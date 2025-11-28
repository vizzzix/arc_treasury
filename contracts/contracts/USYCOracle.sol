// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/Ownable.sol";
import "./interfaces/IUSYCOracle.sol";

/**
 * @title USYCOracle
 * @notice Simple oracle for USYC price (NAV) in USDC
 * @dev
 *  - Price is updated off-chain via Circle / Hashnote NAV API.
 *  - Enforces:
 *      * minimum update interval,
 *      * max stale time,
 *      * max price drift per update.
 *  - For production, consider using a more robust oracle (Chainlink / multi-sig feed).
 */
contract USYCOracle is IUSYCOracle, Ownable {
    /// @notice Current USYC price in USDC (with 6 decimals)
    uint256 private usycPrice;

    /// @notice Timestamp of last update
    uint256 public lastUpdateTime;

    /// @notice Authorized price updater (off-chain service / keeper)
    address public priceUpdater;

    /// @notice Minimum time between updates (1 hour)
    uint256 public constant MIN_UPDATE_INTERVAL = 3600;

    /// @notice Maximum time before price is considered stale (24 hours)
    uint256 public constant MAX_STALE_TIME = 86400;

    /// @notice Maximum price drift per update (5% = 500 basis points)
    uint256 public constant MAX_PRICE_DRIFT_BPS = 500;

    /// @notice Whether oracle is paused
    bool public paused;

    event PriceUpdated(uint256 oldPrice, uint256 newPrice, uint256 timestamp);
    event UpdaterUpdated(address indexed oldUpdater, address indexed newUpdater);
    event Paused(address account);
    event Unpaused(address account);

    // ============ Modifiers ============

    modifier onlyUpdaterOrOwner() {
        require(
            msg.sender == priceUpdater || msg.sender == owner(),
            "Unauthorized"
        );
        _;
    }

    constructor(address _priceUpdater, uint256 _initialPrice) Ownable(msg.sender) {
        require(_priceUpdater != address(0), "Invalid updater");
        require(_initialPrice > 0, "Invalid price");

        priceUpdater = _priceUpdater;
        usycPrice = _initialPrice;
        lastUpdateTime = block.timestamp;
    }

    /**
     * @notice Gets the current USYC price for on-chain consumers
     * @return Price of 1 USYC in USDC (with 6 decimals)
     * @dev
     *  - Reverts if oracle is paused.
     *  - Reverts if price is stale (older than MAX_STALE_TIME).
     *  Use this in other contracts where stale/paused prices are unacceptable.
     */
    function getUSYCPrice() external view override returns (uint256) {
        require(!paused, "Oracle paused");
        require(
            block.timestamp <= lastUpdateTime + MAX_STALE_TIME,
            "Price stale"
        );
        return usycPrice;
    }

    /**
     * @notice Returns raw price + metadata for frontend / off-chain consumers
     * @dev Does NOT revert on stale/paused, instead returns flags.
     */
    function getUSYCPriceInfo()
        external
        view
        returns (
            uint256 price,
            uint256 lastUpdated,
            bool isPaused,
            bool isStale
        )
    {
        price = usycPrice;
        lastUpdated = lastUpdateTime;
        isPaused = paused;
        isStale = (block.timestamp > lastUpdateTime + MAX_STALE_TIME);
    }

    /**
     * @notice Updates the USYC price
     * @param newPrice New price in USDC (with 6 decimals)
     * @dev
     *  - Callable by priceUpdater or owner.
     *  - Enforces minimum update interval.
     *  - Enforces maximum price drift (up or down) to prevent manipulation.
     */
    function updatePrice(uint256 newPrice) external override onlyUpdaterOrOwner {
        require(newPrice > 0, "Invalid price");
        require(
            block.timestamp >= lastUpdateTime + MIN_UPDATE_INTERVAL,
            "Update too soon"
        );

        uint256 oldPrice = usycPrice;

        // Check price drift (only if not first update)
        if (oldPrice > 0) {
            uint256 priceChange;
            if (newPrice > oldPrice) {
                priceChange = ((newPrice - oldPrice) * 10000) / oldPrice;
            } else {
                priceChange = ((oldPrice - newPrice) * 10000) / oldPrice;
            }
            require(
                priceChange <= MAX_PRICE_DRIFT_BPS,
                "Price drift too large"
            );
        }

        usycPrice = newPrice;
        lastUpdateTime = block.timestamp;

        emit PriceUpdated(oldPrice, newPrice, block.timestamp);
    }

    /**
     * @notice Updates the price updater address
     * @param newUpdater New updater address
     * @dev Updater is typically an off-chain service / keeper controlled by the team.
     */
    function setPriceUpdater(address newUpdater) external onlyOwner {
        require(newUpdater != address(0), "Invalid address");

        address oldUpdater = priceUpdater;
        priceUpdater = newUpdater;

        emit UpdaterUpdated(oldUpdater, newUpdater);
    }

    /**
     * @notice Pauses the oracle (emergency stop)
     * @dev Prevents price reads via getUSYCPrice() when paused
     */
    function pause() external onlyOwner {
        paused = true;
        emit Paused(msg.sender);
    }

    /**
     * @notice Unpauses the oracle
     */
    function unpause() external onlyOwner {
        paused = false;
        emit Unpaused(msg.sender);
    }
}
