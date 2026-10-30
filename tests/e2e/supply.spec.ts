import {test,expect,type Page} from '@playwright/test';
import {readFile} from 'node:fs/promises';
const company='a'.repeat(24),product='b'.repeat(24),supplier='c'.repeat(24),purchase='d'.repeat(24);
const account=(permissions:string[])=>({user:{id:'e'.repeat(24),name:'Almoxarife',email:'stock@example.invalid'},tenant:{name:'Cliente Teste'},companies:[{id:company,name:'Empresa Teste'}],permissions,security:{mustChangePassword:false,privacyAcceptanceRequired:false}});
const profile={legalName:'Só Leite Equipamentos Ltda',tradeName:'Só Leite',taxId:'11222333000181',stateRegistration:'123',municipalRegistration:'',address:{street:'Rua São João',number:'10',complement:'',district:'Centro',city:'Castro',state:'PR',zip:'84165-000'},phone:'42 3232-0000',email:'',website:'',logo:null,documentNotes:'',purchaseApprovalLimitCents:100000,version:1,updatedAt:'2030-10-29T12:00:00.000Z'};
async function open(page:Page,permissions:string[],module:string){
 await page.route('**/api/v1/auth/session',route=>route.fulfill({json:account(permissions)}));
 await page.goto('/');if(test.info().project.name==='mobile')await page.getByRole('button',{name:'Abrir ou fechar menu'}).click();
 await page.getByRole('navigation').getByRole('button',{name:module,exact:true}).click();
}
test('company data with logo feeds documents and the warehouse blocks manual exits without stock',async({page})=>{
 let saved:Record<string,unknown>|null=null,movement:Record<string,unknown>|null=null;
 await page.route('**/api/v1/companies/*/supply/company-profile',route=>{if(route.request().method()==='PUT'){saved=route.request().postDataJSON();return route.fulfill({json:{record:{...profile,...saved,version:2}}});}return route.fulfill({json:{record:{...profile,version:1}}});});
 await open(page,['company:read','company:manage','stock:read','stock:write','catalog:read','cost:read'],'Dados da empresa');
 await expect(page.getByRole('heading',{name:'Só Leite'})).toBeVisible();await expect(page.getByText('Acima de R$ 1.000,00')).toBeVisible();
 await page.getByRole('button',{name:'Editar dados da empresa'}).click();const form=page.getByRole('dialog',{name:'Dados da empresa'});
 const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAgAAAAECAYAAACzzX7wAAAAFUlEQVR4nGM8ISf3nwEPYMInSR0FAAbVAgvqeqApAAAAAElFTkSuQmCC','base64');
 await form.getByLabel('Escolher imagem').setInputFiles({name:'logo.png',mimeType:'image/png',buffer:png});await expect(form.getByAltText('Pré-visualização do logotipo')).toBeVisible();
 await form.getByLabel('Aprovar compras acima de (R$)').fill('2.500,00');await form.getByRole('button',{name:'Salvar dados'}).click();await expect(form).not.toBeVisible();
 expect(saved).toMatchObject({legalName:'Só Leite Equipamentos Ltda',purchaseApprovalLimitCents:250000,version:1});expect(String((saved as unknown as {logo:string}).logo)).toMatch(/^data:image\/jpeg;base64,/);expect(saved).not.toHaveProperty('limit');
 await page.route('**/api/v1/companies/*/supply/stock?**',route=>route.fulfill({json:{items:[{productId:product,code:'P-0001',description:'Teteira',unit:'pc',quantityDecimals:0,quantity:'-5',quantityMilli:-5000,negative:true,costCents:1500,valueCents:-7500,updatedAt:null}],total:1,negativeCount:1,page:1,pageSize:30}}));
 await page.route('**/api/v1/companies/*/catalog/products**',route=>route.fulfill({json:{items:[{id:product,code:'P-0001',description:'Teteira',kind:'product',unit:'pc',active:true}],total:1}}));
 await page.route('**/api/v1/companies/*/supply/stock/movements',route=>{movement=route.request().postDataJSON();return route.fulfill({status:400,json:{code:'SUPPLY_RULE_REJECTED',reason:'INSUFFICIENT_STOCK'}});});
 if(test.info().project.name==='mobile')await page.getByRole('button',{name:'Abrir ou fechar menu'}).click();await page.getByRole('navigation').getByRole('button',{name:'Almoxarifado',exact:true}).click();
 await expect(page.getByText('1 item(ns) com saldo negativo')).toBeVisible();await expect(page.getByRole('cell',{name:/-5/})).toBeVisible();await expect(page.getByRole('cell',{name:'-R$ 75,00'})).toBeVisible();
 await page.getByRole('button',{name:'Saída manual'}).click();const exit=page.getByRole('dialog',{name:'Saída manual do almoxarifado'});await exit.getByRole('combobox',{name:'Produto'}).selectOption(product);await exit.getByLabel('Quantidade').fill('2');await exit.getByLabel('Observação').fill('Avaria no transporte');await exit.getByRole('button',{name:'Registrar'}).click();
 await expect(exit.getByRole('alert')).toContainText('Saldo insuficiente');expect(movement).toEqual({productId:product,quantity:'2',reason:'perda',note:'Avaria no transporte',direction:'saida'});
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true);
});
test('suppliers and purchases: draft with server totals, partial receipt and a PDF with company and supplier data',async({page})=>{
 const posts:{url:string;body:Record<string,unknown>}[]=[];
 const record={id:purchase,number:'PC-000001',supplierId:supplier,supplierName:'Distribuidora Leiteira',status:'enviado',items:[{productId:product,code:'P-0001',description:'Teteira',kind:'product',unit:'pc',quantityDecimals:0,quantity:'10',received:'0',pending:'10',unitCostCents:2000,totalCents:20000}],totalCents:20000,expectedDate:'2030-11-10',paymentTerms:'28 dias',notes:'',decisionNote:'',needsApproval:false,submittedAt:null,approvedAt:null,approvedBy:'',sentAt:null,receivedAt:null,cancelledAt:null,createdBy:'Almoxarife',canEdit:false,canSubmit:false,canApprove:false,canSend:false,canReceive:true,canCancel:true,version:3,createdAt:'2030-10-29T12:00:00.000Z',updatedAt:''};
 const supplierRow={id:supplier,name:'Distribuidora Leiteira',tradeName:'',taxId:'11444777000161',stateRegistration:'',contactName:'Ana',phone:'',email:'',address:{street:'',number:'',complement:'',district:'',city:'Ponta Grossa',state:'PR',zip:''},paymentTerms:'',notes:'',active:true,version:0};
 await page.route('**/api/v1/companies/*/supply/company-profile',route=>route.fulfill({json:{record:profile}}));
 await page.route('**/api/v1/companies/*/supply/suppliers**',route=>{if(route.request().method()==='POST'){posts.push({url:'suppliers',body:route.request().postDataJSON()});return route.fulfill({status:201,json:{record:supplierRow}});}return route.fulfill({json:{items:[supplierRow],total:1,page:1,pageSize:20}});});
 await page.route('**/api/v1/companies/*/catalog/products**',route=>route.fulfill({json:{items:[{id:product,code:'P-0001',description:'Teteira',kind:'product',unit:'pc',active:true,costCents:1800}],total:1}}));
 await page.route('**/api/v1/companies/*/supply/purchases**',route=>{const request=route.request(),url=new URL(request.url());
  if(request.method()==='POST'){posts.push({url:url.pathname,body:request.postDataJSON()});return route.fulfill({status:url.pathname.endsWith('/purchases')?201:200,json:url.pathname.endsWith('/purchases')?{id:purchase,number:'PC-000001'}:{record:{...record,status:'recebido_parcial'}}});}
  if(url.pathname.endsWith(purchase))return route.fulfill({json:{record,supplier:supplierRow,history:[{action:'send',actor:'Almoxarife',at:'2030-10-29T12:00:00.000Z',note:''}]}});
  return route.fulfill({json:{items:[record],total:1,page:1,pageSize:20}});});
 await open(page,['company:read','catalog:read','cost:read','stock:read','supplier:read','supplier:write','purchase:read','purchase:write'],'Fornecedores');
 await page.getByRole('button',{name:'Novo fornecedor'}).click();const form=page.getByRole('dialog',{name:'Novo fornecedor'});await form.getByLabel('Razão social / nome').fill('Distribuidora Leiteira');await form.getByLabel('CNPJ ou CPF').fill('11.444.777/0001-61');await form.getByLabel('UF').fill('pr');await form.getByRole('button',{name:'Salvar fornecedor'}).click();await expect(form).not.toBeVisible();
 expect(posts[0]!.body).toMatchObject({name:'Distribuidora Leiteira',taxId:'11.444.777/0001-61',address:{state:'PR'},active:true});
 if(test.info().project.name==='mobile')await page.getByRole('button',{name:'Abrir ou fechar menu'}).click();await page.getByRole('navigation').getByRole('button',{name:'Compras',exact:true}).click();
 await page.getByRole('button',{name:'Novo pedido de compra'}).click();const editor=page.getByRole('dialog',{name:'Novo pedido de compra'});await editor.getByRole('combobox',{name:'Fornecedor'}).selectOption(supplier);await editor.getByRole('combobox',{name:'Incluir item'}).selectOption(product);
 await expect(editor.getByLabel('Custo unitário de P-0001 — Teteira')).toHaveValue('18,00');await editor.getByLabel('Quantidade de P-0001 — Teteira').fill('10');await editor.getByLabel('Custo unitário de P-0001 — Teteira').fill('20,00');await expect(editor.getByText('Total previsto: R$ 200,00')).toBeVisible();
 await editor.getByRole('button',{name:'Salvar rascunho'}).click();await expect(page.getByText('Pedido de compra PC-000001 criado em rascunho.')).toBeVisible();
 expect(posts[1]!.body).toMatchObject({supplierId:supplier,items:[{productId:product,quantity:'10',unitCostCents:2000}]});expect(posts[1]!.body).not.toHaveProperty('totalCents');
 await page.getByRole('button',{name:'Receber'}).click();const detail=page.getByRole('dialog',{name:/Pedido de compra PC-000001/});
 const download=page.waitForEvent('download');await detail.getByRole('button',{name:'Baixar PDF'}).click();const file=await download;expect(file.suggestedFilename()).toBe('PC-000001.pdf');
 const pdf=(await readFile((await file.path())!)).toString('latin1');expect(pdf.startsWith('%PDF-1.4')).toBe(true);expect(pdf).toContain('(Distribuidora Leiteira)');expect(pdf).toContain('(S\\363 Leite)');expect(pdf).toContain('11.444.777/0001-61');
 await detail.getByRole('button',{name:'Registrar recebimento'}).click();const receipt=page.getByRole('dialog',{name:/Registrar recebimento/});await receipt.getByLabel(/P-0001 — Teteira/).fill('4');await receipt.getByLabel(/Observação/).fill('NF 123');await receipt.getByRole('button',{name:'Registrar recebimento'}).click();
 await expect.poll(()=>posts.length).toBe(3);expect(posts[2]).toEqual({url:'/api/v1/companies/'+company+'/supply/purchases/'+purchase+'/receive',body:{version:3,lines:[{productId:product,quantity:'4'}],note:'NF 123'}});
 await page.screenshot({path:'artifacts/purchases-'+test.info().project.name+'.png',fullPage:true});
});
