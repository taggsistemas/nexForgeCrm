import {test,expect} from '@playwright/test';
const account={user:{name:'Administrador',email:'owner@example.invalid'},tenant:{name:'Cliente Teste'},companies:[{id:'a'.repeat(24),name:'Empresa Teste'}],permissions:['user:manage','role:manage'],profiles:[{name:'Administrador do sistema'}]};
test('administrator registers a seller with company and role, then configures the user',async({page})=>{
  await page.route('**/api/v1/auth/session',route=>route.fulfill({json:account}));
  let created=false,submitted:Record<string,unknown>|undefined,updated:Record<string,unknown>|undefined;
  const seller={id:'b'.repeat(24),name:'Vendedor Teste',email:'seller@example.invalid',profileKey:'seller',profileName:'Vendedor',companyIds:['a'.repeat(24)],supervisedUserIds:[],active:true,protected:false};
  const profiles=[{key:'tenant_admin',name:'Administrador do sistema',visibility:'company'},{key:'manager',name:'Gerencial',visibility:'company'},{key:'sales_admin',name:'Administrativo de vendas',visibility:'company'},{key:'supervisor',name:'Supervisor',visibility:'team'},{key:'seller',name:'Vendedor',visibility:'own'}];
  await page.route('**/api/v1/admin/users',async route=>{
    if(route.request().method()==='POST'){submitted=route.request().postDataJSON();created=true;await route.fulfill({status:201,json:{user:seller}});}
    else await route.fulfill({json:{items:created?[seller]:[],profiles}});
  });
  await page.route('**/api/v1/admin/users/*',async route=>{updated=route.request().postDataJSON();await route.fulfill({json:{user:{id:seller.id,active:false,profileKey:'seller'}}});});
  await page.goto('/');
  if(test.info().project.name==='mobile')await page.getByRole('button',{name:'Abrir ou fechar menu'}).click();
  await page.getByRole('navigation').getByRole('button',{name:'Usuários e equipes'}).click();
  await page.getByRole('button',{name:'Novo usuário',exact:true}).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.getByLabel('Nome do usuário').fill(seller.name);
  await page.getByLabel('E-mail',{exact:true}).fill(seller.email);
  await page.getByLabel('Senha temporária',{exact:true}).fill('only-test-password-123');
  await page.getByLabel('Confirmar senha',{exact:true}).fill('only-test-password-123');
  await page.getByLabel('Perfil de acesso').selectOption('seller');
  await page.getByRole('button',{name:'Cadastrar usuário',exact:true}).click();
  await expect(page.getByRole('status').filter({hasText:'Usuário cadastrado'})).toBeVisible();
  expect(submitted).toMatchObject({name:seller.name,email:seller.email,profileKey:'seller',companyIds:account.companies.map(company=>company.id),supervisedUserIds:[]});
  expect(submitted).not.toHaveProperty('tenantId');expect(submitted).not.toHaveProperty('permissions');
  await page.screenshot({path:'artifacts/user-administration-'+test.info().project.name+'.png',fullPage:true});
  await page.getByRole('button',{name:'Configurar',exact:true}).click();
  await page.getByLabel('Acesso ativo').uncheck();
  await page.getByRole('button',{name:'Salvar alterações'}).click();
  await expect(page.getByRole('status').filter({hasText:'Usuário atualizado'})).toBeVisible();
  expect(updated).toEqual({profileKey:'seller',active:false,supervisedUserIds:[]});
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
});
test('a replaced customer session returns to login when the application regains focus',async({page})=>{
  let replaced=false;
  await page.route('**/api/v1/auth/session',route=>route.fulfill(replaced?{status:401,json:{code:'AUTHENTICATION_REQUIRED'}}:{json:account}));
  await page.goto('/');await expect(page.getByRole('heading',{name:'Dashboard comercial'})).toBeVisible();
  replaced=true;await page.evaluate(()=>window.dispatchEvent(new Event('focus')));
  await expect(page.getByRole('heading',{name:'Acessar sua conta',exact:true})).toBeVisible();
  await expect(page.getByRole('alert')).toContainText('encerrada por um novo acesso');
});
test('a replaced master session returns to the separate master login',async({page})=>{
  let replaced=false;
  await page.route('**/api/v1/taggmaster/session',route=>route.fulfill(replaced?{status:401,json:{code:'MASTER_AUTHENTICATION_REQUIRED'}}:{json:{admin:{id:'master',name:'Master',email:'master@example.invalid'}}}));
  await page.route('**/api/v1/taggmaster/clients?*',route=>route.fulfill({json:{items:[],total:0,page:1,pageSize:20}}));
  await page.goto('/taggmaster');await expect(page.getByRole('button',{name:'+ Nova empresa'})).toBeVisible();
  replaced=true;await page.evaluate(()=>window.dispatchEvent(new Event('focus')));
  await expect(page.getByRole('heading',{name:'Acessar Tagg Master',exact:true})).toBeVisible();
  await expect(page.getByRole('alert')).toContainText('encerrada por um novo acesso');
});
