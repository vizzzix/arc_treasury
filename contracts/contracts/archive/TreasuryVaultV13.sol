// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/ReentrancyGuardUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/PausableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import "./interfaces/IUSYC.sol";
import "./interfaces/IEntitlements.sol";
import "./interfaces/IUSYCOracle.sol";
import "./interfaces/ITeller.sol";
import "./interfaces/IWUSDC.sol";

/**
 * @title TreasuryVaultV13
 * @notice Treasury vault with yield simulation for testnet
 * @dev V13 Changes:
 *   - Added accrueYield() for testnet yield simulation
 *   - Added lastYieldAccrual timestamp tracking
 *   - Operator can simulate daily/periodic yield from reserve
 */
contract TreasuryVaultV13 is
    Initializable,
    OwnableUpgradeable,
    ReentrancyGuardUpgradeable,
    PausableUpgradeable,
    UUPSUpgradeable
{
    using SafeERC20 for IERC20;

    // ============ Constants ============

    uint256 public constant USYC_MINIMUM = 100_000 * 1e6;
    uint256 private constant PRECISION = 1e18;
    address private constant NATIVE_USDC = 0x3600000000000000000000000000000000000000;
    uint256 private constant SECONDS_PER_DAY = 86400;

    // Points system constants
    uint256 public constant MIN_DEPOSIT_FOR_POINTS = 100 * 1e6; // $100 minimum (6 decimals)
    uint256 public constant POINTS_USD_DIVISOR = 10; // 1 point per $10 per day
    uint256 public constant DEPOSIT_BONUS_DIVISOR = 100; // 0.1 point per $10 = 1 point per $100
    uint256 public constant REFERRAL_BONUS_BPS = 1000; // 10% of referral's points
    uint256 public constant NFT_BOOST_BPS = 12000; // 120% = x1.2

    // Lock multipliers (in basis points, 10000 = x1)
    uint256 public constant LOCK_MULTIPLIER_FLEX = 10000;      // x1
    uint256 public constant LOCK_MULTIPLIER_1_MONTH = 15000;   // x1.5
    uint256 public constant LOCK_MULTIPLIER_3_MONTH = 20000;   // x2
    uint256 public constant LOCK_MULTIPLIER_12_MONTH = 30000;  // x3

    // Other constants
    uint256 public constant MAX_PLATFORM_FEE_BPS = 200;
    uint256 public constant LOCK_MINIMUM_DEPOSIT = 10 * 1e6;
    uint256 public constant EARLY_WITHDRAW_PENALTY_BPS = 2500;
    uint256 public constant LOCK_PERIOD_1_MONTH = 30 days;
    uint256 public constant LOCK_PERIOD_3_MONTH = 90 days;
    uint256 public constant LOCK_PERIOD_12_MONTH = 365 days;

    // ============ State Variables ============

    IERC20 public usdc;
    bool public isNativeUSDC;
    IERC20 public eurc;
    IUSYC public usyc;
    IEntitlements public entitlements;
    IUSYCOracle public usycOracle;
    ITeller public teller;
    IWUSDC public wusdc;

    uint256 public totalEURC;
    uint256 public totalEURCShares;
    mapping(address => uint256) public userEURCShares;

    // V8: New UserInfo structure
    struct UserInfo {
        uint256 permanentPoints;      // Points that never decrease
        uint256 lastPointsUpdate;     // Last timestamp when points were calculated
        uint256 totalDeposited;       // Lifetime total deposited (for stats)
        address referrer;             // Who referred this user
        uint256 referralPoints;       // Points earned from referrals
    }
    mapping(address => UserInfo) public userInfo;

    // V8: Track active deposits for time-based points
    struct ActiveDeposit {
        uint256 amount;               // Amount in USD (6 decimals)
        uint256 startTime;            // When deposit started
        uint256 lockMultiplier;       // Lock multiplier in BPS
        bool isLocked;                // Is this a locked position
    }
    mapping(address => ActiveDeposit[]) public userActiveDeposits;

    struct LockedPosition {
        uint256 id;
        uint256 amount;
        address token;
        uint8 lockPeriodMonths;
        uint256 depositTime;
        uint256 unlockTime;
        uint256 lastYieldClaim;
        bool withdrawn;
    }
    uint256 public nextLockId;
    mapping(address => LockedPosition[]) public userLockedPositions;
    uint256 public totalLockedUSDC;
    uint256 public totalLockedEURC;

    address public treasuryOperator;
    IERC721 public pointsBoostNFT;
    bool public nftBoostEnabled;
    uint256 public totalUSDC;
    uint256 public totalUSYC;
    uint256 public totalShares;
    mapping(address => uint256) public userShares;
    uint256 public platformFeeBps;
    uint256 public baseAPYBps;

    // V8: Referral tracking
    mapping(address => address[]) public userReferrals; // referrer => list of referrals
    mapping(address => bool) public hasReferrer; // user => has set referrer

    // V12: Auto-conversion settings
    bool public autoConvertEnabled;

    // V13: Yield simulation for testnet
    uint256 public lastYieldAccrual;
    uint256 public yieldAPYBps;  // APY in basis points (e.g., 420 = 4.2%)

    // ============ Events ============

    event Deposit(address indexed user, uint256 amount, uint256 shares);
    event DepositEURC(address indexed user, uint256 amount, uint256 shares);
    event Withdraw(address indexed user, uint256 shares, uint256 amount);
    event WithdrawEURC(address indexed user, uint256 shares, uint256 amount);
    event DepositLocked(address indexed user, uint256 indexed lockId, uint256 amount, address token, uint8 lockPeriodMonths, uint256 unlockTime);
    event LockedPositionWithdrawn(address indexed user, uint256 indexed lockId, uint256 amount, uint256 yield);
    event EarlyWithdrawPenalty(address indexed user, uint256 indexed lockId, uint256 penaltyAmount);
    event YieldClaimed(address indexed user, uint256 indexed lockId, uint256 yieldAmount);

    // V8: Points events
    event PointsEarned(address indexed user, uint256 amount, string reason);
    event ReferralSet(address indexed user, address indexed referrer);
    event ReferralPointsEarned(address indexed referrer, address indexed referral, uint256 points);

    // Admin events
    event OperatorUpdated(address indexed oldOperator, address indexed newOperator);
    event TellerUpdated(address indexed oldTeller, address indexed newTeller);
    event WUSDCUpdated(address indexed oldWusdc, address indexed newWusdc);
    event UsycOracleUpdated(address indexed oldOracle, address indexed newOracle);
    event BaseAPYUpdated(uint256 oldAPY, uint256 newAPY);
    event EmergencyWithdraw(address indexed token, address indexed to, uint256 amount);
    event USYCMinted(uint256 usdcAmount, uint256 usycAmount);
    event USYCRedeemed(uint256 usycAmount, uint256 usdcAmount);

    // V9: Storage fix event
    event TotalUSYCReset(uint256 oldValue, uint256 newValue);

    // V12: Auto-conversion events
    event AutoConvertToggled(bool enabled);
    event AutoUSYCMinted(uint256 usdcAmount, uint256 usycAmount);
    event AutoUSYCRedeemed(uint256 usycAmount, uint256 usdcAmount);

    // V13: Yield simulation events
    event YieldAccrued(uint256 yieldAmount, uint256 totalPoolValue, uint256 timestamp);
    event YieldAPYUpdated(uint256 oldAPY, uint256 newAPY);

    // ============ Modifiers ============

    modifier onlyOperator() {
        require(msg.sender == treasuryOperator, "Not operator");
        _;
    }

    // ============ Initializer ============

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    function initialize(
        address _usdc,
        address _eurc,
        address _usyc,
        address _entitlements,
        address _usycOracle,
        address _treasuryOperator,
        uint256 _platformFeeBps
    ) public initializer {
        __Ownable_init(msg.sender);
        __ReentrancyGuard_init();
        __Pausable_init();
        __UUPSUpgradeable_init();

        require(_usdc != address(0), "Invalid USDC");
        require(_eurc != address(0), "Invalid EURC");
        require(_usyc != address(0), "Invalid USYC");
        require(_treasuryOperator != address(0), "Invalid operator");
        require(_platformFeeBps <= MAX_PLATFORM_FEE_BPS, "Fee too high");

        usdc = IERC20(_usdc);
        isNativeUSDC = (_usdc == NATIVE_USDC);
        eurc = IERC20(_eurc);
        usyc = IUSYC(_usyc);
        entitlements = IEntitlements(_entitlements);
        usycOracle = IUSYCOracle(_usycOracle);
        treasuryOperator = _treasuryOperator;
        platformFeeBps = _platformFeeBps;
        nextLockId = 1;
        wusdc = IWUSDC(_usdc);
    }

    // ============ UUPS ============

    function _authorizeUpgrade(address) internal override onlyOwner {}

    // ============ V9: Storage Fix ============

    /// @notice V9: Reset totalUSYC to fix storage collision from V8 upgrade
    function resetTotalUSYC() external onlyOwner {
        uint256 oldValue = totalUSYC;
        totalUSYC = 0;
        emit TotalUSYCReset(oldValue, 0);
    }

    /// @notice Record USYC amount after manual transfer (called by operator)
    /// @param usycAmount Amount of USYC to record (6 decimals)
    function recordUSYCConversion(uint256 usycAmount) external onlyOperator {
        require(usycAmount > 0, "Invalid amount");
        totalUSYC += usycAmount;
        emit TotalUSYCReset(0, totalUSYC);  // Reuse event for simplicity
    }

    /// @notice Reset totalUSDC to fix storage collision
    function resetTotalUSDC() external onlyOwner {
        totalUSDC = 0;
    }

    // ============ Points System V8 ============

    /**
     * @notice Get user's total points (permanent + pending time-based)
     * @dev Points = permanent + timeBasedPending + referralPoints
     *      With optional NFT boost (x1.2)
     */
    function getUserPoints(address user) public view returns (uint256) {
        UserInfo memory info = userInfo[user];

        // Calculate pending time-based points
        uint256 pendingTimePoints = _calculatePendingTimePoints(user);

        // Total base points
        uint256 basePoints = info.permanentPoints + pendingTimePoints + info.referralPoints;

        // Apply NFT boost if enabled and user has NFT
        if (nftBoostEnabled && address(pointsBoostNFT) != address(0)) {
            try pointsBoostNFT.balanceOf(user) returns (uint256 balance) {
                if (balance > 0) {
                    return (basePoints * NFT_BOOST_BPS) / 10000; // x1.2
                }
            } catch {}
        }

        return basePoints;
    }

    /**
     * @notice Calculate pending time-based points for active deposits
     */
    function _calculatePendingTimePoints(address user) internal view returns (uint256) {
        uint256 totalPending = 0;
        ActiveDeposit[] memory deposits = userActiveDeposits[user];

        for (uint256 i = 0; i < deposits.length; i++) {
            if (deposits[i].amount == 0) continue;

            // Skip if below minimum
            if (deposits[i].amount < MIN_DEPOSIT_FOR_POINTS) continue;

            uint256 daysHeld = (block.timestamp - deposits[i].startTime) / SECONDS_PER_DAY;
            if (daysHeld == 0) continue;

            // Points = (amount / $10) * days * multiplier
            // amount is in 6 decimals, so amount / 10e6 = USD / 10
            uint256 basePoints = (deposits[i].amount * daysHeld) / (POINTS_USD_DIVISOR * 1e6);
            uint256 multipliedPoints = (basePoints * deposits[i].lockMultiplier) / 10000;

            totalPending += multipliedPoints;
        }

        return totalPending;
    }

    /**
     * @notice Set referrer for a user (one-time only)
     * @param referrer Address of the referrer
     */
    function setReferrer(address referrer) external {
        require(!hasReferrer[msg.sender], "Referrer already set");
        require(referrer != address(0), "Invalid referrer");
        require(referrer != msg.sender, "Cannot refer yourself");

        userInfo[msg.sender].referrer = referrer;
        hasReferrer[msg.sender] = true;
        userReferrals[referrer].push(msg.sender);

        emit ReferralSet(msg.sender, referrer);
    }

    /**
     * @notice Finalize and lock in pending points (call before withdraw)
     */
    function _finalizePoints(address user) internal {
        uint256 pendingPoints = _calculatePendingTimePoints(user);

        if (pendingPoints > 0) {
            userInfo[user].permanentPoints += pendingPoints;
            emit PointsEarned(user, pendingPoints, "time_based");

            // Award referral points
            address referrer = userInfo[user].referrer;
            if (referrer != address(0)) {
                uint256 referralBonus = (pendingPoints * REFERRAL_BONUS_BPS) / 10000;
                userInfo[referrer].referralPoints += referralBonus;
                emit ReferralPointsEarned(referrer, user, referralBonus);
            }
        }

        // Reset start times for active deposits
        ActiveDeposit[] storage deposits = userActiveDeposits[user];
        for (uint256 i = 0; i < deposits.length; i++) {
            if (deposits[i].amount > 0) {
                deposits[i].startTime = block.timestamp;
            }
        }

        userInfo[user].lastPointsUpdate = block.timestamp;
    }

    /**
     * @notice Award deposit bonus points
     */
    function _awardDepositBonus(address user, uint256 amount, uint256 lockMultiplier) internal {
        if (amount < MIN_DEPOSIT_FOR_POINTS) return;

        // Deposit bonus: 0.1 point per $10 = 1 point per $100
        // amount in 6 decimals, so amount / 100e6 = number of $100
        uint256 bonusPoints = amount / (DEPOSIT_BONUS_DIVISOR * 1e6);

        // Apply lock multiplier
        bonusPoints = (bonusPoints * lockMultiplier) / 10000;

        if (bonusPoints > 0) {
            userInfo[user].permanentPoints += bonusPoints;
            userInfo[user].totalDeposited += amount;
            emit PointsEarned(user, bonusPoints, "deposit_bonus");

            // Award referral points for deposit bonus
            address referrer = userInfo[user].referrer;
            if (referrer != address(0)) {
                uint256 referralBonus = (bonusPoints * REFERRAL_BONUS_BPS) / 10000;
                userInfo[referrer].referralPoints += referralBonus;
                emit ReferralPointsEarned(referrer, user, referralBonus);
            }
        }
    }

    /**
     * @notice Add active deposit for time-based points tracking
     */
    function _addActiveDeposit(address user, uint256 amount, uint256 lockMultiplier, bool isLocked) internal {
        userActiveDeposits[user].push(ActiveDeposit({
            amount: amount,
            startTime: block.timestamp,
            lockMultiplier: lockMultiplier,
            isLocked: isLocked
        }));
    }

    /**
     * @notice Remove or reduce active deposit
     */
    function _removeActiveDeposit(address user, uint256 amount, bool isLocked) internal {
        ActiveDeposit[] storage deposits = userActiveDeposits[user];
        uint256 remaining = amount;

        for (uint256 i = 0; i < deposits.length && remaining > 0; i++) {
            if (deposits[i].isLocked != isLocked) continue;
            if (deposits[i].amount == 0) continue;

            if (deposits[i].amount <= remaining) {
                remaining -= deposits[i].amount;
                deposits[i].amount = 0;
            } else {
                deposits[i].amount -= remaining;
                remaining = 0;
            }
        }
    }

    // ============ View Functions ============

    function getTotalPoolValue() public view returns (uint256) {
        uint256 usycPrice = 1_000_000;
        if (address(usycOracle) != address(0) && address(usycOracle).code.length > 0) {
            try usycOracle.getUSYCPrice() returns (uint256 price) {
                if (price > 0) usycPrice = price;
            } catch {}
        }
        uint256 usycValue = (usycPrice * totalUSYC) / 1e6;
        uint256 usdcValue = isNativeUSDC ? totalUSDC / 1e12 : totalUSDC;
        return usycValue + usdcValue;
    }

    function getUserShareValue(address user) public view returns (uint256) {
        if (totalShares == 0 || userShares[user] == 0) return 0;
        uint256 pricePerShare = getPricePerShare();
        uint256 shareValue18 = (userShares[user] * pricePerShare) / PRECISION;
        return shareValue18 / 1e12;
    }

    function getPricePerShare() public view returns (uint256) {
        if (totalShares == 0) return PRECISION;
        uint256 totalValue = getTotalPoolValue();
        return (totalValue * 1e12 * PRECISION) / totalShares;
    }

    function getUserOverview(address user) external view returns (
        uint256 usdcShares,
        uint256 usdcValue,
        uint256 eurcShares,
        uint256 eurcValue,
        uint256 points,
        uint256 referralPoints,
        uint256 referralCount,
        bool hasNFT
    ) {
        usdcShares = userShares[user];
        usdcValue = getUserShareValue(user);
        eurcShares = userEURCShares[user];
        if (eurcShares > 0 && totalEURCShares > 0) {
            uint256 pricePerShare = (totalEURC * 1e12 * PRECISION) / totalEURCShares;
            eurcValue = (eurcShares * pricePerShare) / PRECISION / 1e12;
        }
        points = getUserPoints(user);
        referralPoints = userInfo[user].referralPoints;
        referralCount = userReferrals[user].length;
        if (address(pointsBoostNFT) != address(0)) {
            try pointsBoostNFT.balanceOf(user) returns (uint256 bal) {
                hasNFT = bal > 0;
            } catch {}
        }
    }

    // ============ Deposit Functions ============

    function deposit(uint256 amount) external payable whenNotPaused nonReentrant returns (uint256) {
        require(amount > 0, "Amount must be > 0");

        // V13: Auto-accrue yield before deposit (so new depositor doesn't get old yield)
        _tryAccrueYield();

        if (isNativeUSDC) {
            require(msg.value == amount, "Amount mismatch");
        } else {
            require(msg.value == 0, "Native not accepted");
            usdc.safeTransferFrom(msg.sender, address(this), amount);
        }

        uint256 sharesToMint;
        if (totalShares == 0) {
            sharesToMint = isNativeUSDC ? amount : amount * 1e12;
        } else {
            uint256 pricePerShare = getPricePerShare();
            uint256 amount18 = isNativeUSDC ? amount : amount * 1e12;
            sharesToMint = (amount18 * PRECISION) / pricePerShare;
        }

        totalUSDC += amount;
        totalShares += sharesToMint;
        userShares[msg.sender] += sharesToMint;

        // V8: Points - convert to 6 decimals for points calculation
        uint256 amount6Dec = isNativeUSDC ? amount / 1e12 : amount;
        _awardDepositBonus(msg.sender, amount6Dec, LOCK_MULTIPLIER_FLEX);
        _addActiveDeposit(msg.sender, amount6Dec, LOCK_MULTIPLIER_FLEX, false);

        emit Deposit(msg.sender, amount, sharesToMint);

        // V12: Auto-convert to USYC if enabled
        if (autoConvertEnabled && address(teller) != address(0)) {
            _tryAutoMintUSYC(amount);
        }

        return sharesToMint;
    }

    function depositEURC(uint256 amount) external whenNotPaused nonReentrant returns (uint256) {
        require(amount > 0, "Amount must be > 0");
        eurc.safeTransferFrom(msg.sender, address(this), amount);

        uint256 sharesToMint;
        if (totalEURCShares == 0) {
            sharesToMint = amount * 1e12;
        } else {
            uint256 pricePerShare = (totalEURC * 1e12 * PRECISION) / totalEURCShares;
            sharesToMint = (amount * 1e12 * PRECISION) / pricePerShare;
        }

        totalEURC += amount;
        totalEURCShares += sharesToMint;
        userEURCShares[msg.sender] += sharesToMint;

        // V8: Points (EURC assumed same value as USD for simplicity)
        _awardDepositBonus(msg.sender, amount, LOCK_MULTIPLIER_FLEX);
        _addActiveDeposit(msg.sender, amount, LOCK_MULTIPLIER_FLEX, false);

        emit DepositEURC(msg.sender, amount, sharesToMint);
        return sharesToMint;
    }

    // ============ Withdraw Functions ============

    function withdraw(uint256 sharesToWithdraw) external whenNotPaused nonReentrant returns (uint256) {
        require(sharesToWithdraw > 0, "Shares must be > 0");
        require(userShares[msg.sender] >= sharesToWithdraw, "Insufficient shares");

        // V13: Auto-accrue yield before withdraw (so user gets their share of yield)
        _tryAccrueYield();

        // V8: Finalize pending points before withdraw
        _finalizePoints(msg.sender);

        // V12: Calculate withdraw amount from total pool value (USDC + USYC)
        uint256 totalValue = getTotalPoolValue(); // in 6 decimals
        uint256 withdrawValue6Dec = (totalValue * sharesToWithdraw) / totalShares;

        // Convert to native decimals (18 for Arc native USDC)
        uint256 usdcToWithdraw = isNativeUSDC ? withdrawValue6Dec * 1e12 : withdrawValue6Dec;

        // V12: Auto-redeem USYC if not enough USDC available
        if (usdcToWithdraw > totalUSDC && totalUSYC > 0 && address(teller) != address(0)) {
            uint256 shortfall = usdcToWithdraw - totalUSDC;
            _autoRedeemUSYC(shortfall);
        }

        require(usdcToWithdraw > 0 && usdcToWithdraw <= totalUSDC, "Insufficient liquidity");

        totalUSDC -= usdcToWithdraw;
        totalShares -= sharesToWithdraw;
        userShares[msg.sender] -= sharesToWithdraw;

        // V8: Remove from active deposits
        uint256 amount6Dec = isNativeUSDC ? usdcToWithdraw / 1e12 : usdcToWithdraw;
        _removeActiveDeposit(msg.sender, amount6Dec, false);

        if (isNativeUSDC) {
            (bool success, ) = payable(msg.sender).call{value: usdcToWithdraw}("");
            require(success, "Transfer failed");
        } else {
            usdc.safeTransfer(msg.sender, usdcToWithdraw);
        }

        emit Withdraw(msg.sender, sharesToWithdraw, usdcToWithdraw);
        return usdcToWithdraw;
    }

    function withdrawEURC(uint256 sharesToWithdraw) external whenNotPaused nonReentrant returns (uint256) {
        require(sharesToWithdraw > 0, "Shares must be > 0");
        require(userEURCShares[msg.sender] >= sharesToWithdraw, "Insufficient shares");

        _finalizePoints(msg.sender);

        uint256 eurcToWithdraw = (totalEURC * sharesToWithdraw * PRECISION) / totalEURCShares / PRECISION;
        require(eurcToWithdraw > 0 && eurcToWithdraw <= totalEURC, "Invalid withdraw");

        totalEURC -= eurcToWithdraw;
        totalEURCShares -= sharesToWithdraw;
        userEURCShares[msg.sender] -= sharesToWithdraw;

        _removeActiveDeposit(msg.sender, eurcToWithdraw, false);
        eurc.safeTransfer(msg.sender, eurcToWithdraw);

        emit WithdrawEURC(msg.sender, sharesToWithdraw, eurcToWithdraw);
        return eurcToWithdraw;
    }

    // ============ Locked Positions ============

    function _getLockMultiplier(uint8 lockPeriodMonths) internal pure returns (uint256) {
        if (lockPeriodMonths == 1) return LOCK_MULTIPLIER_1_MONTH;
        if (lockPeriodMonths == 3) return LOCK_MULTIPLIER_3_MONTH;
        if (lockPeriodMonths == 12) return LOCK_MULTIPLIER_12_MONTH;
        return LOCK_MULTIPLIER_FLEX;
    }

    function depositLockedUSDC(uint256 amount, uint8 lockPeriodMonths)
        external payable whenNotPaused nonReentrant returns (uint256 lockId)
    {
        require(amount >= LOCK_MINIMUM_DEPOSIT, "Below minimum");
        require(lockPeriodMonths == 1 || lockPeriodMonths == 3 || lockPeriodMonths == 12, "Invalid period");

        if (isNativeUSDC) {
            require(msg.value == amount, "Amount mismatch");
        } else {
            usdc.safeTransferFrom(msg.sender, address(this), amount);
        }

        uint256 lockDuration = lockPeriodMonths == 1 ? LOCK_PERIOD_1_MONTH :
                               lockPeriodMonths == 3 ? LOCK_PERIOD_3_MONTH : LOCK_PERIOD_12_MONTH;

        lockId = nextLockId++;
        userLockedPositions[msg.sender].push(LockedPosition({
            id: lockId,
            amount: amount,
            token: address(usdc),
            lockPeriodMonths: lockPeriodMonths,
            depositTime: block.timestamp,
            unlockTime: block.timestamp + lockDuration,
            lastYieldClaim: block.timestamp,
            withdrawn: false
        }));

        totalLockedUSDC += amount;

        // V8: Points with lock multiplier
        uint256 amount6Dec = isNativeUSDC ? amount / 1e12 : amount;
        uint256 lockMultiplier = _getLockMultiplier(lockPeriodMonths);
        _awardDepositBonus(msg.sender, amount6Dec, lockMultiplier);
        _addActiveDeposit(msg.sender, amount6Dec, lockMultiplier, true);

        emit DepositLocked(msg.sender, lockId, amount, address(usdc), lockPeriodMonths, block.timestamp + lockDuration);
    }

    function depositLockedEURC(uint256 amount, uint8 lockPeriodMonths)
        external whenNotPaused nonReentrant returns (uint256 lockId)
    {
        require(amount >= LOCK_MINIMUM_DEPOSIT, "Below minimum");
        require(lockPeriodMonths == 1 || lockPeriodMonths == 3 || lockPeriodMonths == 12, "Invalid period");

        eurc.safeTransferFrom(msg.sender, address(this), amount);

        uint256 lockDuration = lockPeriodMonths == 1 ? LOCK_PERIOD_1_MONTH :
                               lockPeriodMonths == 3 ? LOCK_PERIOD_3_MONTH : LOCK_PERIOD_12_MONTH;

        lockId = nextLockId++;
        userLockedPositions[msg.sender].push(LockedPosition({
            id: lockId,
            amount: amount,
            token: address(eurc),
            lockPeriodMonths: lockPeriodMonths,
            depositTime: block.timestamp,
            unlockTime: block.timestamp + lockDuration,
            lastYieldClaim: block.timestamp,
            withdrawn: false
        }));

        totalLockedEURC += amount;

        uint256 lockMultiplier = _getLockMultiplier(lockPeriodMonths);
        _awardDepositBonus(msg.sender, amount, lockMultiplier);
        _addActiveDeposit(msg.sender, amount, lockMultiplier, true);

        emit DepositLocked(msg.sender, lockId, amount, address(eurc), lockPeriodMonths, block.timestamp + lockDuration);
    }

    function withdrawLocked(uint256 positionIndex) external whenNotPaused nonReentrant returns (uint256) {
        require(positionIndex < userLockedPositions[msg.sender].length, "Invalid position");
        LockedPosition storage position = userLockedPositions[msg.sender][positionIndex];
        require(!position.withdrawn, "Already withdrawn");
        require(block.timestamp >= position.unlockTime, "Still locked");

        // V8: Finalize points
        _finalizePoints(msg.sender);

        uint256 yieldAmount = _calculateLockedYield(position);
        uint256 totalAmount = position.amount + yieldAmount;
        position.withdrawn = true;

        // Remove from active deposits
        uint256 amount6Dec = isNativeUSDC && position.token == address(usdc) ?
                            position.amount / 1e12 : position.amount;
        _removeActiveDeposit(msg.sender, amount6Dec, true);

        if (position.token == address(usdc)) {
            totalLockedUSDC -= position.amount;
            if (isNativeUSDC) {
                (bool success, ) = payable(msg.sender).call{value: totalAmount}("");
                require(success, "Transfer failed");
            } else {
                usdc.safeTransfer(msg.sender, totalAmount);
            }
        } else {
            totalLockedEURC -= position.amount;
            eurc.safeTransfer(msg.sender, totalAmount);
        }

        emit LockedPositionWithdrawn(msg.sender, position.id, position.amount, yieldAmount);
        return totalAmount;
    }

    function earlyWithdrawLocked(uint256 positionIndex) external whenNotPaused nonReentrant returns (uint256) {
        require(positionIndex < userLockedPositions[msg.sender].length, "Invalid position");
        LockedPosition storage position = userLockedPositions[msg.sender][positionIndex];
        require(!position.withdrawn, "Already withdrawn");
        require(block.timestamp < position.unlockTime, "Already unlocked");

        _finalizePoints(msg.sender);

        uint256 penaltyAmount = (position.amount * EARLY_WITHDRAW_PENALTY_BPS) / 10000;
        uint256 amountAfterPenalty = position.amount - penaltyAmount;
        position.withdrawn = true;

        uint256 amount6Dec = isNativeUSDC && position.token == address(usdc) ?
                            position.amount / 1e12 : position.amount;
        _removeActiveDeposit(msg.sender, amount6Dec, true);

        if (position.token == address(usdc)) {
            totalLockedUSDC -= position.amount;
            if (isNativeUSDC) {
                (bool s1, ) = payable(treasuryOperator).call{value: penaltyAmount}("");
                (bool s2, ) = payable(msg.sender).call{value: amountAfterPenalty}("");
                require(s1 && s2, "Transfer failed");
            } else {
                usdc.safeTransfer(treasuryOperator, penaltyAmount);
                usdc.safeTransfer(msg.sender, amountAfterPenalty);
            }
        } else {
            totalLockedEURC -= position.amount;
            eurc.safeTransfer(treasuryOperator, penaltyAmount);
            eurc.safeTransfer(msg.sender, amountAfterPenalty);
        }

        emit EarlyWithdrawPenalty(msg.sender, position.id, penaltyAmount);
        emit LockedPositionWithdrawn(msg.sender, position.id, amountAfterPenalty, 0);
        return amountAfterPenalty;
    }

    function claimLockedYield(uint256 positionIndex) external whenNotPaused nonReentrant returns (uint256) {
        require(positionIndex < userLockedPositions[msg.sender].length, "Invalid position");
        LockedPosition storage position = userLockedPositions[msg.sender][positionIndex];
        require(!position.withdrawn, "Position withdrawn");

        uint256 yieldAmount = _calculateLockedYield(position);
        require(yieldAmount > 0, "No yield");

        position.lastYieldClaim = block.timestamp;

        if (position.token == address(usdc)) {
            if (isNativeUSDC) {
                (bool success, ) = payable(msg.sender).call{value: yieldAmount}("");
                require(success, "Transfer failed");
            } else {
                usdc.safeTransfer(msg.sender, yieldAmount);
            }
        } else {
            eurc.safeTransfer(msg.sender, yieldAmount);
        }

        emit YieldClaimed(msg.sender, position.id, yieldAmount);
        return yieldAmount;
    }

    function _calculateLockedYield(LockedPosition memory position) internal view returns (uint256) {
        if (position.withdrawn) return 0;
        uint256 apy = baseAPYBps > 0 ? baseAPYBps : 420;
        uint256 netAPY = (apy * 95) / 100; // 5% platform fee
        uint256 timeElapsed = block.timestamp - position.lastYieldClaim;
        return (position.amount * netAPY * timeElapsed) / (10000 * 365 days);
    }

    // ============ View Functions for Positions ============

    function getUserLockedPositions(address user) external view returns (LockedPosition[] memory) {
        return userLockedPositions[user];
    }

    function getUserActiveDeposits(address user) external view returns (ActiveDeposit[] memory) {
        return userActiveDeposits[user];
    }

    function getUserReferrals(address user) external view returns (address[] memory) {
        return userReferrals[user];
    }

    function getPointsBreakdown(address user) external view returns (
        uint256 permanentPoints,
        uint256 pendingTimePoints,
        uint256 referralPoints,
        uint256 totalPoints
    ) {
        permanentPoints = userInfo[user].permanentPoints;
        pendingTimePoints = _calculatePendingTimePoints(user);
        referralPoints = userInfo[user].referralPoints;
        totalPoints = getUserPoints(user);
    }

    // ============ USYC Operations ============

    /// @notice V12: Internal function to auto-mint USYC on deposit
    function _tryAutoMintUSYC(uint256 usdcAmount) internal {
        if (usdcAmount == 0 || totalUSDC < usdcAmount) return;

        // Convert to 6 decimals for Teller
        uint256 usdcAmount6Dec = isNativeUSDC ? usdcAmount / 1e12 : usdcAmount;
        if (usdcAmount6Dec == 0) return;

        try teller.deposit(usdcAmount6Dec, address(this)) returns (uint256 usycAmount) {
            totalUSDC -= usdcAmount;
            totalUSYC += usycAmount;
            emit AutoUSYCMinted(usdcAmount, usycAmount);
        } catch {
            // Silently fail - keep USDC in vault
        }
    }

    /// @notice V12: Internal function to auto-redeem USYC on withdraw
    function _autoRedeemUSYC(uint256 usdcNeeded) internal {
        if (totalUSYC == 0) return;

        // Calculate how much USYC to redeem (convert needed amount to 6 decimals)
        uint256 needed6Dec = isNativeUSDC ? usdcNeeded / 1e12 : usdcNeeded;

        // Get USYC price to calculate amount to redeem
        uint256 usycPrice = 1_000_000; // default $1
        if (address(usycOracle) != address(0)) {
            try usycOracle.getUSYCPrice() returns (uint256 price) {
                if (price > 0) usycPrice = price;
            } catch {}
        }

        // Calculate USYC amount needed (with small buffer for rounding)
        uint256 usycToRedeem = (needed6Dec * 1e6 * 101) / (usycPrice * 100); // +1% buffer
        if (usycToRedeem > totalUSYC) {
            usycToRedeem = totalUSYC;
        }

        if (usycToRedeem == 0) return;

        IERC20(address(usyc)).approve(address(teller), usycToRedeem);

        if (isNativeUSDC) {
            uint256 wusdcBefore = IERC20(address(wusdc)).balanceOf(address(this));
            try teller.redeem(usycToRedeem, address(this), address(this)) returns (uint256 received6Dec) {
                uint256 wusdcAfter = IERC20(address(wusdc)).balanceOf(address(this));
                if (wusdcAfter > wusdcBefore) {
                    wusdc.withdraw(wusdcAfter - wusdcBefore);
                }
                uint256 usdcReceived = received6Dec * 1e12;
                totalUSYC -= usycToRedeem;
                totalUSDC += usdcReceived;
                emit AutoUSYCRedeemed(usycToRedeem, usdcReceived);
            } catch {}
        } else {
            try teller.redeem(usycToRedeem, address(this), address(this)) returns (uint256 usdcReceived) {
                totalUSYC -= usycToRedeem;
                totalUSDC += usdcReceived;
                emit AutoUSYCRedeemed(usycToRedeem, usdcReceived);
            } catch {}
        }
    }

    /// @notice Set max approval for Teller - call once
    function approveUSDCForTeller() external onlyOperator {
        require(address(teller) != address(0), "Teller not set");
        usdc.approve(address(teller), type(uint256).max);
    }

    /// @notice Convert USDC to USYC (call approveUSDCForTeller first)
    function mintUSYC(uint256 usdcAmount) external onlyOperator nonReentrant returns (uint256 usycAmount) {
        require(address(teller) != address(0), "Teller not set");
        require(usdcAmount <= totalUSDC && usdcAmount > 0, "Invalid amount");

        uint256 usdcAmount6Dec = isNativeUSDC ? usdcAmount / 1e12 : usdcAmount;
        usycAmount = teller.deposit(usdcAmount6Dec, address(this));

        totalUSDC -= usdcAmount;
        totalUSYC += usycAmount;
        emit USYCMinted(usdcAmount, usycAmount);
    }

    function redeemUSYC(uint256 usycAmount) external onlyOperator nonReentrant returns (uint256 usdcAmount) {
        require(address(teller) != address(0), "Teller not set");
        require(usycAmount <= totalUSYC && usycAmount > 0, "Invalid amount");

        IERC20(address(usyc)).approve(address(teller), usycAmount);

        if (isNativeUSDC) {
            uint256 wusdcBefore = IERC20(address(wusdc)).balanceOf(address(this));
            uint256 received6Dec = teller.redeem(usycAmount, address(this), address(this));
            uint256 wusdcAfter = IERC20(address(wusdc)).balanceOf(address(this));
            if (wusdcAfter > wusdcBefore) {
                wusdc.withdraw(wusdcAfter - wusdcBefore);
            }
            usdcAmount = received6Dec * 1e12;
        } else {
            usdcAmount = teller.redeem(usycAmount, address(this), address(this));
        }

        totalUSYC -= usycAmount;
        totalUSDC += usdcAmount;
        emit USYCRedeemed(usycAmount, usdcAmount);
    }

    // ============ Admin Functions ============

    function setTreasuryOperator(address newOperator) external onlyOwner {
        require(newOperator != address(0), "Invalid");
        emit OperatorUpdated(treasuryOperator, newOperator);
        treasuryOperator = newOperator;
    }

    function setTeller(address _teller) external onlyOwner {
        emit TellerUpdated(address(teller), _teller);
        teller = ITeller(_teller);
    }

    function setWUSDC(address _wusdc) external onlyOwner {
        emit WUSDCUpdated(address(wusdc), _wusdc);
        wusdc = IWUSDC(_wusdc);
    }

    function setUsycOracle(address _oracle) external onlyOwner {
        emit UsycOracleUpdated(address(usycOracle), _oracle);
        usycOracle = IUSYCOracle(_oracle);
    }

    function setBaseAPY(uint256 _apyBps) external onlyOwner {
        require(_apyBps <= 2000, "APY too high");
        emit BaseAPYUpdated(baseAPYBps, _apyBps);
        baseAPYBps = _apyBps;
    }

    function setPointsBoostNFT(address _nft) external onlyOwner {
        pointsBoostNFT = IERC721(_nft);
    }

    function setNFTBoostEnabled(bool _enabled) external onlyOwner {
        nftBoostEnabled = _enabled;
    }

    /// @notice V12: Toggle auto-conversion of USDC to USYC
    function setAutoConvertEnabled(bool _enabled) external onlyOwner {
        autoConvertEnabled = _enabled;
        emit AutoConvertToggled(_enabled);
    }

    // ============ V13: Yield Simulation ============

    /**
     * @notice Set the APY for yield simulation (testnet only)
     * @param _apyBps APY in basis points (e.g., 420 = 4.2%)
     */
    function setYieldAPY(uint256 _apyBps) external onlyOwner {
        require(_apyBps <= 2000, "APY too high"); // Max 20%
        emit YieldAPYUpdated(yieldAPYBps, _apyBps);
        yieldAPYBps = _apyBps;
    }

    /**
     * @notice Accrue yield to the pool (testnet simulation)
     * @dev Called by operator periodically to simulate USYC yield
     *      Yield is paid from untracked USDC reserve on contract
     *      Formula: yield = totalPoolValue * APY * timePassed / (365 days * 10000)
     */
    function accrueYield() external onlyOperator nonReentrant returns (uint256 yieldAmount) {
        require(yieldAPYBps > 0, "Yield APY not set");
        require(totalShares > 0, "No deposits");

        // Calculate time since last accrual
        uint256 lastAccrual = lastYieldAccrual;
        if (lastAccrual == 0) {
            // First accrual - just set timestamp, no yield
            lastYieldAccrual = block.timestamp;
            return 0;
        }

        uint256 timePassed = block.timestamp - lastAccrual;
        if (timePassed == 0) return 0;

        // Get current pool value (6 decimals)
        uint256 poolValue6Dec = getTotalPoolValue();

        // Calculate yield: poolValue * APY * time / (365 days * 10000)
        // Result in 6 decimals
        yieldAmount = (poolValue6Dec * yieldAPYBps * timePassed) / (365 days * 10000);

        if (yieldAmount == 0) return 0;

        // Convert to native decimals (18 for Arc)
        uint256 yieldNative = isNativeUSDC ? yieldAmount * 1e12 : yieldAmount;

        // Check we have enough untracked reserve
        uint256 contractBalance = isNativeUSDC ? address(this).balance : usdc.balanceOf(address(this));
        uint256 trackedBalance = totalUSDC + totalLockedUSDC;
        uint256 reserve = contractBalance > trackedBalance ? contractBalance - trackedBalance : 0;

        require(reserve >= yieldNative, "Insufficient reserve for yield");

        // Add yield to tracked USDC (increases pool value)
        totalUSDC += yieldNative;
        lastYieldAccrual = block.timestamp;

        emit YieldAccrued(yieldAmount, poolValue6Dec + yieldAmount, block.timestamp);
        return yieldAmount;
    }

    /**
     * @notice Get current reserve available for yield payments
     * @return reserve Untracked USDC available (in native decimals)
     */
    function getYieldReserve() external view returns (uint256 reserve) {
        uint256 contractBalance = isNativeUSDC ? address(this).balance : usdc.balanceOf(address(this));
        uint256 trackedBalance = totalUSDC + totalLockedUSDC;
        reserve = contractBalance > trackedBalance ? contractBalance - trackedBalance : 0;
    }

    /**
     * @notice Calculate pending yield since last accrual
     * @return pendingYield Pending yield amount (6 decimals)
     */
    function getPendingYield() external view returns (uint256 pendingYield) {
        if (yieldAPYBps == 0 || totalShares == 0 || lastYieldAccrual == 0) return 0;

        uint256 timePassed = block.timestamp - lastYieldAccrual;
        if (timePassed == 0) return 0;

        uint256 poolValue6Dec = getTotalPoolValue();
        pendingYield = (poolValue6Dec * yieldAPYBps * timePassed) / (365 days * 10000);
    }

    /**
     * @notice V13: Internal function to auto-accrue yield on deposit/withdraw
     * @dev Silently fails if conditions not met (no revert)
     */
    function _tryAccrueYield() internal {
        if (yieldAPYBps == 0 || totalShares == 0 || lastYieldAccrual == 0) return;

        uint256 timePassed = block.timestamp - lastYieldAccrual;
        if (timePassed == 0) return;

        // Get current pool value (6 decimals)
        uint256 poolValue6Dec = getTotalPoolValue();

        // Calculate yield
        uint256 yieldAmount = (poolValue6Dec * yieldAPYBps * timePassed) / (365 days * 10000);
        if (yieldAmount == 0) return;

        // Convert to native decimals (18 for Arc)
        uint256 yieldNative = isNativeUSDC ? yieldAmount * 1e12 : yieldAmount;

        // Check reserve
        uint256 contractBalance = isNativeUSDC ? address(this).balance : usdc.balanceOf(address(this));
        uint256 trackedBalance = totalUSDC + totalLockedUSDC;
        uint256 reserve = contractBalance > trackedBalance ? contractBalance - trackedBalance : 0;

        if (reserve < yieldNative) return; // Silently fail if not enough reserve

        // Add yield
        totalUSDC += yieldNative;
        lastYieldAccrual = block.timestamp;

        emit YieldAccrued(yieldAmount, poolValue6Dec + yieldAmount, block.timestamp);
    }

    function setEURC(address _eurc) external onlyOwner {
        require(_eurc != address(0), "Invalid EURC");
        eurc = IERC20(_eurc);
    }

    function pause() external onlyOwner { _pause(); }
    function unpause() external onlyOwner { _unpause(); }

    function emergencyWithdraw(address token, address to, uint256 amount) external onlyOwner {
        require(to != address(0), "Invalid");
        if (token == address(0)) {
            uint256 bal = address(this).balance;
            uint256 amt = amount == 0 ? bal : amount;
            (bool success, ) = payable(to).call{value: amt}("");
            require(success, "Failed");
            emit EmergencyWithdraw(address(0), to, amt);
        } else {
            IERC20 t = IERC20(token);
            uint256 bal = t.balanceOf(address(this));
            uint256 amt = amount == 0 ? bal : amount;
            t.safeTransfer(to, amt);
            emit EmergencyWithdraw(token, to, amt);
        }
    }

    receive() external payable {}
}


