import {test,expect} from '@playwright/test';
import {readFile} from 'node:fs/promises';
const company='a'.repeat(24);
const account=(permissions:string[])=>({user:{id:'d'.repeat(24),name:'Usuário',email:'usuario@example.invalid'},tenant:{name:'Cliente Teste'},companies:[{id:company,name:'Empresa Teste'}],permissions,security:{mustChangePassword:false,privacyAcceptanceRequired:false}});
test('sidebar controls exist only for the phone overlay and close it',async({page})=>{
 await page.route('**/api/v1/auth/session',route=>route.fulfill({json:account(['company:read'])}));
 await page.goto('/');
 const toggle=page.getByRole('button',{name:'Abrir ou fechar menu'}),close=page.getByRole('button',{name:'Fechar menu',exact:true});
 if(test.info().project.name==='mobile'){
  await toggle.click();await expect(page.locator('#crm-navigation')).toBeVisible();await expect(close).toBeVisible();
  const box=(await close.boundingBox())!;expect(box.width).toBeGreaterThanOrEqual(44);expect(box.height).toBeLessThanOrEqual(48);
  await close.click();await expect(page.locator('#crm-navigation')).toBeHidden();await expect(toggle).toHaveAttribute('aria-expanded','false');
 }else{await expect(toggle).toBeHidden();await expect(close).toBeHidden();await expect(page.locator('#crm-navigation')).toBeVisible();}
});
test('reports are generated from the server rows of the profile and exported as a real Excel file',async({page})=>{
 const requests:string[]=[];
 await page.route('**/api/v1/auth/session',route=>route.fulfill({json:account(['company:read','order:read','order:sales'])}));
 await page.route('**/api/v1/companies/*/orders/reports/**',route=>{requests.push(route.request().url());return route.fulfill({json:{type:'vendas',title:'Vendas',truncated:false,filters:{startDate:'2030-10-01',endDate:'2030-10-29'},generatedAt:'2030-10-29T12:00:00.000Z',
  columns:[{key:'number',label:'Pedido',kind:'text'},{key:'customer',label:'Cliente',kind:'text'},{key:'created',label:'Criado em',kind:'datetime'},{key:'total',label:'Total',kind:'cents'}],
  rows:[['PV-000001','Fazenda Boa Vista','2030-10-10T13:00:00.000Z',850000],['PV-000002','Sítio Alegre','2030-10-12T13:00:00.000Z',125050]]}});});
 await page.goto('/');
 if(test.info().project.name==='mobile')await page.getByRole('button',{name:'Abrir ou fechar menu'}).click();
 await page.getByRole('navigation').getByRole('button',{name:'Relatórios',exact:true}).click();
 const type=page.getByRole('combobox',{name:'Relatório'});await expect(type.locator('option')).toHaveText(['Pedidos','Vendas','Itens de pedidos','A faturar','Faturamento','Previsão de faturamento']);
 await type.selectOption('vendas');await page.getByLabel('Início').fill('2030-10-01');await page.getByLabel('Fim').fill('2030-10-29');await page.getByRole('button',{name:'Gerar relatório'}).click();
 await expect(page.getByRole('cell',{name:'R$ 8.500,00'})).toBeVisible();await expect(page.getByText('2 linha(s)')).toBeVisible();
 expect(new URL(requests[0]!).pathname).toBe('/api/v1/companies/'+company+'/orders/reports/vendas');expect(new URL(requests[0]!).searchParams.get('startDate')).toBe('2030-10-01');
 const download=page.waitForEvent('download');await page.getByRole('button',{name:'Baixar Excel'}).click();const file=await download;
 expect(file.suggestedFilename()).toBe('relatorio-vendas-2030-10-01-a-2030-10-29.xlsx');
 const bytes=await readFile((await file.path())!);expect(bytes.subarray(0,4).toString('hex')).toBe('504b0304');
 const text=bytes.toString('latin1');expect(text).toContain('xl/worksheets/sheet1.xml');
 expect(bytes.toString('utf8')).toContain('Sítio Alegre');expect(bytes.toString('utf8')).toContain('<v>1250.5</v>');
 await page.screenshot({path:'artifacts/reports-'+test.info().project.name+'.png',fullPage:true});
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true);
});
