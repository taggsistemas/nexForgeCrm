import {test,expect} from '@playwright/test';
const company='a'.repeat(24),user='b'.repeat(24),partyId='c'.repeat(24),propertyId='d'.repeat(24),equipmentId='e'.repeat(24),ticketId='f'.repeat(24),technician='1'.repeat(24);
const account={user:{id:user,name:'Coordenação',email:'coord@example.invalid'},tenant:{name:'Cliente Teste'},companies:[{id:company,name:'Empresa Teste'}],permissions:['company:read','region:read','technical:read','technical:manage','ticket:read','ticket:write','ticket:manage'],security:{mustChangePassword:false,privacyAcceptanceRequired:false}};
const base={id:ticketId,number:'CH-000001',partyId,partyName:'Fazenda Sintética',propertyId,propertyName:'Sede',regionId:'2'.repeat(24),regionName:'Castro',equipmentId,equipmentName:'GEA R9500',origin:'telefone',criticality:'critico',title:'Robô parado',description:'Robô não inicia a ordenha da manhã.',status:'aberto',assigneeId:null,assigneeName:'',escalationLevel:0,previousTicketId:null,previousTicketNumber:'',openedAt:'2030-10-29T11:00:00.000Z',firstResponseAt:null,agreedDeadline:null,resolvedAt:null,cancelledAt:null,solution:'',responseMinutes:null,resolutionMinutes:null,overdue:false,canManage:true,version:0};
test('coordination opens a critical ticket and records the first response without sending instants',async({page})=>{
 let ticket:Record<string,unknown>|null=null,creation:Record<string,unknown>|undefined,response:Record<string,unknown>|undefined;
 await page.route('**/api/v1/auth/session',route=>route.fulfill({json:account}));
 await page.route('**/api/v1/companies/*/territories/**',route=>route.fulfill({json:{items:[{id:'2'.repeat(24),name:'Castro'}]}}));
 await page.route('**/api/v1/companies/*/technical**',route=>route.fulfill({json:{items:[],total:0,page:1}}));
 await page.route('**/api/v1/companies/*/tickets**',async route=>{
  const request=route.request(),url=new URL(request.url()),path=url.pathname,method=request.method();
  if(path.endsWith('/settings'))return route.fulfill({json:{criticalities:[{key:'critico',label:'Parada total'},{key:'alto',label:'Urgente'},{key:'programado',label:'Agendável'}],version:1}});
  if(path.endsWith('/options'))return route.fulfill({json:url.searchParams.get('partyId')?{parties:[{id:partyId,name:'Fazenda Sintética'}],properties:[{id:propertyId,name:'Sede'}],equipment:[{id:equipmentId,propertyId,name:'GEA R9500'}]}:{parties:[{id:partyId,name:'Fazenda Sintética'}],properties:[],equipment:[]}});
  if(path.endsWith('/assignees'))return route.fulfill({json:{items:[{id:technician,name:'Técnico Castro'}]}});
  if(path.endsWith('/first-response')){response=request.postDataJSON();ticket={...ticket,status:'em_atendimento',firstResponseAt:'2030-10-29T11:20:00.000Z',responseMinutes:20,version:1};return route.fulfill({json:{record:ticket}});}
  if(path.endsWith('/'+ticketId))return route.fulfill({json:{record:ticket,history:[{action:'opened',actor:'Você',at:'2030-10-29T11:00:00.000Z',note:'Robô não inicia a ordenha da manhã.',fromAssignee:'',toAssignee:'',statusAfter:ticket?.status==='em_atendimento'?'aberto':'aberto'},...(response?[{action:'first_response',actor:'Você',at:'2030-10-29T11:20:00.000Z',note:String(response.note),fromAssignee:'',toAssignee:'',statusAfter:'em_atendimento'}]:[])]}});
  if(method==='POST'){creation=request.postDataJSON();ticket={...base};return route.fulfill({status:201,json:{id:ticketId,number:'CH-000001'}});}
  return route.fulfill({json:{items:ticket?[ticket]:[],total:ticket?1:0,openByCriticality:{critico:ticket?1:0,alto:0,programado:0},page:1,pageSize:20}});
 });
 await page.goto('/');
 if(test.info().project.name==='mobile')await page.getByRole('button',{name:'Abrir ou fechar menu'}).click();
 await page.getByRole('navigation').getByRole('button',{name:'Chamados',exact:true}).click();
 await expect(page.getByText('Parada total')).toBeVisible();
 await page.getByRole('button',{name:'Abrir chamado',exact:true}).click();
 const form=page.getByRole('dialog',{name:'Abrir chamado'});
 await form.getByRole('combobox',{name:'Cliente'}).selectOption(partyId);
 await form.getByRole('combobox',{name:'Propriedade'}).selectOption(propertyId);
 await form.getByRole('combobox',{name:'Equipamento'}).selectOption(equipmentId);
 await form.getByRole('combobox',{name:'Criticidade'}).selectOption('critico');
 await form.getByLabel('Título').fill('Robô parado');
 await form.getByLabel('Descrição do problema').fill('Robô não inicia a ordenha da manhã.');
 await page.screenshot({path:'artifacts/ticket-open-'+test.info().project.name+'.png',fullPage:true});
 await form.getByRole('button',{name:'Abrir chamado'}).click();
 await expect(page.getByRole('status').filter({hasText:'CH-000001'})).toBeVisible();
 expect(creation).toEqual({partyId,propertyId,equipmentId,origin:'telefone',criticality:'critico',title:'Robô parado',description:'Robô não inicia a ordenha da manhã.',previousTicketId:null});
 await expect(page.getByText('CH-000001 · Robô parado')).toBeVisible();await page.screenshot({path:'artifacts/ticket-queue-'+test.info().project.name+'.png',fullPage:true});
 await page.getByRole('button',{name:'Triar e acompanhar'}).click();
 const detail=page.getByRole('dialog',{name:'CH-000001 — Robô parado'});await expect(detail).toContainText('Sede (Castro) · GEA R9500');
 await detail.getByRole('button',{name:'Registrar primeiro retorno'}).click();
 const action=page.getByRole('dialog',{name:'Registrar primeiro retorno'});await action.getByLabel('Retorno dado ao cliente').fill('Cliente orientado a reiniciar o painel');await action.getByRole('button',{name:'Confirmar'}).click();
 await expect(detail).toContainText('Em atendimento');await expect(detail).toContainText('20 min');
 expect(response).toEqual({version:0,note:'Cliente orientado a reiniciar o painel'});
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
});
