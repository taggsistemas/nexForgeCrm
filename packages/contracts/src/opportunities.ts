export const opportunityStages=['descoberta','proposta','negociacao','ganha','perdida'] as const;
export const openOpportunityStages=['descoberta','proposta','negociacao'] as const;
export type OpportunityStage=typeof opportunityStages[number];
export const opportunityStageNames:Record<OpportunityStage,string>={descoberta:'Descoberta',proposta:'Proposta',negociacao:'Negociação',ganha:'Ganha',perdida:'Perdida'};
export const activityTypes=['ligacao','email','reuniao','tarefa','visita'] as const;
export const activityStatuses=['pendente','concluida','cancelada'] as const;
export interface OpportunityView{id:string;partyId:string;partyName:string;ownerId:string;title:string;amountCents:number;currency:'BRL';expectedCloseDate:string;stage:OpportunityStage;probability:number;weightedAmountCents:number;originId:string|null;propertyId:string|null;propertyName:string;equipmentId:string|null;equipmentName:string;lossReason:string;notes:string;closedAt:string|null;version:number;createdAt:string;updatedAt:string}
export interface OpportunityActivityView{seriesId?:string;id:string;opportunityId:string;title:string;type:typeof activityTypes[number];status:typeof activityStatuses[number];dueAt:string;completedAt:string|null;notes:string;version:number}
export interface OpportunityHistoryView{id:string;action:string;actorName:string;previousStage?:OpportunityStage;nextStage?:OpportunityStage;detail?:string;createdAt:string}
export function moneyToCents(value:string):number|undefined{
 const raw=value.trim();
 if(!/^(?:\d{1,10}|\d{1,3}(?:\.\d{3}){1,3})(,\d{1,2})?$/.test(raw))return;
 const normalized=raw.replace(/\./g,'');
 if(!/^\d{1,10}(,\d{1,2})?$/.test(normalized))return;
 const [whole,fraction='']=normalized.split(',');
 const cents=Number(whole)*100+Number(fraction.padEnd(2,'0'));
 return Number.isSafeInteger(cents)&&cents>0&&cents<=1e12?cents:undefined;
}
/** Fixed phases, configurable names and default probabilities. Won/lost are terminal: 100% and 0%. */
export const defaultPipelineStages:Readonly<Record<typeof openOpportunityStages[number],{label:string;probability:number}>>={descoberta:{label:'Descoberta',probability:10},proposta:{label:'Proposta',probability:40},negociacao:{label:'Negociação',probability:70}};
export interface PipelineSettingsView{stages:{key:typeof openOpportunityStages[number];label:string;probability:number}[];version:number}
/** Expected value for forecasting only; it is never revenue. */
export function weightedCents(amountCents:number,probability:number){return Math.round(amountCents*probability/100);}
export const proposalStatuses=['rascunho','enviada','aceita','recusada','cancelada'] as const;
export type ProposalStatus=typeof proposalStatuses[number];
export const proposalStatusNames:Readonly<Record<ProposalStatus,string>>={rascunho:'Rascunho',enviada:'Enviada ao cliente',aceita:'Aceita pelo cliente',recusada:'Recusada pelo cliente',cancelada:'Cancelada'};
export interface ProposalItemView{productId:string;code:string;description:string;kind:'product'|'service';unit:string;quantity:string;unitPriceCents:number;discountCents:number;referencePriceCents:number|null;totalCents:number}
export interface ProposalView{id:string;opportunityId:string;number:string;status:ProposalStatus;revision:number;validUntil:string;expired:boolean;items:ProposalItemView[];totalCents:number;notes:string;sentAt:string|null;decidedAt:string|null;decisionReason:string;version:number;createdAt:string;updatedAt:string}
export interface ProposalRevisionView{revision:number;status:ProposalStatus;totalCents:number;validUntil:string;itemCount:number;sentAt:string|null;createdAt:string}
/** Line total in integer cents. Quantity uses up to 3 decimals; rounding half away from zero once per line. */
export function proposalLineCents(quantity:string,unitPriceCents:number,discountCents=0){
 if(!/^(?:0|[1-9]\d{0,8})(?:\.\d{1,3})?$/.test(quantity)||!Number.isSafeInteger(unitPriceCents)||unitPriceCents<0||!Number.isSafeInteger(discountCents)||discountCents<0)throw Error('INVALID_PROPOSAL_LINE');
 const [whole,fraction='']=quantity.split('.');const milli=BigInt(whole!)*1000n+BigInt(fraction.padEnd(3,'0'));
 const gross=Number((milli*BigInt(unitPriceCents)+500n)/1000n);
 if(discountCents>gross||gross>1e12)throw Error('INVALID_PROPOSAL_LINE');return gross-discountCents;
}
