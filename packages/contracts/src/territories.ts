export const visitPlanPeriods=['weekly','monthly','quarterly','semiannual'] as const;
export const visitPlanStates=['draft','published','completed','cancelled'] as const;
export const visitPlanPeriodNames:Record<string,string>={weekly:'Semanal',monthly:'Mensal',quarterly:'Trimestral',semiannual:'Semestral'};
export const visitPlanStateNames:Record<string,string>={draft:'Rascunho',published:'Publicado',completed:'Encerrado',cancelled:'Cancelado'};
export interface RegionView{id:string;name:string;state:string;cities:string[];notes:string;active:boolean;version:number}
export interface PortfolioView{id:string;name:string;ownerId:string;ownerName:string;regionId:string|null;regionName:string;notes:string;active:boolean;version:number}
export interface PortfolioPartyView{id:string;name:string;kind:'lead'|'customer';ownerId:string;ownerName:string;portfolioId:string|null;portfolioName:string;regionName:string;version:number}
export interface VisitPlanView{id:string;title:string;portfolioId:string;portfolioName:string;ownerId:string;ownerName:string;period:string;startDate:string;endDate:string;timeZone:string;state:typeof visitPlanStates[number];notes:string;version:number}
export interface VisitPlanItemView{id:string;partyId:string;partyName:string;ownerId:string;startAt:string;endAt:string;durationMinutes:number;objective:string;version:number;activityId:string|null;activityStatus:string;validAssignment:boolean}
export function visitPlanRange(anchorDate:string,period:typeof visitPlanPeriods[number]){
 const date=new Date(anchorDate+'T12:00:00Z');let start=new Date(date),end:Date;
 if(period==='weekly'){start.setUTCDate(start.getUTCDate()-((start.getUTCDay()+6)%7));end=new Date(start);end.setUTCDate(end.getUTCDate()+7);}
 else{const months=period==='monthly'?1:period==='quarterly'?3:6;start=new Date(Date.UTC(date.getUTCFullYear(),Math.floor(date.getUTCMonth()/months)*months,1,12));end=new Date(Date.UTC(start.getUTCFullYear(),start.getUTCMonth()+months,1,12));}
 return {startDate:start.toISOString().slice(0,10),endDate:end.toISOString().slice(0,10)};
}
