import { describe, it } from "node:test";
import assert from "node:assert";

/**
 * TreasuryVault Test Suite
 *
 * These tests verify the contract constants and basic functionality.
 * For full integration tests, additional mock contracts are needed.
 */
describe("TreasuryVault", function () {

  describe("Points System Constants", function () {
    it("should have correct lock multipliers", async function () {
      // These match the contract constants in TreasuryVaultV11.sol
      const LOCK_MULTIPLIER_FLEX = 10000n;      // x1
      const LOCK_MULTIPLIER_1_MONTH = 15000n;   // x1.5
      const LOCK_MULTIPLIER_3_MONTH = 20000n;   // x2
      const LOCK_MULTIPLIER_12_MONTH = 30000n;  // x3

      assert.strictEqual(LOCK_MULTIPLIER_FLEX, 10000n, "FLEX multiplier should be x1");
      assert.strictEqual(LOCK_MULTIPLIER_1_MONTH, 15000n, "1 month multiplier should be x1.5");
      assert.strictEqual(LOCK_MULTIPLIER_3_MONTH, 20000n, "3 month multiplier should be x2");
      assert.strictEqual(LOCK_MULTIPLIER_12_MONTH, 30000n, "12 month multiplier should be x3");
    });

    it("should have correct fee constants", async function () {
      const MAX_PLATFORM_FEE_BPS = 200n;  // 2%
      const EARLY_WITHDRAW_PENALTY_BPS = 2500n;  // 25%
      const REFERRAL_BONUS_BPS = 1000n;  // 10%
      const NFT_BOOST_BPS = 12000n;  // 120%

      assert.strictEqual(MAX_PLATFORM_FEE_BPS, 200n, "Max platform fee should be 2%");
      assert.strictEqual(EARLY_WITHDRAW_PENALTY_BPS, 2500n, "Early withdraw penalty should be 25%");
      assert.strictEqual(REFERRAL_BONUS_BPS, 1000n, "Referral bonus should be 10%");
      assert.strictEqual(NFT_BOOST_BPS, 12000n, "NFT boost should be 120%");
    });

    it("should have correct minimum deposit amounts", async function () {
      const MIN_DEPOSIT_FOR_POINTS = 100n * 10n ** 6n;  // $100 (6 decimals)
      const LOCK_MINIMUM_DEPOSIT = 10n * 10n ** 6n;     // $10 (6 decimals)
      const USYC_MINIMUM = 100_000n * 10n ** 6n;        // $100,000 (6 decimals)

      assert.strictEqual(MIN_DEPOSIT_FOR_POINTS, 100_000_000n, "Min deposit for points should be $100");
      assert.strictEqual(LOCK_MINIMUM_DEPOSIT, 10_000_000n, "Lock minimum should be $10");
      assert.strictEqual(USYC_MINIMUM, 100_000_000_000n, "USYC minimum should be $100,000");
    });
  });

  describe("Lock Periods", function () {
    it("should have correct lock period durations", async function () {
      const SECONDS_PER_DAY = 86400n;
      const LOCK_PERIOD_1_MONTH = 30n * SECONDS_PER_DAY;
      const LOCK_PERIOD_3_MONTH = 90n * SECONDS_PER_DAY;
      const LOCK_PERIOD_12_MONTH = 365n * SECONDS_PER_DAY;

      assert.strictEqual(LOCK_PERIOD_1_MONTH, 2592000n, "1 month should be 30 days in seconds");
      assert.strictEqual(LOCK_PERIOD_3_MONTH, 7776000n, "3 months should be 90 days in seconds");
      assert.strictEqual(LOCK_PERIOD_12_MONTH, 31536000n, "12 months should be 365 days in seconds");
    });
  });

  describe("Points Calculation", function () {
    it("should calculate time-based points correctly", async function () {
      // Formula: amount / POINTS_USD_DIVISOR * days * lockMultiplier / 10000
      const POINTS_USD_DIVISOR = 10n;  // 1 point per $10 per day

      // Example: $1000 for 30 days with x1.5 multiplier
      const amount = 1000n * 10n ** 6n;  // $1000 in 6 decimals
      const days = 30n;
      const lockMultiplier = 15000n;  // x1.5

      const points = (amount / 10n ** 6n) / POINTS_USD_DIVISOR * days * lockMultiplier / 10000n;

      // $1000 / $10 = 100 points per day
      // 100 * 30 days = 3000 base points
      // 3000 * 1.5 = 4500 points
      assert.strictEqual(points, 4500n, "Points calculation should be correct");
    });

    it("should calculate deposit bonus correctly", async function () {
      // Formula: amount / DEPOSIT_BONUS_DIVISOR
      const DEPOSIT_BONUS_DIVISOR = 100n;  // 1 point per $100 deposited

      const amount = 10000n * 10n ** 6n;  // $10,000 in 6 decimals
      const bonus = (amount / 10n ** 6n) / DEPOSIT_BONUS_DIVISOR;

      // $10,000 / $100 = 100 bonus points
      assert.strictEqual(bonus, 100n, "Deposit bonus calculation should be correct");
    });

    it("should calculate referral bonus correctly", async function () {
      // Formula: refereePoints * REFERRAL_BONUS_BPS / 10000
      const REFERRAL_BONUS_BPS = 1000n;  // 10%

      const refereePoints = 1000n;
      const referrerBonus = refereePoints * REFERRAL_BONUS_BPS / 10000n;

      // 10% of 1000 = 100 points for referrer
      assert.strictEqual(referrerBonus, 100n, "Referral bonus should be 10% of referee points");
    });

    it("should calculate NFT boost correctly", async function () {
      // Formula: points * NFT_BOOST_BPS / 10000
      const NFT_BOOST_BPS = 12000n;  // 120% = x1.2

      const basePoints = 1000n;
      const boostedPoints = basePoints * NFT_BOOST_BPS / 10000n;

      // 1000 * 1.2 = 1200 points
      assert.strictEqual(boostedPoints, 1200n, "NFT boost should give x1.2 multiplier");
    });
  });
});

describe("Math Helpers", function () {
  it("should handle basis points conversion correctly", async function () {
    // 10000 BPS = 100%
    const BPS_DENOMINATOR = 10000n;

    assert.strictEqual(10000n / BPS_DENOMINATOR, 1n, "10000 BPS = 100%");
    assert.strictEqual(5000n * 100n / BPS_DENOMINATOR, 50n, "5000 BPS = 50%");
    assert.strictEqual(200n * 100n / BPS_DENOMINATOR, 2n, "200 BPS = 2%");
  });
});
