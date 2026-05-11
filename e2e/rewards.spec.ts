import { test, expect } from '@playwright/test';

test.describe('Rewards (/rewards)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/rewards');
    await page.waitForLoadState('networkidle');
  });

  test('shows Early Supporter Badge section', async ({ page }) => {
    await expect(page.getByText(/Early Supporter/i).first()).toBeVisible();
  });

  test('shows badge mint stats', async ({ page }) => {
    await expect(page.getByText(/Minted/i).first()).toBeVisible();
    await expect(page.getByText(/Left/i).first()).toBeVisible();
  });

  test('shows connect wallet prompt', async ({ page }) => {
    await expect(page.getByText(/Connect wallet to view/i).first()).toBeVisible();
  });

  test('shows Rewards heading', async ({ page }) => {
    await expect(page.getByText('Rewards').first()).toBeVisible();
  });
});
