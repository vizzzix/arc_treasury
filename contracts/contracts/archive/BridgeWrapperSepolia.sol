// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title BridgeWrapperSepolia
 * @notice Wrapper contract for Circle CCTP on Sepolia that enables tracking and fees
 * @dev Deployed on Ethereum Sepolia. Bridges USDC from Sepolia to Arc Testnet.
 *
 * Flow:
 * 1. User approves USDC to this contract
 * 2. User calls bridgeToArc() with amount
 * 3. Contract takes fee (0.05%), approves CCTP, calls depositForBurn
 * 4. Emits BridgeInitiated event for tracking
 */
contract BridgeWrapperSepolia is Ownable, ReentrancyGuard {
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

    /// @notice USDC token on Sepolia (6 decimals)
    IERC20 public immutable usdc;

    /// @notice Circle TokenMessenger for CCTP V2 on Sepolia
    ITokenMessenger public immutable tokenMessenger;

    /// @notice Circle TokenMinter - we need to approve this for burn
    address public immutable tokenMinter;

    /// @notice Fee in basis points (100 = 1%, 5 = 0.05%)
    uint256 public feeBasisPoints;

    /// @notice Maximum fee (10% = 1000 basis points)
    uint256 public constant MAX_FEE_BP = 1000;

    /// @notice Arc Testnet domain ID for CCTP
    uint32 public constant ARC_DOMAIN = 26;

    /// @notice CCTP fee rate in basis points (from Circle API: minimumFee = 1 bps for fast transfers)
    /// @dev This is the Circle CCTP fee, not our wrapper fee. Used to calculate maxFee dynamically.
    uint256 public constant CCTP_FEE_BPS = 1;

    /// @notice Total fees collected (for transparency)
    uint256 public totalFeesCollected;

    // ============ Constructor ============

    constructor(
        address _usdc,
        address _tokenMessenger,
        address _tokenMinter,
        uint256 _feeBasisPoints
    ) Ownable(msg.sender) {
        require(_usdc != address(0), "Invalid USDC address");
        require(_tokenMessenger != address(0), "Invalid TokenMessenger address");
        require(_tokenMinter != address(0), "Invalid TokenMinter address");
        require(_feeBasisPoints <= MAX_FEE_BP, "Fee too high");

        usdc = IERC20(_usdc);
        tokenMessenger = ITokenMessenger(_tokenMessenger);
        tokenMinter = _tokenMinter;
        feeBasisPoints = _feeBasisPoints;

        // Pre-approve TokenMessenger for max amount
        // TokenMessenger.depositForBurn() transfers USDC from this contract to localMinter
        IERC20(_usdc).approve(_tokenMessenger, type(uint256).max);
    }

    // ============ External Functions ============

    /**
     * @notice Bridge USDC to Arc Testnet via Circle CCTP
     * @param amount Amount of USDC to bridge (before fee)
     * @param mintRecipient Recipient address on Arc (as bytes32)
     */
    function bridgeToArc(
        uint256 amount,
        bytes32 mintRecipient
    ) external nonReentrant {
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

        // Calculate maxFee dynamically based on amount (Circle SDK formula)
        // baseFee = ceiling((amount * CCTP_FEE_BPS) / 10000)
        // maxFee = baseFee + 10% buffer
        uint256 baseFee = (bridgeAmount * CCTP_FEE_BPS + 9999) / 10000;
        uint256 maxFee = baseFee + baseFee / 10; // +10% buffer
        // Minimum maxFee of 100 (0.0001 USDC) to handle tiny amounts
        if (maxFee < 100) maxFee = 100;

        // Call CCTP depositForBurn (V2 signature)
        // Note: We don't capture the return value due to proxy compatibility issues
        // destinationCaller = bytes32(0) means anyone can call receiveMessage
        // minFinalityThreshold = 1000 for fast finality
        tokenMessenger.depositForBurn(
            bridgeAmount,
            ARC_DOMAIN,
            mintRecipient,
            address(usdc),
            bytes32(0), // destinationCaller - anyone can claim
            maxFee,     // Dynamic maxFee based on amount
            1000        // minFinalityThreshold - fast
        );

        emit BridgeInitiated(
            msg.sender,
            bridgeAmount,
            fee,
            ARC_DOMAIN,
            mintRecipient,
            0 // nonce not captured due to proxy issues
        );
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
    // Note: The actual function returns uint64 nonce, but we don't capture it
    // due to proxy compatibility issues with return value decoding
    function depositForBurn(
        uint256 amount,
        uint32 destinationDomain,
        bytes32 mintRecipient,
        address burnToken,
        bytes32 destinationCaller,
        uint256 maxFee,
        uint32 minFinalityThreshold
    ) external;
}
