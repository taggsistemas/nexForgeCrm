import {expect,test} from '@playwright/test';
test('customer-controlled text is rendered as text, not executable markup',async({page})=>{
  const name='<img src=x onerror="window.xssExecuted=true">';
  await page.route('**/api/v1/auth/session',route=>route.fulfill({json:{user:{name,email:'user@example.invalid'},tenant:{name:'Empresa Teste'},companies:[{id:'c',name:'<script>window.xssExecuted=true</script>'}]}}));
  await page.goto('/');
  await expect(page.getByRole('heading',{name:'Dashboard comercial'})).toBeVisible();
  await expect(page.locator('.nf-user')).toContainText(name);
  expect(await page.evaluate(()=>Boolean((window as unknown as {xssExecuted?:boolean}).xssExecuted))).toBe(false);
  await expect(page.locator('.nf-account-grid script')).toHaveCount(0);
  await expect(page.locator('.nf-user img')).toHaveCount(0);
});
