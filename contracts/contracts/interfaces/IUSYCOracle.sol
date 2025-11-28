// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * @title IUSYCOracle
 * @notice Interface for USYC price oracle
 * @dev Oracle provides current NAV/price of USYC in USDC
 *      Price is updated offchain via Circle NAV API and stored onchain
 */
interface IUSYCOracle {
    /**
     * @notice Gets the current price of USYC in USDC
     * @return Price of 1 USYC token in USDC (with 6 decimals, same as USDC)
     */
    function getUSYCPrice() external view returns (uint256);

    /**
     * @notice Updates the USYC price (only callable by authorized updater)
     * @param newPrice New price of USYC in USDC (with 6 decimals)
     */
    function updatePrice(uint256 newPrice) external;

    /**
     * @notice Gets the timestamp of the last price update
     * @return Timestamp of last update
     */
    function lastUpdateTime() external view returns (uint256);
}

