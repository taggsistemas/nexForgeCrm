import {test,expect} from '@playwright/test';
const company='a'.repeat(24),seller='b'.repeat(24),partyId='c'.repeat(24),regionId='d'.repeat(24),portfolioId='e'.repeat(24),planId='f'.repeat(24),itemId='1'.repeat(24);
const permissions=['company:read','region:read','region:manage','portfolio:read','portfolio:manage','visit:read','visit:write','activity:read','activity:write','customer:read'];
const account={user:{name:'Gestor',email:'manager@example.invalid'},tenant:{name:'Cliente Teste'},companies:[{id:company,name:'Empresa Teste'}],permissions,security:{mustChangePassword:false,privacyAcceptanceRequired:false}};
const region={id:regionId,name:'Centro',state:'PR',cities:['Guarapuava'],notes:'',active:true,version:0};
const book={id:portfolioId,name:'Carteira Centro',ownerId:seller,ownerName:'Vendedor Um',regionId,regionName:'Centro',notes:'',active:true,version:0};
const plan={id:planId,title:'Semana Centro',portfolioId,portfolioName:book.name,ownerId:seller,ownerName:'Vendedor Um',period:'weekly',startDate:'2030-04-29',endDate:'2030-05-06',timeZone:'America/Sao_Paulo',state:'draft',notes:'',version:0};
test('region, portfolio, assignment and visit publication use modals and show the activity in the agenda',async({page})=>{
 let hasRegion=false,hasBook=false,assigned=false,hasPlan=false,currentPlan={...plan},hasItem=false,published=false;
 let regionPayload:Record<string,unknown>|undefined,bookPayload:Record<string,unknown>|undefined,transferPayload:Record<string,unknown>|undefined,planPayload:Record<string,unknown>|undefined;
 const entry={id:itemId,partyId,partyName:'Cliente Teste',ownerId:seller,startAt:'2030-05-02T12:00:00Z',endAt:'2030-05-02T12:30:00Z',durationMinutes:30,objective:'Apresentar solução',version:0,activityId:null as string|null,activityStatus:'draft',validAssignment:true};
 await page.route('**/api/v1/auth/session',route=>route.fulfill({json:account}));
 await page.route('**/api/v1/companies/*/territories/**',async route=>{
  const req=route.request(),url=new URL(req.url()),path=url.pathname,method=req.method();
  if(path.endsWith('/options')){
   const kind=url.searchParams.get('kind');return route.fulfill({json:{items:kind==='regions'?(hasRegion?[{id:regionId,name:'Centro'}]:[]):kind==='sellers'?[{id:seller,name:'Vendedor Um'}]:kind==='portfolios'?(hasBook?[{id:portfolioId,name:'Carteira Centro — Vendedor Um'}]:[]):assigned?[{id:partyId,name:'Cliente Teste'}]:[]}});
  }
  if(path.endsWith('/assignments')){transferPayload=req.postDataJSON();assigned=true;return route.fulfill({json:{count:1}});}
  if(path.endsWith('/publish')){published=true;currentPlan={...currentPlan,state:'published',version:2};return route.fulfill({json:{count:1}});}
  if(path.endsWith('/items')&&method==='POST'){hasItem=true;currentPlan={...currentPlan,version:1};return route.fulfill({status:201,json:{id:itemId}});}
  if(path.endsWith('/plans/'+planId))return route.fulfill({json:{record:currentPlan,items:hasItem?[{...entry,activityId:published?'2'.repeat(24):null,activityStatus:published?'pendente':'draft'}]:[],total:hasItem?1:0,page:1,pageSize:20}});
  if(path.endsWith('/regions')){
   if(method==='POST'){regionPayload=req.postDataJSON();hasRegion=true;return route.fulfill({status:201,json:{record:region}});}
   return route.fulfill({json:{items:hasRegion?[region]:[],total:hasRegion?1:0,page:1,pageSize:20}});
  }
  if(path.endsWith('/portfolios')){
   if(method==='POST'){bookPayload=req.postDataJSON();hasBook=true;return route.fulfill({status:201,json:{record:{id:portfolioId}}});}
   return route.fulfill({json:{items:hasBook?[book]:[],total:hasBook?1:0,page:1,pageSize:20}});
  }
  if(path.endsWith('/parties'))return route.fulfill({json:{items:[{id:partyId,name:'Cliente Teste',kind:'customer',ownerId:seller,ownerName:'Vendedor Um',portfolioId:assigned?portfolioId:null,portfolioName:assigned?book.name:'',regionName:assigned?'Centro':'',version:assigned?1:0}],total:1,page:1,pageSize:20}});
  if(path.endsWith('/plans')){
   if(method==='POST'){planPayload=req.postDataJSON();hasPlan=true;return route.fulfill({status:201,json:{id:planId}});}
   return route.fulfill({json:{items:hasPlan?[currentPlan]:[],total:hasPlan?1:0,page:1,pageSize:20}});
  }
  return route.fulfill({status:404,json:{}});
 });
 await page.route('**/api/v1/companies/*/agenda/**',route=>{
  const path=new URL(route.request().url()).pathname;if(path.endsWith('/owners'))return route.fulfill({json:{items:[{id:seller,name:'Vendedor Um'}]}});
  return route.fulfill({json:{items:published?[{id:'2'.repeat(24),source:'party',partyId,partyName:'Cliente Teste',ownerId:seller,ownerName:'Vendedor Um',opportunityId:'',opportunityTitle:'',title:'Visita — Cliente Teste',type:'visita',status:'pendente',dueAt:entry.startAt,completedAt:null,notes:entry.objective,version:0}]:[],total:published?1:0,page:1,pageSize:50,dailyCounts:published?[{date:'2030-05-02',total:1}]:[]}});
 });
 await page.goto('/');
 if(test.info().project.name==='mobile')await page.getByRole('button',{name:'Abrir ou fechar menu'}).click();
 await page.getByRole('navigation').getByRole('button',{name:'Carteiras e planejamento'}).click();
 await page.getByRole('tab',{name:'Regiões',exact:true}).click();
 await page.getByRole('button',{name:'Nova região',exact:true}).click();
 const regionModal=page.getByRole('dialog',{name:'Nova região',exact:true});
 await regionModal.getByLabel('Nome da região').fill('Centro');await regionModal.getByLabel('Estado / UF').selectOption('PR');await regionModal.getByLabel('Cidades').fill('Guarapuava');
 await regionModal.getByRole('button',{name:'Salvar cadastro'}).click();
 await expect(page.getByRole('table')).toContainText('Centro');expect(regionPayload).not.toHaveProperty('tenantId');
 await page.getByRole('tab',{name:'Carteiras',exact:true}).click();
 await page.getByRole('button',{name:'Nova carteira',exact:true}).click();
 const bookModal=page.getByRole('dialog',{name:'Nova carteira',exact:true});
 await bookModal.getByLabel('Nome da carteira').fill('Carteira Centro');
 await bookModal.getByRole('combobox',{name:'Vendedor responsável',exact:true}).selectOption(seller);
 await bookModal.getByRole('combobox',{name:'Região da carteira',exact:true}).selectOption(regionId);
 await bookModal.getByRole('button',{name:'Salvar cadastro'}).click();
 await expect(bookModal).not.toBeVisible();expect(bookPayload).toMatchObject({ownerId:seller,regionId});
 await page.getByRole('checkbox',{name:'Selecionar Cliente Teste',exact:true}).check();
 await page.getByRole('button',{name:'Mover selecionados (1)',exact:true}).click();
 const transfer=page.getByRole('dialog',{name:'Mover cadastros de carteira',exact:true});
 await transfer.getByRole('combobox',{name:'Carteira de destino',exact:true}).selectOption(portfolioId);
 await transfer.getByRole('button',{name:'Confirmar',exact:true}).click();await expect(transfer).not.toBeVisible();
 expect(transferPayload).toEqual({portfolioId,entries:[{partyId,version:0}]});
 await page.screenshot({path:'artifacts/portfolios-'+test.info().project.name+'.png',fullPage:true});
 await page.getByRole('tab',{name:'Planejamento',exact:true}).click();
 await page.getByRole('button',{name:'Novo plano de visitas',exact:true}).click();
 const createPlan=page.getByRole('dialog',{name:'Novo plano de visitas',exact:true});
 await createPlan.getByLabel('Título do plano').fill('Semana Centro');
 await createPlan.getByRole('combobox',{name:'Carteira do plano',exact:true}).selectOption(portfolioId);
 await createPlan.getByLabel('Data de referência',{exact:true}).fill('2030-05-02');
 await expect(createPlan).toContainText('29/04/2030 a 05/05/2030');
 await createPlan.getByRole('button',{name:'Salvar cadastro'}).click();await expect(createPlan).not.toBeVisible();
 expect(planPayload).toMatchObject({portfolioId,period:'weekly',anchorDate:'2030-05-02'});expect(planPayload).not.toHaveProperty('ownerId');
 await page.getByRole('button',{name:'Abrir plano',exact:true}).click();
 const details=page.getByRole('dialog',{name:'Plano — Semana Centro',exact:true});
 await details.getByRole('button',{name:'Adicionar visita',exact:true}).click();
 const item=page.getByRole('dialog',{name:'Nova visita planejada',exact:true});
 await item.getByRole('combobox',{name:'Cliente ou lead da carteira',exact:true}).selectOption(partyId);
 await item.getByLabel('Data e hora da visita').fill('2030-05-02T09:00');await item.getByLabel('Objetivo da visita').fill('Apresentar solução');
 await page.screenshot({path:'artifacts/visit-plan-modal-'+test.info().project.name+'.png',fullPage:true});
 await item.getByRole('button',{name:'Salvar cadastro'}).click();await expect(details).toContainText('Cliente Teste');
 await details.getByRole('button',{name:'Publicar plano',exact:true}).click();
 const publish=page.getByRole('dialog',{name:'Publicar plano',exact:true});await publish.getByRole('button',{name:'Confirmar',exact:true}).click();await expect(publish).not.toBeVisible();
 await expect(details).toContainText('Publicado');await expect(details.getByRole('button',{name:'Adicionar visita',exact:true})).toHaveCount(0);
 await page.screenshot({path:'artifacts/visit-plan-'+test.info().project.name+'.png',fullPage:true});
 await details.getByRole('button',{name:'Fechar formulário',exact:true}).click();
 if(test.info().project.name==='mobile')await page.getByRole('button',{name:'Abrir ou fechar menu'}).click();
 await page.getByRole('navigation').getByRole('button',{name:'Agenda e visitas'}).click();
 await page.getByLabel('Data de referência',{exact:true}).fill('2030-05-02');
 await expect(page.locator('.nf-agenda-list')).toContainText('Visita — Cliente Teste');
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
});
test('seller can consult portfolio without region or assignment management controls',async({page})=>{
 await page.route('**/api/v1/auth/session',route=>route.fulfill({json:{...account,permissions:permissions.filter(value=>!['region:manage','portfolio:manage'].includes(value))}}));
 await page.route('**/api/v1/companies/*/territories/**',route=>{
  const path=new URL(route.request().url()).pathname;
  return route.fulfill({json:{items:path.endsWith('/portfolios')?[book]:path.endsWith('/regions')?[region]:[],total:path.endsWith('/parties')?0:1,page:1,pageSize:20}});
 });
 await page.goto('/');
 if(test.info().project.name==='mobile')await page.getByRole('button',{name:'Abrir ou fechar menu'}).click();
 await page.getByRole('navigation').getByRole('button',{name:'Carteiras e planejamento'}).click();
 await expect(page.getByRole('button',{name:'Nova carteira',exact:true})).toHaveCount(0);
 await expect(page.getByRole('button',{name:'Mover selecionados',exact:false})).toHaveCount(0);
 await page.getByRole('tab',{name:'Regiões',exact:true}).click();
 await expect(page.getByRole('button',{name:'Nova região',exact:true})).toHaveCount(0);
});
