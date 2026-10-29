import {test,expect} from '@playwright/test';
const company='a'.repeat(24),user='b'.repeat(24),partyId='c'.repeat(24),id='d'.repeat(24),proposalId='e'.repeat(24),product='f'.repeat(24),propertyId='1'.repeat(24),equipmentId='2'.repeat(24);
const account={user:{id:user,name:'Vendedor',email:'seller@example.invalid'},tenant:{name:'Cliente Teste'},companies:[{id:company,name:'Empresa Teste'}],permissions:['pipeline:read','pipeline:write','activity:read','company:read','customer:read','proposal:read','proposal:write','catalog:read'],security:{mustChangePassword:false,privacyAcceptanceRequired:false}};
const opportunity={id,partyId,partyName:'Fazenda Sintética',ownerId:user,title:'Robô de ordenha',amountCents:150000000,currency:'BRL',expectedCloseDate:'2031-06-30',stage:'proposta',probability:50,weightedAmountCents:75000000,originId:null,propertyId,propertyName:'Sede',equipmentId,equipmentName:'GEA R9500',lossReason:'',notes:'',closedAt:null,version:2,createdAt:'2030-10-29T12:00:00.000Z',updatedAt:'2030-10-29T12:00:00.000Z'};
test('proposal is built from catalog items with a total preview and sent without client totals',async({page})=>{
 let proposal:Record<string,unknown>|null=null,creation:Record<string,unknown>|undefined,sent:Record<string,unknown>|undefined;
 await page.route('**/api/v1/auth/session',route=>route.fulfill({json:account}));
 await page.route('**/api/v1/companies/*/crm/**',route=>route.fulfill({json:{items:[]}}));
 await page.route('**/api/v1/companies/*/catalog/**',route=>{const path=new URL(route.request().url()).pathname;
  if(path.endsWith('/resolve'))return route.fulfill({json:{price:{tableId:'t',scope:'global',priceCents:52000000}}});
  return route.fulfill({json:{items:[{id:product,code:'P000001',manufacturerSku:'',description:'Robô de ordenha',kind:'product',unit:'pc',quantityDecimals:0,packaging:'unit',components:[],variableWeight:false,estimatedWeightGrams:null,ncm:'',cest:'',deliveryDays:30,active:true,version:0}],total:1,page:1}});});
 await page.route('**/api/v1/companies/*/opportunities**',async route=>{
  const request=route.request(),path=new URL(request.url()).pathname,method=request.method();
  if(path.endsWith('/settings'))return route.fulfill({json:{stages:[{key:'descoberta',label:'Prospecção',probability:15},{key:'proposta',label:'Proposta enviada',probability:50},{key:'negociacao',label:'Fechamento',probability:80}],version:1}});
  if(path.endsWith('/send')){sent=request.postDataJSON();proposal={...proposal,status:'enviada',sentAt:'2030-10-29T13:00:00.000Z',version:1};return route.fulfill({json:{record:proposal}});}
  if(path.endsWith('/proposals')&&method==='POST'){creation=request.postDataJSON();proposal={id:proposalId,opportunityId:id,number:'PR-000001',status:'rascunho',revision:1,validUntil:creation!.validUntil,expired:false,items:[{productId:product,code:'P000001',description:'Robô de ordenha',kind:'product',unit:'pc',quantity:'2',unitPriceCents:51000000,discountCents:1000000,referencePriceCents:52000000,totalCents:101000000}],totalCents:101000000,notes:creation!.notes,sentAt:null,decidedAt:null,decisionReason:'',version:0,createdAt:'2030-10-29T12:00:00.000Z',updatedAt:'2030-10-29T12:00:00.000Z'};return route.fulfill({status:201,json:{record:proposal}});}
  if(path.endsWith('/proposals'))return route.fulfill({json:{items:proposal?[proposal]:[]}});
  if(path.endsWith('/history'))return route.fulfill({json:{items:[],total:0,page:1,pageSize:20}});
  if(path.endsWith('/activities'))return route.fulfill({json:{items:[],total:0,page:1,pageSize:20}});
  if(path.endsWith('/'+id))return route.fulfill({json:{record:opportunity}});
  return route.fulfill({json:{items:[opportunity],total:1,page:1,pageSize:20}});
 });
 await page.goto('/');
 if(test.info().project.name==='mobile')await page.getByRole('button',{name:'Abrir ou fechar menu'}).click();
 await page.getByRole('navigation').getByRole('button',{name:'Oportunidades',exact:true}).click();
 const table=page.getByRole('table');await expect(table).toContainText('Proposta enviada');await expect(table).toContainText('50%');await expect(table).toContainText('Sede');await expect(table).toContainText('GEA R9500');
 await page.getByRole('button',{name:'Propostas, atividades e histórico'}).click();
 const details=page.getByRole('dialog',{name:'Oportunidade — Robô de ordenha',exact:true});await expect(details).toContainText('Equipamento: GEA R9500');
 await details.getByRole('button',{name:'Nova proposta',exact:true}).click();
 const editor=page.getByRole('dialog',{name:'Nova proposta',exact:true});
 await editor.getByRole('combobox',{name:'Incluir item'}).selectOption(product);
 await expect(editor.getByLabel('Preço unitário de P000001 — Robô de ordenha')).toHaveValue('520000,00');
 await editor.getByLabel('Quantidade de P000001 — Robô de ordenha').fill('2');
 await editor.getByLabel('Preço unitário de P000001 — Robô de ordenha').fill('510.000,00');
 await editor.getByLabel('Desconto de P000001 — Robô de ordenha').fill('10.000,00');
 await expect(editor.getByText('Total previsto:')).toContainText('1.010.000,00');
 await editor.getByLabel('Condições e observações').fill('Entrega em 30 dias');
 await page.screenshot({path:'artifacts/proposal-editor-'+test.info().project.name+'.png',fullPage:true});
 await editor.getByRole('button',{name:'Salvar rascunho'}).click();
 await expect(details).toContainText('PR-000001 · rev. 1');
 expect(creation).toMatchObject({items:[{productId:product,quantity:'2',unitPriceCents:51000000,discountCents:1000000}],notes:'Entrega em 30 dias'});
 for(const field of ['totalCents','status','number','referencePriceCents'])expect(JSON.stringify(creation)).not.toContain(field);
 await details.getByRole('button',{name:'Enviar ao cliente',exact:true}).click();
 const confirm=page.getByRole('dialog',{name:'Enviar proposta — PR-000001'});await confirm.getByRole('button',{name:'Confirmar'}).click();
 await expect(details).toContainText('Enviada ao cliente');expect(sent).toEqual({version:0,reason:''});
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
});
