// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/**
 * @title TestSimple
 * @notice Super simple test - just transfer and emit
 */
contract TestSimple {
    IERC20 public immutable usdc;

    event TestEvent(string message, uint256 value);

    constructor(address _usdc) {
        usdc = IERC20(_usdc);
    }

    function testTransfer(uint256 amount) external {
        emit TestEvent("Starting", amount);

        // Just do transferFrom and nothing else
        bool success = usdc.transferFrom(msg.sender, address(this), amount);
        require(success, "Transfer failed");

        emit TestEvent("Transfer success", usdc.balanceOf(address(this)));
    }
}
