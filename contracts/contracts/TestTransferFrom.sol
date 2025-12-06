// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

interface IERC20 {
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
    function balanceOf(address account) external view returns (uint256);
}

contract TestTransferFrom {
    IERC20 public immutable usdc;

    constructor(address _usdc) {
        usdc = IERC20(_usdc);
    }

    function testTransferFrom(address from, uint256 amount) external returns (bool) {
        return usdc.transferFrom(from, address(this), amount);
    }

    function getBalance() external view returns (uint256) {
        return usdc.balanceOf(address(this));
    }
}
