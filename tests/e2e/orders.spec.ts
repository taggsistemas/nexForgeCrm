import {test,expect,type Page} from '@playwright/test';
const company='a'.repeat(24),party='b'.repeat(24),product='c'.repeat(24);
const account=(permissions:string[])=>({user:{id:'d'.repeat(24),name:'Usuário',email:'usuario@example.invalid'},tenant:{name:'Cliente Teste'},companies:[{id:company,name:'Empresa Teste'}],permissions,security:{mustChangePassword:false,privacyAcceptanceRequired:false}});
const order=(id:string,status:string,extra:Record<string,unknown>={})=>({id,number:'PV-00000'+id.slice(-1),kind:'venda',origin:'direto',partyId:party,partyName:'Fazenda Boa Vista',opportunityId:null,proposalId:null,proposalNumber:'',workOrderId:null,workOrderNumber:'',status,
 items:[{productId:product,code:'P-0001',description:'Robô de ordenha',kind:'product',unit:'pc',quantity:'1',unitPriceCents:850000,discountCents:0,referencePriceCents:900000,totalCents:850000,costCents:600000}],totalCents:850000,paymentMethod:'boleto',paymentTermDays:[30,60],expectedDeliveryDate:'2030-11-20',notes:'',
 approvalReasons:status==='aguardando_aprovacao'?['discount']:[],decisionNote:'',submittedAt:'2030-10-29T12:00:00.000Z',confirmedAt:null,approvedBy:'',deliveredAt:null,invoicedAt:null,cancelledAt:null,invoices:[],invoicedCents:0,remainingCents:850000,
 installments:[{dueDate:'2030-12-20',amountCents:425000},{dueDate:'2031-01-19',amountCents:425000}],costCents:600000,marginCents:250000,marginPercent:29.4,
 canEdit:false,canSubmit:false,canApprove:status==='aguardando_aprovacao',canDeliver:status==='confirmado',canInvoice:status==='confirmado',canCancel:false,version:2,createdAt:'2030-10-29T12:00:00.000Z',updatedAt:'2030-10-29T12:00:00.000Z',...extra});
