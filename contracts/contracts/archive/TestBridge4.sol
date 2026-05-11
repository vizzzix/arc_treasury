// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

interface ITokenMessengerNoReturn {
    function depositForBurn(
        uint256 amount,
        uint32 destinationDomain,
        bytes32 mintRecipient,
        address burnToken,
        bytes32 destinationCaller,
        uint256 maxFee,
        uint32 minFinalityThreshold
    ) external; // No return value!
}

/**
 * @title TestBridge4
 * @notice Test without expecting return value from depositForBurn
 */
contract TestBridge4 {
    IERC20 public immutable usdc;
    ITokenMessengerNoReturn public immutable tokenMessenger;

    event Done(string message);

    constructor(address _usdc, address _tokenMessenger) {
        usdc = IERC20(_usdc);
        tokenMessenger = ITokenMessengerNoReturn(_tokenMessenger);
        IERC20(_usdc).approve(_tokenMessenger, type(uint256).max);
    }

    function bridge(uint256 amount, bytes32 recipient) external {
        emit Done("Starting");

        bool ok = usdc.transferFrom(msg.sender, address(this), amount);
        require(ok, "Transfer failed");
        emit Done("Transfer done");

        // Call without expecting return value
        tokenMessenger.depositForBurn(
            amount, 26, recipient, address(usdc),
            bytes32(0), 0, 1000
        );
        emit Done("Bridge complete");
    }
}
