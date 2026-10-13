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

    // The account's own temporary password is shown once, to pass on; it
    // must be changed on first login (backend: users.service.ts createDirectly()).
    const temporaryPassword = (await page.getByTestId('new-account-password').innerText()).trim();
    await page.getByRole('button', { name: "C'est noté" }).click();
    await expect(page.getByText('e2e.newteacher@edunest.dz')).toBeVisible();

    await page.getByRole('button', { name: 'Se déconnecter' }).click();
    await expect(page).toHaveURL(/\/login/);

    await page.locator('input[name="email"]').fill('e2e.newteacher@edunest.dz');
    await page.locator('input[name="password"]').fill(temporaryPassword);
    await page.getByRole('button', { name: 'Se connecter' }).click();

    // ProtectedRoute renders ChangePasswordPage in place, without a URL change.
    await expect(page.getByRole('heading', { name: /mot de passe/i })).toBeVisible();
  });
});
