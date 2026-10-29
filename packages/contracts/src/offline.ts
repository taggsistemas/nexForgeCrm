import type {VisitPosition,VisitOutcome} from './field-visits.js';
export interface OfflineParty {id:string;name:string;kind:'lead'|'customer';contactName:string;phone:string;email:string;address:string;ownerId:string;version:number}
export interface OfflineActivity {id:string;partyId:string;title:string;type:string;status:string;dueAt:string;version:number;fieldState:string}
export interface OfflineContact {id:string;partyId:string;name:string;phone:string;email:string;position:string}
export interface OfflineSnapshot {capabilities:{activityWrite:boolean;visitWrite:boolean};grantId:string;issuedAt:string;expiresAt:string;uploadUntil:string;identity:{userId:string;tenantId:string;companyId:string;userName:string;companyName:string};parties:OfflineParty[];contacts:OfflineContact[];activities:OfflineActivity[]}
export type OfflinePayload=
 |{kind:'activity';operationId:string;partyId:string;partyVersion:number;capturedAt:string;title:string;type:'ligacao'|'email'|'reuniao'|'tarefa';dueAt:string;notes:string}
 |{kind:'visit';operationId:string;partyId:string;partyVersion:number;capturedAt:string;activityId?:string;activityVersion?:number;observedInAt:string;observedOutAt:string;checkIn:VisitPosition;checkOut:VisitPosition;locationAuthorized:true;outcome:VisitOutcome;notes:string;nextSteps:string};
export interface OfflineQueueItem {payload:OfflinePayload;state:'pending'|'applied'|'conflict'|'rejected'|'superseded';code?:string;entityId?:string}
export interface OfflineVisitReportView {observedInAt:string;observedOutAt:string;receivedAt:string;outcome:VisitOutcome;notes:string;nextSteps:string;checkIn:VisitPosition;checkOut:VisitPosition}


