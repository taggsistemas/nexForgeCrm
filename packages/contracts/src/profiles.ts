import { permissions, type Permission } from './index.js';
export const profileKeys = ['tenant_admin','manager','sales_admin','supervisor','seller','technician','director','technical_coordinator','auditor','finance','stock'] as const;
export type ProfileKey = typeof profileKeys[number];
export type DataVisibility = 'company' | 'team' | 'own';
const common: Permission[] = ['tenant:read','company:read','region:read','portfolio:read','lead:read','lead:write','qualification:read','qualification:edit','qualification:submit','customer:read','customer:write','contact:read','contact:write','pipeline:read','pipeline:write','activity:read','activity:write','visit:read','visit:write','proposal:read','proposal:write','order:read','order:write','order:sales','order:service','stock:read','order:sales','order:service','catalog:read','goal:read','commission:read','forecast:read','ticket:read','ticket:write'];
export const profileDefinitions: Readonly<Record<ProfileKey,{name:string;visibility:DataVisibility;permissions:readonly Permission[]}>> = {
  tenant_admin:{name:'Administrador do sistema',visibility:'company',permissions:[...permissions]},
  manager:{name:'Gerencial',visibility:'company',permissions:[...common,'user:read','team:manage','region:manage','portfolio:manage','qualification:approve','proposal:approve','order:approve','catalog:manage','list:manage','cost:read','cost:manage','stock:write','purchase:read','purchase:write','purchase:approve','supplier:read','supplier:write','technical:read','goal:manage','commission:manage','report:read']},
  sales_admin:{name:'Administrativo de vendas',visibility:'company',permissions:[...common.filter(value=>!['commission:read','order:service'].includes(value)),'qualification:approve','portfolio:manage','catalog:manage','list:manage']},
  supervisor:{name:'Supervisor',visibility:'team',permissions:[...common,'portfolio:manage','report:read','technical:read']},
  director:{name:'Direção',visibility:'company',permissions:[...common.filter(value=>value.endsWith(':read')),'order:sales','order:service','purchase:read','supplier:read','purchase:approve','technical:read','report:read','qualification:approve','proposal:approve','order:approve','cost:read']},
  technical_coordinator:{name:'Coordenação Técnica',visibility:'team',permissions:['tenant:read','company:read','region:read','technical:read','technical:manage','ticket:read','ticket:write','ticket:manage','order:read','order:service','stock:read']},
  technician:{name:'Técnico',visibility:'own',permissions:['tenant:read','company:read','technical:read','technical:write','ticket:read','stock:read']},
  seller:{name:'Vendedor',visibility:'own',permissions:[...common]},
  // Finance: registers invoices issued in its own system; reads orders, credit and costs; no commercial writes.
  finance:{name:'Financeiro',visibility:'company',permissions:['tenant:read','company:read','region:read','customer:read','contact:read','qualification:read','pipeline:read','proposal:read','order:read','order:sales','order:service','billing:write','cost:read','stock:read','purchase:read','supplier:read','catalog:read','report:read']},
  // Audit consultation: no approvals, compensation, goals or offline packages.
  auditor:{name:'Auditoria',visibility:'company',permissions:[...common.filter(value=>value.endsWith(':read')&&!['commission:read','goal:read','forecast:read'].includes(value)),'order:sales','order:service','purchase:read','supplier:read','technical:read','report:read']},
  // Warehouse and purchasing: stock movements, suppliers and purchase orders; reads catalog costs and orders to plan deliveries.
  stock:{name:'Almoxarifado e compras',visibility:'company',permissions:['tenant:read','company:read','region:read','catalog:read','cost:read','order:read','order:sales','order:service','stock:read','stock:write','purchase:read','purchase:write','supplier:read','supplier:write','report:read']},
};

export const profileDescriptions:Readonly<Record<ProfileKey,string>>={
 tenant_admin:'Administra empresas, usuários e configurações. Acesso operacional às empresas autorizadas.',
 director:'Consulta gerencial e financeira nas empresas autorizadas. Aprova qualificações com crédito, propostas e pedidos; não cria nem edita registros operacionais.',
 manager:'Gerencia a operação comercial e aprova qualificações. Consulta atendimentos técnicos, sem distribuí-los.',
 sales_admin:'Revisa qualificações, organiza carteiras e mantém catálogo e preços. Não coordena atendimentos técnicos.',
 supervisor:'Atua sobre sua carteira e equipe comercial. Consulta técnicos vinculados dentro das regiões autorizadas.',
 seller:'Atua sobre os relacionamentos da própria carteira, agenda e negociações.',
 technical_coordinator:'Faz a triagem e distribui os chamados do seu território; agenda, cancela e interrompe atendimentos da equipe técnica vinculada, dentro das regiões autorizadas. Sem acesso comercial ou financeiro.',
 technician:'Consulta e executa somente atendimentos técnicos e chamados designados a ele. Sem acesso à carteira comercial completa.',
 auditor:'Consulta limitada às empresas autorizadas, sem alterações, aprovações, comissões, metas ou pacote offline.',
 stock:'Registra entradas e saídas manuais do almoxarifado, cadastra fornecedores, emite e recebe pedidos de compra. Pedidos acima do limite da empresa dependem da gerência.',
 finance:'Lança as notas fiscais emitidas no sistema financeiro, acompanha pedidos, previsão de faturamento, custos e margens. Não altera cadastros nem negociações.'
};
