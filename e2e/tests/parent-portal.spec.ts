import { test, expect } from '@playwright/test';

test.describe('Parent portal', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login');
    await page.locator('input[name="email"]').fill('parent@edunest.dz');
    await page.locator('input[name="password"]').fill('parent123');
    await page.getByRole('button', { name: 'Se connecter' }).click();
    await expect(page).toHaveURL(/\/parent/);
  });

  test('can open the invoices & consent page', async ({ page }) => {
    await page.goto('/parent/invoices');
    await expect(page.getByRole('heading', { name: 'Factures et consentements' })).toBeVisible();
  });

  test('can open the payments page', async ({ page }) => {
    await page.goto('/parent/payments');
    await expect(page.getByRole('heading', { name: 'Paiements' })).toBeVisible();
  });

  test('can open the attendance history page for their child', async ({ page }) => {
    await page.goto('/parent/attendance');
    await expect(page).toHaveURL(/\/parent\/attendance/);
  });
});
