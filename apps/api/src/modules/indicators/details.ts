import mongoose from 'mongoose';
import {z} from 'zod';
import type {AccessContext} from '../../../../../packages/contracts/src/index.js';
import {addCalendarDays} from '../../../../../packages/contracts/src/agenda.js';
import {indicatorDrillable,indicatorViews,lastMonths,type IndicatorChart,type IndicatorDetail,type IndicatorSection,type IndicatorSectionKey,type IndicatorView} from '../../../../../packages/contracts/src/indicators.js';
import {opportunityStageNames,proposalStatusNames} from '../../../../../packages/contracts/src/opportunities.js';
import {orderKindNames,orderPendingInstallments,orderStatusNames} from '../../../../../packages/contracts/src/orders.js';
import {technicalStateNames} from '../../../../../packages/contracts/src/technical.js';
import {defaultTicketCriticalityNames,ticketStatusNames} from '../../../../../packages/contracts/src/tickets.js';
import {AccessDenied} from '../../infrastructure/access.js';
import {auditActorNames} from '../../infrastructure/audit-actors.js';
import {Party,Property} from '../relationships/models.js';
import {objectId} from '../relationships/input.js';
import {calendarDate} from '../opportunities/input.js';
import {AgendaActivity} from '../agenda/models.js';
import {dayBoundary} from '../agenda/recurrence.js';
import {FieldExecution} from '../field-visits/models.js';
import {Opportunity,Proposal} from '../opportunities/models.js';
import {Ticket} from '../tickets/models.js';
import {authority as ticketAuthority,scopeStages as ticketScope} from '../tickets/service.js';
import {TechnicalWork} from '../technical/models.js';
import {pipeline as workOrderScope} from '../technical/service.js';
import {SalesOrder} from '../orders/models.js';
import {orderKinds,orderScope} from '../orders/service.js';
import {buildFilters,commercialParties,oid,regionParties,zone,type Filters} from './scope.js';
const limit=500,openTickets=['aberto','em_atendimento','aguardando_cliente'];
type Cell=string|number|null;type Column=IndicatorDetail['columns'][number];
const iso=(value:Date|null|undefined)=>value?value.toISOString():null;
/** Profiles restricted to sales orders (sales administration) do not see service records. */
export const salesOnly=(ctx:AccessContext)=>ctx.permissions.includes('order:read')&&!orderKinds(ctx).includes('servico');
const commercialView=(ctx:AccessContext,view:IndicatorView)=>view!=='tecnica'&&(ctx.permissions.includes('lead:read')||ctx.permissions.includes('customer:read'));
const technicalView=(ctx:AccessContext,view:IndicatorView,permission:'ticket:read'|'technical:read')=>view!=='comercial'&&ctx.permissions.includes(permission)&&!salesOnly(ctx);
const fieldVisits=(ctx:AccessContext,view:IndicatorView)=>commercialView(ctx,view)&&ctx.permissions.includes('visit:read');
/** Work orders of the technical scope with the shared responsible (technician) and property-region filters. */
async function scopedWorks(ctx:AccessContext,companyId:string,filters:Filters,extra:Record<string,unknown>={}){
 const stages=await workOrderScope(ctx,companyId,{...extra,...(filters.ownerId?{technicianId:oid(filters.ownerId)}:{})});
 return [...stages,{$lookup:{from:Property.collection.name,localField:'propertyId',foreignField:'_id',pipeline:[{$match:{tenantId:filters.tenant,companyId:filters.company}},{$project:{name:1,regionId:1}}],as:'site'}},{$unwind:{path:'$site',preserveNullAndEmptyArrays:true}},
  ...(filters.regionId?[{$match:{'site.regionId':oid(filters.regionId)}}]:[])] as mongoose.PipelineStage[];
}
async function scopedTickets(ctx:AccessContext,companyId:string,filters:Filters){
 const access=await ticketAuthority(ctx,companyId);
 return [{$match:{tenantId:filters.tenant,companyId:filters.company,...(filters.ownerId?{assigneeId:oid(filters.ownerId)}:{})}},...ticketScope(ctx,companyId,access),...(filters.regionId?[{$match:{'property.regionId':oid(filters.regionId)}}]:[])] as mongoose.PipelineStage[];
}
/** Open field visits of the live portfolio: server check-in without checkout, joined to the visited property. */
function openVisits(filters:Filters,partyFilter:Record<string,unknown>):mongoose.PipelineStage[]{
 return [{$match:{tenantId:filters.tenant,companyId:filters.company,state:'in_progress'}},{$lookup:{from:Party.collection.name,localField:'partyId',foreignField:'_id',pipeline:[{$match:partyFilter},{$project:{name:1,ownerId:1}}],as:'party'}},{$unwind:'$party'},
  {$lookup:{from:AgendaActivity.collection.name,localField:'activityId',foreignField:'_id',pipeline:[{$project:{propertyId:1,title:1}}],as:'activity'}},{$unwind:{path:'$activity',preserveNullAndEmptyArrays:true}},
  {$lookup:{from:Property.collection.name,localField:'activity.propertyId',foreignField:'_id',pipeline:[{$project:{name:1}}],as:'site'}},{$unwind:{path:'$site',preserveNullAndEmptyArrays:true}}];
}
/** "Em atendimento agora": who has an open server check-in and at which customer/property. It is the registered attendance, never continuous tracking. */
export async function fieldSection(ctx:AccessContext,companyId:string,filters:Filters,view:IndicatorView):Promise<IndicatorSection[]>{
 const indicators:IndicatorSection['indicators']=[];
 if(fieldVisits(ctx,view)){const [row]=await FieldExecution.aggregate([...openVisits(filters,await commercialParties(ctx,companyId,filters,{})),{$count:'count'}]);
  indicators.push({key:'visits',label:'Vendedores em visita',value:row?.count??0,unit:'count',definition:'Visitas com check-in registrado pelo servidor e sem checkout, agora. Mostra o cliente/propriedade da visita; não é rastreamento.'});}
 if(technicalView(ctx,view,'technical:read')){const [row]=await TechnicalWork.aggregate([...await scopedWorks(ctx,companyId,filters,{state:'in_progress'}),{$count:'count'}]);
  indicators.push({key:'works',label:'Técnicos em atendimento',value:row?.count??0,unit:'count',definition:'OS com check-in do técnico e sem conclusão, agora. Mostra o cliente/propriedade da OS; não é rastreamento.'});}
 return indicators.length?[{key:'campo',title:'Em atendimento agora',indicators}]:[];
}
/** Monthly counts or sums keyed by YYYY-MM in São Paulo time. */
const month=(field:string)=>({$dateToString:{format:'%Y-%m',date:'$'+field,timezone:zone}});
function bars(key:string,title:string,subtitle:string,unit:IndicatorChart['unit'],series:string[],months:string[],values:Map<string,number>[]):IndicatorChart{
 return {key,title,subtitle,kind:'bars',unit,series,points:months.map(item=>({label:item,values:values.map(map=>map.get(item)??0)}))};
}
const toMap=(rows:{_id:string;value:number}[])=>new Map(rows.map(row=>[row._id,row.value]));
/** Charts follow the sections the profile received and use the same scopes and filters. */
export async function indicatorCharts(ctx:AccessContext,companyId:string,filters:Filters,view:IndicatorView,endDate:string,sections:IndicatorSection[]):Promise<IndicatorChart[]>{
 const charts:IndicatorChart[]=[],keys=new Set(sections.map(section=>section.key)),months=lastMonths(endDate,12),range={$gte:dayBoundary(months[0]+'-01',zone),$lt:dayBoundary(addCalendarDays(endDate,1),zone)},subtitle='Últimos 12 meses até '+endDate.split('-').reverse().join('/');
 const ids={tenantId:filters.tenant,companyId:filters.company},year=Number(endDate.slice(0,4));
 if(keys.has('visitas')){
  const partyFilter=await commercialParties(ctx,companyId,filters);
  const [row]=await AgendaActivity.aggregate([{$match:{...ids,type:'visita',dueAt:range}},{$lookup:{from:Party.collection.name,localField:'partyId',foreignField:'_id',pipeline:[{$match:partyFilter},{$project:{_id:1}}],as:'party'}},{$unwind:'$party'},
   {$facet:{planned:[{$group:{_id:month('dueAt'),value:{$sum:1}}}],completed:[{$match:{status:'concluida'}},{$group:{_id:month('dueAt'),value:{$sum:1}}}]}}]);
  charts.push({...bars('visitasMes','Visitas por mês',subtitle,'count',['Planejadas','Concluídas'],months,[toMap(row.planned),toMap(row.completed)]),kind:'line'});
 }
 if(keys.has('pedidos')){
  const inRegion=await regionParties(filters),scope=await orderScope(ctx,companyId,'order:read',{...(filters.ownerId?{ownerId:oid(filters.ownerId)}:{}),...(inRegion?{_id:{$in:inRegion}}:{})});
  const [row]=await SalesOrder.aggregate([{$match:scope.match},{$lookup:{from:Party.collection.name,localField:'partyId',foreignField:'_id',pipeline:[{$match:scope.parties},{$project:{ownerId:1}}],as:'party'}},{$unwind:'$party'},{$facet:{
   confirmed:[{$match:{confirmedAt:range}},{$group:{_id:month('confirmedAt'),value:{$sum:'$totalCents'}}}],
   invoiced:[{$unwind:'$invoices'},{$match:{'invoices.issueDate':{$gte:months[0]+'-01',$lte:endDate}}},{$group:{_id:{$substrBytes:['$invoices.issueDate',0,7]},value:{$sum:'$invoices.amountCents'}}}],
   yearly:[{$unwind:'$invoices'},{$match:{'invoices.issueDate':{$gte:(year-1)+'-01-01',$lte:year+'-12-31'}}},{$group:{_id:{$substrBytes:['$invoices.issueDate',0,7]},value:{$sum:'$invoices.amountCents'}}}],
   owners:[{$match:{confirmedAt:{$gte:filters.from,$lt:filters.to}}},{$group:{_id:'$party.ownerId',value:{$sum:'$totalCents'}}},{$sort:{value:-1}},{$limit:10}]}}]);
  // Invoiced amount per month: selected year against the previous one (line), as in a revenue chart.
  const yearly=toMap(row.yearly),monthKeys=Array.from({length:12},(_,index)=>String(index+1).padStart(2,'0'));
  charts.push({key:'faturamentoAno',title:'Faturamento',subtitle:'Notas lançadas por mês de emissão · '+year+' × '+(year-1),kind:'line',unit:'cents',series:[String(year),String(year-1)],points:monthKeys.map(month=>({label:year+'-'+month,values:[yearly.get(year+'-'+month)??0,yearly.get((year-1)+'-'+month)??0]}))});
  charts.push(bars('pedidosMes','Pedidos confirmados × faturado',subtitle,'cents',['Confirmado','Faturado'],months,[toMap(row.confirmed),toMap(row.invoiced)]));
  const section=sections.find(item=>item.key==='pedidos')!,value=(key:string)=>Number(section.indicators.find(item=>item.key===key)?.value??0);
  charts.push({key:'previsao',title:'Previsão de faturamento',subtitle:'Parcelas não faturadas por vencimento, hoje',kind:'bars',unit:'cents',series:['Valor previsto'],points:[['Vencida','forecastOverdue'],['Até 30 dias','forecast30'],['31–60','forecast60'],['61–90','forecast90'],['+90','forecastLater']].map(([label,key])=>({label:label!,values:[value(key!)]}))});
  if(row.owners.length){const names=await auditActorNames(String(filters.tenant),row.owners.map((item:{_id:unknown})=>String(item._id)));
   charts.push({key:'pedidosResponsavel',title:'Pedidos confirmados por responsável',subtitle:'Período filtrado · responsável da carteira',kind:'pie',unit:'cents',series:['Valor confirmado'],points:row.owners.map((item:{_id:unknown;value:number})=>({label:names.get(String(item._id))??'Usuário indisponível',values:[item.value]}))});}
 }
 if(keys.has('chamados')){
  const [row]=await Ticket.aggregate([...await scopedTickets(ctx,companyId,filters),{$facet:{opened:[{$match:{openedAt:range}},{$group:{_id:month('openedAt'),value:{$sum:1}}}],resolved:[{$match:{status:'resolvido',resolvedAt:range}},{$group:{_id:month('resolvedAt'),value:{$sum:1}}}]}}]);
  charts.push(bars('chamadosMes','Chamados abertos × resolvidos',subtitle,'count',['Abertos','Resolvidos'],months,[toMap(row.opened),toMap(row.resolved)]));
 }
 if(keys.has('ordens')){
  const rows=await TechnicalWork.aggregate([...await scopedWorks(ctx,companyId,filters,{state:'completed'}),{$match:{checkedOutAt:{$gte:filters.from,$lt:filters.to}}},{$group:{_id:'$technicianId',value:{$sum:1}}},{$sort:{value:-1}},{$limit:10}]);
  if(rows.length){const names=await auditActorNames(String(filters.tenant),rows.map(item=>String(item._id)));
   charts.push({key:'osTecnico',title:'OS concluídas por técnico',subtitle:'Período filtrado',kind:'pie',unit:'count',series:['OS concluídas'],points:rows.map(item=>({label:names.get(String(item._id))??'Usuário indisponível',values:[item.value]}))});}
 }
 return charts;
}
export const indicatorDetailInput=z.object({section:z.string().max(20),key:z.string().max(30),view:z.enum(indicatorViews).default('gerencial'),startDate:calendarDate.optional(),endDate:calendarDate.optional(),regionId:objectId.optional(),ownerId:objectId.optional()}).strict()
 .refine(value=>indicatorDrillable(value.section as IndicatorSectionKey,value.key)).superRefine((value,ctx)=>{if(value.startDate&&value.endDate&&(value.endDate<value.startDate||(Date.parse(value.endDate)-Date.parse(value.startDate))/86400000>366))ctx.addIssue({code:'custom',path:['endDate'],message:'Período de até 366 dias.'});});
