import {test,expect} from '@playwright/test';
import {privacyPolicy} from '../../packages/contracts/src/privacy';
const company='a'.repeat(24),user='b'.repeat(24),id='c'.repeat(24),contactId='d'.repeat(24),reviewer='e'.repeat(24);
const account={user:{id:user,name:'Vendedor',email:'seller@example.invalid'},tenant:{name:'Empresa Teste'},companies:[{id:company,name:'Empresa Teste'}],permissions:['company:read','lead:read','lead:write','customer:read','customer:write','contact:read','contact:write','qualification:edit','qualification:submit'],security:{mustChangePassword:false,privacyAcceptanceRequired:false}};
const record={id,kind:'lead',name:'Acme',contactName:'Ana Compras',legalName:'',taxId:'',stateRegistration:'',email:'acme@example.invalid',phone:'42999999999',customerType:'outro',stage:'novo',address:{postalCode:'',street:'',number:'',complement:'',neighborhood:'',city:'',state:'',country:'Brasil'},ownerId:user,notes:'',version:0,createdAt:new Date().toISOString(),updatedAt:new Date().toISOString(),qualification:{state:'none',revision:0,reviewReason:'',approvedAt:null,approvedBy:null,registrationStatus:'nao_aplicavel',commercial:{creditLimitCents:0,paymentMethods:[] as string[],paymentTermDays:[] as number[]}}};
test('minimal intake, administrative return, resubmission and approval preserve the same customer identity',async({page})=>{
 let admin=false,created=false,current:any={...record},submission:any=null,partyPayload:any=null,draftPayload:any=null;const events:any[]=[];
 await page.route('**/api/v1/auth/session',route=>route.fulfill({json:admin?{...account,user:{id:reviewer,name:'Administrativo',email:'admin@example.invalid'},permissions:[...account.permissions,'qualification:approve']}:account}));
 await page.route('https://viacep.com.br/ws/85010000/json/',route=>route.fulfill({json:{logradouro:'Rua Teste',bairro:'Centro',localidade:'Guarapuava',uf:'PR'}}));
 await page.route('**/api/v1/companies/*/crm/**',async route=>{
  const req=route.request(),url=new URL(req.url()),path=url.pathname,method=req.method();
  if(path.endsWith('/owners'))return route.fulfill({json:{items:[{id:user,name:'Vendedor'}]}});
  if(path.endsWith('/qualification/submit')){current={...current,version:current.version+1,qualification:{...current.qualification,state:'submitted',revision:current.qualification.revision+1,reviewReason:''}};submission={snapshot:structuredClone(current),stale:false};events.push({action:'submitted',reason:'',at:new Date().toISOString(),actor:'Usuário autorizado'});return route.fulfill({json:{record:current}});}
  if(path.endsWith('/qualification/return')){expect(admin).toBe(true);const data=req.postDataJSON();current={...current,version:current.version+1,qualification:{...current.qualification,state:'revision',reviewReason:data.reason}};events.push({action:'returned',reason:data.reason,at:new Date().toISOString(),actor:'Usuário autorizado'});return route.fulfill({json:{record:current}});}
  if(path.endsWith('/qualification/approve')){expect(admin).toBe(true);expect(req.postDataJSON()).toEqual({version:current.version});current={...current,kind:'customer',stage:'qualificado',version:current.version+1,qualification:{...current.qualification,state:'approved',approvedAt:new Date().toISOString(),approvedBy:reviewer}};return route.fulfill({json:{record:current}});}
  if(path.endsWith('/qualification')){
   if(method==='PATCH'){draftPayload=req.postDataJSON();current={...current,...draftPayload,version:current.version+1,qualification:{...current.qualification,state:current.qualification.state==='revision'?'revision':'draft',registrationStatus:draftPayload.registrationStatus,commercial:draftPayload.commercial}};return route.fulfill({json:{record:current}});}
   return route.fulfill({json:{record:current,submission,history:events,canApprove:admin}});
  }
  if(path.endsWith('/leads')&&method==='POST'){partyPayload=req.postDataJSON();created=true;return route.fulfill({status:201,json:{record:current}});}
  if(path.endsWith('/leads')||path.endsWith('/customers')){const kind=path.endsWith('/leads')?'lead':'customer',items=created&&current.kind===kind&&(!url.searchParams.has('stage')||url.searchParams.get('stage')===current.stage)?[current]:[];return route.fulfill({json:{items,total:items.length,page:1,pageSize:20}});}
  return route.fulfill({status:404,json:{}});
 });
 async function navigate(){await page.goto('/');if(test.info().project.name==='mobile')await page.getByRole('button',{name:'Abrir ou fechar menu'}).click();await page.getByRole('navigation').getByRole('button',{name:'Pipeline comercial'}).click();}
 await navigate();await page.getByRole('button',{name:'+ Novo lead',exact:true}).click();const initial=page.getByRole('dialog');await initial.getByLabel('Nome da empresa',{exact:true}).fill('Acme');await initial.getByLabel('Nome do contato principal').fill('Ana Compras');await initial.getByLabel('Telefone com DDD').fill('42999999999');await initial.getByLabel('E-mail',{exact:true}).fill('acme@example.invalid');await expect(initial.getByLabel('CNPJ',{exact:true})).toHaveCount(0);await expect(initial.getByRole('combobox',{name:'Etapa do lead'}).getByRole('option',{name:'Qualificado',exact:true})).toHaveCount(0);await initial.getByRole('button',{name:'Salvar cadastro'}).click();expect(partyPayload).not.toHaveProperty('taxId');expect(partyPayload).not.toHaveProperty('commercial');
 const modal=page.getByRole('dialog',{name:'Qualificação comercial',exact:true});await page.getByRole('button',{name:'Qualificar',exact:true}).click();await modal.getByLabel('Razão social / nome completo',{exact:true}).fill('Acme Ltda');await modal.getByLabel('CNPJ',{exact:true}).fill('11222333000181');await modal.getByRole('combobox',{name:'Situação da IE',exact:true}).selectOption('isento');await modal.getByLabel('CEP',{exact:true}).fill('85010000');await modal.getByLabel('Número',{exact:true}).click();await expect(modal.getByLabel('Cidade',{exact:true})).toHaveValue('Guarapuava');await modal.getByLabel('Número',{exact:true}).fill('100');await modal.getByLabel('Limite de crédito (R$)',{exact:true}).fill('1500,00');await modal.getByLabel('Prazos em dias (0 = à vista; ex.: 30,60)',{exact:true}).fill('30,60');await modal.getByRole('checkbox',{name:'Boleto',exact:true}).check();await modal.getByRole('button',{name:'Salvar rascunho',exact:true}).click();await expect(modal.getByRole('status').last()).toContainText('Rascunho salvo');expect(draftPayload.commercial).toEqual({creditLimitCents:150000,paymentMethods:['boleto'],paymentTermDays:[30,60]});expect(draftPayload).not.toHaveProperty('approvedBy');await modal.getByRole('button',{name:'Enviar para análise',exact:true}).click();await expect(modal.getByLabel('Razão social / nome completo')).toBeDisabled();await expect(modal.getByRole('button',{name:'Aprovar e tornar cliente'})).toHaveCount(0);await modal.getByRole('button',{name:'Fechar qualificação',exact:true}).click();
 admin=true;await navigate();await page.getByRole('button',{name:'Analisar qualificação',exact:true}).click();await modal.getByLabel('Motivo da devolução',{exact:true}).fill('Confirmar número do endereço');await modal.getByRole('button',{name:'Devolver para revisão',exact:true}).click();await expect(modal).toContainText('Revisão solicitada');await modal.getByRole('button',{name:'Fechar qualificação',exact:true}).click();
 admin=false;await navigate();await page.getByRole('button',{name:'Qualificar',exact:true}).click();await expect(modal).toContainText('Confirmar número do endereço');await modal.getByLabel('Número',{exact:true}).fill('101');await modal.getByRole('button',{name:'Salvar rascunho',exact:true}).click();await modal.getByRole('button',{name:'Enviar para análise',exact:true}).click();await expect(modal.getByLabel('Razão social / nome completo')).toBeDisabled();await modal.getByRole('button',{name:'Fechar qualificação',exact:true}).click();
 admin=true;await navigate();await page.getByRole('button',{name:'Analisar qualificação',exact:true}).click();await page.screenshot({path:'artifacts/qualification-review-'+test.info().project.name+'.png',fullPage:true});await modal.getByRole('button',{name:'Aprovar e tornar cliente',exact:true}).click();await expect(modal).toContainText('Aprovada');await modal.getByRole('button',{name:'Fechar qualificação',exact:true}).click();await page.getByRole('tab',{name:'Clientes',exact:true}).click();await expect(page.getByRole('table')).toContainText('Acme');await expect(page.getByRole('table')).toContainText('Aprovada');await expect(page.getByRole('button',{name:'+ Novo cliente'})).toHaveCount(0);expect(current.id).toBe(id);expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
});
test('temporary password and privacy onboarding are modal gates before the dashboard',async({page})=>{
 let logged=true,changed=false,accepted=false;
 await page.route('**/api/v1/auth/session',route=>route.fulfill(logged?{json:{...account,security:{mustChangePassword:!changed,privacyAcceptanceRequired:!accepted}}}:{status:401,json:{code:'AUTHENTICATION_REQUIRED'}}));
 await page.route('**/api/v1/auth/privacy-policy',route=>route.fulfill({json:privacyPolicy}));
 await page.route('**/api/v1/auth/password/change',async route=>{expect(route.request().postDataJSON()).toEqual({currentPassword:'temporary-test-password',newPassword:'personal-test-password'});changed=true;logged=false;await route.fulfill({status:204});});
 await page.route('**/api/v1/auth/login',route=>{logged=true;return route.fulfill({json:{...account,security:{mustChangePassword:false,privacyAcceptanceRequired:true}}});});
 await page.route('**/api/v1/auth/privacy/accept',route=>{expect(route.request().postDataJSON()).toEqual({version:privacyPolicy.version,accepted:true});accepted=true;return route.fulfill({status:204});});
 await page.goto('/');
 await expect(page.getByRole('heading',{name:'Dashboard comercial'})).toHaveCount(0);
 const modal=page.getByRole('dialog');
 await modal.getByLabel('Senha temporária / atual').fill('temporary-test-password');
 await modal.getByLabel('Nova senha pessoal').fill('personal-test-password');
 await modal.getByLabel('Confirmar nova senha').fill('personal-test-password');
 await modal.getByRole('button',{name:'Alterar senha',exact:true}).click();
 await expect(page.getByRole('heading',{name:'Acessar sua conta',exact:true})).toBeVisible();
 await page.getByLabel('E-mail',{exact:true}).fill('seller@example.invalid');
 await page.getByLabel('Senha',{exact:true}).fill('personal-test-password');
 await page.getByRole('button',{name:'Entrar no CRM'}).click();
 await expect(page.getByRole('heading',{name:'Termos de uso e privacidade',exact:true})).toBeVisible();
 await modal.getByRole('checkbox').check();
 await modal.getByRole('button',{name:'Aceitar termos e continuar'}).click();
 await expect(page.getByRole('heading',{name:'Dashboard comercial'})).toBeVisible();
});
test('forgot password and reset use modals and the reset token leaves the address bar',async({page})=>{
 await page.route('**/api/v1/auth/session',route=>route.fulfill({status:401,json:{}}));
 await page.route('**/api/v1/auth/password/forgot',route=>route.fulfill({status:202,json:{message:'Se houver conta ativa...'}}));
 await page.goto('/');
 await page.getByRole('button',{name:'Esqueci a senha'}).click();
 await page.getByLabel('E-mail cadastrado').fill('seller@example.invalid');
 await page.getByRole('button',{name:'Enviar instruções'}).click();
 await expect(page.getByRole('status')).toContainText(['Conexão disponível','Se houver uma conta ativa']);
 const token='e'.repeat(64);let resetBody:unknown;
 await page.route('**/api/v1/auth/password/reset',route=>{resetBody=route.request().postDataJSON();return route.fulfill({status:204});});
 await page.goto('/reset-password#token='+token);
 await expect(page).toHaveURL(/\/reset-password$/);
 await page.getByLabel('Nova senha',{exact:true}).fill('reset-personal-password');
 await page.getByLabel('Confirmar nova senha',{exact:true}).fill('reset-personal-password');
 await page.getByRole('button',{name:'Salvar nova senha'}).click();
 await expect(page.getByRole('status')).toContainText('Senha atualizada');
 expect(resetBody).toEqual({token,newPassword:'reset-personal-password'});
});
