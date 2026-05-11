import { test, expect } from '@playwright/test';

test.describe('Swap (/swap)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/swap');
    await page.waitForLoadState('networkidle');
  });

  test('shows swap interface', async ({ page }) => {
    await expect(page.getByText(/swap/i).first()).toBeVisible();
  });

  test('shows USDC and EURC tokens', async ({ page }) => {
    await expect(page.getByText(/USDC/i).first()).toBeVisible();
    await expect(page.getByText(/EURC/i).first()).toBeVisible();
  });

  test('swap input accepts numeric values', async ({ page }) => {
    const amountInput = page.getByPlaceholder(/amount|0\.00|0/i).first();
    if (await amountInput.isVisible()) {
      await amountInput.fill('50');
      await expect(amountInput).toHaveValue('50');
    }
  });

  test('shows pool statistics section', async ({ page }) => {
    await expect(page.getByText(/Pool Statistics/i).first()).toBeVisible();
    await expect(page.getByText(/Total Liquidity/i).first()).toBeVisible();
  });
});
