import {test,expect} from '@playwright/test';
import {dateParts} from '../../packages/contracts/src/agenda';
const company='a'.repeat(24),user='b'.repeat(24),partyId='c'.repeat(24),legacyId='d'.repeat(24),seriesId='e'.repeat(24),zone='America/Sao_Paulo';
const account={user:{id:user,name:'Vendedor',email:'seller@example.invalid'},tenant:{name:'Empresa Teste'},companies:[{id:company,name:'Empresa Teste'}],permissions:['company:read','activity:read','activity:write','lead:read','customer:read','pipeline:read'],security:{mustChangePassword:false,privacyAcceptanceRequired:false}};
const base={partyId,partyName:'Lead Inicial',ownerId:user,ownerName:'Vendedor',title:'Retorno comercial',type:'ligacao',status:'pendente',dueAt:'2026-10-28T12:00:00Z',completedAt:null,notes:'',version:0,opportunityId:'',opportunityTitle:''};
test('calendar views unify activities and manage recurring occurrences through modals',async({page})=>{
 let series={id:seriesId,frequency:'weekly',interval:1,count:3,timeZone:zone,state:'active',version:0};
 let rows=[{...base,id:legacyId,source:'opportunity',title:'Atividade já cadastrada',opportunityId:'f'.repeat(24),opportunityTitle:'Oferta Acme'}] as Array<Record<string,unknown>>;
 let creation:Record<string,unknown>|undefined,updateSource='',filteredOwner='';
 await page.route('**/api/v1/auth/session',route=>route.fulfill({json:account}));
 await page.route('**/api/v1/companies/*/agenda/**',async route=>{
  const req=route.request(),url=new URL(req.url()),path=url.pathname,method=req.method();
  if(path.endsWith('/owners'))return route.fulfill({json:{items:[{id:user,name:'Vendedor'}]}});
  if(path.endsWith('/references'))return route.fulfill({json:{items:[{id:partyId,name:'Lead Inicial'}]}});
  if(path.endsWith('/cancel')){
   rows=rows.map(row=>row.seriesId===seriesId&&String(row.dueAt)>'2026-10-28T20:00:00Z'&&row.status==='pendente'?{...row,status:'cancelada',version:Number(row.version)+1}:row);
   series={...series,state:'cancelled',version:1};return route.fulfill({json:{count:2}});
  }
  if(path.endsWith('/activities')&&method==='POST'){
   creation=req.postDataJSON();rows.push(...['2026-10-28','2026-11-04','2026-11-11'].map((date,index)=>({...base,id:String(index+1).repeat(24),source:'party',title:'Reunião recorrente',type:'reuniao',dueAt:date+'T12:00:00Z',seriesId})));
   return route.fulfill({status:201,json:{count:3,series}});
  }
  if(!path.endsWith('/activities')){
   const row=rows.find(item=>item.id===path.split('/').at(-1));
   if(!row)return route.fulfill({status:404,json:{code:'NOT_FOUND'}});
   if(method==='PATCH'){const payload=req.postDataJSON();updateSource=String(row.source);rows=rows.map(item=>item.id===row.id?{...item,...payload,status:payload.status,version:Number(item.version)+1,completedAt:payload.status==='concluida'?'2026-10-28T20:00:00Z':null}:item);return route.fulfill({json:{id:row.id}});}
   return route.fulfill({json:{record:row,series:row.seriesId?series:null}});
  }
  filteredOwner=url.searchParams.get('ownerId')??'';
  const items=rows.filter(row=>{const date=dateParts(new Date(String(row.dueAt)),zone).date;return date>=url.searchParams.get('startDate')!&&date<url.searchParams.get('endDate')!&&(!url.searchParams.has('status')||row.status===url.searchParams.get('status'));});
  const counts:Record<string,number>={};for(const row of items){const date=dateParts(new Date(String(row.dueAt)),zone).date;counts[date]=(counts[date]??0)+1;}
  return route.fulfill({json:{items,total:items.length,page:1,pageSize:50,dailyCounts:Object.entries(counts).map(([date,total])=>({date,total}))}});
 });
 await page.goto('/');
 if(test.info().project.name==='mobile')await page.getByRole('button',{name:'Abrir ou fechar menu'}).click();
 await page.getByRole('navigation').getByRole('button',{name:'Agenda e visitas'}).click();
 await page.getByLabel('Data de referência').fill('2026-10-28');
 const calendar=page.getByRole('grid',{name:'Calendário comercial'});
 await expect(calendar.getByRole('gridcell')).toHaveCount(test.info().project.name==='mobile'?1:7);
 await expect(page.locator('.nf-agenda-list')).toContainText('Atividade já cadastrada');
 await page.getByRole('button',{name:'Mês',exact:true}).click();
 await expect(calendar.getByRole('gridcell')).toHaveCount(42);
 await page.getByRole('button',{name:'Dia',exact:true}).click();
 await expect(calendar.getByRole('gridcell')).toHaveCount(1);
 await page.getByRole('button',{name:'Semana',exact:true}).click();
 await page.getByRole('button',{name:'Nova atividade',exact:true}).click();
 const modal=page.getByRole('dialog',{name:'Nova atividade da agenda',exact:true});
 await modal.getByLabel('Título da atividade').fill('Reunião recorrente');
 await modal.getByRole('combobox',{name:'Cadastro vinculado',exact:true}).selectOption(partyId);
 await modal.getByLabel('Tipo de compromisso').selectOption('reuniao');
 await modal.getByLabel('Data e hora').fill('2026-10-28T09:00');
 await modal.getByLabel('Repetição').selectOption('weekly');
 await modal.getByLabel('Total de ocorrências').fill('3');
 await page.screenshot({path:'artifacts/agenda-modal-'+test.info().project.name+'.png',fullPage:true});
 await modal.getByRole('button',{name:'Salvar atividade'}).click();
 await expect(modal).not.toBeVisible();
 expect(creation).toMatchObject({link:{source:'party',id:partyId},startLocal:'2026-10-28T09:00',timeZone:zone,recurrence:{frequency:'weekly',interval:1,count:3}});
 expect(creation).not.toHaveProperty('ownerId');expect(creation).not.toHaveProperty('tenantId');
 const recurring=()=>page.locator('.nf-agenda-list').getByRole('listitem').filter({hasText:'Reunião recorrente'});
 await recurring().getByRole('button',{name:'Editar ocorrência'}).click();
 const edit=page.getByRole('dialog',{name:'Atividade da agenda',exact:true});
 await expect(edit).toContainText('somente esta ocorrência');
 await edit.getByLabel('Status da ocorrência').selectOption('concluida');
 await edit.getByRole('button',{name:'Salvar atividade'}).click();
 await expect(recurring()).toContainText('Concluída');
 expect(updateSource).toBe('party');
 await recurring().getByRole('button',{name:'Editar ocorrência'}).click();
 await edit.getByRole('button',{name:'Cancelar próximas ocorrências'}).click();
 const cancel=page.getByRole('dialog',{name:'Cancelar próximas ocorrências',exact:true});
 await cancel.getByRole('button',{name:'Confirmar cancelamento'}).click();
 await expect(cancel).not.toBeVisible();
 const existing=page.locator('.nf-agenda-list').getByRole('listitem').filter({hasText:'Atividade já cadastrada'});
 await existing.getByRole('button',{name:'Editar ocorrência'}).click();
 await edit.getByLabel('Status da ocorrência').selectOption('concluida');
 await edit.getByRole('button',{name:'Salvar atividade'}).click();
 await expect(existing).toContainText('Concluída');expect(updateSource).toBe('opportunity');
 await page.getByRole('combobox',{name:'Responsável',exact:true}).selectOption(user);
 await page.getByRole('combobox',{name:'Status',exact:true}).selectOption('concluida');
 await expect(page.locator('.nf-agenda-list').getByRole('listitem')).toHaveCount(2);
 expect(filteredOwner).toBe(user);
 await page.getByRole('combobox',{name:'Status',exact:true}).selectOption('');
 await page.getByRole('button',{name:'Mês',exact:true}).click();
 await page.getByLabel('Data de referência').fill('2026-11-01');
 await expect(page.locator('.nf-agenda-list').getByRole('listitem').filter({hasText:'Cancelada'})).toHaveCount(2);
 await page.screenshot({path:'artifacts/agenda-calendar-'+test.info().project.name+'.png',fullPage:true});
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
});
test('read-only agenda shows a disabled detail form without write controls',async({page})=>{
 const readOnly={...account,permissions:['company:read','activity:read','lead:read']};
 const record={...base,id:'1'.repeat(24),source:'party'};
 await page.route('**/api/v1/auth/session',route=>route.fulfill({json:readOnly}));
 await page.route('**/api/v1/companies/*/agenda/**',async route=>{
  const path=new URL(route.request().url()).pathname;
  if(path.endsWith('/owners'))return route.fulfill({json:{items:[{id:user,name:'Vendedor'}]}});
  if(path.endsWith('/'+record.id))return route.fulfill({json:{record,series:null}});
  return route.fulfill({json:{items:[record],total:1,page:1,pageSize:50,dailyCounts:[{date:'2026-10-28',total:1}]}});
 });
 await page.goto('/');
 if(test.info().project.name==='mobile')await page.getByRole('button',{name:'Abrir ou fechar menu'}).click();
 await page.getByRole('navigation').getByRole('button',{name:'Agenda e visitas'}).click();
 await expect(page.getByRole('button',{name:'Nova atividade',exact:true})).toHaveCount(0);
 await page.getByRole('button',{name:'Ver atividade',exact:true}).click();
 const modal=page.getByRole('dialog',{name:'Atividade da agenda',exact:true});
 await expect(modal.getByLabel('Título da atividade')).toBeDisabled();
 await expect(modal.getByRole('button',{name:'Salvar atividade'})).toHaveCount(0);
 await expect(modal.getByRole('button',{name:'Fechar',exact:true})).toBeEnabled();
 await modal.getByRole('button',{name:'Fechar formulário',exact:true}).click();
 await expect(modal).not.toBeVisible();
});
