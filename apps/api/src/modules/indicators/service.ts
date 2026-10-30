import mongoose from 'mongoose';
import {z} from 'zod';
import type {AccessContext} from '../../../../../packages/contracts/src/index.js';
import {indicatorViews,percent,type IndicatorReport,type IndicatorSection} from '../../../../../packages/contracts/src/indicators.js';
import {addCalendarDays,dateParts} from '../../../../../packages/contracts/src/agenda.js';
import {companyScope,AccessDenied} from '../../infrastructure/access.js';
import {commercialFilter} from '../identity/profile-access.js';
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
import {orderPendingInstallments} from '../../../../../packages/contracts/src/orders.js';
const zone='America/Sao_Paulo';
const oid=(id:string)=>new mongoose.Types.ObjectId(id);
export const indicatorInput=z.object({view:z.enum(indicatorViews).default('gerencial'),startDate:calendarDate.optional(),endDate:calendarDate.optional(),regionId:objectId.optional(),ownerId:objectId.optional()}).strict().superRefine((value,ctx)=>{
 if(value.startDate&&value.endDate&&(value.endDate<value.startDate||(Date.parse(value.endDate)-Date.parse(value.startDate))/86400000>366))ctx.addIssue({code:'custom',path:['endDate'],message:'Período de até 366 dias.'});
});
type Filters={tenant:mongoose.Types.ObjectId;company:mongoose.Types.ObjectId;from:Date;to:Date;regionId:string|null;ownerId:string|null};
const sum=(rows:{total?:number}[]|undefined)=>rows?.[0]?.total??0;
const count=(rows:{count?:number}[]|undefined)=>rows?.[0]?.count??0;
const avg=(rows:{value?:number|null}[]|undefined)=>rows?.[0]?.value===undefined||rows?.[0]?.value===null?null:Math.round(rows[0].value);
/** Customers/leads of the live commercial scope; territory = customer has an active property in the region. */
async function commercialParties(ctx:AccessContext,companyId:string,filters:Filters){
 const kinds=[...(ctx.permissions.includes('lead:read')?['lead']:[]),...(ctx.permissions.includes('customer:read')?['customer']:[])];
 const regionParties=filters.regionId?await Property.distinct('partyId',{tenantId:filters.tenant,companyId:filters.company,archived:false,regionId:oid(filters.regionId)}):null;
 const query=Party.find(commercialFilter(ctx,companyId,kinds.includes('lead')?'lead:read':'customer:read',{archived:false,kind:{$in:kinds},...(filters.ownerId?{ownerId:filters.ownerId}:{}),...(regionParties?{_id:{$in:regionParties}}:{})}));query.cast(Party);
 return query.getFilter();
}
async function commercial(ctx:AccessContext,companyId:string,filters:Filters):Promise<IndicatorSection[]>{
 const partyFilter=await commercialParties(ctx,companyId,filters),ids={tenantId:filters.tenant,companyId:filters.company},period={$gte:filters.from,$lt:filters.to};
 const today=dateParts(new Date(),zone).date,week=addCalendarDays(today,7),scoped=(local:string)=>[{$lookup:{from:Party.collection.name,localField:local,foreignField:'_id',pipeline:[{$match:partyFilter},{$project:{kind:1}}],as:'party'}},{$unwind:'$party'}];
 const [[parties],[visits],[opportunities],[proposals]]=await Promise.all([
  Party.aggregate([{$match:partyFilter},{$facet:{customers:[{$match:{kind:'customer'}},{$count:'count'}],leads:[{$match:{kind:'lead'}},{$count:'count'}],upcoming:[{$match:{nextActionDate:{$gte:today,$lte:week}}},{$count:'count'}],overdue:[{$match:{nextActionDate:{$lt:today}}},{$count:'count'}]}}]),
  AgendaActivity.aggregate([{$match:{...ids,type:'visita',dueAt:period}},...scoped('partyId'),{$lookup:{from:FieldExecution.collection.name,localField:'_id',foreignField:'activityId',pipeline:[{$match:ids},{$project:{outcome:1}}],as:'execution'}},
   {$facet:{planned:[{$count:'count'}],completed:[{$match:{status:'concluida'}},{$count:'count'}],realized:[{$match:{'execution.outcome':'realizada'}},{$count:'count'}],covered:[{$match:{status:'concluida','party.kind':'customer'}},{$group:{_id:'$partyId'}},{$count:'count'}]}}]),
  Opportunity.aggregate([{$match:ids},...scoped('partyId'),{$facet:{
   open:[{$match:{stage:{$in:['descoberta','proposta','negociacao']}}},{$group:{_id:null,count:{$sum:1},total:{$sum:'$amountCents'},weighted:{$sum:{$round:[{$divide:[{$multiply:['$amountCents','$probability']},100]},0]}}}}],
   won:[{$match:{stage:'ganha',closedAt:period}},{$group:{_id:null,count:{$sum:1},total:{$sum:'$amountCents'}}}],
   lost:[{$match:{stage:'perdida',closedAt:period}},{$count:'count'}]}}]),
  Proposal.aggregate([{$match:ids},{$lookup:{from:Opportunity.collection.name,localField:'opportunityId',foreignField:'_id',pipeline:[{$match:ids},{$project:{partyId:1}}],as:'opportunity'}},{$unwind:'$opportunity'},...scoped('opportunity.partyId'),{$facet:{
   sent:[{$match:{sentAt:period}},{$count:'count'}],accepted:[{$match:{status:'aceita',decidedAt:period}},{$group:{_id:null,count:{$sum:1},total:{$sum:'$totalCents'}}}],refused:[{$match:{status:'recusada',decidedAt:period}},{$count:'count'}]}}]),
 ]);
 const customers=count(parties.customers),won=count(opportunities.won),lost=count(opportunities.lost),openRow=opportunities.open[0]??{count:0,total:0,weighted:0},wonRow=opportunities.won[0]??{total:0},acceptedRow=proposals.accepted[0]??{count:0,total:0};
 return [
  {key:'carteira',title:'Carteira',indicators:[
   {key:'customers',label:'Clientes ativos',value:customers,unit:'count',definition:'Clientes não arquivados do seu acesso nos filtros.'},
   {key:'leads',label:'Leads ativos',value:count(parties.leads),unit:'count',definition:'Leads não arquivados do seu acesso nos filtros.'},
   {key:'upcoming',label:'Próximas ações em 7 dias',value:count(parties.upcoming),unit:'count',definition:'Cadastros com data de próxima ação entre hoje e 7 dias.'},
   {key:'overdue',label:'Próximas ações vencidas',value:count(parties.overdue),unit:'count',definition:'Cadastros com data de próxima ação anterior a hoje.'},
  ]},
  {key:'visitas',title:'Visitas',indicators:[
   {key:'planned',label:'Visitas planejadas',value:count(visits.planned),unit:'count',definition:'Atividades do tipo visita com data no período.'},
   {key:'completed',label:'Visitas concluídas',value:count(visits.completed),unit:'count',definition:'Visitas do período com situação concluída.'},
   {key:'realized',label:'Visitas qualificadas',value:count(visits.realized),unit:'count',definition:'Visitas do período com checkout em campo e resultado "realizada".'},
   {key:'coverage',label:'Cobertura da carteira',value:percent(count(visits.covered),customers),unit:'percent',definition:'Clientes com ao menos uma visita concluída no período ÷ clientes ativos.'},
  ]},
  {key:'oportunidades',title:'Oportunidades',indicators:[
   {key:'open',label:'Oportunidades abertas',value:openRow.count,unit:'count',definition:'Oportunidades em descoberta, proposta ou negociação (todas as datas).'},
   {key:'pipeline',label:'Valor em negociação',value:openRow.total,unit:'cents',definition:'Soma do valor estimado das oportunidades abertas. Não é receita.'},
   {key:'forecast',label:'Previsão ponderada',value:openRow.weighted,unit:'cents',definition:'Soma de valor × probabilidade das oportunidades abertas. Previsão, não receita.'},
   {key:'won',label:'Ganhas no período',value:won,unit:'count',definition:'Oportunidades encerradas como ganhas no período.'},
   {key:'wonAmount',label:'Valor ganho no período',value:wonRow.total,unit:'cents',definition:'Valor estimado das oportunidades ganhas no período. Não substitui faturamento.'},
   {key:'conversion',label:'Taxa de conversão',value:percent(won,won+lost),unit:'percent',definition:'Ganhas ÷ (ganhas + perdidas) encerradas no período.'},
  ]},
  {key:'propostas',title:'Propostas',indicators:[
   {key:'sent',label:'Propostas enviadas',value:count(proposals.sent),unit:'count',definition:'Envios registrados no período (a revisão mais recente de cada proposta).'},
   {key:'accepted',label:'Propostas aceitas',value:acceptedRow.count,unit:'count',definition:'Aceites do cliente registrados no período.'},
   {key:'refused',label:'Propostas recusadas',value:count(proposals.refused),unit:'count',definition:'Recusas registradas no período.'},
   {key:'acceptedAmount',label:'Valor aceito',value:acceptedRow.total,unit:'cents',definition:'Total das propostas aceitas no período. Não é pedido nem receita.'},
  ]},
 ];
}
/** Orders of the live customer scope (order:read); territory = active property region; responsible = portfolio owner. */
async function orders(ctx:AccessContext,companyId:string,filters:Filters,startDate:string,endDate:string,today:string):Promise<IndicatorSection[]>{
 const regionParties=filters.regionId?await Property.distinct('partyId',{tenantId:filters.tenant,companyId:filters.company,archived:false,regionId:oid(filters.regionId)}):null;
 const scope=await orderScope(ctx,companyId,'order:read',{...(filters.ownerId?{ownerId:oid(filters.ownerId)}:{}),...(regionParties?{_id:{$in:regionParties}}:{})});
 const period={$gte:filters.from,$lt:filters.to},showCost=ctx.permissions.includes('cost:read');
 const [row]=await SalesOrder.aggregate([{$match:scope.match},{$lookup:{from:Party.collection.name,localField:'partyId',foreignField:'_id',pipeline:[{$match:scope.parties},{$project:{_id:1}}],as:'party'}},{$unwind:'$party'},{$facet:{
  confirmed:[{$match:{confirmedAt:period}},{$group:{_id:null,count:{$sum:1},total:{$sum:'$totalCents'}}}],
  pending:[{$match:{status:'aguardando_aprovacao'}},{$count:'count'}],
  undelivered:[{$match:{status:{$in:['confirmado','faturado']},deliveredAt:null}},{$count:'count'}],
  invoiced:[{$unwind:'$invoices'},{$match:{'invoices.issueDate':{$gte:startDate,$lte:endDate}}},{$group:{_id:null,total:{$sum:'$invoices.amountCents'}}}],
  open:[{$match:{status:{$in:['confirmado','entregue']}}},{$project:{totalCents:1,invoicedCents:1,expectedDeliveryDate:1,paymentTermDays:1,first:{$arrayElemAt:['$invoices.issueDate',0]}}}],
  margin:[{$match:{confirmedAt:period,status:{$ne:'cancelado'}}},{$project:{totalCents:1,complete:{$allElementsTrue:[{$map:{input:'$items',as:'item',in:{$ne:[{$ifNull:['$$item.costCents',null]},null]}}}]},cost:{$sum:'$items.costCents'}}},{$match:{complete:true}},{$group:{_id:null,total:{$sum:'$totalCents'},cost:{$sum:'$cost'}}}],
 }}]);
 const buckets={overdue:0,d30:0,d60:0,d90:0,later:0},limit=(days:number)=>addCalendarDays(today,days);let backlog=0;
 for(const order of row.open as {totalCents:number;invoicedCents:number;expectedDeliveryDate:string;paymentTermDays:number[];first?:string}[]){
  backlog+=order.totalCents-order.invoicedCents;
  for(const item of orderPendingInstallments(order.totalCents,order.invoicedCents,order.first??order.expectedDeliveryDate,order.paymentTermDays)){
   const key=item.dueDate<today?'overdue':item.dueDate<=limit(30)?'d30':item.dueDate<=limit(60)?'d60':item.dueDate<=limit(90)?'d90':'later';buckets[key]+=item.amountCents;
  }
 }
 const confirmed=row.confirmed[0]??{count:0,total:0},margin=row.margin[0] as {total:number;cost:number}|undefined;
 const forecast='Parcelas ainda não faturadas dos pedidos confirmados ou entregues, pelos prazos de pagamento contados da primeira nota (ou da entrega prevista).';
 return [{key:'pedidos',title:'Pedidos e faturamento',indicators:[
  {key:'confirmed',label:'Pedidos confirmados',value:confirmed.count,unit:'count',definition:'Pedidos confirmados (direto ou após aprovação) no período.'},
  {key:'confirmedValue',label:'Valor confirmado',value:confirmed.total,unit:'cents',definition:'Total dos pedidos confirmados no período. Pedido não é receita até a nota ser lançada.'},
  {key:'invoiced',label:'Faturado no período',value:sum(row.invoiced),unit:'cents',definition:'Soma das notas fiscais lançadas pelo financeiro com emissão no período.'},
  {key:'backlog',label:'Carteira a faturar',value:backlog,unit:'cents',definition:'Saldo não faturado dos pedidos confirmados ou entregues, hoje (independe do período).'},
  {key:'pendingApproval',label:'Aguardando aprovação',value:count(row.pending),unit:'count',definition:'Pedidos fora da tabela, do crédito ou das condições aprovadas aguardando a gerência, hoje.'},
  {key:'undelivered',label:'Aguardando entrega',value:count(row.undelivered),unit:'count',definition:'Pedidos confirmados sem entrega registrada, hoje.'},
  {key:'forecastOverdue',label:'Previsão vencida',value:buckets.overdue,unit:'cents',definition:forecast+' Vencimento anterior a hoje.'},
  {key:'forecast30',label:'Previsão até 30 dias',value:buckets.d30,unit:'cents',definition:forecast+' Vencimento de hoje a 30 dias.'},
  {key:'forecast60',label:'Previsão 31 a 60 dias',value:buckets.d60,unit:'cents',definition:forecast},
  {key:'forecast90',label:'Previsão 61 a 90 dias',value:buckets.d90,unit:'cents',definition:forecast},
  {key:'forecastLater',label:'Previsão após 90 dias',value:buckets.later,unit:'cents',definition:forecast},
  ...(showCost?[{key:'margin',label:'Margem bruta',value:margin?margin.total-margin.cost:null,unit:'cents' as const,definition:'Total menos custo congelado no envio, dos pedidos confirmados no período com custo em todos os itens.'},
   {key:'marginPercent',label:'Margem bruta (%)',value:margin?percent(margin.total-margin.cost,margin.total):null,unit:'percent' as const,definition:'Margem bruta ÷ total dos mesmos pedidos.'}]:[]),
 ]}];
}
async function technical(ctx:AccessContext,companyId:string,filters:Filters):Promise<IndicatorSection[]>{
 const sections:IndicatorSection[]=[],period={$gte:filters.from,$lt:filters.to},now=new Date();
 // Profiles restricted to sales orders (sales administration) do not see service indicators.
 const salesOnly=ctx.permissions.includes('order:read')&&!orderKinds(ctx).includes('servico');
 if(ctx.permissions.includes('ticket:read')&&!salesOnly){
  const access=await ticketAuthority(ctx,companyId);
  const minutes=(from:string,to:string)=>({$divide:[{$subtract:['$'+to,'$'+from]},60000]});
  const [row]=await Ticket.aggregate([{$match:{tenantId:filters.tenant,companyId:filters.company,...(filters.ownerId?{assigneeId:oid(filters.ownerId)}:{})}},...ticketScope(ctx,companyId,access),...(filters.regionId?[{$match:{'property.regionId':oid(filters.regionId)}}]:[]),{$facet:{
   critical:[{$match:{status:{$in:['aberto','em_atendimento','aguardando_cliente']},criticality:'critico'}},{$count:'count'}],
   open:[{$match:{status:{$in:['aberto','em_atendimento','aguardando_cliente']}}},{$count:'count'}],
   overdue:[{$match:{status:{$in:['aberto','em_atendimento','aguardando_cliente']},agreedDeadline:{$lt:now}}},{$count:'count'}],
   opened:[{$match:{openedAt:period}},{$count:'count'}],repeat:[{$match:{openedAt:period,previousTicketId:{$ne:null}}},{$count:'count'}],
   response:[{$match:{firstResponseAt:period}},{$group:{_id:null,value:{$avg:minutes('openedAt','firstResponseAt')}}}],
   resolved:[{$match:{status:'resolvido',resolvedAt:period}},{$group:{_id:null,count:{$sum:1},value:{$avg:minutes('openedAt','resolvedAt')}}}],
   withDeadline:[{$match:{status:'resolvido',resolvedAt:period,agreedDeadline:{$ne:null}}},{$group:{_id:null,count:{$sum:1},met:{$sum:{$cond:[{$lte:['$resolvedAt','$agreedDeadline']},1,0]}}}}]}}]);
  const resolved=row.resolved[0]??{count:0,value:null},deadline=row.withDeadline[0]??{count:0,met:0};
  sections.push({key:'chamados',title:'Chamados',indicators:[
   {key:'critical',label:'Chamados críticos em aberto',value:count(row.critical),unit:'count',definition:'Chamados de criticidade crítica ainda não resolvidos ou cancelados.'},
   {key:'open',label:'Chamados em aberto',value:count(row.open),unit:'count',definition:'Chamados abertos, em atendimento ou aguardando cliente.'},
   {key:'overdue',label:'Prazos pactuados vencidos',value:count(row.overdue),unit:'count',definition:'Chamados em aberto com prazo pactuado anterior a agora.'},
   {key:'opened',label:'Abertos no período',value:count(row.opened),unit:'count',definition:'Chamados com abertura (servidor) no período.'},
   {key:'resolved',label:'Resolvidos no período',value:resolved.count,unit:'count',definition:'Chamados resolvidos no período.'},
   {key:'response',label:'Tempo médio de primeiro retorno',value:avg(row.response),unit:'minutes',definition:'Média de (primeiro retorno − abertura) dos retornos registrados no período.'},
   {key:'resolution',label:'Tempo médio de solução',value:resolved.value===null?null:Math.round(resolved.value),unit:'minutes',definition:'Média de (resolução − abertura) dos chamados resolvidos no período.'},
   {key:'sla',label:'Prazo pactuado cumprido',value:percent(deadline.met,deadline.count),unit:'percent',definition:'Resolvidos no período até o prazo pactuado ÷ resolvidos no período com prazo pactuado. Não há SLA automático.'},
   {key:'repeat',label:'Reincidência de chamados',value:percent(count(row.repeat),count(row.opened)),unit:'percent',definition:'Chamados abertos no período ligados a um chamado anterior resolvido ÷ chamados abertos no período.'},
  ]});
 }
 if(ctx.permissions.includes('technical:read')&&!salesOnly){
  const stages=await workOrderScope(ctx,companyId,{...(filters.ownerId?{technicianId:oid(filters.ownerId)}:{})});
  const [row]=await TechnicalWork.aggregate([...stages,...(filters.regionId?[{$lookup:{from:Property.collection.name,localField:'propertyId',foreignField:'_id',pipeline:[{$match:{tenantId:filters.tenant,companyId:filters.company,regionId:oid(filters.regionId)}},{$project:{_id:1}}],as:'orderTerritory'}},{$unwind:'$orderTerritory'}]:[]),{$facet:{
   open:[{$match:{state:{$in:['pending','in_progress']}}},{$count:'count'}],
   completed:[{$match:{checkedOutAt:period,state:'completed'}},{$group:{_id:null,count:{$sum:1},labor:{$sum:{$ifNull:['$laborMinutes',0]}},travel:{$sum:{$ifNull:['$travelMinutes',0]}}}}],
   closed:[{$match:{closedAt:period}},{$group:{_id:null,count:{$sum:1},billable:{$sum:{$ifNull:['$billableMinutes',0]}}}}],
   created:[{$match:{createdAt:period,origin:{$in:['chamado','programada']}}},{$group:{_id:null,count:{$sum:1},repeat:{$sum:{$cond:[{$ne:['$returnOfWorkId',null]},1,0]}}}}]}}]);
  const completed=row.completed[0]??{count:0,labor:0,travel:0},closed=row.closed[0]??{count:0,billable:0},created=row.created[0]??{count:0,repeat:0};
  sections.push({key:'ordens',title:'Ordens de serviço',indicators:[
   {key:'open',label:'OS pendentes ou em execução',value:count(row.open),unit:'count',definition:'Ordens de serviço agendadas ou em andamento.'},
   {key:'completed',label:'OS concluídas no período',value:completed.count,unit:'count',definition:'Execuções concluídas (checkout do técnico) no período.'},
   {key:'closed',label:'OS encerradas no período',value:closed.count,unit:'count',definition:'OS encerradas pela coordenação no período.'},
   {key:'labor',label:'Horas trabalhadas',value:completed.labor,unit:'minutes',definition:'Soma das horas informadas pelos técnicos nas OS concluídas no período.'},
   {key:'travel',label:'Deslocamento',value:completed.travel,unit:'minutes',definition:'Soma do tempo de deslocamento informado nas OS concluídas no período.'},
   {key:'billable',label:'Horas faturáveis autorizadas',value:closed.billable,unit:'minutes',definition:'Soma das horas autorizadas pela coordenação nas OS encerradas no período. Não é faturamento.'},
   {key:'repeat',label:'Reincidência de OS',value:percent(created.repeat,created.count),unit:'percent',definition:'OS abertas no período como retorno pela mesma falha ÷ OS abertas no período.'},
  ]});
 }
 return sections;
}
export const indicatorService={
 async report(ctx:AccessContext,companyId:string,raw:unknown):Promise<IndicatorReport>{
  const input=indicatorInput.parse(raw),scope=companyScope(ctx,companyId,'company:read');
  const today=dateParts(new Date(),zone).date,endDate=input.endDate??today,startDate=input.startDate??addCalendarDays(endDate,-29);
  if(endDate<startDate)throw new AccessDenied();
  const filters:Filters={tenant:oid(scope.tenantId),company:oid(companyId),from:dayBoundary(startDate,zone),to:dayBoundary(addCalendarDays(endDate,1),zone),regionId:input.regionId??null,ownerId:input.ownerId??null};
  const wantsCommercial=input.view!=='tecnica'&&(ctx.permissions.includes('lead:read')||ctx.permissions.includes('customer:read'));
  const wantsTechnical=input.view!=='comercial';
  const wantsOrders=ctx.permissions.includes('order:read')&&orderKinds(ctx).length>0&&(input.view!=='tecnica'||!orderKinds(ctx).includes('venda'));
  const sections=[...(wantsCommercial?await commercial(ctx,companyId,filters):[]),...(wantsOrders?await orders(ctx,companyId,filters,startDate,endDate,today):[]),...(wantsTechnical?await technical(ctx,companyId,filters):[])];
  return {asOf:new Date().toISOString(),view:input.view,filters:{startDate,endDate,regionId:filters.regionId,ownerId:filters.ownerId},sections};
 },
};
