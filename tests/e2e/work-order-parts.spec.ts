import {test,expect} from '@playwright/test';
const company='a'.repeat(24),tech='b'.repeat(24),id='c'.repeat(24),party='d'.repeat(24),product='e'.repeat(24);
const account={user:{id:tech,name:'Técnico Teste',email:'tech@example.invalid'},tenant:{name:'Empresa'},companies:[{id:company,name:'Empresa'}],permissions:['tenant:read','company:read','technical:read','technical:write','ticket:read'],security:{mustChangePassword:false,privacyAcceptanceRequired:false}};
const record={id,title:'Revisão da ordenha',partyId:party,partyName:'Fazenda Teste',address:'Estrada, km 4',serviceId:'f'.repeat(24),serviceName:'Manutenção',technicianId:tech,technicianName:'Técnico Teste',startAt:'2030-10-29T11:00:00.000Z',endAt:'2030-10-29T12:00:00.000Z',state:'in_progress',version:1,notes:'',result:'',reason:'',checkedInAt:'2030-10-29T11:05:00.000Z',checkedOutAt:null,interruptedAt:null,checkIn:{latitude:-24.7,longitude:-50,accuracy:10},checkOut:null,canExecute:true,canManage:false,number:'OS-000001',origin:'programada',ticketId:null,ticketNumber:'',propertyId:'1'.repeat(24),propertyName:'Sede',regionName:'Castro',equipmentId:null,equipmentName:'',returnOfWorkId:null,returnOfNumber:'',diagnosis:'',solution:'',attendanceMinutes:null,laborMinutes:null,travelMinutes:null,travelKm:null,billableMinutes:null,closedAt:null,closingNote:'',canClose:false,parts:[],canRegisterParts:true};
test('assigned technician registers a part on the work order without prices or stock fields',async({page})=>{
 let posted:Record<string,unknown>|undefined;const entries:Record<string,unknown>[]=[];
 await page.route('**/api/v1/auth/session',route=>route.fulfill({json:account}));
 await page.route('**/api/v1/companies/*/technical**',route=>{const req=route.request(),path=new URL(req.url()).pathname;
  if(path.endsWith('/parts/options'))return route.fulfill({json:{items:[{id:product,code:'P000010',description:'Válvula de pulsação',unit:'pc',quantityDecimals:0}]}});
  if(path.endsWith('/parts')&&req.method()==='POST'){posted=req.postDataJSON();entries.push({id:'9'.repeat(24),productId:product,code:'P000010',description:'Válvula de pulsação',unit:'pc',kind:'consumo',quantity:'2',note:'Troca preventiva',actor:'Técnico Teste (você)',at:'2030-10-29T11:30:00.000Z',referencePriceCents:null});return route.fulfill({status:201,json:{id:'9'.repeat(24)}});}
  if(path.endsWith('/parts'))return route.fulfill({json:{items:entries,summary:entries.length?[{productId:product,code:'P000010',description:'Válvula de pulsação',unit:'pc',consumed:'2',returned:'0',net:'2',referenceTotalCents:null}]:[]}});
  if(path.endsWith('/'+id))return route.fulfill({json:{record,history:[]}});
  return route.fulfill({json:{items:[record],total:1}});});
 await page.goto('/');
 await page.getByRole('button',{name:'Detalhes e histórico',exact:true}).click();
 const detail=page.getByRole('dialog',{name:'Ordem de serviço — OS-000001'});await expect(detail).toContainText('Nenhuma peça registrada.');
 await detail.getByRole('button',{name:'Registrar peça',exact:true}).click();
 const form=page.getByRole('dialog',{name:'Registrar peça'});
 await form.getByRole('combobox',{name:'Peça'}).selectOption(product);await form.getByLabel('Quantidade',{exact:false}).fill('2');await form.getByLabel('Observação').fill('Troca preventiva');
 await form.getByRole('button',{name:'Registrar',exact:true}).click();await expect(form).not.toBeVisible();
 await expect(detail).toContainText('2 pc');await expect(detail).not.toContainText('Referência');
 expect(posted).toEqual({productId:product,kind:'consumo',quantity:'2',note:'Troca preventiva'});
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
});
