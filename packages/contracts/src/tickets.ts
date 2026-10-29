/** Service tickets (chamados). Criticality levels are fixed; their labels are configured per company. */
export const ticketCriticalities=['critico','alto','programado'] as const;
export type TicketCriticality=typeof ticketCriticalities[number];
export const defaultTicketCriticalityNames:Readonly<Record<TicketCriticality,string>>={critico:'Crítico',alto:'Alto',programado:'Programado'};
export const ticketOrigins=['telefone','whatsapp','email','visita','interno','outro'] as const;
export const ticketOriginNames:Readonly<Record<typeof ticketOrigins[number],string>>={telefone:'Telefone',whatsapp:'WhatsApp',email:'E-mail',visita:'Visita',interno:'Interno',outro:'Outro'};
export const ticketStatuses=['aberto','em_atendimento','aguardando_cliente','resolvido','cancelado'] as const;
export type TicketStatus=typeof ticketStatuses[number];
export const ticketStatusNames:Readonly<Record<TicketStatus,string>>={aberto:'Aberto',em_atendimento:'Em atendimento',aguardando_cliente:'Aguardando cliente',resolvido:'Resolvido',cancelado:'Cancelado'};
export const openTicketStatuses=['aberto','em_atendimento','aguardando_cliente'] as const;
export const ticketActions=['first-response','assign','deadline','escalate','status','resolve','cancel'] as const;
export type TicketAction=typeof ticketActions[number];
export interface TicketSettingsView{criticalities:{key:TicketCriticality;label:string}[];version:number}
export interface TicketView{
 id:string;number:string;partyId:string;partyName:string;propertyId:string;propertyName:string;regionId:string|null;regionName:string;equipmentId:string|null;equipmentName:string;
 origin:typeof ticketOrigins[number];criticality:TicketCriticality;title:string;description:string;status:TicketStatus;
 assigneeId:string|null;assigneeName:string;escalationLevel:number;previousTicketId:string|null;previousTicketNumber:string;
 openedAt:string;firstResponseAt:string|null;agreedDeadline:string|null;resolvedAt:string|null;cancelledAt:string|null;solution:string;
 responseMinutes:number|null;resolutionMinutes:number|null;overdue:boolean;canManage:boolean;version:number;
}
export interface TicketEventView{action:string;actor:string;at:string;note:string;fromAssignee:string;toAssignee:string;statusAfter:string}
/** Minutes between two server instants; null while the second instant is missing. */
export function elapsedMinutes(from:string|Date,to:string|Date|null){if(!to)return null;return Math.max(0,Math.round((new Date(to).valueOf()-new Date(from).valueOf())/60000));}
