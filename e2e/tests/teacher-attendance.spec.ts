import { test, expect } from '@playwright/test';

test('teacher can mark attendance for their classroom', async ({ page }) => {
  await page.goto('/login');
  await page.locator('input[name="email"]').fill('teacher@edunest.dz');
  await page.locator('input[name="password"]').fill('teacher123');
  await page.getByRole('button', { name: 'Se connecter' }).click();
  await expect(page).toHaveURL(/\/teacher/);

  await expect(page.getByRole('heading', { name: 'Appel de présence' })).toBeVisible();
  await expect(page.getByText('Yasmine Parent')).toBeVisible();

  await page.getByRole('button', { name: 'Marquer tous présents' }).click();
  await page.getByRole('button', { name: 'Enregistrer la présence' }).click();

  await expect(page.getByText('Présence enregistrée avec succès')).toBeVisible();
});
