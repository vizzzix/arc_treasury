// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/**
 * @title IUSYC
 * @notice Interface for USYC token contract
 * @dev USYC is a yield-bearing token issued by Circle International Bermuda Ltd.
 *      Yield accrues via token price appreciation rather than balance changes.
 *      Extends IERC20 to include standard ERC20 functions.
 */
interface IUSYC is IERC20 {
    /**
     * @notice Mints USYC tokens (only for allowlisted addresses)
     * @param amount Amount of USDC to convert to USYC
     * @return Amount of USYC tokens minted
     */
    function mint(uint256 amount) external returns (uint256);

    /**
     * @notice Redeems USYC tokens back to USDC
     * @param amount Amount of USYC tokens to redeem
     * @return Amount of USDC received
     */
    function redeem(uint256 amount) external returns (uint256);

    /**
     * @notice Gets the current price/NAV of USYC in USDC
     * @return Price of 1 USYC token in USDC (with 6 decimals)
     */
    function getPrice() external view returns (uint256);

    /**
     * @notice Gets the number of decimals for USYC token
     * @return Number of decimals (typically 6)
     */
    function decimals() external view returns (uint8);
}

