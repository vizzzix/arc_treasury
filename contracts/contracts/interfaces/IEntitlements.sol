// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * @title IEntitlements
 * @notice Interface for Entitlements contract that manages USYC allowlist
 * @dev Contract address on Arc Testnet: 0xcc205224862c7641930c87679e98999d23c26113
 */
interface IEntitlements {
    /**
     * @notice Checks if an address is entitled (allowlisted) for USYC
     * @param account Address to check
     * @return true if address is allowlisted, false otherwise
     */
    function isEntitled(address account) external view returns (bool);
}

