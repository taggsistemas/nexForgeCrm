/** Company data printed on documents, suppliers, warehouse (one per company) and purchases. */
export interface CompanyAddress {street:string;number:string;complement:string;district:string;city:string;state:string;zip:string}
export interface CompanyProfileView {legalName:string;tradeName:string;taxId:string;stateRegistration:string;municipalRegistration:string;address:CompanyAddress;phone:string;email:string;website:string;logo:string|null;documentNotes:string;purchaseApprovalLimitCents:number;version:number;updatedAt:string|null}
export interface SupplierView {id:string;name:string;tradeName:string;taxId:string;stateRegistration:string;contactName:string;phone:string;email:string;address:CompanyAddress;paymentTerms:string;notes:string;active:boolean;version:number}
export const stockSources=['manual','compra','pedido_venda','os'] as const;
export type StockSource=typeof stockSources[number];
export const stockSourceNames:Readonly<Record<StockSource,string>>={manual:'Manual',compra:'Compra',pedido_venda:'Pedido de venda',os:'Ordem de serviço'};
export const stockManualReasons=['inventario','devolucao','perda','uso_interno','outro'] as const;
export const stockManualReasonNames:Readonly<Record<typeof stockManualReasons[number],string>>={inventario:'Ajuste de inventário',devolucao:'Devolução',perda:'Perda ou avaria',uso_interno:'Uso interno',outro:'Outro'};
export interface StockBalanceView {productId:string;code:string;description:string;unit:string;quantityDecimals:number;quantity:string;quantityMilli:number;negative:boolean;costCents?:number|null;valueCents?:number|null;updatedAt:string|null}
export interface StockMovementView {id:string;productId:string;code:string;description:string;unit:string;direction:'entrada'|'saida';source:StockSource;reason:string;quantity:string;balanceAfter:string;negativeAlert:boolean;reference:string;note:string;actor:string;createdAt:string;unitCostCents?:number|null}
export const purchaseStatuses=['rascunho','aguardando_aprovacao','aprovado','enviado','recebido_parcial','recebido','cancelado'] as const;
export type PurchaseStatus=typeof purchaseStatuses[number];
export const purchaseStatusNames:Readonly<Record<PurchaseStatus,string>>={rascunho:'Rascunho',aguardando_aprovacao:'Aguardando aprovação',aprovado:'Aprovado',enviado:'Enviado ao fornecedor',recebido_parcial:'Recebido parcialmente',recebido:'Recebido',cancelado:'Cancelado'};
export const purchaseActions=['submit','approve','reject','send','cancel'] as const;
export type PurchaseAction=typeof purchaseActions[number];
export interface PurchaseItemView {productId:string;code:string;description:string;kind:'product'|'service';unit:string;quantityDecimals:number;quantity:string;received:string;pending:string;unitCostCents:number;totalCents:number}
export interface PurchaseView {id:string;number:string;supplierId:string;supplierName:string;status:PurchaseStatus;items:PurchaseItemView[];totalCents:number;expectedDate:string;paymentTerms:string;notes:string;decisionNote:string;needsApproval:boolean;submittedAt:string|null;approvedAt:string|null;approvedBy:string;sentAt:string|null;receivedAt:string|null;cancelledAt:string|null;createdBy:string;
 canEdit:boolean;canSubmit:boolean;canApprove:boolean;canSend:boolean;canReceive:boolean;canCancel:boolean;version:number;createdAt:string;updatedAt:string}
export interface PurchaseEventView {action:string;actor:string;at:string;note:string}
/** Weighted average unit cost after an entry: existing stock keeps its cost, new units enter at their purchase cost. */
export function averageCost(stockMilli:number,costCents:number|null,entryMilli:number,entryCostCents:number){
 if(stockMilli<=0||costCents===null)return entryCostCents;
 return Math.round((stockMilli*costCents+entryMilli*entryCostCents)/(stockMilli+entryMilli));
}
export function formatTaxId(value:string){const digits=value.replace(/\D/g,'');if(digits.length===14)return digits.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/,'$1.$2.$3/$4-$5');if(digits.length===11)return digits.replace(/^(\d{3})(\d{3})(\d{3})(\d{2})$/,'$1.$2.$3-$4');return value;}
export function addressLine(address:Partial<CompanyAddress>|null|undefined){if(!address)return '';const street=[address.street,address.number].filter(Boolean).join(', ');return [street,address.complement,address.district,[address.city,address.state].filter(Boolean).join('/'),address.zip?'CEP '+address.zip:''].filter(Boolean).join(' · ');}
