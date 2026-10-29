import { permissions, type Permission } from './index.js';
export const profileKeys = ['tenant_admin','manager','sales_admin','supervisor','seller','technician'] as const;
export type ProfileKey = typeof profileKeys[number];
export type DataVisibility = 'company' | 'team' | 'own';
const common: Permission[] = ['tenant:read','company:read','region:read','portfolio:read','lead:read','lead:write','qualification:edit','qualification:submit','customer:read','customer:write','contact:read','contact:write','pipeline:read','pipeline:write','activity:read','activity:write','visit:read','visit:write','proposal:read','proposal:write','order:read','order:write','catalog:read','goal:read','commission:read','forecast:read'];
export const profileDefinitions: Readonly<Record<ProfileKey,{name:string;visibility:DataVisibility;permissions:readonly Permission[]}>> = {
  tenant_admin:{name:'Administrador do sistema',visibility:'company',permissions:[...permissions]},
  manager:{name:'Gerencial',visibility:'company',permissions:[...common,'user:read','team:manage','region:manage','portfolio:manage','qualification:approve','proposal:approve','order:approve','catalog:manage','technical:read','technical:manage','goal:manage','commission:manage','report:read']},
  sales_admin:{name:'Administrativo de vendas',visibility:'company',permissions:[...common.filter(value=>value!=='commission:read'),'qualification:approve','portfolio:manage','catalog:manage','technical:read','technical:manage']},
  supervisor:{name:'Supervisor',visibility:'team',permissions:[...common,'portfolio:manage','report:read','technical:read']},
  technician:{name:'Técnico',visibility:'own',permissions:['tenant:read','company:read','technical:read','technical:write']},
  seller:{name:'Vendedor',visibility:'own',permissions:[...common]},
};
