// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

/**
 * @title ArcWUSDC
 * @notice Wrapper for Arc Network native USDC (18 decimals) to ERC20 USDC (6 decimals)
 * @dev On Arc Network:
 *   - Native USDC has 18 decimals (like ETH)
 *   - ERC20 USDC at 0x3600... has 6 decimals
 *   - This wrapper converts between them
 *
 * Flow:
 *   deposit(): native USDC (18 dec) -> wrapped balance (6 dec)
 *   withdraw(): wrapped balance (6 dec) -> native USDC (18 dec)
 */
contract ArcWUSDC {
    using SafeERC20 for IERC20;

    /// @notice The native USDC ERC20 address on Arc (6 decimals)
    address public constant USDC_ADDRESS = 0x3600000000000000000000000000000000000000;

    IERC20 public immutable usdc;

    /// @notice Track wrapped balances (in 6 decimals)
    mapping(address => uint256) public balanceOf;

    /// @notice Track allowances
    mapping(address => mapping(address => uint256)) public allowance;

    /// @notice Total wrapped supply (in 6 decimals)
    uint256 public totalSupply;

    string public constant name = "Wrapped USDC";
    string public constant symbol = "WUSDC";
    uint8 public constant decimals = 6;

    event Deposit(address indexed from, uint256 nativeAmount, uint256 wrappedAmount);
    event Withdraw(address indexed to, uint256 wrappedAmount, uint256 nativeAmount);
    event Transfer(address indexed from, address indexed to, uint256 value);
    event Approval(address indexed owner, address indexed spender, uint256 value);

    constructor() {
        usdc = IERC20(USDC_ADDRESS);
    }

    /**
     * @notice Wrap native USDC to WUSDC
     * @dev Receives native USDC (18 dec), credits wrapped amount (6 dec)
     */
    function deposit() external payable {
        require(msg.value > 0, "No value sent");

        // Convert 18 decimals to 6 decimals
        uint256 amount6Dec = msg.value / 1e12;
        require(amount6Dec > 0, "Amount too small");

        // Credit the wrapped balance
        balanceOf[msg.sender] += amount6Dec;
        totalSupply += amount6Dec;

        emit Deposit(msg.sender, msg.value, amount6Dec);
        emit Transfer(address(0), msg.sender, amount6Dec);
    }

    /**
     * @notice Unwrap WUSDC to native USDC
     * @param amount Amount in 6 decimals to unwrap
     */
    function withdraw(uint256 amount) external {
        require(amount > 0, "Amount must be > 0");
        require(balanceOf[msg.sender] >= amount, "Insufficient balance");

        // Convert 6 decimals to 18 decimals
        uint256 nativeAmount = amount * 1e12;
        require(address(this).balance >= nativeAmount, "Insufficient native balance");

        balanceOf[msg.sender] -= amount;
        totalSupply -= amount;

        // Transfer native USDC
        (bool success, ) = payable(msg.sender).call{value: nativeAmount}("");
        require(success, "Transfer failed");

        emit Transfer(msg.sender, address(0), amount);
        emit Withdraw(msg.sender, amount, nativeAmount);
    }

    /**
     * @notice Transfer wrapped tokens
     */
    function transfer(address to, uint256 amount) external returns (bool) {
        require(to != address(0), "Transfer to zero address");
        require(balanceOf[msg.sender] >= amount, "Insufficient balance");

        balanceOf[msg.sender] -= amount;
        balanceOf[to] += amount;

        emit Transfer(msg.sender, to, amount);
        return true;
    }

    /**
     * @notice Transfer from with allowance
     */
    function transferFrom(address from, address to, uint256 amount) external returns (bool) {
        require(to != address(0), "Transfer to zero address");
        require(balanceOf[from] >= amount, "Insufficient balance");

        if (msg.sender != from) {
            require(allowance[from][msg.sender] >= amount, "Insufficient allowance");
            allowance[from][msg.sender] -= amount;
        }

        balanceOf[from] -= amount;
        balanceOf[to] += amount;

        emit Transfer(from, to, amount);
        return true;
    }

    /**
     * @notice Approve spender
     */
    function approve(address spender, uint256 amount) external returns (bool) {
        allowance[msg.sender][spender] = amount;
        emit Approval(msg.sender, spender, amount);
        return true;
    }

    receive() external payable {
        // Allow receiving native USDC directly (for unwrap operations)
    }
}
