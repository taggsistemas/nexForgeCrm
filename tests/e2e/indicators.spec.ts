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
 await expect(page.getByRole('button',{name:/Clientes ativos/})).toContainText('4');
 expect(queries.at(-1)!.get('regionId')).toBe(region);expect(queries.at(-1)!.get('view')).toBe('gerencial');
 await page.getByRole('tab',{name:'Técnica'}).click();await expect.poll(()=>queries.at(-1)!.get('view')).toBe('tecnica');
 await page.screenshot({path:'artifacts/indicators-'+test.info().project.name+'.png',fullPage:true});
 const download=page.waitForEvent('download');await page.getByRole('button',{name:'Exportar CSV'}).click();const file=await download;
 expect(file.suggestedFilename()).toMatch(/^indicadores-tecnica-2030-10-01-a-2030-10-29\.csv$/);
 const csv=await readFile((await file.path())!,'utf8');expect(csv).toContain('"Carteira";"Clientes ativos";"4"');expect(csv).toContain('"Taxa de conversão";"sem base"');
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
});
test('cards open the records behind each value, including who is attending where, and charts show the trend',async({page})=>{
 const details:URLSearchParams[]=[];
 await page.route('**/api/v1/auth/session',route=>route.fulfill({json:{...account,permissions:[...account.permissions,'visit:read']}}));
 await page.route('**/api/v1/companies/*/territories/**',route=>route.fulfill({json:{items:[]}}));
 await page.route('**/api/v1/companies/*/agenda/owners',route=>route.fulfill({json:{items:[]}}));
 await page.route('**/api/v1/companies/*/indicators/details**',route=>{const query=new URL(route.request().url()).searchParams;details.push(query);return route.fulfill({json:{section:'campo',key:'visits',title:'Vendedores em visita agora',note:'Local = cliente e propriedade da visita com check-in no servidor. Não é posição em tempo real.',truncated:false,
  columns:[{key:'person',label:'Pessoa',kind:'text'},{key:'customer',label:'Cliente',kind:'text'},{key:'site',label:'Propriedade',kind:'text'},{key:'since',label:'Check-in',kind:'datetime'}],rows:[['Vendedor 1','Fazenda X','Sede','2030-10-29T13:00:00.000Z'],['Técnico 1','Cliente Y','Galpão','2030-10-29T14:00:00.000Z']]}});});
 await page.route('**/api/v1/companies/*/indicators?**',route=>route.fulfill({json:{asOf:'2030-10-29T15:00:00.000Z',view:'gerencial',filters:{startDate:'2030-10-01',endDate:'2030-10-29',regionId:null,ownerId:null},
  sections:[{key:'campo',title:'Em atendimento agora',indicators:[{key:'visits',label:'Vendedores em visita',value:2,unit:'count',definition:'Visitas com check-in sem checkout.'}]},{key:'visitas',title:'Visitas',indicators:[{key:'coverage',label:'Cobertura da carteira',value:50,unit:'percent',definition:'Clientes visitados ÷ ativos.'}]}],
  charts:[{key:'pedidosMes',title:'Pedidos confirmados × faturado',subtitle:'Últimos 6 meses',kind:'bars',unit:'cents',series:['Confirmado','Faturado'],points:['2030-05','2030-06','2030-07','2030-08','2030-09','2030-10'].map((label,index)=>({label,values:[index*100000,index*50000]}))},
   {key:'osTecnico',title:'OS concluídas por técnico',subtitle:'Período filtrado',kind:'pie',unit:'count',series:['OS concluídas'],points:[{label:'Técnico 1',values:[4]},{label:'Técnico 2',values:[1]}]},
   {key:'faturamentoAno',title:'Faturamento',subtitle:'2030 × 2029',kind:'line',unit:'cents',series:['2030','2029'],points:['01','02','03'].map((month,index)=>({label:'2030-'+month,values:[(index+1)*90000,index*40000]}))},
   {key:'pedidosResponsavel',title:'Por responsável',subtitle:'',kind:'ranking',unit:'cents',series:['Valor'],points:[{label:'Vendedor 1',values:[100000]}]}]}}));
 await page.goto('/');
 if(test.info().project.name==='mobile')await page.getByRole('button',{name:'Abrir ou fechar menu'}).click();
 await page.getByRole('navigation').getByRole('button',{name:'Central gerencial',exact:true}).click();
 await expect(page.getByRole('heading',{name:'Pedidos confirmados × faturado'})).toBeVisible();await expect(page.locator('.nf-pie-legend li').first()).toContainText('Técnico 1');await expect(page.locator('.nf-pie-legend li').first()).toContainText('80%');await expect(page.locator('.is-line svg path')).toHaveCount(4);await expect(page.locator('.nf-ranking li').first()).toContainText('Vendedor 1');
 await expect(page.getByRole('article').filter({hasText:'Cobertura da carteira'})).toBeVisible();
 const card=page.getByRole('button',{name:/Vendedores em visita/});await expect(card).toHaveAttribute('aria-haspopup','dialog');await card.click();
 const detail=page.getByRole('dialog',{name:'Vendedores em visita agora'});await expect(detail.locator('h2')).toBeFocused();await expect(detail.getByRole('cell',{name:'Fazenda X'})).toBeVisible();await expect(detail.getByRole('cell',{name:'Cliente Y'})).toBeVisible();await expect(detail).toContainText('Não é posição em tempo real');
 expect(details[0]!.get('section')).toBe('campo');expect(details[0]!.get('key')).toBe('visits');expect(details[0]!.get('startDate')).toBeTruthy();
 const download=page.waitForEvent('download');await detail.getByRole('button',{name:'Baixar Excel'}).click();expect((await download).suggestedFilename()).toMatch(/^detalhe-campo-visits-.*\.xlsx$/);
 await page.screenshot({path:'artifacts/indicators-detail-'+test.info().project.name+'.png',fullPage:true});
 await detail.getByRole('button',{name:'Fechar formulário'}).click();await expect(detail).not.toBeVisible();await expect(card).toBeFocused();
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true);
});
