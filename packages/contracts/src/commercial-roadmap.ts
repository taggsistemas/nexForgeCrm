// Escopo futuro declarado: não são endpoints ou um motor comercial já disponível.
export const orderStatuses=['orcamento','aprovado','cancelado','producao_separacao','expedicao','despachado'] as const;
export type OrderStatus=typeof orderStatuses[number];
export const priceTableScopes=['global','cliente','tipo_cliente','vendedor','regiao','equipe'] as const;
export type PriceTableScope=
 | {kind:'global'}
 | {kind:'cliente';customerId:string}
 | {kind:'tipo_cliente';customerType:'atacado'|'varejo'|'outro'}
 | {kind:'vendedor';userId:string}
 | {kind:'regiao';regionId:string}
 | {kind:'equipe';teamId:string};
