// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title BridgeWrapper
 * @notice Wrapper contract for Circle CCTP that enables tracking and optional fees
 * @dev Users approve and call this contract instead of CCTP directly.
 *      This allows tracking which bridges came through our UI.
 *
 * Flow:
 * 1. User approves USDC to this contract
 * 2. User calls bridgeToSepolia() with amount
 * 3. Contract takes fee (if any), approves CCTP, calls depositForBurn
 * 4. Emits BridgeInitiated event for tracking
 */
contract BridgeWrapper is Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;

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

    /// @notice USDC token on Arc Testnet (ERC20 interface uses 6 decimals)
    IERC20 public immutable usdc;

    /// @notice Circle TokenMessenger for CCTP
    ITokenMessenger public immutable tokenMessenger;

    /// @notice Fee in basis points (100 = 1%, 5 = 0.05%)
    uint256 public feeBasisPoints;

    /// @notice Maximum fee (10% = 1000 basis points)
    uint256 public constant MAX_FEE_BP = 1000;

    /// @notice Sepolia domain ID for CCTP
    uint32 public constant SEPOLIA_DOMAIN = 0;

    /// @notice Total fees collected (for transparency)
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
     * @param amount Amount of USDC to bridge (before fee)
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

        // Transfer USDC from user to this contract
        usdc.safeTransferFrom(msg.sender, address(this), amount);

        // Track fees
        if (fee > 0) {
            totalFeesCollected += fee;
        }

        // Approve TokenMessenger to spend bridgeAmount
        usdc.approve(address(tokenMessenger), bridgeAmount);

        // Call CCTP depositForBurn (V2 signature)
        // destinationCaller = bytes32(0) means anyone can call receiveMessage
        // maxFee = 0 for testnet (no relayer fees)
        // minFinalityThreshold = 1000 for fast finality
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

    /**
     * @notice Bridge USDC to a custom destination domain
     * @param amount Amount of USDC to bridge (before fee)
     * @param destinationDomain CCTP domain ID of destination chain
     * @param mintRecipient Recipient address on destination (as bytes32)
     * @return nonce The CCTP nonce for this transfer
     */
    function bridge(
        uint256 amount,
        uint32 destinationDomain,
        bytes32 mintRecipient
    ) external nonReentrant returns (uint64 nonce) {
        require(amount > 0, "Amount must be > 0");
        require(mintRecipient != bytes32(0), "Invalid recipient");

        // Calculate fee
        uint256 fee = (amount * feeBasisPoints) / 10000;
        uint256 bridgeAmount = amount - fee;

        // Transfer USDC from user to this contract
        usdc.safeTransferFrom(msg.sender, address(this), amount);

        // Track fees
        if (fee > 0) {
            totalFeesCollected += fee;
        }

        // Approve TokenMessenger
        usdc.approve(address(tokenMessenger), bridgeAmount);

        // Call CCTP depositForBurn
        nonce = tokenMessenger.depositForBurn(
            bridgeAmount,
            destinationDomain,
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
            destinationDomain,
            mintRecipient,
            nonce
        );

        return nonce;
    }

    // ============ Admin Functions ============

    /**
     * @notice Update the fee (in basis points)
     * @param newFeeBasisPoints New fee (e.g., 5 = 0.05%, 50 = 0.5%)
     */
    function setFee(uint256 newFeeBasisPoints) external onlyOwner {
        require(newFeeBasisPoints <= MAX_FEE_BP, "Fee too high");
        uint256 oldFee = feeBasisPoints;
        feeBasisPoints = newFeeBasisPoints;
        emit FeeUpdated(oldFee, newFeeBasisPoints);
    }

    /**
     * @notice Withdraw accumulated fees
     * @param to Address to send fees to
     */
    function withdrawFees(address to) external onlyOwner {
        require(to != address(0), "Invalid address");
        uint256 balance = usdc.balanceOf(address(this));
        require(balance > 0, "No fees to withdraw");

        usdc.safeTransfer(to, balance);
        emit FeesWithdrawn(to, balance);
    }

    // ============ View Functions ============

    /**
     * @notice Calculate fee for a given amount
     * @param amount Amount to bridge
     * @return fee The fee that would be charged
     * @return bridgeAmount The amount that would actually be bridged
     */
    function calculateFee(uint256 amount) external view returns (uint256 fee, uint256 bridgeAmount) {
        fee = (amount * feeBasisPoints) / 10000;
        bridgeAmount = amount - fee;
    }

    /**
     * @notice Helper to convert address to bytes32 (for mintRecipient)
     */
    function addressToBytes32(address addr) external pure returns (bytes32) {
        return bytes32(uint256(uint160(addr)));
    }
}

// ============ Interface ============

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
