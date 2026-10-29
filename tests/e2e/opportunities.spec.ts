import {test,expect} from '@playwright/test';
const company='a'.repeat(24),user='b'.repeat(24),partyId='c'.repeat(24),id='d'.repeat(24),activityId='e'.repeat(24);
const account={user:{id:user,name:'Vendedor',email:'seller@example.invalid'},tenant:{name:'Cliente Teste'},companies:[{id:company,name:'Empresa Teste'}],permissions:['pipeline:read','pipeline:write','activity:read','activity:write','company:read','customer:read'],security:{mustChangePassword:false,privacyAcceptanceRequired:false}};
const record={id,partyId,partyName:'Acme Ltda',ownerId:user,title:'Projeto Acme',amountCents:123456,currency:'BRL',expectedCloseDate:'2027-06-30',stage:'descoberta',lossReason:'',notes:'Escopo comercial',closedAt:null as string|null,version:0,createdAt:'2026-10-29T12:00:00.000Z',updatedAt:'2026-10-29T12:00:00.000Z'};
test('opportunity modal, linked activity, history and won closure work on each viewport',async({page})=>{
 let created=false,current={...record},activity:Record<string,unknown>|null=null;
 let creation:Record<string,unknown>|undefined,activityCreation:Record<string,unknown>|undefined,closure:Record<string,unknown>|undefined;
 await page.route('**/api/v1/auth/session',route=>route.fulfill({json:account}));
 await page.route('**/api/v1/companies/*/opportunities**',async route=>{
  const request=route.request(),url=new URL(request.url()),path=url.pathname,method=request.method();
  if(path.endsWith('/references'))return route.fulfill({json:{items:[{id:partyId,name:'Acme Ltda',kind:'customer'}]}});
  if(path.endsWith('/history'))return route.fulfill({json:{items:[{id:'history',action:'opportunity.created',actorName:'Você',createdAt:record.createdAt}],total:1,page:1,pageSize:20}});
  if(path.endsWith('/activities/'+activityId)&&method==='PATCH'){activity={...activity,...request.postDataJSON(),completedAt:'2026-10-29T13:00:00Z',version:1};return route.fulfill({json:{record:activity}});}
  if(path.endsWith('/activities')&&method==='POST'){activityCreation=request.postDataJSON();activity={...activityCreation,id:activityId,opportunityId:id,status:'pendente',completedAt:null,version:0};return route.fulfill({status:201,json:{record:activity}});}
  if(path.endsWith('/activities'))return route.fulfill({json:{items:activity?[activity]:[],total:activity?1:0,page:1,pageSize:20}});
  if(path.endsWith('/'+id)&&method==='PATCH'){closure=request.postDataJSON();current={...current,...closure,closedAt:'2026-10-29T13:00:00Z',version:1};return route.fulfill({json:{record:current}});}
  if(path.endsWith('/'+id))return route.fulfill({json:{record:current}});
  if(method==='POST'){creation=request.postDataJSON();created=true;return route.fulfill({status:201,json:{record:current}});}
  return route.fulfill({json:{items:created?[current]:[],total:created?1:0,page:1,pageSize:20}});
 });
 await page.goto('/');
 if(test.info().project.name==='mobile')await page.getByRole('button',{name:'Abrir ou fechar menu'}).click();
 await page.getByRole('navigation').getByRole('button',{name:'Oportunidades',exact:true}).click();
 await expect(page.getByLabel('Título da oportunidade')).toHaveCount(0);
 await page.getByRole('button',{name:'Nova oportunidade',exact:true}).click();
 const opportunity=page.getByRole('dialog',{name:'Nova oportunidade',exact:true});
 await opportunity.getByLabel('Título da oportunidade').fill('Projeto Acme');
 await opportunity.getByRole('combobox',{name:'Lead qualificado ou cliente',exact:true}).selectOption(partyId);
 await opportunity.getByLabel('Valor estimado').fill('1.234,56');
 await opportunity.getByLabel('Fechamento previsto').fill('2027-06-30');
 await page.screenshot({path:'artifacts/opportunity-modal-'+test.info().project.name+'.png',fullPage:true});
 await opportunity.getByRole('button',{name:'Salvar cadastro'}).click();
 await expect(page.getByRole('table')).toContainText('Projeto Acme');
 expect(creation).toMatchObject({partyId,amountCents:123456,stage:'descoberta'});
 expect(creation).not.toHaveProperty('tenantId');expect(creation).not.toHaveProperty('ownerId');
 await page.getByRole('button',{name:'Propostas, atividades e histórico'}).click();
 const details=page.getByRole('dialog',{name:'Oportunidade — Projeto Acme',exact:true});
 await expect(details).toContainText('Oportunidade criada');
 await details.getByRole('button',{name:'Nova atividade',exact:true}).click();
 const activityModal=page.getByRole('dialog',{name:'Nova atividade',exact:true});
 await activityModal.getByLabel('Título da atividade').fill('Reunião técnica');
 await activityModal.getByLabel('Tipo de atividade').selectOption('reuniao');
 await activityModal.getByLabel('Prazo da atividade').fill('2027-06-01T15:00');
 await activityModal.getByRole('button',{name:'Salvar cadastro'}).click();
 await expect(details).toContainText('Reunião técnica');
 expect(activityCreation).toMatchObject({title:'Reunião técnica',type:'reuniao'});
 expect(String(activityCreation?.dueAt)).toMatch(/Z$/);
 await details.getByRole('button',{name:'Editar atividade'}).click();
 const editActivity=page.getByRole('dialog',{name:'Editar atividade',exact:true});
 await editActivity.getByLabel('Status da atividade').selectOption('concluida');
 await editActivity.getByRole('button',{name:'Salvar cadastro'}).click();
 await expect(details).toContainText('Concluída');
 await page.screenshot({path:'artifacts/opportunity-activities-'+test.info().project.name+'.png',fullPage:true});
 await details.getByRole('button',{name:'Fechar formulário',exact:true}).click();
 await page.getByRole('button',{name:'Marcar ganha',exact:true}).click();
 const close=page.getByRole('dialog',{name:'Encerrar como ganha',exact:true});
 await close.getByRole('button',{name:'Confirmar encerramento'}).click();
 expect(closure).toEqual({version:0,stage:'ganha'});
 await expect(page.getByRole('table')).toContainText('Ganha');
 await expect(page.getByRole('button',{name:'Marcar ganha'})).toHaveCount(0);
 await page.screenshot({path:'artifacts/opportunities-'+test.info().project.name+'.png',fullPage:true});
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
});
test('lost opportunity requires an explicit reason in a modal',async({page})=>{
 let payload:Record<string,unknown>|undefined;
 await page.route('**/api/v1/auth/session',route=>route.fulfill({json:account}));
 await page.route('**/api/v1/companies/*/opportunities**',async route=>{
  if(route.request().method()==='PATCH'){payload=route.request().postDataJSON();return route.fulfill({json:{record:{...record,...payload,version:1}}});}
  return route.fulfill({json:{items:[record],total:1,page:1,pageSize:20}});
 });
 await page.goto('/');
 if(test.info().project.name==='mobile')await page.getByRole('button',{name:'Abrir ou fechar menu'}).click();
 await page.getByRole('navigation').getByRole('button',{name:'Oportunidades',exact:true}).click();
 await page.getByRole('button',{name:'Marcar perdida'}).click();
 const modal=page.getByRole('dialog',{name:'Encerrar como perdida'});
 await modal.getByRole('button',{name:'Confirmar encerramento'}).click();
 expect(payload).toBeUndefined();
 await modal.getByLabel('Motivo da perda').fill('Prazo incompatível');
 await modal.getByRole('button',{name:'Confirmar encerramento'}).click();
 await expect(modal).not.toBeVisible();
 expect(payload).toEqual({version:0,stage:'perdida',lossReason:'Prazo incompatível'});
});
