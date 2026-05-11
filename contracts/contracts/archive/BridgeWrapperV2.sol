// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title BridgeWrapperV2
 * @notice Wrapper for Circle CCTP on Arc Testnet - uses standard ERC20 calls
 * @dev Arc USDC precompile may not work with SafeERC20, so we use direct calls
 */
contract BridgeWrapperV2 is Ownable, ReentrancyGuard {
    // ============ Events ============

    event BridgeInitiated(
        address indexed user,
        uint256 amount,
        uint256 fee,
        uint32 destinationDomain,
        bytes32 mintRecipient,
        uint64 nonce
    );

    event FeeUpdated(uint256 oldFee, uint256 newFee);
    event FeesWithdrawn(address indexed to, uint256 amount);

    // ============ State ============

    /// @notice USDC token on Arc (ERC20 interface, 6 decimals)
    IERC20 public immutable usdc;

    /// @notice Circle TokenMessenger for CCTP
    ITokenMessenger public immutable tokenMessenger;

    /// @notice Fee in basis points (100 = 1%, 5 = 0.05%)
    uint256 public feeBasisPoints;

    /// @notice Maximum fee (10% = 1000 basis points)
    uint256 public constant MAX_FEE_BP = 1000;

    /// @notice Sepolia domain ID for CCTP
    uint32 public constant SEPOLIA_DOMAIN = 0;

    /// @notice Total fees collected
    uint256 public totalFeesCollected;

    // ============ Constructor ============

    constructor(
        address _usdc,
        address _tokenMessenger,
        uint256 _feeBasisPoints
    ) Ownable(msg.sender) {
        require(_usdc != address(0), "Invalid USDC address");
        require(_tokenMessenger != address(0), "Invalid TokenMessenger address");
        require(_feeBasisPoints <= MAX_FEE_BP, "Fee too high");

        usdc = IERC20(_usdc);
        tokenMessenger = ITokenMessenger(_tokenMessenger);
        feeBasisPoints = _feeBasisPoints;
    }

    // ============ External Functions ============

    /**
     * @notice Bridge USDC to Ethereum Sepolia via Circle CCTP
     * @param amount Amount of USDC to bridge (6 decimals)
     * @param mintRecipient Recipient address on Sepolia (as bytes32)
     * @return nonce The CCTP nonce for this transfer
     */
    function bridgeToSepolia(
        uint256 amount,
        bytes32 mintRecipient
    ) external nonReentrant returns (uint64 nonce) {
        require(amount > 0, "Amount must be > 0");
        require(mintRecipient != bytes32(0), "Invalid recipient");

        // Calculate fee
        uint256 fee = (amount * feeBasisPoints) / 10000;
        uint256 bridgeAmount = amount - fee;

        // Transfer USDC from user to this contract (direct call, not SafeERC20)
        bool success = usdc.transferFrom(msg.sender, address(this), amount);
        require(success, "Transfer failed");

        // Track fees
        if (fee > 0) {
            totalFeesCollected += fee;
        }

        // Approve TokenMessenger to spend bridgeAmount
        usdc.approve(address(tokenMessenger), bridgeAmount);

        // Call CCTP depositForBurn
        nonce = tokenMessenger.depositForBurn(
            bridgeAmount,
            SEPOLIA_DOMAIN,
            mintRecipient,
            address(usdc),
            bytes32(0), // destinationCaller - anyone can claim
            0,          // maxFee - no relayer fee on testnet
            1000        // minFinalityThreshold - fast
        );

        emit BridgeInitiated(
            msg.sender,
            bridgeAmount,
            fee,
            SEPOLIA_DOMAIN,
            mintRecipient,
            nonce
        );

        return nonce;
    }

    // ============ Admin Functions ============

    function setFee(uint256 newFeeBasisPoints) external onlyOwner {
        require(newFeeBasisPoints <= MAX_FEE_BP, "Fee too high");
        uint256 oldFee = feeBasisPoints;
        feeBasisPoints = newFeeBasisPoints;
        emit FeeUpdated(oldFee, newFeeBasisPoints);
    }

    function withdrawFees(address to) external onlyOwner {
        require(to != address(0), "Invalid address");
        uint256 balance = usdc.balanceOf(address(this));
        require(balance > 0, "No fees to withdraw");
        bool success = usdc.transfer(to, balance);
        require(success, "Transfer failed");
        emit FeesWithdrawn(to, balance);
    }

    // ============ View Functions ============

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

interface ITokenMessenger {
    function depositForBurn(
        uint256 amount,
        uint32 destinationDomain,
        bytes32 mintRecipient,
        address burnToken,
        bytes32 destinationCaller,
        uint256 maxFee,
        uint32 minFinalityThreshold
    ) external returns (uint64 nonce);
}
