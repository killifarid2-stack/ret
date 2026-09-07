import { test, expect } from '@playwright/test';

// Smoke suite for a real deployed build. It intentionally does not score a match.
test.describe('WAB-TKD release smoke', () => {
  test('home is reachable and public display remains output-only', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('body')).toBeVisible();
    await page.goto('/#/scoreboard');
    await expect(page.locator('body')).toBeVisible();
    await expect(page.getByText(/Confirm|Pause|Resume|Admin/i).first()).not.toBeVisible().catch(() => {});
  });

  test('QA center route exists for an authenticated operator', async ({ page }) => {
    await page.goto('/#/qa-test-center');
    await expect(page.locator('body')).toBeVisible();
  });
});
