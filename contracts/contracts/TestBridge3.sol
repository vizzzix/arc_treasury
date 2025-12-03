// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

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

/**
 * @title TestBridge3
 * @notice Minimal bridge test without SafeERC20
 */
contract TestBridge3 {
    IERC20 public immutable usdc;
    ITokenMessenger public immutable tokenMessenger;

    event Step(string message);

    constructor(address _usdc, address _tokenMessenger) {
        usdc = IERC20(_usdc);
        tokenMessenger = ITokenMessenger(_tokenMessenger);
        // Approve max
        IERC20(_usdc).approve(_tokenMessenger, type(uint256).max);
    }

    function bridge(uint256 amount, bytes32 recipient) external returns (uint64) {
        emit Step("1. Starting");

        // Use regular transferFrom, not safe
        bool ok = usdc.transferFrom(msg.sender, address(this), amount);
        require(ok, "Transfer failed");
        emit Step("2. Transfer done");

        // Call depositForBurn
        uint64 nonce = tokenMessenger.depositForBurn(
            amount, 26, recipient, address(usdc),
            bytes32(0), 0, 1000
        );
        emit Step("3. depositForBurn done");

        return nonce;
    }
}
