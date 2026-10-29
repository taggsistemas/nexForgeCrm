import type {OfflineVisitReportView} from './offline.js';
export const visitOutcomes=['realizada','contato_ausente','cliente_fechado','nao_realizada'] as const;
export type VisitOutcome=typeof visitOutcomes[number];
export interface VisitPosition {latitude:number;longitude:number;accuracy:number}
export interface FieldExecutionView {
 id:string;state:'in_progress'|'completed'|'interrupted';actorId:string;version:number;
 checkedInAt:string;checkedOutAt:string|null;checkIn:VisitPosition;checkOut:VisitPosition|null;
 outcome:VisitOutcome|null;notes:string;nextSteps:string;interruptionReason:string;
}
export interface FieldStopView {
 offlineReport?:OfflineVisitReportView;canExecute:boolean;canInterrupt:boolean;id:string;partyId:string;partyName:string;ownerId:string;ownerName:string;title:string;
 dueAt:string;status:string;version:number;address:string;propertyName:string;regionName:string;equipmentName:string;objective:string;execution:FieldExecutionView|null;
}


