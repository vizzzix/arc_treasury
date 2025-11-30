// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title TestEURC
 * @notice Mintable EURC token for Arc Testnet swap pool
 * @dev Owner can mint any amount for testing purposes
 */
contract TestEURC is ERC20, Ownable {
    uint8 private constant _decimals = 6;

    constructor() ERC20("EURC", "EURC") Ownable(msg.sender) {
        // Mint initial supply to deployer (100K EURC for testing)
        _mint(msg.sender, 100_000 * 10 ** _decimals);
    }

    function decimals() public pure override returns (uint8) {
        return _decimals;
    }

    /**
     * @notice Mint tokens (owner only)
     * @param to Recipient address
     * @param amount Amount to mint (in smallest units, 6 decimals)
     */
    function mint(address to, uint256 amount) external onlyOwner {
        _mint(to, amount);
    }

    /**
     * @notice Mint tokens to caller (for easy testing)
     * @param amount Amount to mint (in human-readable, will be multiplied by 10^6)
     */
    function faucet(uint256 amount) external {
        require(amount <= 10_000, "Max 10K per faucet call");
        _mint(msg.sender, amount * 10 ** _decimals);
    }
}
