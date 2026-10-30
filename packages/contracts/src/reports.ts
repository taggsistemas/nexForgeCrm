import type {XlsxCell,XlsxColumnKind} from './xlsx.js';
/** Order reports. Rows are computed on the server after the role scope (kind permissions and live portfolio or technical scope). */
export const orderReportTypes=['pedidos','vendas','servicos','itens','a_faturar','faturamento','previsao'] as const;
export type OrderReportType=typeof orderReportTypes[number];
export const orderReportInfo:Readonly<Record<OrderReportType,{title:string;description:string;period:'created'|'invoice'|'current';kind?:'venda'|'servico'}>>={
 pedidos:{title:'Pedidos',description:'Todos os pedidos criados no período, com situação, valores, faturado e saldo.',period:'created'},
 vendas:{title:'Vendas',description:'Pedidos de venda criados no período.',period:'created',kind:'venda'},
 servicos:{title:'Serviços',description:'Pedidos de serviço criados no período (horas e peças das OS ou lançamento direto).',period:'created',kind:'servico'},
 itens:{title:'Itens de pedidos',description:'Linhas dos pedidos criados no período e já confirmados: produto/serviço, quantidade e valores.',period:'created'},
 a_faturar:{title:'A faturar',description:'Pedidos confirmados ou entregues com saldo não faturado, hoje (independe do período).',period:'current'},
 faturamento:{title:'Faturamento',description:'Notas fiscais lançadas pelo financeiro com emissão no período.',period:'invoice'},
 previsao:{title:'Previsão de faturamento',description:'Parcelas ainda não faturadas pelos prazos de pagamento, hoje (independe do período).',period:'current'},
};
export interface ReportColumn{key:string;label:string;kind:XlsxColumnKind}
export interface OrderReport{type:OrderReportType;title:string;columns:ReportColumn[];rows:XlsxCell[][];truncated:boolean;filters:{startDate:string;endDate:string};generatedAt:string}
/** Reports a profile may request: kind-specific reports require the matching order kind permission. */
export function availableOrderReports(permissions:readonly string[]){
 if(!permissions.includes('order:read'))return [];
 const sales=permissions.includes('order:sales'),service=permissions.includes('order:service');
 return orderReportTypes.filter(type=>{const kind=orderReportInfo[type].kind;return kind==='venda'?sales:kind==='servico'?service:sales||service;});
}
