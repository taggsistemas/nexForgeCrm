import type {VisitPosition,VisitOutcome} from './field-visits.js';
export interface OfflineParty {id:string;name:string;kind:'lead'|'customer';contactName:string;phone:string;email:string;address:string;ownerId:string;version:number;orderable?:boolean}
export interface OfflineProperty {id:string;partyId:string;name:string}
export interface OfflineEquipment {id:string;partyId:string;propertyId:string;name:string}
/** Catalog for offline orders. The price is the company's general table, only a suggestion: the server applies the customer's table and rules on sync. */
export interface OfflineProduct {id:string;code:string;description:string;kind:'product'|'service';unit:string;quantityDecimals:number;priceCents:number|null}
export interface OfflineActivity {id:string;partyId:string;title:string;type:string;status:string;dueAt:string;version:number;fieldState:string}
export interface OfflineContact {id:string;partyId:string;name:string;phone:string;email:string;position:string}
export interface OfflineSnapshot {capabilities:{activityWrite:boolean;visitWrite:boolean;orderWrite?:boolean;ticketWrite?:boolean};grantId:string;issuedAt:string;expiresAt:string;uploadUntil:string;identity:{userId:string;tenantId:string;companyId:string;userName:string;companyName:string};parties:OfflineParty[];contacts:OfflineContact[];activities:OfflineActivity[];properties?:OfflineProperty[];equipment?:OfflineEquipment[];products?:OfflineProduct[]}
export type OfflinePayload=
 |{kind:'activity';operationId:string;partyId:string;partyVersion:number;capturedAt:string;title:string;type:'ligacao'|'email'|'reuniao'|'tarefa';dueAt:string;notes:string}
 |{kind:'visit';operationId:string;partyId:string;partyVersion:number;capturedAt:string;activityId?:string;activityVersion?:number;observedInAt:string;observedOutAt:string;checkIn:VisitPosition;checkOut:VisitPosition;locationAuthorized:true;outcome:VisitOutcome;notes:string;nextSteps:string}
 |{kind:'order';operationId:string;partyId:string;partyVersion:number;capturedAt:string;items:{productId:string;quantity:string;unitPriceCents:number;discountCents:number}[];expectedDeliveryDate:string;paymentMethod:string;paymentTermDays:number[];notes:string;submit:boolean}
 |{kind:'ticket';operationId:string;partyId:string;partyVersion:number;capturedAt:string;propertyId:string;equipmentId:string|null;criticality:'critico'|'alto'|'programado';title:string;description:string};
export interface OfflineQueueItem {payload:OfflinePayload;state:'pending'|'applied'|'conflict'|'rejected'|'superseded';code?:string;entityId?:string;number?:string;status?:string}
/** Server reply to one synchronized operation. Orders and tickets return their number (and the order status after the rules). */
export interface OfflineSyncResult {operationId:string;entityId:string;replayed:boolean;number?:string;status?:string}
export interface OfflineVisitReportView {observedInAt:string;observedOutAt:string;receivedAt:string;outcome:VisitOutcome;notes:string;nextSteps:string;checkIn:VisitPosition;checkOut:VisitPosition}


