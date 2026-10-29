import {test,expect} from '@playwright/test';
import {readFile} from 'node:fs/promises';
const company='a'.repeat(24),region='b'.repeat(24);
const account={user:{id:'c'.repeat(24),name:'Gestão',email:'gestao@example.invalid'},tenant:{name:'Cliente Teste'},companies:[{id:company,name:'Empresa Teste'}],permissions:['company:read','region:read','lead:read','customer:read','activity:read','ticket:read','technical:read','report:read'],security:{mustChangePassword:false,privacyAcceptanceRequired:false}};
const report=(view:string,regionId:string|null)=>({asOf:'2030-10-29T12:00:00.000Z',view,filters:{startDate:'2030-10-01',endDate:'2030-10-29',regionId,ownerId:null},sections:[
 {key:'carteira',title:'Carteira',indicators:[{key:'customers',label:'Clientes ativos',value:regionId?4:12,unit:'count',definition:'Clientes não arquivados do seu acesso nos filtros.'}]},
 {key:'oportunidades',title:'Oportunidades',indicators:[{key:'forecast',label:'Previsão ponderada',value:4500000,unit:'cents',definition:'Soma de valor × probabilidade das oportunidades abertas. Previsão, não receita.'},{key:'conversion',label:'Taxa de conversão',value:null,unit:'percent',definition:'Ganhas ÷ (ganhas + perdidas) encerradas no período.'}]},
 {key:'chamados',title:'Chamados',indicators:[{key:'response',label:'Tempo médio de primeiro retorno',value:95,unit:'minutes',definition:'Média de (primeiro retorno − abertura).'}]}]});
test('management indicators apply shared filters on the server and export the same values as CSV',async({page})=>{
 const queries:URLSearchParams[]=[];
 await page.route('**/api/v1/auth/session',route=>route.fulfill({json:account}));
 await page.route('**/api/v1/companies/*/territories/**',route=>route.fulfill({json:{items:[{id:region,name:'Castro'}]}}));
 await page.route('**/api/v1/companies/*/agenda/owners',route=>route.fulfill({json:{items:[]}}));
 await page.route('**/api/v1/companies/*/indicators**',route=>{const query=new URL(route.request().url()).searchParams;queries.push(query);return route.fulfill({json:report(query.get('view')??'gerencial',query.get('regionId'))});});
 await page.goto('/');
 if(test.info().project.name==='mobile')await page.getByRole('button',{name:'Abrir ou fechar menu'}).click();
 await page.getByRole('navigation').getByRole('button',{name:'Central gerencial',exact:true}).click();
 await expect(page.getByText('R$ 45.000,00')).toBeVisible();await expect(page.getByText('1 h 35 min')).toBeVisible();await expect(page.getByText('sem base')).toBeVisible();
 await page.getByRole('combobox',{name:'Território'}).selectOption(region);
 await expect(page.getByRole('article').filter({hasText:'Clientes ativos'})).toContainText('4');
 expect(queries.at(-1)!.get('regionId')).toBe(region);expect(queries.at(-1)!.get('view')).toBe('gerencial');
 await page.getByRole('tab',{name:'Técnica'}).click();await expect.poll(()=>queries.at(-1)!.get('view')).toBe('tecnica');
 await page.screenshot({path:'artifacts/indicators-'+test.info().project.name+'.png',fullPage:true});
 const download=page.waitForEvent('download');await page.getByRole('button',{name:'Exportar CSV'}).click();const file=await download;
 expect(file.suggestedFilename()).toMatch(/^indicadores-tecnica-2030-10-01-a-2030-10-29\.csv$/);
 const csv=await readFile((await file.path())!,'utf8');expect(csv).toContain('"Carteira";"Clientes ativos";"4"');expect(csv).toContain('"Taxa de conversão";"sem base"');
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
});
