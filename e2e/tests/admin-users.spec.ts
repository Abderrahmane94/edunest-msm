import { test, expect, type Page } from '@playwright/test';

async function loginAsAdmin(page: Page): Promise<void> {
  await page.goto('/login');
  await page.locator('input[name="email"]').fill('admin@edunest.dz');
  await page.locator('input[name="password"]').fill('admin123');
  await page.getByRole('button', { name: 'Se connecter' }).click();
  await expect(page).toHaveURL(/\/admin/);
}

test.describe('Admin — user management', () => {
  test('lists the seeded users', async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto('/admin/users');

    await expect(page.getByRole('heading', { name: 'Utilisateurs' })).toBeVisible();
    const table = page.getByRole('table');
    await expect(table.getByText('admin@edunest.dz')).toBeVisible();
    await expect(table.getByText('teacher@edunest.dz')).toBeVisible();
    await expect(table.getByText('parent@edunest.dz')).toBeVisible();
  });

  test('admin can create a new user, who is forced to change password on first login', async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto('/admin/users');

    await page.getByRole('button', { name: 'Créer un utilisateur' }).click();
    await page.locator('#cu-first').fill('Nadia');
    await page.locator('#cu-last').fill('Enseignante');
    await page.locator('#cu-email').fill('e2e.newteacher@edunest.dz');
    await page.getByRole('button', { name: 'Créer', exact: true }).click();

    await expect(page.getByText('e2e.newteacher@edunest.dz')).toBeVisible();

    // The newly created user's default password is "edunest26" and must be
    // changed on first login (backend: users.service.ts createUser()).
    await page.getByRole('button', { name: 'Se déconnecter' }).click();
    await expect(page).toHaveURL(/\/login/);

    await page.locator('input[name="email"]').fill('e2e.newteacher@edunest.dz');
    await page.locator('input[name="password"]').fill('edunest26');
    await page.getByRole('button', { name: 'Se connecter' }).click();

    // ProtectedRoute renders ChangePasswordPage in place, without a URL change.
    await expect(page.getByRole('heading', { name: /mot de passe/i })).toBeVisible();
  });
});
