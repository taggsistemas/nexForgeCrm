import { expect, test } from '@playwright/test';
test('foundation is usable without horizontal overflow', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Relacionamentos que movem negócios.' })).toBeVisible();
  await page.getByRole('link', { name: 'Conhecer os módulos' }).click();
  await expect(page.getByRole('heading', { name: 'Sua operação, conectada' })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});
test('built PWA shell opens offline after its first online visit', async ({ page, context }) => {
  await page.goto('/');
  await page.evaluate(async () => { await navigator.serviceWorker.ready; });
  await page.reload();
  await page.waitForFunction(() => !!navigator.serviceWorker.controller);
  await context.setOffline(true);
  await page.reload();
  await expect(page.getByRole('status')).toHaveText('Sem conexão');
  await expect(page.getByRole('heading', { name: 'Relacionamentos que movem negócios.' })).toBeVisible();
});