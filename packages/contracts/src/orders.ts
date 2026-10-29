/** Sales and service orders. The CRM creates and follows the order; invoices are issued by finance in its own system and registered here. */
export const orderKinds=['venda','servico'] as const;
export const orderKindNames:Readonly<Record<typeof orderKinds[number],string>>={venda:'Venda',servico:'Serviço'};
export const orderOrigins=['proposta','direto','os'] as const;
export const orderOriginNames:Readonly<Record<typeof orderOrigins[number],string>>={proposta:'Proposta aceita',direto:'Lançamento direto',os:'Ordem de serviço'};
export const orderStatuses=['rascunho','aguardando_aprovacao','confirmado','entregue','faturado','cancelado'] as const;
export type OrderStatus=typeof orderStatuses[number];
export const orderStatusNames:Readonly<Record<OrderStatus,string>>={rascunho:'Rascunho',aguardando_aprovacao:'Aguardando aprovação',confirmado:'Confirmado',entregue:'Entregue',faturado:'Faturado',cancelado:'Cancelado'};
export const orderApprovalReasons=['credit','discount','payment'] as const;
export const orderApprovalReasonNames:Readonly<Record<typeof orderApprovalReasons[number],string>>={credit:'Ultrapassa o limite de crédito',discount:'Preço abaixo da tabela',payment:'Prazo ou forma de pagamento fora do aprovado'};
export const orderPaymentMethodNames:Readonly<Record<string,string>>={pix:'PIX',boleto:'Boleto',cartao_credito:'Cartão de crédito',cartao_debito:'Cartão de débito',dinheiro:'Dinheiro',transferencia:'Transferência'};
export const orderActions=['submit','approve','reject','deliver','cancel'] as const;
export type OrderAction=typeof orderActions[number];
export interface OrderItemView{productId:string;code:string;description:string;kind:'product'|'service';unit:string;quantity:string;unitPriceCents:number;discountCents:number;referencePriceCents:number|null;totalCents:number;costCents?:number|null}
export interface OrderInvoiceView{number:string;issueDate:string;amountCents:number;registeredBy:string;registeredAt:string}
export interface OrderInstallmentView{dueDate:string;amountCents:number}
export interface OrderView{
 id:string;number:string;kind:typeof orderKinds[number];origin:typeof orderOrigins[number];partyId:string;partyName:string;opportunityId:string|null;proposalId:string|null;proposalNumber:string;workOrderId:string|null;workOrderNumber:string;
 status:OrderStatus;items:OrderItemView[];totalCents:number;paymentMethod:string;paymentTermDays:number[];expectedDeliveryDate:string;notes:string;
 approvalReasons:(typeof orderApprovalReasons[number])[];decisionNote:string;submittedAt:string|null;confirmedAt:string|null;approvedBy:string;deliveredAt:string|null;invoicedAt:string|null;cancelledAt:string|null;
 invoices:OrderInvoiceView[];invoicedCents:number;remainingCents:number;installments:OrderInstallmentView[];
 costCents?:number|null;marginCents?:number|null;marginPercent?:number|null;
 canEdit:boolean;canSubmit:boolean;canApprove:boolean;canDeliver:boolean;canInvoice:boolean;canCancel:boolean;version:number;createdAt:string;updatedAt:string;
}
export interface OrderEventView{action:string;actor:string;at:string;note:string}
/** Splits an amount into one installment per payment term; the last one absorbs rounding. Dates are calendar days. */
export function orderInstallments(totalCents:number,baseDate:string,termDays:number[]):OrderInstallmentView[]{
 const terms=termDays.length?[...termDays].sort((a,b)=>a-b):[0],share=Math.floor(totalCents/terms.length);
 return terms.map((days,index)=>{const date=new Date(baseDate+'T12:00:00Z');date.setUTCDate(date.getUTCDate()+days);return {dueDate:date.toISOString().slice(0,10),amountCents:index===terms.length-1?totalCents-share*(terms.length-1):share};});
}
/** Margin only when every line has a cost; otherwise null (no fabricated profit). */
export function orderMargin(totalCents:number,lineCosts:(number|null)[]){if(!lineCosts.length||lineCosts.some(value=>value===null))return {costCents:null,marginCents:null,marginPercent:null};const cost=lineCosts.reduce((sum:number,value)=>sum+(value as number),0),margin=totalCents-cost;return {costCents:cost,marginCents:margin,marginPercent:totalCents>0?Math.round(margin*1000/totalCents)/10:null};}
/** Parses "30/60/90" or "30, 60" into unique sorted day terms; null when invalid. */
export function parsePaymentTerms(value:string):number[]|null{const parts=value.split(/[\s,;/]+/).filter(Boolean);if(!parts.length||parts.length>12||parts.some(part=>!/^\d{1,3}$/.test(part)))return null;const days=parts.map(Number);if(days.some(day=>day>730)||new Set(days).size!==days.length)return null;return days.sort((a,b)=>a-b);}
/** Installments still to be invoiced: invoiced amounts consume the earliest installments first. */
export function orderPendingInstallments(totalCents:number,invoicedCents:number,baseDate:string,termDays:number[]):OrderInstallmentView[]{
 let consumed=invoicedCents;const pending:OrderInstallmentView[]=[];
 for(const item of orderInstallments(totalCents,baseDate,termDays)){const used=Math.min(consumed,item.amountCents);consumed-=used;if(item.amountCents-used>0)pending.push({dueDate:item.dueDate,amountCents:item.amountCents-used});}
 return pending;
}
