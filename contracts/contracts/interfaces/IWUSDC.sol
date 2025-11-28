// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * @title IWUSDC
 * @notice Interface for Wrapped USDC on Arc Network
 * @dev Similar to WETH - wraps native USDC to ERC20
 */
interface IWUSDC {
    function deposit() external payable;
    function withdraw(uint256 amount) external;
    function balanceOf(address account) external view returns (uint256);
    function approve(address spender, uint256 amount) external returns (bool);
    function transfer(address to, uint256 amount) external returns (bool);
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
}
