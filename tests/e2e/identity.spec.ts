import { test, expect } from '@playwright/test';
test('login requires only email and password and handles rejection', async ({ page }) => {
  await page.route('**/api/v1/auth/session', route => route.fulfill({ status: 401, json: { code: 'AUTHENTICATION_REQUIRED' } }));
  let submitted: unknown;
  await page.route('**/api/v1/auth/login', route => { submitted=route.request().postDataJSON(); return route.fulfill({ status: 401, json: { code: 'INVALID_CREDENTIALS' } }); });
  await page.goto('/');
  await expect(page.locator('[name=tenantSlug]')).toHaveCount(0);
  await page.getByLabel('E-mail', { exact: true }).fill('user@example.invalid');
  await page.getByLabel('Senha', { exact: true }).fill('wrong-password');
  await page.getByRole('button', { name: 'Entrar no CRM' }).click();
  await expect(page.getByRole('alert')).toContainText('Confira o e-mail e a senha');
  expect(submitted).toEqual({email:'user@example.invalid',password:'wrong-password'});
  await expect(page.getByRole('button', { name: 'Encerrar sessão' })).toHaveCount(0);
});
