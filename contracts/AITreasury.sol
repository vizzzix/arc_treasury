// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "./interfaces/ISwapRouter.sol";
import "./interfaces/IYieldAggregator.sol";

/**
 * @title AITreasury
 * @notice Main contract for automated treasury management
 * @dev Manages multi-currency stablecoin portfolios with auto-rebalancing
 */
contract AITreasury is Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    // Structs
    struct Treasury {
        address owner;
        mapping(address => uint256) targetAllocations; // token => percentage (scaled by 100, e.g., 50% = 5000)
        mapping(address => uint256) balances;
        address[] tokens;
        uint256 rebalanceThreshold; // percentage drift before rebalancing (scaled by 100)
        bool autoYield;
        uint256 totalValue;
        uint256 createdAt;
        uint256 lastRebalance;
    }

    struct RebalanceLog {
        address treasury;
        address tokenFrom;
        address tokenTo;
        uint256 amountFrom;
        uint256 amountTo;
        uint256 timestamp;
    }

    // State variables
    mapping(address => Treasury) public treasuries;
    mapping(address => bool) public supportedTokens;
    address[] public supportedTokenList;
    
    ISwapRouter public swapRouter;
    IYieldAggregator public yieldAggregator;
    
    uint256 public constant BASIS_POINTS = 10000;
    uint256 public constant MIN_REBALANCE_THRESHOLD = 100; // 1%
    uint256 public constant MAX_REBALANCE_THRESHOLD = 2000; // 20%
    uint256 public constant REBALANCE_FEE = 30; // 0.3%
    uint256 public constant YIELD_FEE = 1000; // 10%
    uint256 public constant ZERO_FEE_THRESHOLD = 100 * 1e6; // $100 (assuming 6 decimals)

    uint256 public totalValueLocked;
    uint256 public totalTreasuries;
    uint256 public totalYieldGenerated;
    
    RebalanceLog[] public rebalanceHistory;

    // Events
    event TreasuryCreated(address indexed owner, address treasuryAddress);
    event Deposited(address indexed treasury, address indexed token, uint256 amount);
    event Withdrawn(address indexed treasury, address indexed token, uint256 amount);
    event Rebalanced(address indexed treasury, address tokenFrom, address tokenTo, uint256 amountFrom, uint256 amountTo);
    event YieldClaimed(address indexed treasury, uint256 amount);
    event ConfigUpdated(address indexed treasury);

    // Modifiers
    modifier onlyTreasuryOwner(address treasuryAddr) {
        require(treasuries[treasuryAddr].owner == msg.sender, "Not treasury owner");
        _;
    }

    modifier validTreasury(address treasuryAddr) {
        require(treasuries[treasuryAddr].owner != address(0), "Treasury does not exist");
        _;
    }

    constructor(address _swapRouter, address _yieldAggregator) Ownable(msg.sender) {
        swapRouter = ISwapRouter(_swapRouter);
        yieldAggregator = IYieldAggregator(_yieldAggregator);
    }

    /**
     * @notice Create a new treasury
     * @param tokens Array of token addresses
     * @param allocations Array of target allocations (sum must equal 10000)
     * @param rebalanceThreshold Threshold for auto-rebalancing
     * @param autoYield Enable automatic yield farming
     */
    function createTreasury(
        address[] calldata tokens,
        uint256[] calldata allocations,
        uint256 rebalanceThreshold,
        bool autoYield
    ) external returns (address) {
        require(tokens.length > 0 && tokens.length == allocations.length, "Invalid input");
        require(rebalanceThreshold >= MIN_REBALANCE_THRESHOLD && rebalanceThreshold <= MAX_REBALANCE_THRESHOLD, "Invalid threshold");
        
        // Validate allocations sum to 100%
        uint256 totalAllocation;
        for (uint256 i = 0; i < allocations.length; i++) {
            require(supportedTokens[tokens[i]], "Token not supported");
            totalAllocation += allocations[i];
        }
        require(totalAllocation == BASIS_POINTS, "Allocations must sum to 100%");

        address treasuryAddr = address(uint160(uint256(keccak256(abi.encodePacked(msg.sender, block.timestamp, totalTreasuries)))));
        
        Treasury storage newTreasury = treasuries[treasuryAddr];
        newTreasury.owner = msg.sender;
        newTreasury.tokens = tokens;
        newTreasury.rebalanceThreshold = rebalanceThreshold;
        newTreasury.autoYield = autoYield;
        newTreasury.createdAt = block.timestamp;

        for (uint256 i = 0; i < tokens.length; i++) {
            newTreasury.targetAllocations[tokens[i]] = allocations[i];
        }

        totalTreasuries++;
        emit TreasuryCreated(msg.sender, treasuryAddr);
        
        return treasuryAddr;
    }

    /**
     * @notice Deposit tokens into treasury
     * @param treasuryAddr Address of the treasury
     * @param token Token to deposit
     * @param amount Amount to deposit
     */
    function deposit(
        address treasuryAddr,
        address token,
        uint256 amount
    ) external nonReentrant validTreasury(treasuryAddr) onlyTreasuryOwner(treasuryAddr) {
        require(supportedTokens[token], "Token not supported");
        require(amount > 0, "Amount must be greater than 0");

        Treasury storage treasury = treasuries[treasuryAddr];
        require(_isTokenInTreasury(treasury, token), "Token not in treasury allocation");

        IERC20(token).safeTransferFrom(msg.sender, address(this), amount);
        
        treasury.balances[token] += amount;
        treasury.totalValue += amount;
        totalValueLocked += amount;

        // Auto-deploy to yield if enabled
        if (treasury.autoYield) {
            _depositToYield(token, amount);
        }

        emit Deposited(treasuryAddr, token, amount);
        
        // Check if rebalancing is needed
        if (_needsRebalancing(treasuryAddr)) {
            _rebalance(treasuryAddr);
        }
    }

    /**
     * @notice Withdraw tokens from treasury
     * @param treasuryAddr Address of the treasury
     * @param token Token to withdraw
     * @param amount Amount to withdraw
     */
    function withdraw(
        address treasuryAddr,
        address token,
        uint256 amount
    ) external nonReentrant validTreasury(treasuryAddr) onlyTreasuryOwner(treasuryAddr) {
        Treasury storage treasury = treasuries[treasuryAddr];
        require(treasury.balances[token] >= amount, "Insufficient balance");

        // Withdraw from yield if enabled
        if (treasury.autoYield) {
            _withdrawFromYield(token, amount);
        }

        treasury.balances[token] -= amount;
        treasury.totalValue -= amount;
        totalValueLocked -= amount;

        IERC20(token).safeTransfer(msg.sender, amount);

        emit Withdrawn(treasuryAddr, token, amount);
    }

    /**
     * @notice Manually trigger rebalancing
     * @param treasuryAddr Address of the treasury
     */
    function rebalance(address treasuryAddr) external validTreasury(treasuryAddr) onlyTreasuryOwner(treasuryAddr) {
        _rebalance(treasuryAddr);
    }

    /**
     * @notice Check if treasury needs rebalancing
     * @param treasuryAddr Address of the treasury
     * @return needs True if rebalancing is needed
     */
    function needsRebalancing(address treasuryAddr) external view returns (bool needs) {
        return _needsRebalancing(treasuryAddr);
    }

    /**
     * @notice Get treasury details
     * @param treasuryAddr Address of the treasury
     * @return owner Owner address
     * @return tokens Array of token addresses
     * @return totalValue Total value locked
     */
    function getTreasuryDetails(address treasuryAddr) external view returns (
        address owner,
        address[] memory tokens,
        uint256 totalValue
    ) {
        Treasury storage treasury = treasuries[treasuryAddr];
        return (treasury.owner, treasury.tokens, treasury.totalValue);
    }

    /**
     * @notice Get token balance in treasury
     * @param treasuryAddr Address of the treasury
     * @param token Token address
     * @return balance Current balance
     */
    function getTokenBalance(address treasuryAddr, address token) external view returns (uint256 balance) {
        return treasuries[treasuryAddr].balances[token];
    }

    /**
     * @notice Add supported token
     * @param token Token address
     */
    function addSupportedToken(address token) external onlyOwner {
        require(!supportedTokens[token], "Token already supported");
        supportedTokens[token] = true;
        supportedTokenList.push(token);
    }

    /**
     * @notice Update swap router
     * @param _swapRouter New swap router address
     */
    function updateSwapRouter(address _swapRouter) external onlyOwner {
        swapRouter = ISwapRouter(_swapRouter);
    }

    /**
     * @notice Update yield aggregator
     * @param _yieldAggregator New yield aggregator address
     */
    function updateYieldAggregator(address _yieldAggregator) external onlyOwner {
        yieldAggregator = IYieldAggregator(_yieldAggregator);
    }

    // Internal functions
    function _needsRebalancing(address treasuryAddr) internal view returns (bool) {
        Treasury storage treasury = treasuries[treasuryAddr];
        
        if (treasury.totalValue == 0) return false;

        for (uint256 i = 0; i < treasury.tokens.length; i++) {
            address token = treasury.tokens[i];
            uint256 currentAllocation = (treasury.balances[token] * BASIS_POINTS) / treasury.totalValue;
            uint256 targetAllocation = treasury.targetAllocations[token];
            
            uint256 drift = currentAllocation > targetAllocation 
                ? currentAllocation - targetAllocation 
                : targetAllocation - currentAllocation;
            
            if (drift >= treasury.rebalanceThreshold) {
                return true;
            }
        }
        
        return false;
    }

    function _rebalance(address treasuryAddr) internal {
        Treasury storage treasury = treasuries[treasuryAddr];
        
        // Calculate target amounts for each token
        for (uint256 i = 0; i < treasury.tokens.length; i++) {
            address token = treasury.tokens[i];
            uint256 targetAmount = (treasury.totalValue * treasury.targetAllocations[token]) / BASIS_POINTS;
            uint256 currentAmount = treasury.balances[token];
            
            if (currentAmount > targetAmount) {
                // Need to sell this token
                uint256 amountToSwap = currentAmount - targetAmount;
                
                // Find token to buy (one that's below target)
                for (uint256 j = 0; j < treasury.tokens.length; j++) {
                    address buyToken = treasury.tokens[j];
                    if (buyToken != token) {
                        uint256 buyTargetAmount = (treasury.totalValue * treasury.targetAllocations[buyToken]) / BASIS_POINTS;
                        uint256 buyCurrentAmount = treasury.balances[buyToken];
                        
                        if (buyCurrentAmount < buyTargetAmount) {
                            // Perform swap
                            _executeSwap(treasuryAddr, token, buyToken, amountToSwap);
                            break;
                        }
                    }
                }
            }
        }
        
        treasury.lastRebalance = block.timestamp;
    }

    function _executeSwap(
        address treasuryAddr,
        address tokenFrom,
        address tokenTo,
        uint256 amountFrom
    ) internal {
        Treasury storage treasury = treasuries[treasuryAddr];
        
        // Withdraw from yield if needed
        if (treasury.autoYield) {
            _withdrawFromYield(tokenFrom, amountFrom);
        }

        // Approve swap router
        IERC20(tokenFrom).safeIncreaseAllowance(address(swapRouter), amountFrom);
        
        // Execute swap
        uint256 amountOut = swapRouter.swapExactTokensForTokens(
            tokenFrom,
            tokenTo,
            amountFrom,
            0, // In production, calculate proper slippage
            address(this)
        );

        // Calculate and deduct fee
        uint256 fee = 0;
        if (amountFrom > ZERO_FEE_THRESHOLD) {
            fee = (amountOut * REBALANCE_FEE) / BASIS_POINTS;
            amountOut -= fee;
        }

        // Update balances
        treasury.balances[tokenFrom] -= amountFrom;
        treasury.balances[tokenTo] += amountOut;

        // Deposit to yield if enabled
        if (treasury.autoYield) {
            _depositToYield(tokenTo, amountOut);
        }

        // Log rebalance
        rebalanceHistory.push(RebalanceLog({
            treasury: treasuryAddr,
            tokenFrom: tokenFrom,
            tokenTo: tokenTo,
            amountFrom: amountFrom,
            amountTo: amountOut,
            timestamp: block.timestamp
        }));

        emit Rebalanced(treasuryAddr, tokenFrom, tokenTo, amountFrom, amountOut);
    }

    function _depositToYield(address token, uint256 amount) internal {
        IERC20(token).safeIncreaseAllowance(address(yieldAggregator), amount);
        yieldAggregator.deposit(token, amount);
    }

    function _withdrawFromYield(address token, uint256 amount) internal {
        yieldAggregator.withdraw(token, amount);
    }

    function _isTokenInTreasury(Treasury storage treasury, address token) internal view returns (bool) {
        for (uint256 i = 0; i < treasury.tokens.length; i++) {
            if (treasury.tokens[i] == token) {
                return true;
            }
        }
        return false;
    }
}

