// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "./interfaces/IUSYC.sol";
import "./interfaces/IEntitlements.sol";
import "./interfaces/IUSYCOracle.sol";
import "./interfaces/ITeller.sol";
import "@openzeppelin/contracts/token/ERC721/IERC721.sol";

/**
 * @title TreasuryVault
 * @notice Treasury vault that aggregates user deposits and simulates USYC yield on testnet
 * @dev Implements a shares-based model where users own shares in the pool, not USYC directly.
 *      Platform owns USYC on mainnet, users receive yield through share price appreciation.
 *      IMPORTANT:
 *      - convertToUSYC() and withdraw() currently use TESTNET-ONLY logic.
 *      - No real USYC is minted or redeemed on Arc Testnet.
 *      For mainnet, off-chain Teller/USYC integration must be added.
 */
contract TreasuryVault is Ownable, ReentrancyGuard, Pausable {
    using SafeERC20 for IERC20;

    // ============ Constants ============

    /// @notice Minimum amount required to convert to USYC ($100,000)
    uint256 public constant USYC_MINIMUM = 100_000 * 1e6; // $100k with 6 decimals

    /// @notice Precision for share calculations (1e18)
    uint256 private constant PRECISION = 1e18;

    /// @notice USDC decimals (6)
    uint256 private constant USDC_DECIMALS = 6;

    /// @notice Native USDC address on Arc Testnet
    address private constant NATIVE_USDC = 0x3600000000000000000000000000000000000000;

    /// @notice Points calculation constants
    uint256 private constant POINTS_PER_USD_PER_DAY = 1; // Base multiplier for time-based points
    uint256 private constant POINTS_PER_USD_DEPOSIT = 1; // Base multiplier for deposit-based points
    uint256 private constant SECONDS_PER_DAY = 86400;

    /// @notice Maximum platform fee in basis points (200 = 2%)
    uint256 public constant MAX_PLATFORM_FEE_BPS = 200;

    /// @notice Minimum deposit amount for locked positions ($10 or €10 with 6 decimals)
    uint256 public constant LOCK_MINIMUM_DEPOSIT = 10 * 1e6; // $10 or €10

    /// @notice Early withdrawal penalty (25%)
    uint256 public constant EARLY_WITHDRAW_PENALTY_BPS = 2500; // 25%

    /// @notice Lock period constants (in days)
    uint256 public constant LOCK_PERIOD_1_MONTH = 30 days;
    uint256 public constant LOCK_PERIOD_3_MONTH = 90 days;
    uint256 public constant LOCK_PERIOD_12_MONTH = 365 days;

    /// @notice Lock period APY boost multipliers (100 = 1x, 117 = 1.17x, etc.)
    /// @dev Boosted APY = baseAPY * multiplier / 100
    uint256 public constant LOCK_BOOST_MULTIPLIER_1_MONTH = 117;   // 1.17x (+17% boost)
    uint256 public constant LOCK_BOOST_MULTIPLIER_3_MONTH = 135;   // 1.35x (+35% boost)
    uint256 public constant LOCK_BOOST_MULTIPLIER_12_MONTH = 169;  // 1.69x (+69% boost)

    /// @notice Lock period points multipliers (100 = 1x, 150 = 1.5x, 200 = 2x, 300 = 3x)
    uint256 public constant LOCK_POINTS_MULTIPLIER_FLEXIBLE = 100;
    uint256 public constant LOCK_POINTS_MULTIPLIER_1_MONTH = 150;
    uint256 public constant LOCK_POINTS_MULTIPLIER_3_MONTH = 200;
    uint256 public constant LOCK_POINTS_MULTIPLIER_12_MONTH = 300;

    // ============ State Variables ============

    /// @notice USDC token contract (or native address for Arc Testnet)
    IERC20 public immutable usdc;

    /// @notice Whether USDC is native currency
    bool public immutable isNativeUSDC;

    /// @notice EURC token contract
    IERC20 public immutable eurc;

    /// @notice Total EURC in the pool
    uint256 public totalEURC;

    /// @notice Total shares for EURC pool (18 decimals)
    uint256 public totalEURCShares;

    /// @notice User EURC shares mapping (18 decimals)
    mapping(address => uint256) public userEURCShares;

    /// @notice User information for points calculation
    struct UserInfo {
        uint256 firstDepositTime;    // Timestamp of first deposit (any currency)
        uint256 lastBalanceUpdate;   // Last time balance changed (for time-based points calculation)
        uint256 balanceAtLastUpdate; // Balance in USD (6 decimals) at last update
        uint256 accumulatedPoints;   // Accumulated points from previous periods
        uint256 currentPoints;       // Current total points (for caching)
    }

    /// @notice User info mapping
    mapping(address => UserInfo) public userInfo;

    /// @notice Locked position information
    struct LockedPosition {
        uint256 id;              // Unique position ID
        uint256 amount;          // Locked amount (6 decimals for USDC/EURC)
        address token;           // USDC or EURC address
        uint8 lockPeriodMonths;  // 1, 3, or 12 months
        uint256 depositTime;     // Timestamp when locked
        uint256 unlockTime;      // Timestamp when unlockable
        uint256 lastYieldClaim;  // Last time yield was claimed
        bool withdrawn;          // Whether position has been fully withdrawn
    }

    /// @notice Counter for generating unique lock IDs
    uint256 public nextLockId = 1;

    /// @notice Mapping from user address to array of their locked positions
    mapping(address => LockedPosition[]) public userLockedPositions;

    /// @notice Total locked USDC across all positions (6 decimals for ERC20, 18 for native)
    uint256 public totalLockedUSDC;

    /// @notice Total locked EURC across all positions (6 decimals)
    uint256 public totalLockedEURC;

    /// @notice USYC token contract (for mainnet integration)
    IUSYC public immutable usyc;

    /// @notice Entitlements contract for allowlist checking (USYC eligibility)
    IEntitlements public immutable entitlements;

    /// @notice USYC price oracle
    IUSYCOracle public immutable usycOracle;

    /// @notice USYC Teller contract for USDC/USYC conversion
    ITeller public teller;

    /// @notice Treasury operator address (must be allowlisted for USYC)
    address public treasuryOperator;

    /// @notice Points Multiplier NFT contract (optional, can be address(0))
    IERC721 public pointsMultiplierNFT;

    /// @notice Whether NFT multiplier is enabled
    bool public nftMultiplierEnabled = false;

    /// @notice Total USDC in the pool (not yet converted to USYC)
    /// @dev Stored in 18 decimals if native (Arc), 6 decimals if ERC20.
    uint256 public totalUSDC;

    /// @notice Total USYC owned by the platform (on treasury operator address)
    /// @dev Simulated on testnet, real on mainnet.
    uint256 public totalUSYC;

    /// @notice Total shares in the USDC pool (18 decimals)
    uint256 public totalShares;

    /// @notice User USDC shares mapping (18 decimals)
    mapping(address => uint256) public userShares;

    /// @notice Platform fee in basis points (50 = 0.5%)
    uint256 public platformFeeBps;

    /// @notice Last recorded pool value (for fee calculation)
    uint256 public lastRecordedValue;

    // ============ Events ============

    event Deposit(address indexed user, uint256 amount, uint256 shares);
    event DepositEURC(address indexed user, uint256 amount, uint256 shares);
    event Withdraw(address indexed user, uint256 shares, uint256 amount);
    event WithdrawEURC(address indexed user, uint256 shares, uint256 amount);
    event ConvertedToUSYC(uint256 usdcAmount, uint256 usycAmount);
    event USYCConversionRecorded(address indexed operator, uint256 usycAmount, uint256 totalUSYC);
    event PlatformFeeAccrued(uint256 feeShares);
    event OperatorUpdated(address indexed oldOperator, address indexed newOperator);
    event FeeUpdated(uint256 oldFee, uint256 newFee);
    event EmergencyWithdraw(address indexed token, address indexed to, uint256 amount);
    event PointsUpdated(address indexed user, uint256 newPoints);
    event DepositLocked(address indexed user, uint256 indexed lockId, uint256 amount, address token, uint8 lockPeriodMonths, uint256 unlockTime);
    event LockedPositionWithdrawn(address indexed user, uint256 indexed lockId, uint256 amount, uint256 yield);
    event EarlyWithdrawPenalty(address indexed user, uint256 indexed lockId, uint256 penaltyAmount);
    event YieldClaimed(address indexed user, uint256 indexed lockId, uint256 yieldAmount);
    event TellerUpdated(address indexed oldTeller, address indexed newTeller);
    event USYCMinted(uint256 usdcAmount, uint256 usycAmount);
    event USYCRedeemed(uint256 usycAmount, uint256 usdcAmount);

    // ============ Modifiers ============

    modifier onlyOperator() {
        require(msg.sender == treasuryOperator, "Not operator");
        _;
    }

    // ============ Constructor ============

    constructor(
        address _usdc,
        address _eurc,
        address _usyc,
        address _entitlements,
        address _usycOracle,
        address _treasuryOperator,
        uint256 _platformFeeBps
    ) Ownable(msg.sender) {
        require(_usdc != address(0), "Invalid USDC address");
        require(_eurc != address(0), "Invalid EURC address");
        require(_usyc != address(0), "Invalid USYC address");
        require(_entitlements != address(0), "Invalid Entitlements address");
        require(_usycOracle != address(0), "Invalid Oracle address");
        require(_treasuryOperator != address(0), "Invalid operator address");
        require(_platformFeeBps <= MAX_PLATFORM_FEE_BPS, "Fee too high");

        usdc = IERC20(_usdc);
        isNativeUSDC = (_usdc == NATIVE_USDC);
        eurc = IERC20(_eurc);
        usyc = IUSYC(_usyc);
        entitlements = IEntitlements(_entitlements);
        usycOracle = IUSYCOracle(_usycOracle);
        treasuryOperator = _treasuryOperator;
        platformFeeBps = _platformFeeBps;
    }

    // ============ Public View Functions ============

    /**
     * @notice Gets the total value of the pool in USDC
     * @return Total pool value in USDC (with 6 decimals)
     */
    function getTotalPoolValue() public view returns (uint256) {
        // Get current USYC price from oracle (6 decimals)
        // Use try-catch to handle potential oracle issues
        uint256 usycPrice = 1_000_000; // Default to 1.0 USDC if oracle fails
        try usycOracle.getUSYCPrice() returns (uint256 price) {
            if (price > 0) {
                usycPrice = price;
            }
        } catch {
            // If oracle call fails, use default price
        }

        // Calculate USYC value: (price * totalUSYC) / 1e6
        // usycPrice has 6 decimals, totalUSYC has 6 decimals
        // Result: 12 decimals, divide by 1e6 to get 6 decimals (as USDC)
        uint256 usycValue = (usycPrice * totalUSYC) / 1e6;

        // Convert totalUSDC to 6 decimals
        // For native USDC, totalUSDC is stored with 18 decimals
        // For ERC20 USDC, totalUSDC is stored with 6 decimals
        uint256 usdcValue = isNativeUSDC ? totalUSDC / 1e12 : totalUSDC;

        // Total pool value = USYC value + USDC in pool (both in 6 decimals)
        return usycValue + usdcValue;
    }

    /**
     * @notice Gets the value of a user's USDC shares in USDC
     * @param user Address of the user
     * @return Value of user's shares in USDC (with 6 decimals)
     */
    function getUserShareValue(address user) public view returns (uint256) {
        if (totalShares == 0 || userShares[user] == 0) {
            return 0;
        }

        // Use price per share (18 decimals) to calculate value
        uint256 pricePerShare = getPricePerShare();
        // pricePerShare has 18 decimals, userShares has 18 decimals
        // Result: (18 * 18) / 18 = 18 decimals
        // But we need 6 decimals (USDC), so divide by 1e12
        uint256 shareValue18 = (userShares[user] * pricePerShare) / PRECISION;
        return shareValue18 / 1e12;
    }

    /**
     * @notice Gets the price per share for USDC pool
     * @return Price per share in USDC (with 18 decimals, PRECISION)
     * @dev Returns price with 18 decimals for share calculations.
     *      To get price in 6 decimals: divide by 1e12.
     */
    function getPricePerShare() public view returns (uint256) {
        if (totalShares == 0) {
            // 1:1 for first deposit (1 share (1e18) per $1 (1e6))
            return PRECISION;
        }
        uint256 totalValue = getTotalPoolValue(); // 6 decimals
        // Convert totalValue (6 dec) to 18 dec, then scale by PRECISION and divide by totalShares (18 dec)
        // Result: 18 decimals
        return (totalValue * 1e12 * PRECISION) / totalShares;
    }

    /**
     * @notice Gets the price per share for EURC pool
     * @return Price per share in EURC (with 18 decimals, PRECISION)
     */
    function getEURCPricePerShare() public view returns (uint256) {
        if (totalEURCShares == 0) {
            return PRECISION; // 1:1 for first deposit (in 18 decimals)
        }
        // totalEURC is in 6 decimals, totalEURCShares is in 18 decimals
        // To get price per share in 18 decimals: (totalEURC * 1e12 * PRECISION) / totalEURCShares
        return (totalEURC * 1e12 * PRECISION) / totalEURCShares;
    }

    /**
     * @notice Gets user's current points
     * @param user Address of the user
     * @return Current points balance
     * @dev Points are calculated based on:
     *      1. Flexible balance (shares converted to USD value) - 1x multiplier
     *      2. Locked positions with lock period multipliers (1.5x, 2x, 3x)
     *      3. Time held (days since last balance update)
     *      4. NFT multiplier (2x) if enabled
     */
    function getUserPoints(address user) public view returns (uint256) {
        UserInfo memory info = userInfo[user];
        if (info.firstDepositTime == 0 && userLockedPositions[user].length == 0) {
            return 0;
        }

        // === FLEXIBLE BALANCE POINTS (1x multiplier) ===
        uint256 currentBalanceUSD = _getUserCurrentBalanceUSD(user);

        uint256 daysSinceLastUpdate = 0;
        if (info.lastBalanceUpdate > 0) {
            daysSinceLastUpdate = (block.timestamp - info.lastBalanceUpdate) / SECONDS_PER_DAY;
        } else if (info.firstDepositTime > 0) {
            daysSinceLastUpdate = (block.timestamp - info.firstDepositTime) / SECONDS_PER_DAY;
        }

        uint256 timePoints = (daysSinceLastUpdate * currentBalanceUSD * POINTS_PER_USD_PER_DAY) / 10000;
        uint256 balancePoints = (currentBalanceUSD * POINTS_PER_USD_DEPOSIT) / 10000;

        // Flexible points (1x multiplier)
        uint256 flexiblePoints = (info.accumulatedPoints + timePoints + balancePoints) * LOCK_POINTS_MULTIPLIER_FLEXIBLE / 100;

        // === LOCKED POSITIONS POINTS (with lock period multipliers) ===
        uint256 lockedPoints = 0;
        LockedPosition[] memory positions = userLockedPositions[user];

        for (uint256 i = 0; i < positions.length; i++) {
            if (positions[i].withdrawn) continue;

            // Calculate days since deposit
            uint256 daysSinceDeposit = (block.timestamp - positions[i].depositTime) / SECONDS_PER_DAY;

            // Get lock period multiplier
            uint256 lockMultiplier = LOCK_POINTS_MULTIPLIER_FLEXIBLE; // Default 1x
            if (positions[i].lockPeriodMonths == 1) {
                lockMultiplier = LOCK_POINTS_MULTIPLIER_1_MONTH; // 1.5x
            } else if (positions[i].lockPeriodMonths == 3) {
                lockMultiplier = LOCK_POINTS_MULTIPLIER_3_MONTH; // 2x
            } else if (positions[i].lockPeriodMonths == 12) {
                lockMultiplier = LOCK_POINTS_MULTIPLIER_12_MONTH; // 3x
            }

            // Calculate points for this position
            uint256 positionTimePoints = (daysSinceDeposit * positions[i].amount * POINTS_PER_USD_PER_DAY) / 10000;
            uint256 positionBalancePoints = (positions[i].amount * POINTS_PER_USD_DEPOSIT) / 10000;

            // Apply lock multiplier
            uint256 positionPoints = (positionTimePoints + positionBalancePoints) * lockMultiplier / 100;
            lockedPoints += positionPoints;
        }

        // Total base points = flexible + locked
        uint256 basePoints = flexiblePoints + lockedPoints;

        // Apply NFT multiplier if enabled and user owns NFT
        if (nftMultiplierEnabled && address(pointsMultiplierNFT) != address(0)) {
            try pointsMultiplierNFT.balanceOf(user) returns (uint256 balance) {
                if (balance > 0) {
                    // x2 multiplier for NFT holders
                    return basePoints * 2;
                }
            } catch {
                // If NFT contract call fails, return base points
            }
        }

        return basePoints;
    }

    /**
     * @notice Returns aggregated view of user's position for frontend
     */
    function getUserOverview(address user)
        external
        view
        returns (
            uint256 usdcShares,
            uint256 usdcValue,
            uint256 eurcShares,
            uint256 eurcValue,
            uint256 points,
            bool hasNFT
        )
    {
        usdcShares = userShares[user];
        usdcValue = getUserShareValue(user);

        eurcShares = userEURCShares[user];
        if (eurcShares > 0 && totalEURCShares > 0) {
            uint256 pricePerShare = getEURCPricePerShare();
            uint256 value18 = (eurcShares * pricePerShare) / PRECISION;
            eurcValue = value18 / 1e12; // back to 6 decimals
        } else {
            eurcValue = 0;
        }

        points = getUserPoints(user);

        if (address(pointsMultiplierNFT) != address(0)) {
            try pointsMultiplierNFT.balanceOf(user) returns (uint256 balance) {
                hasNFT = balance > 0;
            } catch {
                hasNFT = false;
            }
        } else {
            hasNFT = false;
        }
    }

    /**
     * @notice Gets user's current balance in USD (6 decimals)
     * @param user Address of the user
     * @return Balance in USD (6 decimals)
     */
    function _getUserCurrentBalanceUSD(address user) internal view returns (uint256) {
        uint256 totalBalanceUSD = 0;

        // Get USDC balance value
        if (userShares[user] > 0 && totalShares > 0) {
            uint256 userShareValue = getUserShareValue(user);
            totalBalanceUSD += userShareValue;
        }

        // Get EURC balance value
        if (userEURCShares[user] > 0 && totalEURCShares > 0) {
            uint256 eurcPricePerShare = getEURCPricePerShare();
            uint256 eurcValue18 = (userEURCShares[user] * eurcPricePerShare) / PRECISION;
            totalBalanceUSD += eurcValue18 / 1e12;
        }

        return totalBalanceUSD;
    }

    // ============ Public Functions ============

    /**
     * @notice Deposits USDC into the vault
     * @param amount Amount of USDC to deposit (with 6 decimals)
     * @return shares Amount of shares minted (18 decimals)
     */
    function deposit(uint256 amount) external payable whenNotPaused nonReentrant returns (uint256) {
        require(amount > 0, "Amount must be > 0");

        // Handle native USDC (Arc Testnet) or ERC20 USDC
        if (isNativeUSDC) {
            // For native USDC, msg.value should equal amount (both in 18 decimals on Arc)
            require(msg.value == amount, "Amount mismatch");
            // Native currency is already in the contract
        } else {
            // For ERC20 USDC, transfer from user
            require(msg.value == 0, "Native currency not accepted");
            usdc.safeTransferFrom(msg.sender, address(this), amount);
        }

        // Convert amount (6 decimals) to 18 decimals for share math
        uint256 amount18 = isNativeUSDC ? amount : amount * 1e12;

        // Calculate shares to mint
        uint256 sharesToMint;
        if (totalShares == 0) {
            // First deposit: 1:1 ratio in 18 decimals
            sharesToMint = amount18;
        } else {
            // Subsequent deposits: shares based on current price per share
            uint256 pricePerShare = getPricePerShare(); // 18 decimals
            sharesToMint = (amount18 * PRECISION) / pricePerShare;
            require(sharesToMint > 0, "Shares too small");
        }

        // Update balances
        if (isNativeUSDC) {
            // native amount is already in contract and in 18 decimals
            totalUSDC += amount; // 18 decimals
        } else {
            // ERC20 USDC stored in 6 decimals
            totalUSDC += amount;
        }

        totalShares += sharesToMint;
        userShares[msg.sender] += sharesToMint;

        // Update user info and points
        _updateUserInfo(msg.sender, amount, 0, true);

        // On testnet, convertToUSYC() is disabled - we only track USDC and simulate yield via oracle.
        // For mainnet:
        // if (totalUSDC >= USYC_MINIMUM && canConvertToUSYC()) {
        //     convertToUSYC();
        // }

        emit Deposit(msg.sender, amount, sharesToMint);
        return sharesToMint;
    }

    /**
     * @notice Deposits EURC into the vault
     * @param amount Amount of EURC to deposit (with 6 decimals)
     * @return shares Amount of shares minted (18 decimals)
     */
    function depositEURC(uint256 amount) external whenNotPaused nonReentrant returns (uint256) {
        require(amount > 0, "Amount must be > 0");

        // Transfer EURC from user
        eurc.safeTransferFrom(msg.sender, address(this), amount);

        // Calculate shares to mint
        uint256 sharesToMint;
        if (totalEURCShares == 0) {
            // First deposit: 1:1 ratio, but shares must be in 18 decimals
            sharesToMint = amount * 1e12; // 6 -> 18 decimals
        } else {
            uint256 pricePerShare = getEURCPricePerShare(); // 18 decimals
            uint256 amount18 = amount * 1e12;
            sharesToMint = (amount18 * PRECISION) / pricePerShare;
            require(sharesToMint > 0, "Shares too small");
        }

        // Update balances
        totalEURC += amount;
        totalEURCShares += sharesToMint;
        userEURCShares[msg.sender] += sharesToMint;

        // Update user info and points
        _updateUserInfo(msg.sender, 0, amount, true);

        emit DepositEURC(msg.sender, amount, sharesToMint);
        return sharesToMint;
    }

    /**
     * @notice Withdraws USDC by burning shares
     * @param sharesToWithdraw Amount of shares to withdraw (18 decimals)
     * @return usdcAmount Amount of USDC received (18 decimals for native, 6 for ERC20)
     * @dev Pays based on TOTAL pool value (USDC + USYC).
     *      If USDC liquidity is insufficient, auto-redeems USYC via Teller.
     *      User receives their fair share of the pool value.
     */
    function withdraw(uint256 sharesToWithdraw) external whenNotPaused nonReentrant returns (uint256) {
        require(sharesToWithdraw > 0, "Shares must be > 0");
        require(userShares[msg.sender] >= sharesToWithdraw, "Insufficient shares");
        require(totalShares > 0, "No shares in pool");

        // Calculate value to withdraw based on user's share of TOTAL POOL VALUE
        uint256 pricePerShare = getPricePerShare(); // 18 decimals
        uint256 shareValue18 = (sharesToWithdraw * pricePerShare) / PRECISION; // 18 decimals

        // Convert to appropriate decimals for the target currency
        uint256 valueToWithdraw;
        if (isNativeUSDC) {
            // For native USDC, we need 18 decimals - shareValue18 is already 18 decimals
            valueToWithdraw = shareValue18;
        } else {
            // For ERC20 USDC, convert from 18 to 6 decimals
            valueToWithdraw = shareValue18 / 1e12;
        }

        require(valueToWithdraw > 0, "No value to withdraw");

        // Check if we need to redeem USYC to cover the withdrawal
        if (totalUSDC < valueToWithdraw && totalUSYC > 0 && address(teller) != address(0)) {
            // Calculate how much USYC we need to redeem
            uint256 usdcShortfall = valueToWithdraw - totalUSDC;

            // Convert shortfall to 6 decimals for USYC calculation
            uint256 shortfall6Dec = isNativeUSDC ? usdcShortfall / 1e12 : usdcShortfall;

            // Get USYC price from oracle (6 decimals)
            uint256 usycPrice = 1_000_000; // Default to 1.0
            try usycOracle.getUSYCPrice() returns (uint256 price) {
                if (price > 0) usycPrice = price;
            } catch {}

            // Calculate USYC amount needed: shortfall / price * 1e6
            // Add 1% buffer for price fluctuations
            uint256 usycNeeded = (shortfall6Dec * 1e6 * 101) / (usycPrice * 100);

            // Cap at available USYC
            if (usycNeeded > totalUSYC) {
                usycNeeded = totalUSYC;
            }

            // Auto-redeem USYC via Teller
            if (usycNeeded > 0) {
                IERC20(address(usyc)).approve(address(teller), usycNeeded);

                if (isNativeUSDC) {
                    uint256 balanceBefore = address(this).balance;
                    teller.redeem(usycNeeded, address(this), address(this));
                    uint256 nativeReceived = address(this).balance - balanceBefore;

                    totalUSYC -= usycNeeded;
                    totalUSDC += nativeReceived;

                    emit USYCRedeemed(usycNeeded, nativeReceived);
                } else {
                    uint256 usdcReceived = teller.redeem(usycNeeded, address(this), address(this));

                    totalUSYC -= usycNeeded;
                    totalUSDC += usdcReceived;

                    emit USYCRedeemed(usycNeeded, usdcReceived);
                }
            }
        }

        // Recalculate actual amount to withdraw (may be less if USYC redeem failed or insufficient)
        uint256 actualWithdraw = valueToWithdraw <= totalUSDC ? valueToWithdraw : totalUSDC;
        require(actualWithdraw > 0, "Insufficient liquidity");

        // Update balances
        totalUSDC -= actualWithdraw;
        totalShares -= sharesToWithdraw;
        userShares[msg.sender] -= sharesToWithdraw;

        // Update user info and points
        _updateUserInfo(msg.sender, actualWithdraw, 0, false);

        // Transfer USDC to user
        if (isNativeUSDC) {
            require(address(this).balance >= actualWithdraw, "Insufficient contract balance");
            (bool success, ) = payable(msg.sender).call{value: actualWithdraw}("");
            require(success, "Transfer failed");
        } else {
            require(usdc.balanceOf(address(this)) >= actualWithdraw, "Insufficient USDC balance");
            usdc.safeTransfer(msg.sender, actualWithdraw);
        }

        emit Withdraw(msg.sender, sharesToWithdraw, actualWithdraw);
        return actualWithdraw;
    }

    /**
     * @notice Withdraws EURC shares and converts to EURC
     * @param sharesToWithdraw Amount of shares to withdraw (18 decimals)
     * @return eurcAmount Amount of EURC received (6 decimals)
     */
    function withdrawEURC(uint256 sharesToWithdraw) external whenNotPaused nonReentrant returns (uint256) {
        require(sharesToWithdraw > 0, "Shares must be > 0");
        require(userEURCShares[msg.sender] >= sharesToWithdraw, "Insufficient shares");
        require(totalEURCShares > 0, "No shares in pool");

        // Calculate EURC amount to withdraw
        uint256 userShareFraction = (sharesToWithdraw * PRECISION) / totalEURCShares;
        uint256 eurcToWithdraw = (totalEURC * userShareFraction) / PRECISION;

        // Ensure we have enough EURC in the pool
        require(eurcToWithdraw > 0, "No EURC to withdraw");
        require(eurcToWithdraw <= totalEURC, "Insufficient EURC liquidity");

        // Update balances
        totalEURC -= eurcToWithdraw;
        totalEURCShares -= sharesToWithdraw;
        userEURCShares[msg.sender] -= sharesToWithdraw;

        // Update user info and points
        _updateUserInfo(msg.sender, 0, eurcToWithdraw, false);

        // Transfer EURC to user
        require(eurc.balanceOf(address(this)) >= eurcToWithdraw, "Insufficient EURC balance");
        eurc.safeTransfer(msg.sender, eurcToWithdraw);

        emit WithdrawEURC(msg.sender, sharesToWithdraw, eurcToWithdraw);
        return eurcToWithdraw;
    }

    /**
     * @notice Deposits USDC with a lock period for boosted APY
     * @param amount Amount of USDC to lock (with 6 decimals)
     * @param lockPeriodMonths Lock period: 1, 3, or 12 months
     * @return lockId Unique ID of the locked position
     * @dev Minimum deposit: $10 (LOCK_MINIMUM_DEPOSIT)
     */
    function depositLockedUSDC(uint256 amount, uint8 lockPeriodMonths)
        external
        payable
        whenNotPaused
        nonReentrant
        returns (uint256)
    {
        require(amount >= LOCK_MINIMUM_DEPOSIT, "Amount below minimum");
        require(
            lockPeriodMonths == 1 || lockPeriodMonths == 3 || lockPeriodMonths == 12,
            "Invalid lock period"
        );

        // Handle native USDC (Arc Testnet) or ERC20 USDC
        if (isNativeUSDC) {
            require(msg.value == amount, "Amount mismatch");
        } else {
            require(msg.value == 0, "Native currency not accepted");
            usdc.safeTransferFrom(msg.sender, address(this), amount);
        }

        // Determine lock duration
        uint256 lockDuration;
        if (lockPeriodMonths == 1) {
            lockDuration = LOCK_PERIOD_1_MONTH;
        } else if (lockPeriodMonths == 3) {
            lockDuration = LOCK_PERIOD_3_MONTH;
        } else {
            lockDuration = LOCK_PERIOD_12_MONTH;
        }

        // Create locked position
        uint256 lockId = nextLockId++;
        uint256 unlockTime = block.timestamp + lockDuration;

        LockedPosition memory newPosition = LockedPosition({
            id: lockId,
            amount: amount,
            token: address(usdc),
            lockPeriodMonths: lockPeriodMonths,
            depositTime: block.timestamp,
            unlockTime: unlockTime,
            lastYieldClaim: block.timestamp,
            withdrawn: false
        });

        userLockedPositions[msg.sender].push(newPosition);

        // Update total locked balance
        if (isNativeUSDC) {
            totalLockedUSDC += amount; // 18 decimals for native
        } else {
            totalLockedUSDC += amount; // 6 decimals for ERC20
        }

        // Update user info for points
        _updateUserInfo(msg.sender, amount, 0, true);

        emit DepositLocked(msg.sender, lockId, amount, address(usdc), lockPeriodMonths, unlockTime);
        return lockId;
    }

    /**
     * @notice Deposits EURC with a lock period for boosted APY
     * @param amount Amount of EURC to lock (with 6 decimals)
     * @param lockPeriodMonths Lock period: 1, 3, or 12 months
     * @return lockId Unique ID of the locked position
     * @dev Minimum deposit: €10 (LOCK_MINIMUM_DEPOSIT)
     */
    function depositLockedEURC(uint256 amount, uint8 lockPeriodMonths)
        external
        whenNotPaused
        nonReentrant
        returns (uint256)
    {
        require(amount >= LOCK_MINIMUM_DEPOSIT, "Amount below minimum");
        require(
            lockPeriodMonths == 1 || lockPeriodMonths == 3 || lockPeriodMonths == 12,
            "Invalid lock period"
        );

        // Transfer EURC from user
        eurc.safeTransferFrom(msg.sender, address(this), amount);

        // Determine lock duration
        uint256 lockDuration;
        if (lockPeriodMonths == 1) {
            lockDuration = LOCK_PERIOD_1_MONTH;
        } else if (lockPeriodMonths == 3) {
            lockDuration = LOCK_PERIOD_3_MONTH;
        } else {
            lockDuration = LOCK_PERIOD_12_MONTH;
        }

        // Create locked position
        uint256 lockId = nextLockId++;
        uint256 unlockTime = block.timestamp + lockDuration;

        LockedPosition memory newPosition = LockedPosition({
            id: lockId,
            amount: amount,
            token: address(eurc),
            lockPeriodMonths: lockPeriodMonths,
            depositTime: block.timestamp,
            unlockTime: unlockTime,
            lastYieldClaim: block.timestamp,
            withdrawn: false
        });

        userLockedPositions[msg.sender].push(newPosition);

        // Update total locked balance
        totalLockedEURC += amount;

        // Update user info for points
        _updateUserInfo(msg.sender, 0, amount, true);

        emit DepositLocked(msg.sender, lockId, amount, address(eurc), lockPeriodMonths, unlockTime);
        return lockId;
    }

    /**
     * @notice Withdraws a locked position after unlock time (full amount + yield)
     * @param positionIndex Index of the position in user's array
     * @return amount Total amount withdrawn (principal + yield)
     * @dev Can only be called after unlockTime has passed
     */
    function withdrawLocked(uint256 positionIndex) external whenNotPaused nonReentrant returns (uint256) {
        require(positionIndex < userLockedPositions[msg.sender].length, "Invalid position");
        LockedPosition storage position = userLockedPositions[msg.sender][positionIndex];

        require(!position.withdrawn, "Already withdrawn");
        require(block.timestamp >= position.unlockTime, "Still locked");

        // Calculate accumulated yield
        uint256 yieldAmount = _calculateLockedYield(position);

        // Mark as withdrawn
        position.withdrawn = true;

        // Total amount = principal + yield
        uint256 totalAmount = position.amount + yieldAmount;

        // Update total locked balance
        if (position.token == address(usdc)) {
            if (isNativeUSDC) {
                totalLockedUSDC -= position.amount;
                require(address(this).balance >= totalAmount, "Insufficient balance");
                (bool success, ) = payable(msg.sender).call{value: totalAmount}("");
                require(success, "Transfer failed");
            } else {
                totalLockedUSDC -= position.amount;
                require(usdc.balanceOf(address(this)) >= totalAmount, "Insufficient USDC");
                usdc.safeTransfer(msg.sender, totalAmount);
            }
        } else if (position.token == address(eurc)) {
            totalLockedEURC -= position.amount;
            require(eurc.balanceOf(address(this)) >= totalAmount, "Insufficient EURC");
            eurc.safeTransfer(msg.sender, totalAmount);
        }

        // Update user info
        _updateUserInfo(msg.sender, position.amount, 0, false);

        emit LockedPositionWithdrawn(msg.sender, position.id, position.amount, yieldAmount);
        return totalAmount;
    }

    /**
     * @notice Withdraws a locked position BEFORE unlock time with 25% penalty
     * @param positionIndex Index of the position in user's array
     * @return amountAfterPenalty Amount received after 25% penalty
     * @dev 25% penalty goes to treasury operator
     */
    function earlyWithdrawLocked(uint256 positionIndex)
        external
        whenNotPaused
        nonReentrant
        returns (uint256)
    {
        require(positionIndex < userLockedPositions[msg.sender].length, "Invalid position");
        LockedPosition storage position = userLockedPositions[msg.sender][positionIndex];

        require(!position.withdrawn, "Already withdrawn");
        require(block.timestamp < position.unlockTime, "Use withdrawLocked instead");

        // Mark as withdrawn
        position.withdrawn = true;

        // Calculate penalty: 25% of principal
        uint256 penaltyAmount = (position.amount * EARLY_WITHDRAW_PENALTY_BPS) / 10000;
        uint256 amountAfterPenalty = position.amount - penaltyAmount;

        // Update total locked balance
        if (position.token == address(usdc)) {
            totalLockedUSDC -= position.amount;

            // Transfer penalty to treasury operator
            if (isNativeUSDC) {
                require(address(this).balance >= position.amount, "Insufficient balance");
                (bool successPenalty, ) = payable(treasuryOperator).call{value: penaltyAmount}("");
                require(successPenalty, "Penalty transfer failed");

                // Transfer remaining to user
                (bool successUser, ) = payable(msg.sender).call{value: amountAfterPenalty}("");
                require(successUser, "User transfer failed");
            } else {
                require(usdc.balanceOf(address(this)) >= position.amount, "Insufficient USDC");
                usdc.safeTransfer(treasuryOperator, penaltyAmount);
                usdc.safeTransfer(msg.sender, amountAfterPenalty);
            }
        } else if (position.token == address(eurc)) {
            totalLockedEURC -= position.amount;
            require(eurc.balanceOf(address(this)) >= position.amount, "Insufficient EURC");
            eurc.safeTransfer(treasuryOperator, penaltyAmount);
            eurc.safeTransfer(msg.sender, amountAfterPenalty);
        }

        // Update user info
        _updateUserInfo(msg.sender, position.amount, 0, false);

        emit EarlyWithdrawPenalty(msg.sender, position.id, penaltyAmount);
        emit LockedPositionWithdrawn(msg.sender, position.id, amountAfterPenalty, 0);
        return amountAfterPenalty;
    }

    /**
     * @notice Claims accumulated yield from a locked position without unlocking principal
     * @param positionIndex Index of the position in user's array
     * @return yieldAmount Amount of yield claimed
     * @dev Principal remains locked, can claim yield multiple times
     */
    function claimLockedYield(uint256 positionIndex)
        external
        whenNotPaused
        nonReentrant
        returns (uint256)
    {
        require(positionIndex < userLockedPositions[msg.sender].length, "Invalid position");
        LockedPosition storage position = userLockedPositions[msg.sender][positionIndex];

        require(!position.withdrawn, "Position withdrawn");

        // Calculate yield since last claim
        uint256 yieldAmount = _calculateLockedYield(position);
        require(yieldAmount > 0, "No yield to claim");

        // Update last claim time
        position.lastYieldClaim = block.timestamp;

        // Transfer yield to user
        if (position.token == address(usdc)) {
            if (isNativeUSDC) {
                require(address(this).balance >= yieldAmount, "Insufficient balance");
                (bool success, ) = payable(msg.sender).call{value: yieldAmount}("");
                require(success, "Transfer failed");
            } else {
                require(usdc.balanceOf(address(this)) >= yieldAmount, "Insufficient USDC");
                usdc.safeTransfer(msg.sender, yieldAmount);
            }
        } else if (position.token == address(eurc)) {
            require(eurc.balanceOf(address(this)) >= yieldAmount, "Insufficient EURC");
            eurc.safeTransfer(msg.sender, yieldAmount);
        }

        emit YieldClaimed(msg.sender, position.id, yieldAmount);
        return yieldAmount;
    }

    // ============ Internal Functions ============

    /**
     * @notice Calculates accumulated yield for a locked position
     * @param position The locked position
     * @return yieldAmount Accumulated yield since last claim (6 decimals)
     * @dev Yield = principal * boosted APY * time elapsed / 365 days
     *      Boosted APY = baseAPY * multiplier / 100
     */
    function _calculateLockedYield(LockedPosition memory position) internal view returns (uint256) {
        // Base APY in basis points (400 = 4.00%)
        // This is the approximate USYC yield based on US Treasury rates
        uint256 baseAPY = 400;

        // Get boost multiplier based on lock period (100 = 1x, 117 = 1.17x, etc.)
        uint256 boostMultiplier = 100; // Default 1x (no boost)
        if (position.lockPeriodMonths == 1) {
            boostMultiplier = LOCK_BOOST_MULTIPLIER_1_MONTH; // 1.17x
        } else if (position.lockPeriodMonths == 3) {
            boostMultiplier = LOCK_BOOST_MULTIPLIER_3_MONTH; // 1.35x
        } else if (position.lockPeriodMonths == 12) {
            boostMultiplier = LOCK_BOOST_MULTIPLIER_12_MONTH; // 1.69x
        }

        // Calculate boosted APY: baseAPY * multiplier / 100
        // e.g., 400 * 117 / 100 = 468 (4.68%)
        uint256 boostedAPY = (baseAPY * boostMultiplier) / 100;

        // Time elapsed since last claim (in seconds)
        uint256 timeElapsed = block.timestamp - position.lastYieldClaim;

        // Yield = principal * boostedAPY * time / (365 days * 10000)
        // position.amount has 6 decimals, boostedAPY is in bps (basis points)
        // Result: 6 decimals
        uint256 yieldAmount = (position.amount * boostedAPY * timeElapsed) / (365 days * 10000);

        return yieldAmount;
    }

    /**
     * @notice Updates user info and calculates points
     * @param user Address of the user
     * @dev Points are calculated based on current balance (shares converted to USD) and time held.
     *      usdcAmount / eurcAmount / isDeposit kept only for backward compatibility.
     */
    function _updateUserInfo(address user, uint256 /* usdcAmount */, uint256 /* eurcAmount */, bool /* isDeposit */) internal {
        UserInfo storage info = userInfo[user];

        // If first deposit, initialize user info
        if (info.firstDepositTime == 0) {
            info.firstDepositTime = block.timestamp;
            info.lastBalanceUpdate = block.timestamp;
            info.balanceAtLastUpdate = 0;
            info.accumulatedPoints = 0;
        } else {
            // Calculate points for the period since last update with previous balance
            if (info.lastBalanceUpdate > 0 && info.balanceAtLastUpdate > 0) {
                uint256 daysSinceLastUpdate = (block.timestamp - info.lastBalanceUpdate) / SECONDS_PER_DAY;
                if (daysSinceLastUpdate > 0) {
                    uint256 periodPoints =
                        (daysSinceLastUpdate * info.balanceAtLastUpdate * POINTS_PER_USD_PER_DAY) / 10000;
                    info.accumulatedPoints += periodPoints;
                }
            }
        }

        // Get current balance before updating
        uint256 currentBalanceUSD = _getUserCurrentBalanceUSD(user);
        
        // Calculate days since last update using OLD lastBalanceUpdate (before we update it)
        uint256 daysSinceUpdateForCurrentPoints = 0;
        if (info.lastBalanceUpdate > 0) {
            daysSinceUpdateForCurrentPoints = (block.timestamp - info.lastBalanceUpdate) / SECONDS_PER_DAY;
        } else if (info.firstDepositTime > 0) {
            daysSinceUpdateForCurrentPoints = (block.timestamp - info.firstDepositTime) / SECONDS_PER_DAY;
        }
        
        // Calculate time points for current period (will be 0 since we're updating now, but kept for consistency)
        uint256 timePoints = (daysSinceUpdateForCurrentPoints * currentBalanceUSD * POINTS_PER_USD_PER_DAY) / 10000;
        uint256 balancePoints = (currentBalanceUSD * POINTS_PER_USD_DEPOSIT) / 10000;
        
        // Update balance and timestamp
        info.balanceAtLastUpdate = currentBalanceUSD;
        info.lastBalanceUpdate = block.timestamp;

        // Update current points (for caching/events)
        // Note: timePoints will be 0 since daysSinceLastUpdate is calculated from old lastBalanceUpdate
        // which is now equal to block.timestamp (just updated), but this is correct for current points calculation
        info.currentPoints = info.accumulatedPoints + timePoints + balancePoints;

        emit PointsUpdated(user, info.currentPoints);
    }

    /**
     * @notice Checks if treasury operator can convert to USYC
     * @return true if operator is allowlisted and conditions are met
     * @dev TESTNET VERSION: Entitlements check disabled for testing
     */
    function canConvertToUSYC() internal pure returns (bool) {
        return true; // Testnet: Skip entitlements check
    }

    /**
     * @notice Converts USDC to USYC via Teller
     * @dev Requires Teller contract to be set and vault to be whitelisted
     *      Flow:
     *      1. Approve USDC to Teller
     *      2. Call Teller.deposit() to mint USYC
     *      3. Update totalUSDC and totalUSYC accounting
     */
    function convertToUSYC() internal {
        require(canConvertToUSYC(), "Operator not allowlisted");
        require(totalUSDC >= USYC_MINIMUM, "Insufficient amount");
        require(address(teller) != address(0), "Teller not set");

        uint256 usdcToConvert = totalUSDC;

        // For native USDC, we need to handle differently
        if (!isNativeUSDC) {
            // Approve Teller to spend USDC
            usdc.approve(address(teller), usdcToConvert);

            // Deposit USDC to Teller and receive USYC
            uint256 usycReceived = teller.deposit(usdcToConvert, address(this));

            // Update accounting
            totalUSDC = 0;
            totalUSYC += usycReceived;

            emit ConvertedToUSYC(usdcToConvert, usycReceived);
            emit USYCMinted(usdcToConvert, usycReceived);
        } else {
            // Native USDC - emit event only (manual conversion needed)
            emit ConvertedToUSYC(usdcToConvert, 0);
        }
    }

    /**
     * @notice Manually mint USYC via Teller (operator only)
     * @param usdcAmount Amount of USDC to convert (18 decimals for native, 6 for ERC20)
     * @return usycAmount Amount of USYC received (6 decimals)
     * @dev For controlled conversion when pool has sufficient USDC
     *      Native USDC: sends msg.value to Teller, converts to 6 decimals for Teller call
     *      ERC20 USDC: approves and calls Teller directly
     */
    function mintUSYC(uint256 usdcAmount) external onlyOperator nonReentrant returns (uint256 usycAmount) {
        require(address(teller) != address(0), "Teller not set");
        require(usdcAmount <= totalUSDC, "Insufficient USDC in pool");
        require(usdcAmount > 0, "Amount must be > 0");

        if (isNativeUSDC) {
            // Native USDC: totalUSDC is in 18 decimals
            // Convert to 6 decimals for Teller's assets parameter
            uint256 usdcAmount6Dec = usdcAmount / 1e12;
            require(usdcAmount6Dec > 0, "Amount too small");
            require(address(this).balance >= usdcAmount, "Insufficient contract balance");

            // Call Teller.deposit with native currency
            // Teller expects assets in 6 decimals, receives native via msg.value
            usycAmount = teller.deposit{value: usdcAmount}(usdcAmount6Dec, address(this));

            // Update accounting
            totalUSDC -= usdcAmount;
            totalUSYC += usycAmount;
        } else {
            // ERC20 USDC: standard flow with 6 decimals
            // Approve Teller to spend USDC
            usdc.approve(address(teller), usdcAmount);

            // Deposit USDC to Teller and receive USYC
            usycAmount = teller.deposit(usdcAmount, address(this));

            // Update accounting
            totalUSDC -= usdcAmount;
            totalUSYC += usycAmount;
        }

        emit USYCMinted(usdcAmount, usycAmount);
    }

    /**
     * @notice Redeem USYC back to USDC via Teller (operator only)
     * @param usycAmount Amount of USYC to redeem (6 decimals)
     * @return usdcAmount Amount of USDC received (18 decimals for native, 6 for ERC20)
     * @dev For liquidity management when users withdraw
     *      Native USDC: receives native currency from Teller, converts to 18 decimals for storage
     *      ERC20 USDC: receives ERC20 USDC directly
     */
    function redeemUSYC(uint256 usycAmount) external onlyOperator nonReentrant returns (uint256 usdcAmount) {
        require(address(teller) != address(0), "Teller not set");
        require(usycAmount <= totalUSYC, "Insufficient USYC");
        require(usycAmount > 0, "Amount must be > 0");

        // Approve Teller to spend USYC
        IERC20(address(usyc)).approve(address(teller), usycAmount);

        if (isNativeUSDC) {
            // Native USDC: Teller returns USDC in 6 decimals
            uint256 balanceBefore = address(this).balance;

            // Redeem USYC - Teller will send native currency
            uint256 usdcReceived6Dec = teller.redeem(usycAmount, address(this), address(this));

            // Calculate actual received native currency (may differ due to exchange rate)
            uint256 balanceAfter = address(this).balance;
            uint256 nativeReceived = balanceAfter - balanceBefore;

            // Use actual received amount if available, otherwise convert from 6 to 18 decimals
            usdcAmount = nativeReceived > 0 ? nativeReceived : usdcReceived6Dec * 1e12;

            // Update accounting (in 18 decimals)
            totalUSYC -= usycAmount;
            totalUSDC += usdcAmount;
        } else {
            // ERC20 USDC: standard flow with 6 decimals
            usdcAmount = teller.redeem(usycAmount, address(this), address(this));

            // Update accounting
            totalUSYC -= usycAmount;
            totalUSDC += usdcAmount;
        }

        emit USYCRedeemed(usycAmount, usdcAmount);
    }

    /**
     * @notice Accrues platform fee by minting fee shares
     * @dev Performance fee: mints shares to platform proportional to profit.
     *      Should be called periodically by operator/keeper, not on every deposit.
     */
    function accrue() external {
        uint256 currentValue = getTotalPoolValue();

        if (currentValue > lastRecordedValue && lastRecordedValue > 0) {
            uint256 profit = currentValue - lastRecordedValue;

            // Calculate fee amount
            uint256 feeAmount = (profit * platformFeeBps) / 10000;

            // Mint fee shares to platform
            uint256 pricePerShare = getPricePerShare();
            uint256 feeShares = (feeAmount * PRECISION) / pricePerShare;

            totalShares += feeShares;
            userShares[treasuryOperator] += feeShares;

            lastRecordedValue = currentValue;

            emit PlatformFeeAccrued(feeShares);
        } else if (lastRecordedValue == 0) {
            // First time: record current value
            lastRecordedValue = currentValue;
        }
    }

    /**
     * @notice Internal version for backward compatibility (deprecated)
     * @dev Use accrue() instead
     */
    function accruePlatformFee() internal {
        // no-op, kept for backward compatibility
    }

    /**
     * @notice Gets all locked positions for a user
     * @param user Address of the user
     * @return Array of locked positions
     */
    function getUserLockedPositions(address user) external view returns (LockedPosition[] memory) {
        return userLockedPositions[user];
    }

    /**
     * @notice Gets a single locked position for a user
     * @param user Address of the user
     * @param positionIndex Index of the position in user's array
     * @return The locked position
     */
    function getUserLockedPosition(address user, uint256 positionIndex)
        external
        view
        returns (LockedPosition memory)
    {
        require(positionIndex < userLockedPositions[user].length, "Invalid position index");
        return userLockedPositions[user][positionIndex];
    }

    /**
     * @notice Gets the current accumulated yield for a locked position
     * @param user Address of the user
     * @param positionIndex Index of the position in user's array
     * @return yieldAmount Current accumulated yield (6 decimals)
     */
    function getLockedPositionYield(address user, uint256 positionIndex)
        external
        view
        returns (uint256)
    {
        require(positionIndex < userLockedPositions[user].length, "Invalid position index");
        LockedPosition memory position = userLockedPositions[user][positionIndex];
        require(!position.withdrawn, "Position already withdrawn");
        return _calculateLockedYield(position);
    }

    /**
     * @notice Gets count of user's locked positions
     * @param user Address of the user
     * @return Number of locked positions
     */
    function getUserLockedPositionsCount(address user) external view returns (uint256) {
        return userLockedPositions[user].length;
    }

    /**
     * @notice Manually updates user points based on current time and balance
     * @dev Does not change user funds, only updates UserInfo (accumulatedPoints, lastBalanceUpdate, currentPoints).
     *      Useful for frontend "Update my points" button without moving funds.
     */
    function refreshUserPoints() external {
        require(userInfo[msg.sender].firstDepositTime > 0, "User has no deposits");
        _updateUserInfo(msg.sender, 0, 0, true);
    }

    // ============ Owner / Operator Functions ============

    /**
     * @notice Updates the treasury operator address
     * @param newOperator New operator address
     * @dev TESTNET VERSION: Entitlements check disabled for testing
     */
    function setTreasuryOperator(address newOperator) external onlyOwner {
        require(newOperator != address(0), "Invalid address");
        // TESTNET: Entitlements check disabled
        // require(entitlements.isEntitled(newOperator), "Operator must be allowlisted");

        address oldOperator = treasuryOperator;
        treasuryOperator = newOperator;

        emit OperatorUpdated(oldOperator, newOperator);
    }

    /**
     * @notice Updates the platform fee
     * @param newFeeBps New fee in basis points (max 200 = 2%)
     */
    function setPlatformFee(uint256 newFeeBps) external onlyOwner {
        require(newFeeBps <= MAX_PLATFORM_FEE_BPS, "Fee too high");

        uint256 oldFee = platformFeeBps;
        platformFeeBps = newFeeBps;

        emit FeeUpdated(oldFee, newFeeBps);
    }

    /**
     * @notice Records USYC amount after conversion (called by operator)
     * @param usycAmount Amount of USYC received (6 decimals)
     * @dev TESTNET:
     *      - This function simulates USYC exposure for TVL/points/fee.
     *      MAINNET:
     *      - Must be called only after actual USYC mint off-chain.
     */
    function recordUSYCConversion(uint256 usycAmount) external onlyOperator {
        require(usycAmount > 0, "Invalid amount");
        totalUSYC += usycAmount;
        emit USYCConversionRecorded(msg.sender, usycAmount, totalUSYC);
    }

    /**
     * @notice Sets the Teller contract address for USDC/USYC conversion
     * @param _teller Address of the Teller contract
     * @dev Can only be called by owner. Set to address(0) to disable.
     */
    function setTeller(address _teller) external onlyOwner {
        address oldTeller = address(teller);
        teller = ITeller(_teller);
        emit TellerUpdated(oldTeller, _teller);
    }

    /**
     * @notice Sets the Points Multiplier NFT contract address
     * @param nftAddress Address of the NFT contract (can be address(0) to disable)
     */
    function setPointsMultiplierNFT(address nftAddress) external onlyOwner {
        if (nftAddress != address(0)) {
            // Verify it's a valid ERC721 contract by checking supportsInterface
            try IERC721(nftAddress).supportsInterface(0x80ac58cd) returns (bool supported) {
                require(supported, "Not a valid ERC721 contract");
            } catch {
                revert("Invalid NFT contract");
            }
        }
        pointsMultiplierNFT = IERC721(nftAddress);
    }

    /**
     * @notice Enables or disables NFT multiplier
     * @param enabled Whether NFT multiplier should be enabled
     */
    function setNFTMultiplierEnabled(bool enabled) external onlyOwner {
        require(address(pointsMultiplierNFT) != address(0) || !enabled, "NFT contract not set");
        nftMultiplierEnabled = enabled;
    }

    // ============ Pausable Functions ============

    /**
     * @notice Pauses the contract (emergency stop)
     * @dev Prevents deposits and withdrawals
     */
    function pause() external onlyOwner {
        _pause();
    }

    /**
     * @notice Unpauses the contract
     */
    function unpause() external onlyOwner {
        _unpause();
    }

    // ============ Emergency Functions ============

    /**
     * @notice Emergency withdraw function (owner only)
     * @param token Address of token to withdraw (address(0) for native currency)
     * @param to Address to send tokens to
     * @param amount Amount to withdraw (0 = all)
     * @dev TESTNET-ONLY SAFETY HATCH.
     *      In production this MUST be restricted by multisig/timelock
     *      and/or limited to non-core assets.
     */
    function emergencyWithdraw(address token, address to, uint256 amount) external onlyOwner {
        require(to != address(0), "Invalid recipient");

        if (token == address(0)) {
            // Withdraw native currency
            uint256 balance = address(this).balance;
            uint256 withdrawAmount = amount == 0 ? balance : amount;
            require(withdrawAmount <= balance, "Insufficient balance");

            (bool success, ) = payable(to).call{value: withdrawAmount}("");
            require(success, "Transfer failed");

            emit EmergencyWithdraw(address(0), to, withdrawAmount);
        } else {
            // Withdraw ERC20 token
            IERC20 tokenContract = IERC20(token);
            uint256 balance = tokenContract.balanceOf(address(this));
            uint256 withdrawAmount = amount == 0 ? balance : amount;
            require(withdrawAmount <= balance, "Insufficient balance");

            tokenContract.safeTransfer(to, withdrawAmount);

            emit EmergencyWithdraw(token, to, withdrawAmount);
        }
    }

    // ============ Receive Function ============

    /**
     * @notice Allows contract to receive native currency
     * @dev Required for receiving USDC from Teller when redeeming USYC on Arc Testnet
     */
    receive() external payable {}
}
