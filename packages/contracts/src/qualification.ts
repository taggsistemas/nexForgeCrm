export const qualificationStates=['none','draft','submitted','revision','approved'] as const;
export type QualificationState=typeof qualificationStates[number];
export const registrationStatuses=['contribuinte','isento','nao_aplicavel'] as const;
export const paymentMethods=['pix','boleto','cartao_credito','cartao_debito','dinheiro','transferencia'] as const;
export interface CommercialConditions {creditLimitCents:number;paymentMethods:typeof paymentMethods[number][];paymentTermDays:number[]}
export interface QualificationSummary {state:QualificationState;revision:number;reviewReason:string;approvedAt:string|null;approvedBy:string|null;commercial:CommercialConditions;registrationStatus:typeof registrationStatuses[number]}
