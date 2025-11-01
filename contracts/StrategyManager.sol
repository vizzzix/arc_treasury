// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title StrategyManager
 * @notice Manages preset treasury strategies (Conservative, Balanced, Aggressive)
 */
contract StrategyManager is Ownable {
    
    struct Strategy {
        string name;
        string description;
        mapping(address => uint256) allocations; // token => percentage
        address[] tokens;
        uint256 rebalanceThreshold;
        bool autoYield;
        bool active;
    }

    mapping(string => Strategy) public strategies;
    string[] public strategyNames;

    event StrategyCreated(string indexed name);
    event StrategyUpdated(string indexed name);
    event StrategyDeactivated(string indexed name);

    constructor() Ownable(msg.sender) {}

    /**
     * @notice Create a new strategy template
     * @param name Strategy name
     * @param description Strategy description
     * @param tokens Array of token addresses
     * @param allocations Array of allocations (sum must equal 10000)
     * @param rebalanceThreshold Rebalance threshold
     * @param autoYield Enable auto-yield
     */
    function createStrategy(
        string memory name,
        string memory description,
        address[] memory tokens,
        uint256[] memory allocations,
        uint256 rebalanceThreshold,
        bool autoYield
    ) external onlyOwner {
        require(bytes(name).length > 0, "Name cannot be empty");
        require(tokens.length > 0 && tokens.length == allocations.length, "Invalid input");
        require(!strategies[name].active, "Strategy already exists");

        uint256 totalAllocation;
        for (uint256 i = 0; i < allocations.length; i++) {
            totalAllocation += allocations[i];
        }
        require(totalAllocation == 10000, "Allocations must sum to 100%");

        Strategy storage newStrategy = strategies[name];
        newStrategy.name = name;
        newStrategy.description = description;
        newStrategy.tokens = tokens;
        newStrategy.rebalanceThreshold = rebalanceThreshold;
        newStrategy.autoYield = autoYield;
        newStrategy.active = true;

        for (uint256 i = 0; i < tokens.length; i++) {
            newStrategy.allocations[tokens[i]] = allocations[i];
        }

        strategyNames.push(name);

        emit StrategyCreated(name);
    }

    /**
     * @notice Get strategy details
     * @param name Strategy name
     * @return description Strategy description
     * @return tokens Array of token addresses
     * @return allocations Array of allocations
     * @return rebalanceThreshold Rebalance threshold
     * @return autoYield Auto-yield enabled
     */
    function getStrategy(string memory name) external view returns (
        string memory description,
        address[] memory tokens,
        uint256[] memory allocations,
        uint256 rebalanceThreshold,
        bool autoYield
    ) {
        Strategy storage strategy = strategies[name];
        require(strategy.active, "Strategy does not exist");

        allocations = new uint256[](strategy.tokens.length);
        for (uint256 i = 0; i < strategy.tokens.length; i++) {
            allocations[i] = strategy.allocations[strategy.tokens[i]];
        }

        return (
            strategy.description,
            strategy.tokens,
            allocations,
            strategy.rebalanceThreshold,
            strategy.autoYield
        );
    }

    /**
     * @notice Get all strategy names
     * @return names Array of strategy names
     */
    function getAllStrategyNames() external view returns (string[] memory names) {
        return strategyNames;
    }

    /**
     * @notice Deactivate a strategy
     * @param name Strategy name
     */
    function deactivateStrategy(string memory name) external onlyOwner {
        require(strategies[name].active, "Strategy does not exist");
        strategies[name].active = false;
        emit StrategyDeactivated(name);
    }
}

