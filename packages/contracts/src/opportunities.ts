export const opportunityStages=['descoberta','proposta','negociacao','ganha','perdida'] as const;
export const openOpportunityStages=['descoberta','proposta','negociacao'] as const;
export type OpportunityStage=typeof opportunityStages[number];
export const opportunityStageNames:Record<OpportunityStage,string>={descoberta:'Descoberta',proposta:'Proposta',negociacao:'Negociação',ganha:'Ganha',perdida:'Perdida'};
export const activityTypes=['ligacao','email','reuniao','tarefa','visita'] as const;
export const activityStatuses=['pendente','concluida','cancelada'] as const;
export interface OpportunityView{id:string;partyId:string;partyName:string;ownerId:string;title:string;amountCents:number;currency:'BRL';expectedCloseDate:string;stage:OpportunityStage;lossReason:string;notes:string;closedAt:string|null;version:number;createdAt:string;updatedAt:string}
export interface OpportunityActivityView{seriesId?:string;id:string;opportunityId:string;title:string;type:typeof activityTypes[number];status:typeof activityStatuses[number];dueAt:string;completedAt:string|null;notes:string;version:number}
export interface OpportunityHistoryView{id:string;action:string;actorName:string;previousStage?:OpportunityStage;nextStage?:OpportunityStage;createdAt:string}
export function moneyToCents(value:string):number|undefined{
 const raw=value.trim();
 if(!/^(?:\d{1,10}|\d{1,3}(?:\.\d{3}){1,3})(,\d{1,2})?$/.test(raw))return;
 const normalized=raw.replace(/\./g,'');
 if(!/^\d{1,10}(,\d{1,2})?$/.test(normalized))return;
 const [whole,fraction='']=normalized.split(',');
 const cents=Number(whole)*100+Number(fraction.padEnd(2,'0'));
 return Number.isSafeInteger(cents)&&cents>0&&cents<=1e12?cents:undefined;
}