const col=(key:string,label:string,kind:Column['kind']='text'):Column=>({key,label,kind});
/** Records behind one indicator, with exactly the scope and filters used to count it. */
export async function indicatorDetails(ctx:AccessContext,companyId:string,raw:unknown):Promise<IndicatorDetail>{
 const input=indicatorDetailInput.parse(raw),section=input.section as IndicatorSectionKey,{filters,startDate,endDate,today}=buildFilters(ctx,companyId,input);
 const ids={tenantId:filters.tenant,companyId:filters.company},period={$gte:filters.from,$lt:filters.to},now=new Date();
 const finish=async(title:string,note:string,columns:Column[],raw:{cells:Cell[];people:unknown[]}[]):Promise<IndicatorDetail>=>{
  const rows=raw.slice(0,limit),names=await auditActorNames(ctx.tenantId,[...new Set(rows.flatMap(row=>row.people.filter(Boolean).map(String)))]);
  return {section,key:input.key,title,note,columns,rows:rows.map(row=>row.cells.map(cell=>typeof cell==='string'&&cell.startsWith('@person:')?names.get(cell.slice(8))??'':cell)),truncated:raw.length>limit};
 };
 const person=(id:unknown)=>id?'@person:'+String(id):null;
 if(section==='campo'){
  if(input.key==='visits'){
   if(!fieldVisits(ctx,input.view))throw new AccessDenied();
   const rows=await FieldExecution.aggregate([...openVisits(filters,await commercialParties(ctx,companyId,filters,{})),{$sort:{checkedInAt:1}},{$limit:limit+1}]);
   return finish('Vendedores em visita agora','Local = cliente e propriedade da visita com check-in no servidor. Não é posição em tempo real.',[col('person','Pessoa'),col('customer','Cliente'),col('site','Propriedade'),col('activity','Atividade'),col('since','Check-in','datetime'),col('minutes','Minutos em atendimento','number')],
    rows.map(row=>({cells:[person(row.actorId),row.party.name,row.site?.name??'Não informada',row.activity?.title??'Visita',iso(row.checkedInAt),Math.round((now.getTime()-row.checkedInAt.getTime())/60000)],people:[row.actorId]})));
  }
  if(!technicalView(ctx,input.view,'technical:read'))throw new AccessDenied();
  const rows=await TechnicalWork.aggregate([...await scopedWorks(ctx,companyId,filters,{state:'in_progress'}),{$sort:{checkedInAt:1}},{$limit:limit+1}]);
  return finish('Técnicos em atendimento agora','Local = cliente e propriedade da OS com check-in no servidor. Não é posição em tempo real.',[col('person','Pessoa'),col('customer','Cliente'),col('site','Propriedade'),col('work','OS'),col('since','Check-in','datetime'),col('minutes','Minutos em atendimento','number')],
   rows.map(row=>({cells:[person(row.technicianId),row.party.name,row.site?.name??'Não informada',(row.number??'')+' · '+row.title,iso(row.checkedInAt),row.checkedInAt?Math.round((now.getTime()-row.checkedInAt.getTime())/60000):null],people:[row.technicianId]})));
 }
 if(['carteira','visitas','oportunidades','propostas'].includes(section)&&!commercialView(ctx,input.view))throw new AccessDenied();
 if(section==='carteira'){
  const partyFilter=await commercialParties(ctx,companyId,filters),match:Record<string,unknown>=input.key==='customers'?{kind:'customer'}:input.key==='leads'?{kind:'lead'}:input.key==='upcoming'?{nextActionDate:{$gte:today,$lte:addCalendarDays(today,7)}}:{nextActionDate:{$lt:today}};
  const rows=await Party.aggregate([{$match:{$and:[partyFilter,match]}},{$sort:{name:1}},{$limit:limit+1}]);
  const titles:Record<string,string>={customers:'Clientes ativos',leads:'Leads ativos',upcoming:'Próximas ações em 7 dias',overdue:'Próximas ações vencidas'};
  return finish(titles[input.key]!,'Cadastros do seu acesso nos filtros.',[col('name','Nome'),col('kind','Tipo'),col('owner','Responsável'),col('city','Cidade'),col('next','Próxima ação','date'),col('action','Ação')],
   rows.map(row=>({cells:[row.name,row.kind==='customer'?'Cliente':'Lead',person(row.ownerId),[row.address?.city,row.address?.state].filter(Boolean).join('/'),row.nextActionDate??null,row.nextAction??''],people:[row.ownerId]})));
 }
 if(section==='visitas'){
  const partyFilter=await commercialParties(ctx,companyId,filters);
  const rows=await AgendaActivity.aggregate([{$match:{...ids,type:'visita',dueAt:period,...(input.key==='completed'?{status:'concluida'}:{})}},{$lookup:{from:Party.collection.name,localField:'partyId',foreignField:'_id',pipeline:[{$match:partyFilter},{$project:{name:1,ownerId:1}}],as:'party'}},{$unwind:'$party'},
   {$lookup:{from:FieldExecution.collection.name,localField:'_id',foreignField:'activityId',pipeline:[{$match:ids},{$project:{outcome:1,checkedInAt:1,checkedOutAt:1,actorId:1,state:1}}],as:'execution'}},{$unwind:{path:'$execution',preserveNullAndEmptyArrays:true}},
   ...(input.key==='realized'?[{$match:{'execution.outcome':'realizada'}}]:[]),{$lookup:{from:Property.collection.name,localField:'propertyId',foreignField:'_id',pipeline:[{$project:{name:1}}],as:'site'}},{$unwind:{path:'$site',preserveNullAndEmptyArrays:true}},{$sort:{dueAt:1}},{$limit:limit+1}]);
  const titles:Record<string,string>={planned:'Visitas planejadas',completed:'Visitas concluídas',realized:'Visitas qualificadas'},status:Record<string,string>={pendente:'Pendente',concluida:'Concluída',cancelada:'Cancelada'},outcome:Record<string,string>={realizada:'Realizada',contato_ausente:'Contato ausente',cliente_fechado:'Cliente fechado',nao_realizada:'Não realizada'};
  return finish(titles[input.key]!,'Visitas com data no período. Check-in e checkout são horários do servidor.',[col('due','Data','datetime'),col('customer','Cliente'),col('site','Propriedade'),col('owner','Responsável'),col('status','Situação'),col('in','Check-in','datetime'),col('out','Checkout','datetime'),col('result','Resultado')],
   rows.map(row=>({cells:[iso(row.dueAt),row.party.name,row.site?.name??'',person(row.party.ownerId),row.execution?.state==='in_progress'?'Em visita agora':status[row.status]??row.status,iso(row.execution?.checkedInAt),iso(row.execution?.checkedOutAt),row.execution?.outcome?outcome[row.execution.outcome]??row.execution.outcome:''],people:[row.party.ownerId]})));
 }
 if(section==='oportunidades'){
  const partyFilter=await commercialParties(ctx,companyId,filters);
  const rows=await Opportunity.aggregate([{$match:{...ids,...(input.key==='open'?{stage:{$in:['descoberta','proposta','negociacao']}}:{stage:'ganha',closedAt:period})}},{$lookup:{from:Party.collection.name,localField:'partyId',foreignField:'_id',pipeline:[{$match:partyFilter},{$project:{name:1,ownerId:1}}],as:'party'}},{$unwind:'$party'},{$sort:{expectedCloseDate:1,_id:1}},{$limit:limit+1}]);
  return finish(input.key==='open'?'Oportunidades abertas':'Oportunidades ganhas no período','Valores estimados; não são receita.',[col('title','Oportunidade'),col('customer','Cliente'),col('owner','Responsável'),col('stage','Etapa'),col('amount','Valor','cents'),col('probability','Probabilidade','percent'),col('expected','Previsão de fechamento','date'),col('closed','Encerrada em','datetime')],
   rows.map(row=>({cells:[row.title,row.party.name,person(row.party.ownerId),opportunityStageNames[row.stage as keyof typeof opportunityStageNames]??row.stage,row.amountCents??0,row.probability??null,row.expectedCloseDate??null,iso(row.closedAt)],people:[row.party.ownerId]})));
 }
 if(section==='propostas'){
  const partyFilter=await commercialParties(ctx,companyId,filters),match=input.key==='sent'?{sentAt:period}:{status:input.key==='accepted'?'aceita':'recusada',decidedAt:period};
  const rows=await Proposal.aggregate([{$match:{...ids,...match}},{$lookup:{from:Opportunity.collection.name,localField:'opportunityId',foreignField:'_id',pipeline:[{$match:ids},{$project:{partyId:1,title:1}}],as:'opportunity'}},{$unwind:'$opportunity'},
   {$lookup:{from:Party.collection.name,localField:'opportunity.partyId',foreignField:'_id',pipeline:[{$match:partyFilter},{$project:{name:1,ownerId:1}}],as:'party'}},{$unwind:'$party'},{$sort:{sentAt:1,_id:1}},{$limit:limit+1}]);
  const titles:Record<string,string>={sent:'Propostas enviadas',accepted:'Propostas aceitas',refused:'Propostas recusadas'};
  return finish(titles[input.key]!,'Proposta não é pedido nem receita.',[col('number','Proposta'),col('opportunity','Oportunidade'),col('customer','Cliente'),col('owner','Responsável'),col('status','Situação'),col('total','Total','cents'),col('sent','Enviada em','datetime'),col('decided','Decisão em','datetime')],
   rows.map(row=>({cells:[row.number+' rev. '+row.revision,row.opportunity.title,row.party.name,person(row.party.ownerId),proposalStatusNames[row.status as keyof typeof proposalStatusNames]??row.status,row.totalCents,iso(row.sentAt),iso(row.decidedAt)],people:[row.party.ownerId]})));
 }
 if(section==='pedidos'){
  if(!ctx.permissions.includes('order:read'))throw new AccessDenied();
  const inRegion=await regionParties(filters),scope=await orderScope(ctx,companyId,'order:read',{...(filters.ownerId?{ownerId:oid(filters.ownerId)}:{}),...(inRegion?{_id:{$in:inRegion}}:{})});
  const match:Record<string,unknown>={confirmed:{confirmedAt:period},pendingApproval:{status:'aguardando_aprovacao'},undelivered:{status:{$in:['confirmado','faturado']},deliveredAt:null},invoiced:{'invoices.issueDate':{$gte:startDate,$lte:endDate}}}[input.key]as Record<string,unknown>??{status:{$in:['confirmado','entregue']}};
  const rows=await SalesOrder.aggregate([{$match:{...scope.match,...match}},{$lookup:{from:Party.collection.name,localField:'partyId',foreignField:'_id',pipeline:[{$match:scope.parties},{$project:{name:1,ownerId:1}}],as:'party'}},{$unwind:'$party'},{$sort:{createdAt:1,_id:1}},{$limit:5001}]);
  if(input.key==='invoiced')return finish('Faturado no período','Notas lançadas pelo financeiro com emissão no período.',[col('number','Pedido'),col('customer','Cliente'),col('owner','Responsável'),col('invoice','Nota fiscal'),col('issue','Emissão','date'),col('amount','Valor','cents')],
   rows.flatMap(row=>row.invoices.filter((item:{issueDate:string})=>item.issueDate>=startDate&&item.issueDate<=endDate).map((item:{number:string;issueDate:string;amountCents:number})=>({cells:[row.number,row.party.name,person(row.party.ownerId),item.number,item.issueDate,item.amountCents],people:[row.party.ownerId]}))));
  if(input.key.startsWith('forecast')){
   const bucket=(due:string)=>due<today?'forecastOverdue':due<=addCalendarDays(today,30)?'forecast30':due<=addCalendarDays(today,60)?'forecast60':due<=addCalendarDays(today,90)?'forecast90':'forecastLater';
   const titles:Record<string,string>={forecastOverdue:'Previsão vencida',forecast30:'Previsão até 30 dias',forecast60:'Previsão 31 a 60 dias',forecast90:'Previsão 61 a 90 dias',forecastLater:'Previsão após 90 dias'};
   const items=rows.flatMap(row=>orderPendingInstallments(row.totalCents,row.invoicedCents,row.invoices[0]?.issueDate??row.expectedDeliveryDate,row.paymentTermDays).filter(item=>bucket(item.dueDate)===input.key).map(item=>({due:item.dueDate,row,amount:item.amountCents}))).sort((a,b)=>a.due.localeCompare(b.due));
   return finish(titles[input.key]!,'Parcelas ainda não faturadas pelos prazos de pagamento: quem está para faturar.',[col('due','Vencimento','date'),col('number','Pedido'),col('customer','Cliente'),col('owner','Responsável'),col('kind','Tipo'),col('status','Situação'),col('amount','Valor previsto','cents')],
    items.map(item=>({cells:[item.due,item.row.number,item.row.party.name,person(item.row.party.ownerId),orderKindNames[item.row.kind as 'venda'],orderStatusNames[item.row.status as 'confirmado'],item.amount],people:[item.row.party.ownerId]})));
  }
  const titles:Record<string,string>={confirmed:'Pedidos confirmados no período',backlog:'Carteira a faturar',pendingApproval:'Pedidos aguardando aprovação',undelivered:'Pedidos aguardando entrega'};
  return finish(titles[input.key]!,input.key==='backlog'?'Pedidos confirmados ou entregues com saldo a faturar: quem está para faturar.':'Pedidos do seu acesso nos filtros.',[col('number','Pedido'),col('customer','Cliente'),col('owner','Responsável'),col('kind','Tipo'),col('status','Situação'),col('total','Total','cents'),col('invoiced','Faturado','cents'),col('remaining','A faturar','cents'),col('expected','Entrega prevista','date'),col('confirmed','Confirmado em','datetime')],
   rows.map(row=>({cells:[row.number,row.party.name,person(row.party.ownerId),orderKindNames[row.kind as 'venda'],orderStatusNames[row.status as 'confirmado'],row.totalCents,row.invoicedCents,row.totalCents-row.invoicedCents,row.expectedDeliveryDate,iso(row.confirmedAt)],people:[row.party.ownerId]})));
 }
 if(section==='chamados'){
  if(!technicalView(ctx,input.view,'ticket:read'))throw new AccessDenied();
  const match:Record<string,unknown>={critical:{status:{$in:openTickets},criticality:'critico'},open:{status:{$in:openTickets}},overdue:{status:{$in:openTickets},agreedDeadline:{$lt:now}},opened:{openedAt:period},resolved:{status:'resolvido',resolvedAt:period}}[input.key] as Record<string,unknown>;
  const rows=await Ticket.aggregate([...await scopedTickets(ctx,companyId,filters),{$match:match},{$lookup:{from:Property.collection.name,localField:'propertyId',foreignField:'_id',pipeline:[{$project:{name:1}}],as:'site'}},{$unwind:{path:'$site',preserveNullAndEmptyArrays:true}},{$sort:{openedAt:1}},{$limit:limit+1}]);
  const titles:Record<string,string>={critical:'Chamados críticos em aberto',open:'Chamados em aberto',overdue:'Chamados com prazo vencido',opened:'Chamados abertos no período',resolved:'Chamados resolvidos no período'};
  return finish(titles[input.key]!,'Fila de chamados do seu perfil nos filtros.',[col('number','Chamado'),col('title','Título'),col('customer','Cliente'),col('site','Propriedade'),col('criticality','Criticidade'),col('status','Situação'),col('assignee','Responsável'),col('opened','Aberto em','datetime'),col('deadline','Prazo','datetime'),col('resolved','Resolvido em','datetime')],
   rows.map(row=>({cells:[row.number,row.title,row.party.name,row.site?.name??'',defaultTicketCriticalityNames[row.criticality as 'critico']??row.criticality,ticketStatusNames[row.status as 'aberto']??row.status,person(row.assigneeId),iso(row.openedAt),iso(row.agreedDeadline),iso(row.resolvedAt)],people:[row.assigneeId]})));
 }
 if(!technicalView(ctx,input.view,'technical:read'))throw new AccessDenied();
 const extra:Record<string,unknown>={open:{state:{$in:['pending','in_progress']}},completed:{state:'completed'},closed:{closedAt:period}}[input.key] as Record<string,unknown>;
 const rows=await TechnicalWork.aggregate([...await scopedWorks(ctx,companyId,filters,extra),...(input.key==='completed'?[{$match:{checkedOutAt:period}}]:[]),{$sort:{startAt:1}},{$limit:limit+1}]);
 const titles:Record<string,string>={open:'OS pendentes ou em execução',completed:'OS concluídas no período',closed:'OS encerradas no período'};
 return finish(titles[input.key]!,'OS do seu escopo técnico nos filtros.',[col('number','OS'),col('title','Título'),col('customer','Cliente'),col('site','Propriedade'),col('technician','Técnico'),col('state','Situação'),col('start','Agendada','datetime'),col('done','Concluída','datetime'),col('closed','Encerrada','datetime'),col('billable','Horas faturáveis','number')],
  rows.map(row=>({cells:[row.number??'',row.title,row.party.name,row.site?.name??'',person(row.technicianId),row.closedAt?'Encerrada':technicalStateNames[row.state]??row.state,iso(row.startAt),iso(row.checkedOutAt),iso(row.closedAt),row.billableMinutes===null||row.billableMinutes===undefined?null:Math.round(row.billableMinutes/60*100)/100],people:[row.technicianId]})));
}
