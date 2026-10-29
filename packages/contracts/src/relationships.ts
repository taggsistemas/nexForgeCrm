export const customerTypes=['atacado','varejo','outro'] as const;
export const leadStages=['novo','em_contato','qualificado','descartado'] as const;
export type PartyKind='lead'|'customer';
export interface PartyView {
 id:string;portfolioId?:string|null;kind:PartyKind;name:string;contactName:string;legalName:string;taxId:string;stateRegistration:string;
 email:string;phone:string;customerType:typeof customerTypes[number];stage:typeof leadStages[number];
 address:{postalCode:string;street:string;number:string;complement:string;neighborhood:string;city:string;state:string;country:string};
 ownerId:string;notes:string;version:number;createdAt:string;updatedAt:string;
}
export interface ContactView {id:string;partyId:string;name:string;email:string;phone:string;position:string;notes:string;ownerId:string;version:number;createdAt:string;updatedAt:string}
