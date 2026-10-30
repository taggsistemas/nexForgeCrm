import {z} from 'zod';
import type {AccessContext} from '../../../../../packages/contracts/src/index.js';
import {addCalendarDays,dateParts} from '../../../../../packages/contracts/src/agenda.js';
import {orderKindNames,orderOriginNames,orderPaymentMethodNames,orderPendingInstallments,orderStatusNames,orderMargin,type OrderStatus} from '../../../../../packages/contracts/src/orders.js';
import {availableOrderReports,orderReportInfo,orderReportTypes,type OrderReport,type ReportColumn} from '../../../../../packages/contracts/src/reports.js';
import type {XlsxCell} from '../../../../../packages/contracts/src/xlsx.js';
import {AccessDenied} from '../../infrastructure/access.js';
import {auditActorNames} from '../../infrastructure/audit-actors.js';
import {Party} from '../relationships/models.js';
import {calendarDate} from '../opportunities/input.js';
import {dayBoundary} from '../agenda/recurrence.js';
import {SalesOrder} from './models.js';
import {orderScope} from './service.js';
const zone='America/Sao_Paulo',limit=5000;
export const orderReportInput=z.object({type:z.enum(orderReportTypes),startDate:calendarDate.optional(),endDate:calendarDate.optional()}).strict().superRefine((value,ctx)=>{
 if(value.startDate&&value.endDate&&(value.endDate<value.startDate||(Date.parse(value.endDate)-Date.parse(value.startDate))/86400000>366))ctx.addIssue({code:'custom',path:['endDate'],message:'Período de até 366 dias.'});
});
type Row={_id:unknown;number:string;kind:'venda'|'servico';origin:'proposta'|'direto'|'os';status:OrderStatus;totalCents:number;invoicedCents:number;paymentMethod:string;paymentTermDays:number[];expectedDeliveryDate:string;createdAt:Date;confirmedAt:Date|null;deliveredAt:Date|null;
 items:{code:string;description:string;kind:string;unit:string;quantity:string;unitPriceCents:number;discountCents:number;totalCents:number;costCents?:number|null}[];invoices:{number:string;issueDate:string;amountCents:number;registeredBy:unknown}[];party:{name:string;ownerId:unknown}};
