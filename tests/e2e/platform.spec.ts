import { expect, test } from '@playwright/test';
const master = { id: '000000000000000000000001', name: 'Master Test', email: 'master@example.invalid' };
test('master route has its own login and fits the viewport', async ({ page }) => {
  await page.route('**/api/v1/taggmaster/session', route => route.fulfill({ status: 401, json: { code: 'MASTER_AUTHENTICATION_REQUIRED' } }));
  await page.goto('/taggmaster');
  await expect(page.getByRole('heading', { name: 'Acessar Tagg Master', exact:true })).toBeVisible();
  await expect(page.getByLabel('E-mail master')).toBeVisible();
  await page.screenshot({path:'artifacts/master-login-' + test.info().project.name + '.png',fullPage:true});
  await expect(page.getByRole('button', { name: '+ Nova empresa', exact: true })).toHaveCount(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});
test('an expired master session hides client registration', async ({ page }) => {
  await page.route('**/api/v1/taggmaster/session', route => route.fulfill({ json: { admin: master } }));
  await page.route('**/api/v1/taggmaster/clients**', route => route.fulfill({ status: 401, json: { code: 'MASTER_AUTHENTICATION_REQUIRED' } }));
  await page.goto('/taggmaster');
  await expect(page.getByRole('button', { name: 'Entrar no Tagg Master', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: '+ Nova empresa', exact: true })).toHaveCount(0);
});
