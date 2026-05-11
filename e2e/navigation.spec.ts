import { test, expect } from '@playwright/test';

test.describe('Navigation & Page Rendering', () => {
  test('landing page loads and has launch app button', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveTitle(/Arc Treasury/i);
    const launchBtn = page.getByText('Launch App').first();
    await expect(launchBtn).toBeVisible();
  });

  test('landing page → dashboard navigation', async ({ page }) => {
    await page.goto('/');
    const launchBtn = page.getByText('Launch App').first();
    await launchBtn.click();
    await expect(page).toHaveURL(/\/(app|dashboard)/);
  });

  test('dashboard renders without wallet', async ({ page }) => {
    await page.goto('/app');
    await page.waitForLoadState('networkidle');
    await expect(page.locator('body')).not.toHaveText(/Something went wrong/);
  });

  test('swap page renders', async ({ page }) => {
    await page.goto('/swap');
    await page.waitForLoadState('networkidle');
    await expect(page.locator('body')).not.toHaveText(/Something went wrong/);
  });

  test('bridge page renders', async ({ page }) => {
    await page.goto('/bridge');
    await page.waitForLoadState('networkidle');
    await expect(page.locator('body')).not.toHaveText(/Something went wrong/);
  });

  test('rewards page renders', async ({ page }) => {
    await page.goto('/rewards');
    await page.waitForLoadState('networkidle');
    await expect(page.locator('body')).not.toHaveText(/Something went wrong/);
  });

  test('history page renders', async ({ page }) => {
    await page.goto('/history');
    await page.waitForLoadState('networkidle');
    await expect(page.locator('body')).not.toHaveText(/Something went wrong/);
  });

  test('profile page renders', async ({ page }) => {
    await page.goto('/profile');
    await page.waitForLoadState('networkidle');
    await expect(page.locator('body')).not.toHaveText(/Something went wrong/);
  });

  test('FAQ page renders', async ({ page }) => {
    await page.goto('/faq');
    await page.waitForLoadState('networkidle');
    await expect(page.locator('body')).not.toHaveText(/Something went wrong/);
  });

  test('litepaper page renders', async ({ page }) => {
    await page.goto('/litepaper');
    await page.waitForLoadState('networkidle');
    await expect(page.locator('body')).not.toHaveText(/Something went wrong/);
  });

  test('support page renders', async ({ page }) => {
    await page.goto('/support');
    await page.waitForLoadState('networkidle');
    await expect(page.locator('body')).not.toHaveText(/Something went wrong/);
  });

  test('404 page for unknown route', async ({ page }) => {
    await page.goto('/nonexistent-page-xyz');
    await page.waitForLoadState('networkidle');
    await expect(page.locator('body')).toContainText(/not found|404/i);
  });
});
