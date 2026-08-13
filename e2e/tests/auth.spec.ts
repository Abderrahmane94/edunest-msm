import { test, expect } from '@playwright/test';

test.describe('Authentication', () => {
  test('admin can log in and reach the admin portal', async ({ page }) => {
    await page.goto('/login');
    await page.locator('input[name="email"]').fill('admin@edunest.dz');
    await page.locator('input[name="password"]').fill('admin123');
    await page.getByRole('button', { name: 'Se connecter' }).click();
    await expect(page).toHaveURL(/\/admin/);
  });

  test('teacher can log in and reach the attendance page', async ({ page }) => {
    await page.goto('/login');
    await page.locator('input[name="email"]').fill('teacher@edunest.dz');
    await page.locator('input[name="password"]').fill('teacher123');
    await page.getByRole('button', { name: 'Se connecter' }).click();
    await expect(page).toHaveURL(/\/teacher/);
    await expect(page.getByRole('heading', { name: 'Appel de présence' })).toBeVisible();
  });

  test('parent can log in and reach the parent portal', async ({ page }) => {
    await page.goto('/login');
    await page.locator('input[name="email"]').fill('parent@edunest.dz');
    await page.locator('input[name="password"]').fill('parent123');
    await page.getByRole('button', { name: 'Se connecter' }).click();
    await expect(page).toHaveURL(/\/parent/);
  });

  test('super admin can log in and reach the platform admin portal', async ({ page }) => {
    await page.goto('/login');
    await page.locator('input[name="email"]').fill('superadmin@edunest.dz');
    await page.locator('input[name="password"]').fill('superadmin123');
    await page.getByRole('button', { name: 'Se connecter' }).click();
    await expect(page).toHaveURL(/\/admin/);
  });

  test('wrong password shows an error and stays on the login page', async ({ page }) => {
    await page.goto('/login');
    await page.locator('input[name="email"]').fill('admin@edunest.dz');
    await page.locator('input[name="password"]').fill('wrong-password');
    await page.getByRole('button', { name: 'Se connecter' }).click();
    await expect(page.getByText('Identifiants incorrects. Veuillez réessayer.')).toBeVisible();
    await expect(page).toHaveURL(/\/login/);
  });

  test('unknown email shows the same generic error (no user enumeration)', async ({ page }) => {
    await page.goto('/login');
    await page.locator('input[name="email"]').fill('nobody@edunest.dz');
    await page.locator('input[name="password"]').fill('whatever123');
    await page.getByRole('button', { name: 'Se connecter' }).click();
    await expect(page.getByText('Identifiants incorrects. Veuillez réessayer.')).toBeVisible();
  });

  test('logout returns to the login page', async ({ page }) => {
    await page.goto('/login');
    await page.locator('input[name="email"]').fill('admin@edunest.dz');
    await page.locator('input[name="password"]').fill('admin123');
    await page.getByRole('button', { name: 'Se connecter' }).click();
    await expect(page).toHaveURL(/\/admin/);

    await page.getByRole('button', { name: 'Se déconnecter' }).click();
    await expect(page).toHaveURL(/\/login/);
  });
});
