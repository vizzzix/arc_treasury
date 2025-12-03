// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

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
 * @title TestDepositForBurn2
 * @notice Test with detailed error tracking
 */
contract TestDepositForBurn2 {
    IERC20 public immutable usdc;
    ITokenMessenger public immutable tokenMessenger;

    event Step(string message);
    event StepValue(string message, uint256 value);
    event StepError(string message, bytes errorData);

    constructor(address _usdc, address _tokenMessenger) {
        usdc = IERC20(_usdc);
        tokenMessenger = ITokenMessenger(_tokenMessenger);
        // Approve max
        IERC20(_usdc).approve(_tokenMessenger, type(uint256).max);
    }

    function testBridge(uint256 amount, bytes32 mintRecipient) external returns (uint64) {
        emit Step("1. Starting");

        // Step 1: Check allowance
        uint256 allowance = usdc.allowance(msg.sender, address(this));
        emit StepValue("2. User allowance to this", allowance);
        require(allowance >= amount, "Insufficient allowance");

        // Step 2: Check balance
        uint256 userBalance = usdc.balanceOf(msg.sender);
        emit StepValue("3. User balance", userBalance);
        require(userBalance >= amount, "Insufficient balance");

        // Step 3: Transfer from user
        emit Step("4. Calling transferFrom");
        bool success = usdc.transferFrom(msg.sender, address(this), amount);
        require(success, "TransferFrom failed");
        emit Step("5. TransferFrom success");

        // Step 4: Check our balance
        uint256 ourBalance = usdc.balanceOf(address(this));
        emit StepValue("6. Our balance after transfer", ourBalance);

        // Step 5: Check our allowance to TokenMessenger
        uint256 ourAllowance = usdc.allowance(address(this), address(tokenMessenger));
        emit StepValue("7. Our allowance to TokenMessenger", ourAllowance);

        // Step 6: Call depositForBurn with try/catch
        emit Step("8. Calling depositForBurn");

        try tokenMessenger.depositForBurn(
            amount,
            26,
            mintRecipient,
            address(usdc),
            bytes32(0),
            0,
            1000
        ) returns (uint64 nonce) {
            emit StepValue("9. Success! Nonce", uint256(nonce));
            return nonce;
        } catch (bytes memory errorData) {
            emit StepError("9. depositForBurn FAILED", errorData);
            revert("depositForBurn failed");
        }
    }
}
