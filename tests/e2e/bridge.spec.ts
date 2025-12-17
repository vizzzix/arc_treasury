import { test, expect } from '@playwright/test';

test.describe('Bridge Page - Basic Tests', () => {
  test('Bridge page loads correctly', async ({ page }) => {
    await page.goto('/bridge');

    // Check page title/header
    await expect(page.locator('h2:has-text("Bridge USDC")')).toBeVisible();

    // Check network selectors are visible
    await expect(page.getByText('From', { exact: true })).toBeVisible();
    await expect(page.locator('p.uppercase:has-text("To")')).toBeVisible();

    // Check amount input exists
    await expect(page.locator('input[type="number"]')).toBeVisible();
  });

  test('Shows connect wallet button when not connected', async ({ page }) => {
    await page.goto('/bridge');

    // Should show connect button in header
    await expect(page.getByRole('button', { name: 'Connect Wallet' })).toBeVisible();
  });

  test('Can switch networks', async ({ page }) => {
    await page.goto('/bridge');

    // Click From dropdown (first network selector)
    await page.locator('button:has-text("Ethereum Sepolia")').first().click();

    // Should show network options in dropdown
    await expect(page.getByRole('button', { name: 'Arc Testnet', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Solana Devnet', exact: true })).toBeVisible();
  });

  test('Amount input works', async ({ page }) => {
    await page.goto('/bridge');

    const amountInput = page.locator('input[type="number"]');
    await amountInput.fill('100');

    await expect(amountInput).toHaveValue('100');
  });

  test('Faucet info card is visible', async ({ page }) => {
    // Clear localStorage to show faucet info
    await page.goto('/bridge');
    await page.evaluate(() => localStorage.removeItem('bridge_faucet_dismissed'));
    await page.reload();

    await expect(page.getByText('Need testnet tokens?')).toBeVisible();
    await expect(page.getByText('Circle Faucet')).toBeVisible();
  });

  test('HALF and MAX buttons work', async ({ page }) => {
    await page.goto('/bridge');

    // HALF and MAX buttons should be visible
    await expect(page.getByRole('button', { name: 'HALF' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'MAX' })).toBeVisible();
  });

  test('Swap networks button works', async ({ page }) => {
    await page.goto('/bridge');

    // Get initial networks
    const fromButton = page.locator('button:has-text("Ethereum Sepolia")').first();
    const toButton = page.locator('button:has-text("Arc Testnet")').first();

    await expect(fromButton).toBeVisible();
    await expect(toButton).toBeVisible();

    // Click swap button
    await page.locator('button[title="Swap networks"]').click();

    // Networks should be swapped
    await expect(page.locator('button:has-text("Arc Testnet")').first()).toBeVisible();
  });
});

test.describe('Bridge Page - Form Validation', () => {
  test('Shows warning when amount exceeds balance', async ({ page }) => {
    await page.goto('/bridge');

    // Enter a large amount (balance should be 0 when not connected)
    const amountInput = page.locator('input[type="number"]');
    await amountInput.fill('999999999');

    // Should show warning about exceeding balance
    await expect(page.getByText('Amount exceeds available balance')).toBeVisible();
  });

  test('Bridge button disabled when no amount', async ({ page }) => {
    await page.goto('/bridge');

    // Main bridge button should be disabled when no amount entered
    const bridgeButton = page.getByRole('button', { name: /Connect EVM Wallet|Bridge to/ });
    await expect(bridgeButton).toBeDisabled();
  });

  test('Bridge button disabled when amount exceeds balance', async ({ page }) => {
    await page.goto('/bridge');

    const amountInput = page.locator('input[type="number"]');
    await amountInput.fill('999999');

    // Button should remain disabled
    const bridgeButton = page.getByRole('button', { name: /Connect EVM Wallet|Bridge to/ });
    await expect(bridgeButton).toBeDisabled();
  });
});

test.describe('Bridge Page - Stuck Transfer Recovery', () => {
  test('Shows stuck transfer help link', async ({ page }) => {
    await page.goto('/bridge');

    // Should show help link
    await expect(page.getByText('Having trouble with a stuck transfer?')).toBeVisible();
  });

  test('Opens restore form when clicked', async ({ page }) => {
    await page.goto('/bridge');

    // Click the help link
    await page.getByText('Having trouble with a stuck transfer?').click();

    // Form should appear
    await expect(page.getByPlaceholder('0x...')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Restore' })).toBeVisible();
  });

  test('Shows error for invalid tx hash', async ({ page }) => {
    await page.goto('/bridge');

    // Open restore form
    await page.getByText('Having trouble with a stuck transfer?').click();

    // Enter invalid hash
    await page.getByPlaceholder('0x...').fill('0xinvalid');
    await page.getByRole('button', { name: 'Restore' }).click();

    // Should show error
    await expect(page.getByText(/should be 66 characters/)).toBeVisible();
  });
});
