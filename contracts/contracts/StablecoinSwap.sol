// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title StablecoinSwap
 * @notice AMM for swapping between native USDC and EURC on Arc Testnet
 * @dev USDC is native currency on Arc (like ETH), EURC is ERC20
 *
 * Key features:
 * - Swap native USDC <-> EURC with real EUR/USD exchange rate
 * - Liquidity providers earn 0.2% fee on swaps
 * - LP tokens represent share of liquidity pool
 * - Owner can update exchange rate
 */
contract StablecoinSwap is ERC20, Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    // EURC token (ERC20)
    IERC20 public immutable eurc;

    // Token decimals (USDC is native 18 decimals on Arc, EURC is 6 decimals)
    uint8 public constant USDC_DECIMALS = 18;
    uint8 public constant EURC_DECIMALS = 6;

    // Exchange rate: EUR/USD rate with 6 decimals (e.g., 1080000 = 1.08 USD per EUR)
    // This means 1 EURC = 1.08 USDC at rate 1080000
    uint256 public exchangeRate = 1080000; // Default 1.08 USD/EUR
    uint256 public constant RATE_DECIMALS = 6;

    // Swap fee: 0.2% = 20 basis points
    uint256 public constant SWAP_FEE_BPS = 20;
    uint256 public constant BPS_DENOMINATOR = 10000;

    // Minimum liquidity to prevent division by zero
    uint256 public constant MINIMUM_LIQUIDITY = 1000;

    // Track USDC reserve (native balance)
    uint256 public usdcReserve;

    // Events
    event Swap(
        address indexed user,
        bool indexed usdcToEurc,
        uint256 amountIn,
        uint256 amountOut,
        uint256 fee
    );
    event LiquidityAdded(
        address indexed provider,
        uint256 usdcAmount,
        uint256 eurcAmount,
        uint256 lpTokensMinted
    );
    event LiquidityRemoved(
        address indexed provider,
        uint256 usdcAmount,
        uint256 eurcAmount,
        uint256 lpTokensBurned
    );
    event ExchangeRateUpdated(uint256 oldRate, uint256 newRate);

    constructor(
        address _eurc
    ) ERC20("Arc USDC/EURC LP", "arcLP-USDC-EURC") Ownable(msg.sender) {
        require(_eurc != address(0), "Invalid EURC address");
        eurc = IERC20(_eurc);
    }

    /**
     * @notice Update exchange rate (EUR/USD)
     * @param newRate New rate with 6 decimals (e.g., 1080000 = 1.08)
     */
    function setExchangeRate(uint256 newRate) external onlyOwner {
        require(newRate > 0 && newRate < 2000000, "Rate out of bounds"); // 0 < rate < 2.0
        uint256 oldRate = exchangeRate;
        exchangeRate = newRate;
        emit ExchangeRateUpdated(oldRate, newRate);
    }

    /**
     * @notice Get pool reserves
     * @return _usdcReserve USDC balance (18 decimals, native)
     * @return eurcReserve EURC balance (6 decimals, ERC20)
     */
    function getReserves() public view returns (uint256 _usdcReserve, uint256 eurcReserve) {
        _usdcReserve = usdcReserve;
        eurcReserve = eurc.balanceOf(address(this));
    }

    /**
     * @notice Calculate output for USDC -> EURC swap
     * @param usdcIn Amount of USDC (18 decimals)
     * @return eurcOut Amount of EURC out (6 decimals)
     * @return fee Fee in EURC (6 decimals)
     */
    function getEurcOut(uint256 usdcIn) public view returns (uint256 eurcOut, uint256 fee) {
        require(usdcIn > 0, "Amount must be > 0");

        // Convert 18 decimals USDC to 6 decimals
        uint256 normalizedIn = usdcIn / 10 ** (USDC_DECIMALS - EURC_DECIMALS);
        // Apply exchange rate: USDC / rate = EURC
        uint256 rawOut = (normalizedIn * 10 ** RATE_DECIMALS) / exchangeRate;

        // Apply fee
        fee = (rawOut * SWAP_FEE_BPS) / BPS_DENOMINATOR;
        eurcOut = rawOut - fee;
    }

    /**
     * @notice Calculate output for EURC -> USDC swap
     * @param eurcIn Amount of EURC (6 decimals)
     * @return usdcOut Amount of USDC out (18 decimals)
     * @return fee Fee in USDC (18 decimals)
     */
    function getUsdcOut(uint256 eurcIn) public view returns (uint256 usdcOut, uint256 fee) {
        require(eurcIn > 0, "Amount must be > 0");

        // Apply exchange rate: EURC * rate = USDC (in 6 decimals)
        uint256 rawOut = (eurcIn * exchangeRate) / 10 ** RATE_DECIMALS;
        // Convert to 18 decimals
        rawOut = rawOut * 10 ** (USDC_DECIMALS - EURC_DECIMALS);

        // Apply fee
        fee = (rawOut * SWAP_FEE_BPS) / BPS_DENOMINATOR;
        usdcOut = rawOut - fee;
    }

    /**
     * @notice Swap native USDC for EURC
     * @param minEurcOut Minimum EURC to receive (slippage protection)
     * @return eurcOut Actual EURC received
     */
    function swapUsdcForEurc(uint256 minEurcOut) external payable nonReentrant returns (uint256 eurcOut) {
        require(msg.value > 0, "Must send USDC");

        uint256 eurcReserve = eurc.balanceOf(address(this));
        require(usdcReserve > 0 && eurcReserve > 0, "No liquidity");

        uint256 fee;
        (eurcOut, fee) = getEurcOut(msg.value);
        require(eurcOut >= minEurcOut, "Slippage exceeded");
        require(eurcOut <= eurcReserve, "Insufficient EURC liquidity");

        // Update USDC reserve
        usdcReserve += msg.value;

        // Transfer EURC to user
        eurc.safeTransfer(msg.sender, eurcOut);

        emit Swap(msg.sender, true, msg.value, eurcOut, fee);
    }

    /**
     * @notice Swap EURC for native USDC
     * @param eurcIn Amount of EURC to swap
     * @param minUsdcOut Minimum USDC to receive (slippage protection)
     * @return usdcOut Actual USDC received
     */
    function swapEurcForUsdc(uint256 eurcIn, uint256 minUsdcOut) external nonReentrant returns (uint256 usdcOut) {
        require(eurcIn > 0, "Amount must be > 0");

        uint256 eurcReserve = eurc.balanceOf(address(this));
        require(usdcReserve > 0 && eurcReserve > 0, "No liquidity");

        uint256 fee;
        (usdcOut, fee) = getUsdcOut(eurcIn);
        require(usdcOut >= minUsdcOut, "Slippage exceeded");
        require(usdcOut <= usdcReserve, "Insufficient USDC liquidity");

        // Transfer EURC from user
        eurc.safeTransferFrom(msg.sender, address(this), eurcIn);

        // Update USDC reserve and send native USDC
        usdcReserve -= usdcOut;
        (bool success, ) = msg.sender.call{value: usdcOut}("");
        require(success, "USDC transfer failed");

        emit Swap(msg.sender, false, eurcIn, usdcOut, fee);
    }

    /**
     * @notice Add liquidity to the pool
     * @dev Send native USDC as msg.value, EURC via approval
     * @param eurcAmount Amount of EURC to add (6 decimals)
     * @param minLpTokens Minimum LP tokens to receive
     * @return lpTokens Amount of LP tokens minted
     */
    function addLiquidity(
        uint256 eurcAmount,
        uint256 minLpTokens
    ) external payable nonReentrant returns (uint256 lpTokens) {
        require(msg.value > 0 && eurcAmount > 0, "Amounts must be > 0");

        uint256 eurcReserve = eurc.balanceOf(address(this));
        uint256 totalSupply_ = totalSupply();

        if (totalSupply_ == 0) {
            // First liquidity provider
            // Normalize both to 18 decimals for sqrt calculation
            uint256 normalizedUsdc = msg.value;
            uint256 normalizedEurc = eurcAmount * 10 ** (USDC_DECIMALS - EURC_DECIMALS);
            lpTokens = _sqrt(normalizedUsdc * normalizedEurc) - MINIMUM_LIQUIDITY;

            // Mint minimum liquidity to dead address
            _mint(address(0xdead), MINIMUM_LIQUIDITY);
        } else {
            // Calculate LP tokens based on existing ratio
            uint256 lpFromUsdc = (msg.value * totalSupply_) / usdcReserve;
            uint256 lpFromEurc = (eurcAmount * totalSupply_) / eurcReserve;

            // Use minimum to maintain ratio
            lpTokens = lpFromUsdc < lpFromEurc ? lpFromUsdc : lpFromEurc;
        }

        require(lpTokens >= minLpTokens, "Slippage exceeded");
        require(lpTokens > 0, "Insufficient liquidity minted");

        // Update USDC reserve
        usdcReserve += msg.value;

        // Transfer EURC from user
        eurc.safeTransferFrom(msg.sender, address(this), eurcAmount);

        // Mint LP tokens
        _mint(msg.sender, lpTokens);

        emit LiquidityAdded(msg.sender, msg.value, eurcAmount, lpTokens);
    }

    /**
     * @notice Remove liquidity from the pool
     * @param lpTokens Amount of LP tokens to burn
     * @param minUsdcOut Minimum USDC to receive
     * @param minEurcOut Minimum EURC to receive
     * @return usdcOut Amount of USDC returned
     * @return eurcOut Amount of EURC returned
     */
    function removeLiquidity(
        uint256 lpTokens,
        uint256 minUsdcOut,
        uint256 minEurcOut
    ) external nonReentrant returns (uint256 usdcOut, uint256 eurcOut) {
        require(lpTokens > 0, "Amount must be > 0");
        require(balanceOf(msg.sender) >= lpTokens, "Insufficient LP tokens");

        uint256 eurcReserve = eurc.balanceOf(address(this));
        uint256 totalSupply_ = totalSupply();

        // Calculate proportional amounts
        usdcOut = (lpTokens * usdcReserve) / totalSupply_;
        eurcOut = (lpTokens * eurcReserve) / totalSupply_;

        require(usdcOut >= minUsdcOut, "USDC slippage exceeded");
        require(eurcOut >= minEurcOut, "EURC slippage exceeded");
        require(usdcOut > 0 && eurcOut > 0, "Insufficient output");

        // Burn LP tokens
        _burn(msg.sender, lpTokens);

        // Update USDC reserve and send
        usdcReserve -= usdcOut;
        (bool success, ) = msg.sender.call{value: usdcOut}("");
        require(success, "USDC transfer failed");

        // Transfer EURC
        eurc.safeTransfer(msg.sender, eurcOut);

        emit LiquidityRemoved(msg.sender, usdcOut, eurcOut, lpTokens);
    }

    /**
     * @notice Get user's share of the pool
     */
    function getUserShare(address user) external view returns (
        uint256 usdcShare,
        uint256 eurcShare,
        uint256 sharePercent
    ) {
        uint256 userLp = balanceOf(user);
        uint256 totalSupply_ = totalSupply();

        if (totalSupply_ == 0 || userLp == 0) {
            return (0, 0, 0);
        }

        uint256 eurcReserve = eurc.balanceOf(address(this));

        usdcShare = (userLp * usdcReserve) / totalSupply_;
        eurcShare = (userLp * eurcReserve) / totalSupply_;
        sharePercent = (userLp * 10000) / totalSupply_;
    }

    /**
     * @notice Square root (Babylonian method)
     */
    function _sqrt(uint256 y) internal pure returns (uint256 z) {
        if (y > 3) {
            z = y;
            uint256 x = y / 2 + 1;
            while (x < z) {
                z = x;
                x = (y / x + x) / 2;
            }
        } else if (y != 0) {
            z = 1;
        }
    }

    /**
     * @notice Receive native USDC
     */
    receive() external payable {}
}
