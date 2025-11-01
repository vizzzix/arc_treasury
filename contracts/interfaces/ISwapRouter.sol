// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title ISwapRouter
 * @notice Interface for DEX swap operations
 */
interface ISwapRouter {
    /**
     * @notice Swap exact amount of tokenIn for tokenOut
     * @param tokenIn Address of input token
     * @param tokenOut Address of output token
     * @param amountIn Amount of input token
     * @param amountOutMin Minimum amount of output token
     * @param to Recipient address
     * @return amountOut Actual amount of output token received
     */
    function swapExactTokensForTokens(
        address tokenIn,
        address tokenOut,
        uint256 amountIn,
        uint256 amountOutMin,
        address to
    ) external returns (uint256 amountOut);

    /**
     * @notice Get expected output amount for swap
     * @param tokenIn Address of input token
     * @param tokenOut Address of output token
     * @param amountIn Amount of input token
     * @return amountOut Expected amount of output token
     */
    function getAmountOut(
        address tokenIn,
        address tokenOut,
        uint256 amountIn
    ) external view returns (uint256 amountOut);
}

