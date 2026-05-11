// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title MinimalBridge
 * @notice Minimal test contract for CCTP bridge on Arc
 * @dev Tests the full flow: transferFrom -> approve -> depositForBurn
 */

interface IERC20 {
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
    function approve(address spender, uint256 amount) external returns (bool);
    function balanceOf(address account) external view returns (uint256);
    function allowance(address owner, address spender) external view returns (uint256);
}

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

contract MinimalBridge {
    IERC20 public immutable usdc;
    ITokenMessenger public immutable tokenMessenger;

    event Step1_TransferFrom(bool success, uint256 contractBalance);
    event Step2_Approve(bool success, uint256 allowance);
    event Step3_DepositForBurn(uint64 nonce);
    event Error(string reason);

    constructor(address _usdc, address _tokenMessenger) {
        usdc = IERC20(_usdc);
        tokenMessenger = ITokenMessenger(_tokenMessenger);
    }

    function bridge(uint256 amount, bytes32 mintRecipient) external returns (uint64) {
        // Step 1: Transfer USDC from user to this contract
        bool success = usdc.transferFrom(msg.sender, address(this), amount);
        emit Step1_TransferFrom(success, usdc.balanceOf(address(this)));
        if (!success) {
            emit Error("transferFrom failed");
            revert("transferFrom failed");
        }

        // Step 2: Approve TokenMessenger to spend our USDC
        success = usdc.approve(address(tokenMessenger), amount);
        uint256 allowance = usdc.allowance(address(this), address(tokenMessenger));
        emit Step2_Approve(success, allowance);
        if (!success) {
            emit Error("approve failed");
            revert("approve failed");
        }

        // Step 3: Call depositForBurn
        uint64 nonce = tokenMessenger.depositForBurn(
            amount,
            0,  // Sepolia domain
            mintRecipient,
            address(usdc),
            bytes32(0),  // anyone can claim
            0,           // no max fee
            1000         // fast finality
        );
        emit Step3_DepositForBurn(nonce);

        return nonce;
    }

    function getBalance() external view returns (uint256) {
        return usdc.balanceOf(address(this));
    }

    function getAllowance() external view returns (uint256) {
        return usdc.allowance(address(this), address(tokenMessenger));
    }
}
