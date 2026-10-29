import {test,expect} from '@playwright/test';
const company='a'.repeat(24),id='b'.repeat(24),seller='c'.repeat(24);
const account={user:{id:seller,name:'Vendedor',email:'seller@example.invalid'},tenant:{name:'Cliente'},companies:[{id:company,name:'Empresa'}],permissions:['visit:read','visit:write','activity:read','activity:write','lead:read'],security:{mustChangePassword:false,privacyAcceptanceRequired:false}};
async function openField(page:import('@playwright/test').Page){await page.goto('/');if(test.info().project.name==='mobile')await page.getByRole('button',{name:'Abrir ou fechar menu'}).click();await page.getByRole('navigation').getByRole('button',{name:'Rotas e visitas em campo',exact:true}).click();}
for(const denied of [false,true])test(denied?'denied location does not submit a check-in':'field visit check-in and check-out use authorized location and modals',async({page})=>{
 let execution:any=null,checkInPayload:any=null,checkOutPayload:any=null;
 await page.addInitScript(({denied})=>{Object.defineProperty(navigator,'geolocation',{value:{getCurrentPosition:(ok:Function,fail:Function)=>denied?fail({code:1}):ok({coords:{latitude:-25.39,longitude:-51.46,accuracy:12}})}});},{denied});
 await page.route('**/api/v1/auth/session',route=>route.fulfill({json:account}));
 await page.route('**/api/v1/companies/*/agenda/owners',route=>route.fulfill({json:{items:[{id:seller,name:'Vendedor'}]}}));
 await page.route('**/api/v1/companies/*/field-visits/**',async route=>{
  const req=route.request(),url=new URL(req.url());
  if(url.pathname.endsWith('/check-in')){checkInPayload=req.postDataJSON();execution={id:'d'.repeat(24),state:'in_progress',actorId:seller,checkedInAt:new Date().toISOString(),checkedOutAt:null,checkIn:checkInPayload.position,checkOut:null,outcome:null,notes:'',nextSteps:'',interruptionReason:'',version:0};return route.fulfill({status:201,json:{execution}});}
  if(url.pathname.endsWith('/check-out')){checkOutPayload=req.postDataJSON();execution={...execution,...checkOutPayload,state:'completed',checkOut:checkOutPayload.position,checkedOutAt:new Date().toISOString(),version:1};return route.fulfill({json:{execution}});}
  return route.fulfill({json:{items:[{id,partyId:'e'.repeat(24),partyName:'Cliente de campo',ownerId:seller,ownerName:'Vendedor',title:'Visita comercial',dueAt:new Date().toISOString(),status:execution?.state==='completed'?'concluida':'pendente',version:execution?1:0,address:'Rua Teste, 100, Centro',execution,canExecute:true,canInterrupt:true}],total:1,page:1,pageSize:50}});
 });
 await openField(page);await expect(page.getByRole('heading',{name:'Roteiro diário'})).toBeVisible();await page.getByRole('button',{name:'Check-in',exact:true}).click();
 const entry=page.getByRole('dialog',{name:'Check-in da visita',exact:true});await expect(entry).toBeVisible();await entry.getByRole('checkbox').check();await entry.getByRole('button',{name:'Confirmar check-in',exact:true}).click();
 if(denied){await expect(entry.getByRole('alert')).toContainText('Localização indisponível');expect(checkInPayload).toBeNull();return;}
 await expect(entry).not.toBeVisible();expect(checkInPayload).toEqual({version:0,locationAuthorized:true,position:{latitude:-25.39,longitude:-51.46,accuracy:12}});
 await page.getByRole('button',{name:'Check-out',exact:true}).click();const exit=page.getByRole('dialog',{name:'Check-out da visita',exact:true});await exit.getByRole('checkbox').check();await exit.getByRole('combobox',{name:'Resultado',exact:true}).selectOption('realizada');await exit.getByLabel('Relato da visita',{exact:true}).fill('Apresentação realizada com o cliente');await exit.getByLabel('Próximos passos',{exact:true}).fill('Enviar proposta');await page.screenshot({path:'artifacts/field-checkout-'+test.info().project.name+'.png',fullPage:true});await exit.getByRole('button',{name:'Encerrar visita',exact:true}).click();await expect(exit).not.toBeVisible();expect(checkOutPayload).toMatchObject({outcome:'realizada',notes:'Apresentação realizada com o cliente',locationAuthorized:true});expect(checkOutPayload).not.toHaveProperty('completedAt');
 await page.getByRole('button',{name:'Ver registro',exact:true}).click();await expect(page.getByRole('dialog',{name:'Registro da visita',exact:true})).toContainText('Enviar proposta');expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true);await page.screenshot({path:'artifacts/field-record-'+test.info().project.name+'.png',fullPage:true});
});


