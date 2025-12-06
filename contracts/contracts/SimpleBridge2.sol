// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

interface IERC20 {
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
    function transfer(address to, uint256 amount) external returns (bool);
    function approve(address spender, uint256 amount) external returns (bool);
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

contract SimpleBridge2 {
    IERC20 public immutable usdc;
    ITokenMessenger public immutable tokenMessenger;
    address public immutable tokenMinter;

    event Debug(string step, uint256 value);
    event BridgeSuccess(uint64 nonce);

    constructor(address _usdc, address _tokenMessenger, address _tokenMinter) {
        usdc = IERC20(_usdc);
        tokenMessenger = ITokenMessenger(_tokenMessenger);
        tokenMinter = _tokenMinter;
    }

    function bridge(uint256 amount, bytes32 mintRecipient) external returns (uint64) {
        emit Debug("start", amount);

        // Step 1: Transfer from user
        bool success = usdc.transferFrom(msg.sender, address(this), amount);
        require(success, "transferFrom failed");
        emit Debug("transferFrom done", usdc.balanceOf(address(this)));

        // Step 2: Approve TokenMinter (not TokenMessenger!)
        // TokenMessenger calls TokenMinter.burn() which needs allowance
        success = usdc.approve(tokenMinter, amount);
        require(success, "approve failed");
        emit Debug("approve TokenMinter done", amount);

        // Step 3: Call depositForBurn
        uint64 nonce = tokenMessenger.depositForBurn(
            amount,
            0, // Sepolia
            mintRecipient,
            address(usdc),
            bytes32(0),
            0,
            1000
        );
        emit Debug("depositForBurn done", nonce);
        emit BridgeSuccess(nonce);

        return nonce;
    }

    function getBalance() external view returns (uint256) {
        return usdc.balanceOf(address(this));
    }
}
