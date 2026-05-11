import { test, expect } from '@playwright/test';

test.describe('Bridge (/bridge)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/bridge');
    await page.waitForLoadState('networkidle');
  });

  test('shows bridge interface', async ({ page }) => {
    await expect(page.getByText(/bridge/i).first()).toBeVisible();
  });

  test('shows source and destination chain selectors', async ({ page }) => {
    const sepoliaText = page.getByText(/sepolia/i).first();
    const arcText = page.getByText(/arc/i).first();
    await expect(sepoliaText).toBeVisible();
    await expect(arcText).toBeVisible();
  });

  test('shows connect wallet prompt', async ({ page }) => {
    const connectBtn = page.getByRole('button', { name: /connect|wallet/i }).first();
    await expect(connectBtn).toBeVisible();
  });

  test('bridge amount input accepts values', async ({ page }) => {
    const amountInput = page.getByPlaceholder(/amount|0\.00|0/i).first();
    if (await amountInput.isVisible()) {
      await amountInput.fill('10');
      await expect(amountInput).toHaveValue('10');
    }
  });
});
