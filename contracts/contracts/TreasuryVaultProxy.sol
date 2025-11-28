// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";

/**
 * @title TreasuryVaultProxy
 * @notice ERC1967 Proxy for TreasuryVaultV5
 * @dev Deploy this with implementation address and initialize calldata
 */
contract TreasuryVaultProxy is ERC1967Proxy {
    constructor(address implementation, bytes memory data) ERC1967Proxy(implementation, data) {}
}
