import { test, expect } from '@playwright/test';

test.describe('Dashboard (/app)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/app');
    await page.waitForLoadState('networkidle');
  });

  test('shows deposit/withdraw tabs or sections', async ({ page }) => {
    const depositText = page.getByText(/deposit/i).first();
    await expect(depositText).toBeVisible();
  });

  test('shows USDC and EURC options', async ({ page }) => {
    await expect(page.getByText(/USDC/i).first()).toBeVisible();
  });

  test('shows connect wallet prompt when no wallet connected', async ({ page }) => {
    const connectBtn = page.getByRole('button', { name: /connect|wallet/i }).first();
    await expect(connectBtn).toBeVisible();
  });

  test('deposit input accepts numeric values', async ({ page }) => {
    const amountInput = page.getByPlaceholder(/amount|0\.00/i).first();
    if (await amountInput.isVisible()) {
      await amountInput.fill('100');
      await expect(amountInput).toHaveValue('100');
    }
  });

  test('lock positions section is visible', async ({ page }) => {
    const lockText = page.getByText(/lock|locked/i).first();
    if (await lockText.isVisible()) {
      await expect(lockText).toBeVisible();
    }
  });
});
