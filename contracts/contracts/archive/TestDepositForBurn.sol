// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

interface ITokenMessenger {
    function depositForBurn(
        uint256 amount,
        uint32 destinationDomain,
        bytes32 mintRecipient,
        address burnToken,
        bytes32 destinationCaller,
        uint256 maxFee,
        uint32 minFinalityThreshold
    ) external returns (uint64 nonce);
}

/**
 * @title TestDepositForBurn
 * @notice Minimal test contract to debug depositForBurn
 */
contract TestDepositForBurn {
    using SafeERC20 for IERC20;

    IERC20 public immutable usdc;
    ITokenMessenger public immutable tokenMessenger;

    event Debug(string message, uint256 value);
    event DebugAddress(string message, address value);

    constructor(address _usdc, address _tokenMessenger) {
        usdc = IERC20(_usdc);
        tokenMessenger = ITokenMessenger(_tokenMessenger);

        // Approve TokenMessenger for max
        IERC20(_usdc).approve(_tokenMessenger, type(uint256).max);
    }

    function testBridge(uint256 amount, bytes32 mintRecipient) external returns (uint64) {
        emit Debug("Starting testBridge", amount);
        emit DebugAddress("msg.sender", msg.sender);
        emit DebugAddress("this", address(this));

        // Step 1: Transfer from user to this contract
        emit Debug("Step 1: transferFrom user", amount);
        usdc.safeTransferFrom(msg.sender, address(this), amount);
        emit Debug("Step 1 complete, balance", usdc.balanceOf(address(this)));

        // Step 2: Call depositForBurn
        emit Debug("Step 2: depositForBurn", amount);
        uint64 nonce = tokenMessenger.depositForBurn(
            amount,
            26, // Arc domain
            mintRecipient,
            address(usdc),
            bytes32(0),
            0,
            1000
        );
        emit Debug("Step 2 complete, nonce", uint256(nonce));

        return nonce;
    }

    function checkAllowance() external view returns (uint256) {
        return usdc.allowance(address(this), address(tokenMessenger));
    }
}
