/**
 * MetaMask Integration Tests using Synpress
 *
 * IMPORTANT: These tests require:
 * 1. A test wallet seed phrase in .env.test (TEST_WALLET_SEED)
 * 2. Run with: npm run test:e2e:metamask
 *
 * The seed phrase should be for a TESTNET wallet only!
 * Never use a mainnet wallet with real funds.
 */

import { test, expect, chromium, type BrowserContext } from '@playwright/test';
import path from 'path';
import { fileURLToPath } from 'url';

// ESM fix for __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Skip these tests if no MetaMask extension is available
test.skip(({ browserName }) => browserName !== 'chromium', 'MetaMask only works in Chromium');

// Test configuration for MetaMask
const METAMASK_VERSION = '11.16.0';
const EXTENSION_PATH = path.join(__dirname, '../../metamask-extension');

// Test wallet - TESTNET ONLY!
const TEST_SEED = process.env.TEST_WALLET_SEED || 'test test test test test test test test test test test junk';
const TEST_PASSWORD = 'TestPassword123!';

test.describe('Bridge with Real MetaMask', () => {
  let context: BrowserContext;

  test.beforeAll(async () => {
    // Note: For real MetaMask tests, you need to:
    // 1. Download MetaMask extension
    // 2. Extract to ./metamask-extension folder
    // 3. Set TEST_WALLET_SEED in .env.test

    console.log('MetaMask tests require manual extension setup');
    console.log('See: https://github.com/AcalaNetwork/chopsticks#using-metamask');
  });

  test.skip('Connect MetaMask and verify balance', async ({ page }) => {
    // This test demonstrates the flow but requires MetaMask setup

    await page.goto('/bridge');

    // Click connect wallet
    await page.click('button:has-text("Connect")');

    // MetaMask popup would appear here
    // Synpress handles the approval automatically

    // After connection, check balance is visible
    await expect(page.locator('text=USDC')).toBeVisible();
  });

  test.skip('Full bridge flow - Sepolia to Arc', async ({ page }) => {
    await page.goto('/bridge');

    // Connect wallet (handled by Synpress)
    await page.click('button:has-text("Connect")');

    // Select networks
    await page.locator('text=Ethereum Sepolia').first().click();
    await page.locator('button:has-text("Arc Testnet")').click();

    // Enter amount
    await page.fill('input[type="number"]', '1');

    // Click bridge
    await page.click('button:has-text("Bridge")');

    // MetaMask will prompt for approval + transaction
    // Synpress auto-confirms these

    // Wait for success
    await expect(page.locator('text=Bridge Complete')).toBeVisible({ timeout: 120000 });
  });
});

/**
 * Alternative: Using dappeteer (another MetaMask automation tool)
 *
 * import dappeteer from '@chainsafe/dappeteer';
 *
 * const browser = await dappeteer.launch(puppeteer, { metamaskVersion: 'latest' });
 * const metamask = await dappeteer.setupMetamask(browser, {
 *   seed: TEST_SEED,
 *   password: TEST_PASSWORD,
 * });
 * await metamask.switchNetwork('sepolia');
 */
