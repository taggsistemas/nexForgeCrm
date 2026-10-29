import {Territories} from './features/territories/Territories';
import {Agenda} from './features/agenda/Agenda';
import {Opportunities} from './features/opportunities/Opportunities';
import {Relationships} from './features/relationships/Relationships';
import {AccountOnboarding} from './features/account-security/AccountSecurity';
import { UserAdministration } from './features/administration/UserAdministration';
import { useEffect, useState } from 'react';
import { IdentityPanel, useIdentity } from './features/identity/IdentityPanel';
import { BrandPanel } from './components/BrandPanel';
import { ThemeToggle } from './components/ThemeToggle';
const modules = [
  {id:'overview',group:'GERAL',title:'Visão geral',icon:'VG',description:'Sua empresa e os acessos do NexForge CRM.'},
  {id:'relationship',group:'RELACIONAMENTO',title:'Leads, clientes e contatos',icon:'RC',description:'Organização dos relacionamentos e contatos comerciais.'},
  {id:'pipeline',group:'COMERCIAL',title:'Pipeline comercial',icon:'PC',description:'Captação, contato e qualificação de leads.'},
  {id:'opportunities',group:'COMERCIAL',title:'Oportunidades',icon:'OP',description:'Valores, fechamento, ganho/perda e atividades vinculadas.'},
  {id:'visits',group:'ATIVIDADES E VISITAS',title:'Agenda e visitas',icon:'AV',description:'Planejamento, roteiros e registro em campo.'},
  {id:'territories',group:'ATIVIDADES E VISITAS',title:'Carteiras e planejamento',icon:'CP',description:'Regiões, vendedores, carteiras e planos de visitas.'},
  {id:'proposals',group:'VENDAS',title:'Propostas e pedidos',icon:'VP',description:'Negociação, aprovações e histórico comercial.'},
  {id:'management',group:'GESTÃO',title:'Central gerencial',icon:'CG',description:'Metas, comissões, forecast e acompanhamento.'},
  {id:'administration',group:'CONFIGURAÇÕES',title:'Usuários e equipes',icon:'CF',description:'Usuários, perfis e equipes das empresas autorizadas.'},
];
export function App() {
  const identity = useIdentity();
  const [online,setOnline] = useState(navigator.onLine);
  const [menu,setMenu] = useState(false);
  const [search,setSearch] = useState('');
  const [selected,setSelected] = useState('overview');
  useEffect(() => {
    const update=()=>setOnline(navigator.onLine);
    window.addEventListener('online',update); window.addEventListener('offline',update);
    return ()=> {window.removeEventListener('online',update);window.removeEventListener('offline',update);};
  },[]);
  const connection=<span className="nf-connection" role="status"><i className={online ? 'nf-dot' : 'nf-dot offline'}/>{online ? 'Conexão disponível' : 'Sem conexão'}</span>;
  if(identity.checking) return <div className="nf-loading" role="status">Verificando sessão...</div>;
  if(!identity.account) return <main className="nf-login"><div className="nf-login-tools">{connection}<ThemeToggle/></div><div className="nf-login-layout"><BrandPanel/><IdentityPanel identity={identity}/></div></main>;
  const account=identity.account;
  if(account.security?.mustChangePassword||account.security?.privacyAcceptanceRequired)return <AccountOnboarding mustChangePassword={account.security.mustChangePassword} tenantName={account.tenant.name} onLogout={identity.logout}/>;
  const availableModules=modules.filter(item=>(item.id!=='territories'||account.permissions?.some(value=>['region:read','portfolio:read','visit:read'].includes(value)))&&(item.id!=='visits'||account.permissions?.includes('activity:read'))&&(item.id!=='opportunities'||account.permissions?.includes('pipeline:read'))&&(item.id!=='pipeline'||account.permissions?.includes('lead:read'))&&(item.id!=='administration'||account.permissions?.includes('user:manage'))&&(!['relationship','pipeline'].includes(item.id)||account.permissions?.some(permission=>['lead:read','customer:read','contact:read'].includes(permission))));
  const current=modules.find(item=>item.id===selected)!;
  return <div className="nf-shell">
    <aside className={'nf-sidebar '+(menu?'is-open':'')} aria-label="Menu do CRM">
      <a className="nf-sidebar-brand" href="/" aria-label="NexForge CRM"><img src="/brand/tagg-logo-compact.png" alt="TAGG Sistemas"/><strong>NexForge <b>CRM</b></strong><small>Plataforma Comercial Integrada</small></a>
      <label className="nf-menu-search">BUSCAR FUNÇÃO<input value={search} onChange={event=>setSearch(event.target.value)} placeholder="Digite para localizar um módulo"/></label>
      <nav aria-label="Navegação principal">{availableModules.filter(item=>item.title.toLocaleLowerCase('pt-BR').includes(search.toLocaleLowerCase('pt-BR'))).map(item=><div className="nf-menu-group" key={item.id}><span>{item.group}</span><button type="button" className={selected===item.id?'is-active':''} onClick={()=>{setSelected(item.id);setMenu(false);}} aria-current={selected===item.id?'page':undefined}><i aria-hidden="true">{item.icon}</i><span>{item.title}</span></button></div>)}</nav>
      <small className="nf-sidebar-footer">NexForge by TAGG Sistemas</small>
    </aside>
    <div className="nf-workspace"><header className="nf-topbar"><div className="nf-topbar-brand"><button className="nf-menu-toggle nf-secondary" onClick={()=>setMenu(!menu)} aria-label="Abrir ou fechar menu" aria-expanded={menu}>☰</button><strong>NexForge <span>• CRM</span></strong></div><div className="nf-user"><div><strong>{account.user.name}</strong><small>{account.tenant.name}</small><small>{account.profiles?.map(profile=>profile.name).join(', ')}</small></div><ThemeToggle/><button className="nf-secondary" onClick={identity.logout} disabled={identity.busy}>Encerrar sessão</button></div></header>
      <main className="nf-content"><div className="nf-page-heading"><div><span className="nf-breadcrumb">Início / {current.title}</span><h1>{selected==='overview'?'Dashboard comercial':current.title}</h1><p>{account.tenant.name}</p></div>{connection}</div>
      {identity.message && <p role="alert" className="nf-error">{identity.message}</p>}
      {selected==='overview'?<>
        <section className="nf-panel"><div className="nf-section-heading"><h2>Seu ambiente de trabalho</h2><span className="nf-badge">Acesso ativo</span></div><div className="nf-account-grid"><div><small>EMPRESA CLIENTE</small><strong>{account.tenant.name}</strong></div><div><small>USUÁRIO</small><strong>{account.user.name}</strong><span>{account.user.email}</span></div><div><small>EMPRESAS AUTORIZADAS</small>{account.companies.map(company=><strong key={company.id}>{company.name}</strong>)}</div></div></section>
        <div className="nf-section-heading"><h2>Operação comercial</h2><span className="nf-muted">Módulos do CRM</span></div><section className="nf-module-grid">{availableModules.slice(1).map(item=><button className="nf-module-card" key={item.id} onClick={()=>setSelected(item.id)}><span className="nf-module-icon">{item.icon}</span><span className="nf-badge">{['administration','relationship','pipeline','opportunities','visits','territories'].includes(item.id)?'Disponível':'Em desenvolvimento'}</span><strong>{item.title}</strong><p>{item.description}</p></button>)}</section>
      </>:selected==='territories'?<Territories account={account}/>:selected==='visits'?<Agenda account={account}/>:selected==='opportunities'?<Opportunities account={account}/>:['relationship','pipeline'].includes(selected)?<Relationships key={selected} account={account} initialPipeline={selected==='pipeline'}/>:selected==='administration'&&account.permissions?.includes('user:manage')?<UserAdministration companies={account.companies}/>:<section className="nf-panel nf-empty"><span className="nf-module-icon">{current.icon}</span><h2>{current.title}</h2><p>{current.description}</p><span className="nf-badge">Módulo em desenvolvimento</span><p>Este módulo ainda não está disponível para operação.</p><button className="nf-secondary" onClick={()=>setSelected('overview')}>Voltar à visão geral</button></section>}
      </main><footer className="nf-footer">NexForge Plataforma Comercial Integrada — by TAGG Sistemas</footer>
    </div>
  </div>;
}
