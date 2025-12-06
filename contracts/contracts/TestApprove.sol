// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

interface IERC20 {
    function approve(address spender, uint256 amount) external returns (bool);
    function allowance(address owner, address spender) external view returns (uint256);
    function balanceOf(address account) external view returns (uint256);
}

contract TestApprove {
    IERC20 public immutable usdc;
    address public immutable tokenMessenger;

    event ApproveResult(bool success, uint256 allowanceBefore, uint256 allowanceAfter);

    constructor(address _usdc, address _tokenMessenger) {
        usdc = IERC20(_usdc);
        tokenMessenger = _tokenMessenger;
    }

    function testApprove(uint256 amount) external {
        uint256 allowanceBefore = usdc.allowance(address(this), tokenMessenger);
        bool success = usdc.approve(tokenMessenger, amount);
        uint256 allowanceAfter = usdc.allowance(address(this), tokenMessenger);

        emit ApproveResult(success, allowanceBefore, allowanceAfter);
    }

    function getAllowance() external view returns (uint256) {
        return usdc.allowance(address(this), tokenMessenger);
    }
}
