// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title IYieldAggregator
 * @notice Interface for yield farming integration
 */
interface IYieldAggregator {
    /**
     * @notice Deposit tokens to earn yield
     * @param token Address of token to deposit
     * @param amount Amount to deposit
     * @return shares Amount of shares received
     */
    function deposit(address token, uint256 amount) external returns (uint256 shares);

    /**
     * @notice Withdraw tokens from yield farming
     * @param token Address of token to withdraw
     * @param shares Amount of shares to redeem
     * @return amount Amount of tokens received
     */
    function withdraw(address token, uint256 shares) external returns (uint256 amount);

    /**
     * @notice Get current yield for a token
     * @param token Address of token
     * @return apy Current APY (scaled by 1e18)
     */
    function getCurrentAPY(address token) external view returns (uint256 apy);

    /**
     * @notice Get user's balance in yield protocol
     * @param token Address of token
     * @param user Address of user
     * @return amount Current balance including yield
     */
    function getBalance(address token, address user) external view returns (uint256 amount);
}