async function openOrders(page:Page,permissions:string[]){
 await page.route('**/api/v1/auth/session',route=>route.fulfill({json:account(permissions)}));
 await page.goto('/');
 if(test.info().project.name==='mobile')await page.getByRole('button',{name:'Abrir ou fechar menu'}).click();
 await page.getByRole('navigation').getByRole('button',{name:'Pedidos de venda e serviço',exact:true}).click();
}
test('management approves an exception and finance registers an invoice without sending server-owned fields',async({page})=>{
 const posts:{url:string;body:Record<string,unknown>}[]=[];const rows=[order('1'.repeat(24),'aguardando_aprovacao'),order('2'.repeat(24),'confirmado')];
 await page.route('**/api/v1/companies/*/orders**',route=>{const request=route.request(),url=new URL(request.url());
  if(request.method()==='POST'){posts.push({url:url.pathname,body:request.postDataJSON()});return route.fulfill({json:{record:rows[0]}});}
  const id=url.pathname.split('/').at(-1)!;if(id!=='orders')return route.fulfill({json:{record:rows.find(row=>row.id===id),history:[{action:'submit',actor:'Vendedor',at:'2030-10-29T12:00:00.000Z',note:'Aprovação necessária: discount'}]}});
  return route.fulfill({json:{items:rows,total:2,page:1,pageSize:20}});});
 await openOrders(page,['company:read','customer:read','order:read','order:sales','order:service','order:approve','billing:write','cost:read']);
 const filters=page.locator('.nf-filter-bar');const [status,number]=await Promise.all([filters.getByLabel('Situação').boundingBox(),filters.getByLabel('Número do pedido').boundingBox()]);if(test.info().project.name!=='mobile')expect(Math.abs(status!.y+status!.height-(number!.y+number!.height))).toBeLessThanOrEqual(1);
 await expect(page.getByText('PV-000001 · Fazenda Boa Vista')).toBeVisible();await expect(page.getByRole('button',{name:'Novo pedido'})).toHaveCount(0);
 await page.getByRole('button',{name:'Analisar aprovação'}).click();
 const detail=page.getByRole('dialog',{name:/Pedido PV-000001/});await expect(detail.getByText('Aprovação necessária: Preço abaixo da tabela.')).toBeVisible();await expect(detail.getByText('R$ 2.500,00 (29,4%)')).toBeVisible();
 await expect(detail.getByText('20/12/2030 · R$ 4.250,00')).toBeVisible();await expect(detail.getByText(/Enviado · Vendedor/)).toBeVisible();
 await detail.getByRole('button',{name:'Aprovar'}).click();await page.getByRole('dialog',{name:/Aprovar pedido/}).getByRole('button',{name:'Confirmar'}).click();
 await expect.poll(()=>posts.length).toBe(1);expect(posts[0]).toEqual({url:'/api/v1/companies/'+company+'/orders/'+'1'.repeat(24)+'/approve',body:{version:2,note:''}});
 await detail.getByRole('button',{name:'Fechar formulário'}).click();
 await page.getByRole('button',{name:'Lançar nota'}).click();await page.getByRole('dialog',{name:/Pedido PV-000002/}).getByRole('button',{name:'Lançar nota fiscal'}).click();
 const invoice=page.getByRole('dialog',{name:/Lançar nota fiscal/});await invoice.getByLabel('Número da nota').fill('NF-1001');await invoice.getByLabel('Valor (R$)').fill('4.250,00');await invoice.getByRole('button',{name:'Lançar nota'}).click();
 await expect.poll(()=>posts.length).toBe(2);expect(posts[1]!.url).toMatch(/\/invoices$/);expect(Object.keys(posts[1]!.body).sort()).toEqual(['amountCents','issueDate','number','version']);expect(posts[1]!.body.amountCents).toBe(425000);
 const printed=page.getByRole('dialog',{name:/Pedido PV-000002/});
 await page.evaluate(()=>{(window as unknown as {printed:number}).printed=0;window.print=()=>{(window as unknown as {printed:number}).printed++;};});
 await printed.getByRole('button',{name:'Imprimir'}).click();await expect.poll(()=>page.evaluate(()=>(window as unknown as {printed:number}).printed)).toBe(1);
 const sheet=page.locator('body > .nf-print-area');await expect(sheet).toContainText('PV-000002');await expect(sheet).toContainText('Robô de ordenha');await expect(sheet).not.toContainText('Custo');await expect(sheet).not.toContainText('Margem');
 await page.emulateMedia({media:'print'});await expect(sheet).toBeVisible();await expect(page.locator('#root')).toBeHidden();await page.emulateMedia({media:'screen'});
 await page.evaluate(()=>window.dispatchEvent(new Event('afterprint')));await expect(sheet).toHaveCount(0);
 await page.screenshot({path:'artifacts/orders-'+test.info().project.name+'.png',fullPage:true});
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true);
});
test('seller creates a direct order from approved customers and catalog items with typed payment terms',async({page})=>{
 let created:Record<string,unknown>|null=null;const customerQueries:string[]=[];
 await page.route('**/api/v1/companies/*/customers**',route=>{customerQueries.push(route.request().url());return route.fulfill({json:{items:[{id:party,name:'Fazenda Boa Vista'}],total:1}});});
 await page.route('**/api/v1/companies/*/catalog/products**',route=>route.fulfill({json:{items:[{id:product,code:'P-0001',description:'Robô de ordenha',active:true}],total:1}}));
 await page.route('**/api/v1/companies/*/catalog/resolve**',route=>route.fulfill({json:{price:{priceCents:900000}}}));
 await page.route('**/api/v1/companies/*/orders**',route=>{if(route.request().method()==='POST'){created=route.request().postDataJSON();return route.fulfill({status:201,json:{id:'1'.repeat(24),number:'PV-000003'}});}return route.fulfill({json:{items:[],total:0,page:1,pageSize:20}});});
 await openOrders(page,['company:read','customer:read','catalog:read','order:read','order:write','order:sales','order:service']);
 await page.getByRole('button',{name:'Novo pedido'}).click();const editor=page.getByRole('dialog',{name:'Novo pedido'});
 await editor.getByRole('combobox',{name:'Cliente'}).selectOption(party);await editor.getByRole('combobox',{name:'Incluir item'}).selectOption(product);
 await expect(editor.getByLabel('Preço unitário de P-0001 — Robô de ordenha')).toHaveValue('9000,00');await expect(editor.getByText('Total previsto: R$ 9.000,00')).toBeVisible();
 await editor.getByLabel('Prazos (dias após a entrega)').fill('60/30');await editor.getByRole('button',{name:'Salvar rascunho'}).click();
 await expect(page.getByText('Pedido PV-000003 criado em rascunho.')).toBeVisible();
 expect(customerQueries.every(url=>url.includes('qualificationState=approved'))).toBe(true);
 expect(created).toMatchObject({partyId:party,paymentMethod:'boleto',paymentTermDays:[30,60],items:[{productId:product,quantity:'1',unitPriceCents:900000,discountCents:0}]});
 expect(created).not.toHaveProperty('totalCents');expect(created).not.toHaveProperty('status');
});
