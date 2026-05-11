// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

interface IERC20 {
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
    function approve(address spender, uint256 amount) external returns (bool);
    function allowance(address owner, address spender) external view returns (uint256);
    function balanceOf(address account) external view returns (uint256);
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

contract TestFullBridge {
    IERC20 public immutable usdc;
    ITokenMessenger public immutable tokenMessenger;

    event Step(string name, bool success, uint256 value);

    constructor(address _usdc, address _tokenMessenger) {
        usdc = IERC20(_usdc);
        tokenMessenger = ITokenMessenger(_tokenMessenger);
    }

    function bridge(uint256 amount, bytes32 mintRecipient) external returns (uint64) {
        // Step 1: Check balance before
        uint256 balBefore = usdc.balanceOf(address(this));
        emit Step("balance_before", true, balBefore);

        // Step 2: TransferFrom
        bool success = usdc.transferFrom(msg.sender, address(this), amount);
        emit Step("transferFrom", success, usdc.balanceOf(address(this)));
        require(success, "transferFrom failed");

        // Step 3: Approve TokenMessenger
        success = usdc.approve(address(tokenMessenger), amount);
        emit Step("approve", success, usdc.allowance(address(this), address(tokenMessenger)));
        require(success, "approve failed");

        // Step 4: depositForBurn
        uint64 nonce = tokenMessenger.depositForBurn(
            amount,
            0, // Sepolia
            mintRecipient,
            address(usdc),
            bytes32(0),
            0,
            1000
        );
        emit Step("depositForBurn", true, nonce);

        return nonce;
    }
}
