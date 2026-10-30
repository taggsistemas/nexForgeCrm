import {test,expect,type Page,type BrowserContext} from '@playwright/test';
const company='a'.repeat(24),user='b'.repeat(24),tenant='c'.repeat(24),party='d'.repeat(24),activity='e'.repeat(24),product='f'.repeat(24),property='1'.repeat(24);
const account={user:{id:user,name:'Vendedor Offline',email:'offline@example.invalid'},tenant:{id:tenant,name:'Cliente'},companies:[{id:company,name:'Empresa'}],permissions:['company:read','lead:read','lead:write','customer:read','contact:read','activity:read','activity:write','visit:read','visit:write','order:read','order:write','order:sales','catalog:read','ticket:read','ticket:write'],security:{mustChangePassword:false,privacyAcceptanceRequired:false}};
type State={offline:boolean;logged:boolean;version:number;prepareCount:number;logoutCount:number;grant:number;effects:Map<string,{kind:string;activityId?:string}>;posts:{grantId:string;operation:Record<string,unknown>}[];lost:boolean;conflicted:boolean};
async function setup(page:Page,options:{conflict?:boolean;loss?:boolean}={}){
 const state:State={offline:false,logged:true,version:0,prepareCount:0,logoutCount:0,grant:0,effects:new Map(),posts:[],lost:false,conflicted:false};
 await page.addInitScript(()=>{Object.defineProperty(navigator,'geolocation',{value:{getCurrentPosition:(ok:(value:unknown)=>void)=>ok({coords:{latitude:-25.39,longitude:-51.46,accuracy:12}})}});});
 await page.route('**/api/v1/auth/session',route=>state.offline?route.abort('internetdisconnected'):route.fulfill(state.logged?{json:account}:{status:401,json:{code:'AUTHENTICATION_REQUIRED'}}));
 await page.route('**/api/v1/auth/logout',route=>{state.logoutCount++;state.logged=false;return route.fulfill({status:204});});
 await page.route('**/api/v1/companies/*/dashboard**',route=>route.fulfill({json:{}}));
 await page.route('**/api/v1/companies/*/offline/prepare',route=>{if(state.offline)return route.abort('internetdisconnected');state.prepareCount++;const now=Date.now(),done=[...state.effects.values()].some(value=>value.kind==='visit'&&value.activityId===activity);
  return route.fulfill({json:{capabilities:{activityWrite:true,visitWrite:true,orderWrite:true,ticketWrite:true},grantId:(++state.grant).toString(16).padStart(24,'0'),issuedAt:new Date(now).toISOString(),expiresAt:new Date(now+8*3600000).toISOString(),uploadUntil:new Date(now+7*86400000).toISOString(),identity:{userId:user,tenantId:tenant,companyId:company,userName:'Vendedor Offline',companyName:'Empresa'},
   parties:[{id:party,name:'Fazenda Protegida Offline',kind:'customer',contactName:'Contato de campo',phone:'42999999999',email:'contact@example.invalid',address:'Rua de Teste, 100',ownerId:user,version:state.version,orderable:true}],contacts:[{id:'2'.repeat(24),partyId:party,name:'Maria Contato',phone:'42999999999',email:'contact@example.invalid',position:'Compras'}],
   activities:[{id:activity,partyId:party,title:'Visita de demonstração',type:'visita',status:done?'concluida':'pendente',fieldState:done?'completed_offline':'none',dueAt:new Date(now).toISOString(),version:0}],
   properties:[{id:property,partyId:party,name:'Sede da fazenda'}],equipment:[],products:[{id:product,code:'P-0001',description:'Teteira',kind:'product',unit:'pc',quantityDecimals:0,priceCents:5000}]}});});
 await page.route('**/api/v1/companies/*/offline/sync',route=>{if(state.offline)return route.abort('internetdisconnected');const body=route.request().postDataJSON();state.posts.push(body);
  if(options.conflict&&!state.conflicted){state.conflicted=true;state.version=1;return route.fulfill({status:409,json:{code:'OFFLINE_CONFLICT'}});}
  const replayed=state.effects.has(body.operation.operationId);if(!replayed)state.effects.set(body.operation.operationId,body.operation);
  if(options.loss&&!state.lost){state.lost=true;return route.abort('failed');}
  const kind=body.operation.kind,extra=kind==='order'?{number:'PV-000001',status:'aguardando_aprovacao'}:kind==='ticket'?{number:'CH-000001'}:{};
  return route.fulfill({json:{operationId:body.operation.operationId,entityId:'9'.repeat(24),replayed,...extra}});});
 await page.goto('/');await expect.poll(()=>state.prepareCount).toBeGreaterThan(0);
 return state;
}
async function openOffline(page:Page){if(test.info().project.name==='mobile')await page.getByRole('button',{name:'Abrir ou fechar menu'}).click();await page.getByRole('navigation').getByRole('button',{name:'Operação offline',exact:true}).click();await expect(page.getByRole('heading',{name:'Carteira no aparelho'})).toBeVisible();}
async function envelope(page:Page){return page.evaluate(async()=>new Promise<{pendingCount:number;ciphertext:string;ownerTag:string;blocked:boolean}|null>((resolve,reject)=>{const request=indexedDB.open('nexforge-crm-offline-v2',1);request.onsuccess=()=>{const db=request.result,query=db.transaction('vault','readonly').objectStore('vault').get('primary');query.onsuccess=()=>{resolve(query.result??null);db.close();};query.onerror=reject;};request.onerror=reject;}));}
const row=(page:Page)=>page.getByRole('listitem').filter({hasText:'Fazenda Protegida Offline'}).filter({has:page.getByRole('button',{name:'Atividade'})});
async function goOffline(page:Page,context:BrowserContext,state:State){state.offline=true;await context.setOffline(true);await expect(page.getByText('Sem conexão').first()).toBeVisible();}
async function activityOffline(page:Page){await row(page).getByRole('button',{name:'Atividade',exact:true}).click();const modal=page.getByRole('dialog',{name:/Nova atividade/});await modal.getByLabel('Título',{exact:true}).fill('Ligar depois da visita');await modal.getByLabel('Relato / observações',{exact:true}).fill('Anotação local protegida');await modal.getByRole('button',{name:'Salvar neste aparelho',exact:true}).click();await expect(modal).not.toBeVisible();}
test('prepares automatically without a password, keeps activity, order and ticket on the device and syncs them once on reconnection',async({page,context})=>{
 const state=await setup(page,{loss:true});await openOffline(page);
 await expect(page.getByLabel(/senha/i)).toHaveCount(0);await expect(page.getByRole('button',{name:/Preparar|Desbloquear/})).toHaveCount(0);
 await goOffline(page,context,state);await activityOffline(page);
 await row(page).getByRole('button',{name:'Pedido',exact:true}).click();const order=page.getByRole('dialog',{name:/Novo pedido/});await order.getByRole('combobox',{name:'Incluir item'}).selectOption(product);
 await expect(order.getByLabel('Preço unitário de P-0001 — Teteira')).toHaveValue('50,00');await order.getByLabel('Quantidade de P-0001 — Teteira').fill('3');await expect(order.getByText('Total previsto: R$ 150,00')).toBeVisible();await order.getByLabel('Prazos (dias após a entrega)').fill('30/60');await order.getByRole('button',{name:'Salvar neste aparelho'}).click();await expect(order).not.toBeVisible();
 await row(page).getByRole('button',{name:'Chamado',exact:true}).click();const ticket=page.getByRole('dialog',{name:/Abrir chamado/});await ticket.getByRole('combobox',{name:'Propriedade'}).selectOption(property);await ticket.getByLabel('Título').fill('Bomba parada');await ticket.getByLabel('Descrição do problema').fill('Bomba de vácuo parou durante a ordenha.');await ticket.getByRole('button',{name:'Salvar neste aparelho'}).click();await expect(ticket).not.toBeVisible();
 await expect(page.getByText('Aguardando envio',{exact:true})).toHaveCount(3);expect(state.posts).toHaveLength(0);
 const stored=(await envelope(page))!;expect(stored.pendingCount).toBe(3);for(const secret of ['Fazenda Protegida','Anotação local','Bomba parada','Vendedor Offline'])expect(JSON.stringify(stored)).not.toContain(secret);
 await page.screenshot({path:'artifacts/offline-device-'+test.info().project.name+'.png',fullPage:true});
 state.offline=false;await context.setOffline(false);
 await expect.poll(()=>state.posts.length).toBeGreaterThan(0);await page.getByRole('button',{name:'Sincronizar agora'}).click();
 await expect(page.getByText('Sincronizado',{exact:true})).toHaveCount(3);await expect(page.getByText(/PV-000001 · aguardando aprovação/)).toBeVisible();await expect(page.getByText('CH-000001')).toBeVisible();
 expect(state.effects.size).toBe(3);expect(state.posts[1]!.operation.operationId).toBe(state.posts[0]!.operation.operationId);
 const sentOrder=state.posts.find(item=>item.operation.kind==='order')!.operation;expect(sentOrder).toMatchObject({items:[{productId:product,quantity:'3',unitPriceCents:5000,discountCents:0}],paymentTermDays:[30,60],submit:true});expect(sentOrder).not.toHaveProperty('totalCents');
 expect(state.posts.find(item=>item.operation.kind==='ticket')!.operation).not.toHaveProperty('openedAt');expect((await envelope(page))!.pendingCount).toBe(0);
});
test('a cold start without network opens the device data with no password and records a visit with authorized location',async({page,context})=>{
 const state=await setup(page);await page.evaluate(()=>navigator.serviceWorker.ready.then(()=>undefined));await page.reload();await page.waitForFunction(()=>Boolean(navigator.serviceWorker.controller));await expect.poll(()=>state.prepareCount).toBeGreaterThan(1);
 state.offline=true;await context.setOffline(true);await page.reload();
 await expect(page.getByText('Fazenda Protegida Offline',{exact:true})).toBeVisible();await expect(page.getByRole('heading',{name:'Dashboard comercial'})).toHaveCount(0);
 await row(page).getByRole('button',{name:'Iniciar visita',exact:true}).click();const entry=page.getByRole('dialog',{name:/Iniciar visita/});await entry.getByRole('combobox',{name:'Visita'}).selectOption(activity);await entry.getByRole('checkbox').check();await entry.getByRole('button',{name:'Salvar neste aparelho'}).click();await expect(entry).not.toBeVisible();
 await expect(page.getByText('Visita em andamento')).toBeVisible();await page.getByRole('button',{name:'Encerrar visita',exact:true}).click();const exit=page.getByRole('dialog',{name:/Encerrar visita/});await exit.getByLabel('Relato da visita').fill('Relato offline da visita');await exit.getByRole('checkbox').check();await exit.getByRole('button',{name:'Salvar neste aparelho'}).click();await expect(exit).not.toBeVisible();
 await expect(page.getByText('Aguardando envio',{exact:true})).toHaveCount(1);expect(state.posts).toHaveLength(0);expect((await envelope(page))!.pendingCount).toBe(1);
});
test('confirmed conflicts are kept for review and resent only as an explicit new attempt',async({page})=>{
 const state=await setup(page,{conflict:true});await openOffline(page);await activityOffline(page);
 await expect(page.getByText('Conflito',{exact:true})).toBeVisible();expect(state.effects.size).toBe(0);
 await page.getByRole('button',{name:'Nova tentativa'}).click();await expect(page.getByText('Sincronizado',{exact:true})).toBeVisible();await expect.poll(()=>state.effects.size).toBe(1);
 expect(state.effects.size).toBe(1);expect(state.posts[1]!.operation.operationId).not.toBe(state.posts[0]!.operation.operationId);expect(state.posts[1]!.operation.partyVersion).toBe(1);
});
test('logout warns about records still on the device; cancelling keeps them and confirming removes the vault',async({page,context})=>{
 const state=await setup(page);await openOffline(page);await goOffline(page,context,state);await activityOffline(page);state.offline=false;await context.setOffline(false);await page.unroute('**/api/v1/companies/*/offline/sync');await page.route('**/api/v1/companies/*/offline/sync',route=>route.abort('failed'));
 const portal=page.getByRole('button',{name:'Voltar'});if(await portal.isVisible())await portal.click();
 page.once('dialog',dialog=>dialog.dismiss());await page.getByRole('button',{name:'Encerrar sessão',exact:true}).click();expect(state.logoutCount).toBe(0);expect((await envelope(page))!.pendingCount).toBe(1);
 page.once('dialog',dialog=>{expect(dialog.message()).toContain('1 registro');void dialog.accept();});await page.getByRole('button',{name:'Encerrar sessão',exact:true}).click();await expect(page.getByRole('heading',{name:'Acessar sua conta',exact:true})).toBeVisible();expect(state.logoutCount).toBe(1);expect(await envelope(page)).toBeNull();
});
test('tampered device data is refused without disclosing it',async({page})=>{
 await setup(page);const original=(await envelope(page))!;
 await page.evaluate(async value=>new Promise<void>((resolve,reject)=>{const req=indexedDB.open('nexforge-crm-offline-v2',1);req.onsuccess=()=>{const db=req.result,tx=db.transaction('vault','readwrite');tx.objectStore('vault').put(value,'primary');tx.oncomplete=()=>{db.close();resolve();};tx.onerror=reject;};}),{...original,revision:(original as unknown as {revision:number}).revision+1,ciphertext:(original.ciphertext[0]==='A'?'B':'A')+original.ciphertext.slice(1)});
 await page.route('**/api/v1/companies/*/offline/prepare',route=>route.abort('failed'));
 if(test.info().project.name==='mobile')await page.getByRole('button',{name:'Abrir ou fechar menu'}).click();await page.getByRole('navigation').getByRole('button',{name:'Operação offline',exact:true}).click();
 await expect(page.getByRole('alert')).toContainText('corrompidos');await expect(page.getByText('Fazenda Protegida Offline')).toHaveCount(0);
});
