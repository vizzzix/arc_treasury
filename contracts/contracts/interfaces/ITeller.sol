// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * @title ITeller
 * @notice Interface for USYC Teller contract (Circle/Hashnote)
 * @dev Teller provides liquidity for USDC/USYC pair
 *      - deposit/mint: USDC → USYC (subscribe)
 *      - withdraw/redeem: USYC → USDC (redeem)
 */
interface ITeller {
    // ============ Events ============

    event Deposit(address indexed caller, address indexed owner, uint256 assets, uint256 shares);
    event Withdraw(address indexed caller, address indexed receiver, address indexed owner, uint256 assets, uint256 shares);

    // ============ Subscribe Functions (USDC → USYC) ============

    /**
     * @notice Deposits USDC and receives USYC shares
     * @param assets Amount of USDC to deposit (6 decimals)
     * @param receiver Address to receive USYC shares
     * @return shares Amount of USYC shares minted
     * @dev For native USDC, send value with msg.value
     */
    function deposit(uint256 assets, address receiver) external payable returns (uint256 shares);

    /**
     * @notice Mints exact USYC shares by depositing USDC
     * @param shares Amount of USYC shares to mint
     * @param receiver Address to receive USYC shares
     * @return assets Amount of USDC required
     */
    function mint(uint256 shares, address receiver) external returns (uint256 assets);

    // ============ Redeem Functions (USYC → USDC) ============

    /**
     * @notice Withdraws exact USDC amount by burning USYC shares
     * @param assets Amount of USDC to withdraw (6 decimals)
     * @param receiver Address to receive USDC
     * @param owner Address that owns the USYC shares
     * @return shares Amount of USYC shares burned
     */
    function withdraw(uint256 assets, address receiver, address owner) external returns (uint256 shares);

    /**
     * @notice Redeems USYC shares for USDC
     * @param shares Amount of USYC shares to redeem
     * @param receiver Address to receive USDC
     * @param owner Address that owns the USYC shares
     * @return assets Amount of USDC received
     */
    function redeem(uint256 shares, address receiver, address owner) external returns (uint256 assets);

    // ============ View Functions ============

    /**
     * @notice Returns the USDC token address
     */
    function asset() external view returns (address);

    /**
     * @notice Returns the USYC token address
     */
    function share() external view returns (address);

    /**
     * @notice Returns total USDC available for redemptions
     */
    function totalAssets() external view returns (uint256);

    /**
     * @notice Converts USDC amount to USYC shares
     * @param assets Amount of USDC
     * @return shares Equivalent USYC shares
     */
    function convertToShares(uint256 assets) external view returns (uint256 shares);

    /**
     * @notice Converts USYC shares to USDC amount
     * @param shares Amount of USYC shares
     * @return assets Equivalent USDC amount
     */
    function convertToAssets(uint256 shares) external view returns (uint256 assets);

    /**
     * @notice Preview deposit - returns shares for given assets
     * @param assets Amount of USDC to deposit
     * @return shares Amount of USYC shares to receive
     */
    function previewDeposit(uint256 assets) external view returns (uint256 shares);

    /**
     * @notice Preview mint - returns assets needed for given shares
     * @param shares Amount of USYC shares to mint
     * @return assets Amount of USDC required
     */
    function previewMint(uint256 shares) external view returns (uint256 assets);

    /**
     * @notice Preview withdraw - returns shares needed for given assets
     * @param assets Amount of USDC to withdraw
     * @return shares Amount of USYC shares to burn
     */
    function previewWithdraw(uint256 assets) external view returns (uint256 shares);

    /**
     * @notice Preview redeem - returns assets for given shares
     * @param shares Amount of USYC shares to redeem
     * @return assets Amount of USDC to receive
     */
    function previewRedeem(uint256 shares) external view returns (uint256 assets);

    /**
     * @notice Returns max deposit amount for account
     * @param account Address to check
     * @return maxAssets Maximum USDC that can be deposited
     */
    function maxDeposit(address account) external view returns (uint256 maxAssets);

    /**
     * @notice Returns max mint amount for account
     * @param account Address to check
     * @return maxShares Maximum USYC shares that can be minted
     */
    function maxMint(address account) external view returns (uint256 maxShares);

    /**
     * @notice Returns max withdraw amount for account
     * @param account Address to check
     * @return maxAssets Maximum USDC that can be withdrawn
     */
    function maxWithdraw(address account) external view returns (uint256 maxAssets);

    /**
     * @notice Returns max redeem amount for account
     * @param account Address to check
     * @return maxShares Maximum USYC shares that can be redeemed
     */
    function maxRedeem(address account) external view returns (uint256 maxShares);
}
