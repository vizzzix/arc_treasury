// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title BridgeWrapperV3
 * @notice Wrapper for Circle CCTP on Arc Testnet with fee collection
 * @dev On Arc, TokenMessenger.depositForBurn() may not return nonce properly
 *      so we don't capture the return value to avoid ABI decoding issues
 */
contract BridgeWrapperV3 is Ownable, ReentrancyGuard {
    // ============ Events ============

    event BridgeInitiated(
        address indexed user,
        uint256 amount,
        uint256 fee,
        uint32 destinationDomain,
        bytes32 mintRecipient
    );

    event FeeUpdated(uint256 oldFee, uint256 newFee);
    event FeesWithdrawn(address indexed to, uint256 amount);

    // ============ State ============

    IERC20 public immutable usdc;
    ITokenMessenger public immutable tokenMessenger;
    uint256 public feeBasisPoints;
    uint256 public constant MAX_FEE_BP = 1000;
    uint32 public constant SEPOLIA_DOMAIN = 0;
    uint256 public totalFeesCollected;

    // ============ Constructor ============

    constructor(
        address _usdc,
        address _tokenMessenger,
        uint256 _feeBasisPoints
    ) Ownable(msg.sender) {
        require(_usdc != address(0), "Invalid USDC");
        require(_tokenMessenger != address(0), "Invalid TokenMessenger");
        require(_feeBasisPoints <= MAX_FEE_BP, "Fee too high");

        usdc = IERC20(_usdc);
        tokenMessenger = ITokenMessenger(_tokenMessenger);
        feeBasisPoints = _feeBasisPoints;
    }

    // ============ Bridge ============

    /**
     * @notice Bridge USDC to Sepolia via CCTP
     * @param amount Amount in 6 decimals
     * @param mintRecipient Recipient on Sepolia (bytes32)
     */
    function bridgeToSepolia(
        uint256 amount,
        bytes32 mintRecipient
    ) external nonReentrant {
        require(amount > 0, "Amount must be > 0");
        require(mintRecipient != bytes32(0), "Invalid recipient");

        // Calculate fee
        uint256 fee = (amount * feeBasisPoints) / 10000;
        uint256 bridgeAmount = amount - fee;

        // Transfer from user
        bool success = usdc.transferFrom(msg.sender, address(this), amount);
        require(success, "Transfer failed");

        // Track fee
        if (fee > 0) {
            totalFeesCollected += fee;
        }

        // Approve TokenMessenger
        usdc.approve(address(tokenMessenger), bridgeAmount);

        // Call depositForBurn WITHOUT capturing return value
        // This avoids ABI decoding issues with Arc's implementation
        tokenMessenger.depositForBurn(
            bridgeAmount,
            SEPOLIA_DOMAIN,
            mintRecipient,
            address(usdc),
            bytes32(0),
            0,
            1000
        );

        emit BridgeInitiated(
            msg.sender,
            bridgeAmount,
            fee,
            SEPOLIA_DOMAIN,
            mintRecipient
        );
    }

    // ============ Admin ============

    function setFee(uint256 newFeeBasisPoints) external onlyOwner {
        require(newFeeBasisPoints <= MAX_FEE_BP, "Fee too high");
        uint256 oldFee = feeBasisPoints;
        feeBasisPoints = newFeeBasisPoints;
        emit FeeUpdated(oldFee, newFeeBasisPoints);
    }

    function withdrawFees(address to) external onlyOwner {
        require(to != address(0), "Invalid address");
        uint256 balance = usdc.balanceOf(address(this));
        require(balance > 0, "No fees");
        bool success = usdc.transfer(to, balance);
        require(success, "Transfer failed");
        emit FeesWithdrawn(to, balance);
    }

    // ============ View ============

    function calculateFee(uint256 amount) external view returns (uint256 fee, uint256 bridgeAmount) {
        fee = (amount * feeBasisPoints) / 10000;
        bridgeAmount = amount - fee;
    }

    function addressToBytes32(address addr) external pure returns (bytes32) {
        return bytes32(uint256(uint160(addr)));
    }
}

// ============ Interfaces ============

interface IERC20 {
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
    function transfer(address to, uint256 amount) external returns (bool);
    function approve(address spender, uint256 amount) external returns (bool);
    function balanceOf(address account) external view returns (uint256);
}

// Note: We DON'T specify return type for depositForBurn
// to avoid ABI decoding issues
interface ITokenMessenger {
    function depositForBurn(
        uint256 amount,
        uint32 destinationDomain,
        bytes32 mintRecipient,
        address burnToken,
        bytes32 destinationCaller,
        uint256 maxFee,
        uint32 minFinalityThreshold
    ) external; // NO return type!
}
