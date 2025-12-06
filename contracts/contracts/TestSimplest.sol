// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

interface IERC20 {
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
    function balanceOf(address account) external view returns (uint256);
}

contract TestSimplest {
    IERC20 public immutable usdc;

    event Started(uint256 balance);
    event Done(bool success, uint256 newBalance);

    constructor(address _usdc) {
        usdc = IERC20(_usdc);
    }

    function test(uint256 amount) external {
        emit Started(usdc.balanceOf(address(this)));
        bool success = usdc.transferFrom(msg.sender, address(this), amount);
        emit Done(success, usdc.balanceOf(address(this)));
    }
}
