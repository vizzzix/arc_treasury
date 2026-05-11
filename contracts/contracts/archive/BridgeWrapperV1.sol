// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title BridgeWrapperV1
 * @notice Uses CCTP V1 signature for depositForBurn (4 params instead of 7)
 */
contract BridgeWrapperV1 is Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;

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

    IERC20 public immutable usdc;
    ITokenMessengerV1 public immutable tokenMessenger;
    uint256 public feeBasisPoints;
    uint256 public constant MAX_FEE_BP = 1000;
    uint32 public constant ARC_DOMAIN = 26;
    uint256 public totalFeesCollected;

    constructor(
        address _usdc,
        address _tokenMessenger,
        uint256 _feeBasisPoints
    ) Ownable(msg.sender) {
        require(_usdc != address(0), "Invalid USDC");
        require(_tokenMessenger != address(0), "Invalid TokenMessenger");
        require(_feeBasisPoints <= MAX_FEE_BP, "Fee too high");

        usdc = IERC20(_usdc);
        tokenMessenger = ITokenMessengerV1(_tokenMessenger);
        feeBasisPoints = _feeBasisPoints;

        // Approve TokenMessenger
        IERC20(_usdc).approve(_tokenMessenger, type(uint256).max);
    }

    function bridgeToArc(
        uint256 amount,
        bytes32 mintRecipient
    ) external nonReentrant returns (uint64 nonce) {
        require(amount > 0, "Amount must be > 0");
        require(mintRecipient != bytes32(0), "Invalid recipient");

        // Calculate fee
        uint256 fee = (amount * feeBasisPoints) / 10000;
        uint256 bridgeAmount = amount - fee;

        // Transfer USDC from user
        usdc.safeTransferFrom(msg.sender, address(this), amount);

        // Track fees
        if (fee > 0) {
            totalFeesCollected += fee;
        }

        // Call CCTP V1 depositForBurn (4 params)
        nonce = tokenMessenger.depositForBurn(
            bridgeAmount,
            ARC_DOMAIN,
            mintRecipient,
            address(usdc)
        );

        emit BridgeInitiated(
            msg.sender,
            bridgeAmount,
            fee,
            ARC_DOMAIN,
            mintRecipient,
            nonce
        );
    }

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
        usdc.safeTransfer(to, balance);
        emit FeesWithdrawn(to, balance);
    }

    function calculateFee(uint256 amount) external view returns (uint256 fee, uint256 bridgeAmount) {
        fee = (amount * feeBasisPoints) / 10000;
        bridgeAmount = amount - fee;
    }

    function addressToBytes32(address addr) external pure returns (bytes32) {
        return bytes32(uint256(uint160(addr)));
    }
}

interface ITokenMessengerV1 {
    function depositForBurn(
        uint256 amount,
        uint32 destinationDomain,
        bytes32 mintRecipient,
        address burnToken
    ) external returns (uint64 nonce);
}