const iso=(value:Date|null|undefined)=>value?value.toISOString():null;
/** Report rows use the same scope as the order list; cost and margin columns exist only with cost:read. */
export async function orderReport(ctx:AccessContext,companyId:string,raw:unknown):Promise<OrderReport>{
 const input=orderReportInput.parse(raw);
 if(!availableOrderReports(ctx.permissions).includes(input.type))throw new AccessDenied();
 const scope=await orderScope(ctx,companyId,'order:read'),info=orderReportInfo[input.type],costs=ctx.permissions.includes('cost:read');
 const today=dateParts(new Date(),zone).date,endDate=input.endDate??today,startDate=input.startDate??addCalendarDays(endDate,-29);
 const created={createdAt:{$gte:dayBoundary(startDate,zone),$lt:dayBoundary(addCalendarDays(endDate,1),zone)}};
 const match:Record<string,unknown>={...scope.match,...(info.kind?{kind:info.kind}:{})};
 if(info.period==='created')Object.assign(match,created);
 if(input.type==='itens')match.status={$in:['confirmado','entregue','faturado']};
 if(input.type==='a_faturar'||input.type==='previsao')match.status={$in:['confirmado','entregue']};
 if(input.type==='faturamento')match['invoices.issueDate']={$gte:startDate,$lte:endDate};
 const found=await SalesOrder.aggregate<Row>([{$match:match},{$lookup:{from:Party.collection.name,localField:'partyId',foreignField:'_id',pipeline:[{$match:scope.parties},{$project:{name:1,ownerId:1}}],as:'party'}},{$unwind:'$party'},{$sort:{createdAt:1,_id:1}},{$limit:limit+1}]);
 const truncated=found.length>limit,orders=found.slice(0,limit);
 const names=await auditActorNames(ctx.tenantId,[...new Set(orders.flatMap(row=>[String(row.party.ownerId),...row.invoices.map(item=>String(item.registeredBy))]))]);
 const owner=(row:Row)=>names.get(String(row.party.ownerId))??'';
 let columns:ReportColumn[],rows:XlsxCell[][];
 if(input.type==='itens'){
  columns=[{key:'number',label:'Pedido',kind:'text'},{key:'customer',label:'Cliente',kind:'text'},{key:'seller',label:'Responsável',kind:'text'},{key:'kind',label:'Tipo',kind:'text'},{key:'confirmed',label:'Confirmado em',kind:'datetime'},{key:'code',label:'Código',kind:'text'},{key:'description',label:'Descrição',kind:'text'},{key:'itemKind',label:'Produto/serviço',kind:'text'},{key:'quantity',label:'Quantidade',kind:'number'},{key:'unit',label:'Unidade',kind:'text'},{key:'unitPrice',label:'Preço unitário',kind:'cents'},{key:'discount',label:'Desconto',kind:'cents'},{key:'total',label:'Total',kind:'cents'},...(costs?[{key:'cost',label:'Custo',kind:'cents' as const},{key:'margin',label:'Margem',kind:'cents' as const}]:[])];
  rows=orders.flatMap(row=>row.items.map(item=>[row.number,row.party.name,owner(row),orderKindNames[row.kind],iso(row.confirmedAt),item.code,item.description,item.kind==='service'?'Serviço':'Produto',Number(item.quantity),item.unit,item.unitPriceCents,item.discountCents,item.totalCents,...(costs?[item.costCents??null,item.costCents===null||item.costCents===undefined?null:item.totalCents-item.costCents]:[])]));
 }else if(input.type==='faturamento'){
  columns=[{key:'number',label:'Pedido',kind:'text'},{key:'customer',label:'Cliente',kind:'text'},{key:'seller',label:'Responsável',kind:'text'},{key:'kind',label:'Tipo',kind:'text'},{key:'invoice',label:'Nota fiscal',kind:'text'},{key:'issueDate',label:'Emissão',kind:'date'},{key:'amount',label:'Valor da nota',kind:'cents'},{key:'registeredBy',label:'Lançada por',kind:'text'},{key:'orderTotal',label:'Total do pedido',kind:'cents'}];
  rows=orders.flatMap(row=>row.invoices.filter(item=>item.issueDate>=startDate&&item.issueDate<=endDate).map(item=>[row.number,row.party.name,owner(row),orderKindNames[row.kind],item.number,item.issueDate,item.amountCents,names.get(String(item.registeredBy))??'',row.totalCents]));
 }else if(input.type==='previsao'){
  columns=[{key:'dueDate',label:'Vencimento',kind:'date'},{key:'number',label:'Pedido',kind:'text'},{key:'customer',label:'Cliente',kind:'text'},{key:'seller',label:'Responsável',kind:'text'},{key:'kind',label:'Tipo',kind:'text'},{key:'status',label:'Situação',kind:'text'},{key:'amount',label:'Valor previsto',kind:'cents'},{key:'overdue',label:'Vencida',kind:'text'}];
  rows=orders.flatMap(row=>orderPendingInstallments(row.totalCents,row.invoicedCents,row.invoices[0]?.issueDate??row.expectedDeliveryDate,row.paymentTermDays).map(item=>[item.dueDate,row.number,row.party.name,owner(row),orderKindNames[row.kind],orderStatusNames[row.status],item.amountCents,item.dueDate<today?'Sim':'Não'] as XlsxCell[])).sort((a,b)=>String(a[0]).localeCompare(String(b[0])));
 }else{
  columns=[{key:'number',label:'Pedido',kind:'text'},{key:'customer',label:'Cliente',kind:'text'},{key:'seller',label:'Responsável',kind:'text'},{key:'kind',label:'Tipo',kind:'text'},{key:'origin',label:'Origem',kind:'text'},{key:'status',label:'Situação',kind:'text'},{key:'created',label:'Criado em',kind:'datetime'},{key:'confirmed',label:'Confirmado em',kind:'datetime'},{key:'expected',label:'Entrega prevista',kind:'date'},{key:'delivered',label:'Entregue em',kind:'datetime'},{key:'payment',label:'Pagamento',kind:'text'},{key:'terms',label:'Prazos (dias)',kind:'text'},{key:'total',label:'Total',kind:'cents'},{key:'invoiced',label:'Faturado',kind:'cents'},{key:'remaining',label:'A faturar',kind:'cents'},...(costs?[{key:'cost',label:'Custo',kind:'cents' as const},{key:'margin',label:'Margem',kind:'cents' as const},{key:'marginPercent',label:'Margem %',kind:'percent' as const}]:[])];
  rows=orders.map(row=>{const margin=costs&&!['rascunho','aguardando_aprovacao','cancelado'].includes(row.status)?orderMargin(row.totalCents,row.items.map(item=>item.costCents??null)):{costCents:null,marginCents:null,marginPercent:null};
   return [row.number,row.party.name,owner(row),orderKindNames[row.kind],orderOriginNames[row.origin],orderStatusNames[row.status],iso(row.createdAt),iso(row.confirmedAt),row.expectedDeliveryDate,iso(row.deliveredAt),orderPaymentMethodNames[row.paymentMethod]??row.paymentMethod,row.paymentTermDays.join('/'),row.totalCents,row.invoicedCents,row.status==='cancelado'?0:row.totalCents-row.invoicedCents,...(costs?[margin.costCents,margin.marginCents,margin.marginPercent]:[])];});
 }
 return {type:input.type,title:info.title,columns,rows,truncated,filters:{startDate,endDate},generatedAt:new Date().toISOString()};
}
