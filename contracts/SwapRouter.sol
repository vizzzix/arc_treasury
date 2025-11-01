// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "./interfaces/ISwapRouter.sol";

/**
 * @title SwapRouter
 * @notice Simple DEX router for stablecoin swaps
 * @dev Mock implementation with near-zero slippage for stablecoin pairs
 */
contract SwapRouter is ISwapRouter, Ownable {
    using SafeERC20 for IERC20;

    // Exchange rates (scaled by 1e18)
    // For stablecoins, rates are close to 1:1 with minor fluctuations
    mapping(address => mapping(address => uint256)) public exchangeRates;
    
    uint256 public constant RATE_PRECISION = 1e18;
    uint256 public constant SLIPPAGE_TOLERANCE = 9950; // 0.5% slippage
    uint256 public constant BASIS_POINTS = 10000;

    event Swapped(address indexed tokenIn, address indexed tokenOut, uint256 amountIn, uint256 amountOut, address indexed to);
    event RateUpdated(address indexed tokenIn, address indexed tokenOut, uint256 rate);

    constructor() Ownable(msg.sender) {}

    /**
     * @notice Set exchange rate between two tokens
     * @param tokenIn Input token
     * @param tokenOut Output token
     * @param rate Exchange rate (scaled by 1e18)
     */
    function setExchangeRate(address tokenIn, address tokenOut, uint256 rate) external onlyOwner {
        require(rate > 0, "Rate must be greater than 0");
        exchangeRates[tokenIn][tokenOut] = rate;
        emit RateUpdated(tokenIn, tokenOut, rate);
    }

    /**
     * @inheritdoc ISwapRouter
     */
    function swapExactTokensForTokens(
        address tokenIn,
        address tokenOut,
        uint256 amountIn,
        uint256 amountOutMin,
        address to
    ) external override returns (uint256 amountOut) {
        require(amountIn > 0, "Amount must be greater than 0");
        require(exchangeRates[tokenIn][tokenOut] > 0, "Exchange rate not set");

        // Calculate output amount
        amountOut = getAmountOut(tokenIn, tokenOut, amountIn);
        require(amountOut >= amountOutMin, "Insufficient output amount");

        // Transfer tokens
        IERC20(tokenIn).safeTransferFrom(msg.sender, address(this), amountIn);
        IERC20(tokenOut).safeTransfer(to, amountOut);

        emit Swapped(tokenIn, tokenOut, amountIn, amountOut, to);

        return amountOut;
    }

    /**
     * @inheritdoc ISwapRouter
     */
    function getAmountOut(
        address tokenIn,
        address tokenOut,
        uint256 amountIn
    ) public view override returns (uint256 amountOut) {
        uint256 rate = exchangeRates[tokenIn][tokenOut];
        require(rate > 0, "Exchange rate not set");
        
        // For stablecoins, apply minimal slippage
        amountOut = (amountIn * rate * SLIPPAGE_TOLERANCE) / (RATE_PRECISION * BASIS_POINTS);
        
        return amountOut;
    }

    /**
     * @notice Provide liquidity to the router (for testing)
     * @param token Token address
     * @param amount Amount to provide
     */
    function provideLiquidity(address token, uint256 amount) external {
        IERC20(token).safeTransferFrom(msg.sender, address(this), amount);
    }

    /**
     * @notice Withdraw liquidity (owner only)
     * @param token Token address
     * @param amount Amount to withdraw
     */
    function withdrawLiquidity(address token, uint256 amount) external onlyOwner {
        IERC20(token).safeTransfer(msg.sender, amount);
    }
}

