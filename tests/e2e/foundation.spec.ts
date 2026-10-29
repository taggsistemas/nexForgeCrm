import { expect, test } from '@playwright/test';
const session={user:{name:'Admin Teste',email:'admin@example.invalid'},tenant:{name:'Empresa Teste'},companies:[{id:'company',name:'Empresa Teste Ltda'}]};
test('customer opens a dedicated ERP-style login without organization field',async({page})=>{
  await page.route('**/api/v1/auth/session',route=>route.fulfill({status:401,json:{code:'AUTHENTICATION_REQUIRED'}}));
  await page.goto('/');
  await expect(page.getByRole('heading',{name:'Acessar sua conta',exact:true})).toBeVisible();
  await expect(page.locator('.nf-parent-logo')).toBeVisible();
  await expect(page.locator('[name=tenantSlug]')).toHaveCount(0);
  await page.screenshot({path:'artifacts/crm-' + test.info().title.split(' ')[0] + '-' + test.info().project.name + '.png',fullPage:true});
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
});
test('authenticated dashboard has company header, navigation and theme control',async({page})=>{
  await page.route('**/api/v1/auth/session',route=>route.fulfill({json:session}));
  await page.goto('/');
  await expect(page.getByRole('heading',{name:'Dashboard comercial'})).toBeVisible();
  await expect(page.locator('.nf-user')).toContainText('Empresa Teste');
  await page.screenshot({path:'artifacts/crm-dashboard-dark-' + test.info().project.name + '.png',fullPage:true});
  await page.getByRole('button',{name:'Ativar tema claro'}).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme','light');
  await page.screenshot({path:'artifacts/crm-dashboard-light-' + test.info().project.name + '.png',fullPage:true});
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-theme','light');
  if(test.info().project.name==='mobile') await page.getByRole('button',{name:'Abrir ou fechar menu'}).click();
  await page.getByRole('navigation').getByRole('button',{name:'Propostas e pedidos'}).click();
  await expect(page.getByRole('heading',{name:'Propostas e pedidos',level:1})).toBeVisible();
  await expect(page.getByText('Este módulo ainda não está disponível para operação.')).toBeVisible();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
});
test('public login shell opens offline after its first online visit',async({page,context})=>{
  await page.route('**/api/v1/auth/session',route=>route.fulfill({status:401,json:{code:'AUTHENTICATION_REQUIRED'}}));
  await page.goto('/');
  await expect(page.getByRole('heading',{name:'Acessar sua conta',exact:true})).toBeVisible();
  await page.evaluate(async()=>{await navigator.serviceWorker.ready;});
  await page.reload();await page.waitForFunction(()=>!!navigator.serviceWorker.controller);
  await context.setOffline(true); await page.reload();
  await expect(page.getByRole('status')).toHaveText('Sem conexão');
  await expect(page.getByRole('heading',{name:'Acessar sua conta',exact:true})).toBeVisible();
});
