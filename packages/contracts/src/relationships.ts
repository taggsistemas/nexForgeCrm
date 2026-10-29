import type {QualificationSummary} from './qualification.js';
export const customerTypes=['atacado','varejo','outro'] as const;
export const leadStages=['novo','em_contato','qualificado','descartado'] as const;
export type PartyKind='lead'|'customer';
/** Company-configurable lists. Values are option IDs; labels change without rewriting customers. */
export const partyListKinds=['origin','segment','classification','potential','equipmentCategory'] as const;
export type PartyListKind=typeof partyListKinds[number];
export const partyListNames:Readonly<Record<PartyListKind,string>>={origin:'Origem',segment:'Segmento',classification:'Classificação',potential:'Potencial',equipmentCategory:'Categoria de equipamento'};
export const defaultPartyListOptions:Readonly<Record<PartyListKind,readonly string[]>>={
 origin:['Indicação','Prospecção em visita','Feira ou evento','Site ou redes sociais','Telefone ou WhatsApp','Carteira anterior','Outro'],
 segment:['Pecuária leiteira','Pecuária de corte','Agricultura','Agroindústria','Cooperativa','Outro'],
 classification:['A','B','C'],
 potential:['Alto','Médio','Baixo'],
 equipmentCategory:['Ordenhadeira','Robô de ordenha','Tanque de resfriamento','Bomba de vácuo','Sistema de alimentação','Gerador','Outro'],
};
export const contactRoles=['decisor','compras','financeiro','tecnico','proprietario','operacao','outro'] as const;
export const contactRoleNames:Readonly<Record<typeof contactRoles[number],string>>={decisor:'Decisor',compras:'Compras',financeiro:'Financeiro',tecnico:'Técnico',proprietario:'Proprietário',operacao:'Operação',outro:'Outro'};
export const contactChannels=['telefone','whatsapp','email','visita'] as const;
export const contactChannelNames:Readonly<Record<typeof contactChannels[number],string>>={telefone:'Telefone',whatsapp:'WhatsApp',email:'E-mail',visita:'Visita presencial'};
export interface PartyClassification {originId:string|null;segmentId:string|null;classificationId:string|null;potentialId:string|null}
export interface PartyView extends PartyClassification {
 qualification?:QualificationSummary;id:string;portfolioId?:string|null;kind:PartyKind;name:string;contactName:string;legalName:string;taxId:string;stateRegistration:string;
 email:string;phone:string;customerType:typeof customerTypes[number];stage:typeof leadStages[number];
 address:{postalCode:string;street:string;number:string;complement:string;neighborhood:string;city:string;state:string;country:string};
 nextAction:{date:string|null;description:string};technicalOwnerId:string|null;
 ownerId:string;notes:string;version:number;createdAt:string;updatedAt:string;
}
export interface ContactView {id:string;partyId:string;name:string;email:string;phone:string;position:string;notes:string;roles:(typeof contactRoles[number])[];preferredChannel:typeof contactChannels[number]|'';communicationConsent:{granted:boolean;at:string|null};ownerId:string;version:number;createdAt:string;updatedAt:string}
export interface PartyListOptionView {id:string;kind:PartyListKind;label:string;active:boolean;order:number;version:number}
export interface PartyHistoryEntry {action:string;actor:string;at:string;reason:string;changes:{field:string;before:string;after:string}[]}
/** Service location of a customer or lead ("Propriedade" in agribusiness). Territory is the property's own region, not the seller portfolio. */
export interface PropertyView {id:string;partyId:string;name:string;regionId:string|null;regionName:string;address:{postalCode:string;street:string;number:string;complement:string;neighborhood:string;city:string;state:string;country:string};coordinates:{latitude:number;longitude:number}|null;contactIds:string[];notes:string;version:number;createdAt:string;updatedAt:string}
export const equipmentStatuses=['em_operacao','parado','em_manutencao','retirado'] as const;
export const equipmentStatusNames:Readonly<Record<typeof equipmentStatuses[number],string>>={em_operacao:'Em operação',parado:'Parado',em_manutencao:'Em manutenção',retirado:'Retirado'};
/** Installed base item. It belongs to one property of the customer; serial numbers are unique per company when informed. */
export interface EquipmentView {id:string;partyId:string;propertyId:string;propertyName:string;categoryId:string|null;brand:string;model:string;serialNumber:string;status:typeof equipmentStatuses[number];installedAt:string|null;warrantyUntil:string|null;supplier:string;notes:string;version:number;createdAt:string;updatedAt:string}
