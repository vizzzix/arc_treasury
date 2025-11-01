// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "./interfaces/IYieldAggregator.sol";

/**
 * @title YieldAggregator
 * @notice Aggregates yield from multiple lending protocols
 * @dev Mock implementation for testing
 */
contract YieldAggregator is IYieldAggregator, Ownable {
    using SafeERC20 for IERC20;

    struct UserDeposit {
        uint256 shares;
        uint256 depositTime;
        uint256 principal;
    }

    // Token => User => Deposit info
    mapping(address => mapping(address => UserDeposit)) public deposits;
    
    // Token => Total shares
    mapping(address => uint256) public totalShares;
    
    // Token => APY (scaled by 1e18, e.g., 5% = 5e16)
    mapping(address => uint256) public currentAPY;

    uint256 public constant APY_PRECISION = 1e18;
    uint256 public constant SECONDS_PER_YEAR = 365 days;

    event Deposited(address indexed token, address indexed user, uint256 amount, uint256 shares);
    event Withdrawn(address indexed token, address indexed user, uint256 shares, uint256 amount);
    event APYUpdated(address indexed token, uint256 newAPY);

    constructor() Ownable(msg.sender) {}

    /**
     * @inheritdoc IYieldAggregator
     */
    function deposit(address token, uint256 amount) external override returns (uint256 shares) {
        require(amount > 0, "Amount must be greater than 0");

        IERC20(token).safeTransferFrom(msg.sender, address(this), amount);

        // Calculate shares (1:1 for first deposit)
        if (totalShares[token] == 0) {
            shares = amount;
        } else {
            // Include accrued yield in share calculation
            uint256 totalBalance = IERC20(token).balanceOf(address(this));
            shares = (amount * totalShares[token]) / totalBalance;
        }

        UserDeposit storage userDeposit = deposits[token][msg.sender];
        userDeposit.shares += shares;
        userDeposit.principal += amount;
        
        if (userDeposit.depositTime == 0) {
            userDeposit.depositTime = block.timestamp;
        }

        totalShares[token] += shares;

        emit Deposited(token, msg.sender, amount, shares);

        return shares;
    }

    /**
     * @inheritdoc IYieldAggregator
     */
    function withdraw(address token, uint256 shares) external override returns (uint256 amount) {
        UserDeposit storage userDeposit = deposits[token][msg.sender];
        require(userDeposit.shares >= shares, "Insufficient shares");

        // Calculate amount including yield
        uint256 totalBalance = IERC20(token).balanceOf(address(this));
        amount = (shares * totalBalance) / totalShares[token];

        userDeposit.shares -= shares;
        totalShares[token] -= shares;

        if (userDeposit.shares == 0) {
            delete deposits[token][msg.sender];
        }

        IERC20(token).safeTransfer(msg.sender, amount);

        emit Withdrawn(token, msg.sender, shares, amount);

        return amount;
    }

    /**
     * @inheritdoc IYieldAggregator
     */
    function getCurrentAPY(address token) external view override returns (uint256 apy) {
        return currentAPY[token];
    }

    /**
     * @inheritdoc IYieldAggregator
     */
    function getBalance(address token, address user) external view override returns (uint256 amount) {
        UserDeposit storage userDeposit = deposits[token][user];
        
        if (userDeposit.shares == 0) {
            return 0;
        }

        uint256 totalBalance = IERC20(token).balanceOf(address(this));
        amount = (userDeposit.shares * totalBalance) / totalShares[token];

        return amount;
    }

    /**
     * @notice Set APY for a token (owner only)
     * @param token Token address
     * @param apy APY (scaled by 1e18)
     */
    function setAPY(address token, uint256 apy) external onlyOwner {
        currentAPY[token] = apy;
        emit APYUpdated(token, apy);
    }

    /**
     * @notice Simulate yield generation (owner only, for testing)
     * @param token Token address
     * @param amount Amount of yield to add
     */
    function simulateYield(address token, uint256 amount) external onlyOwner {
        // This simulates protocol-generated yield
        // In production, this would come from actual lending protocols
        require(amount > 0, "Amount must be greater than 0");
    }

    /**
     * @notice Get user's shares
     * @param token Token address
     * @param user User address
     * @return shares User's shares
     */
    function getUserShares(address token, address user) external view returns (uint256 shares) {
        return deposits[token][user].shares;
    }
}

