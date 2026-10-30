import {TechnicalWorkspace} from './features/technical/TechnicalWorkspace';
import {Tickets} from './features/tickets/Tickets';
import {Indicators} from './features/indicators/Indicators';
import {Orders} from './features/orders/Orders';
import {Reports} from './features/reports/Reports';
import {Catalog} from './features/catalog/Catalog';
import {Dashboard} from './features/dashboard/Dashboard';
import {OfflineWorkspace} from './features/offline/OfflineWorkspace';
import {FieldVisits} from './features/field-visits/FieldVisits';
import {Territories} from './features/territories/Territories';
import {Agenda} from './features/agenda/Agenda';
import {Opportunities} from './features/opportunities/Opportunities';
import {Relationships} from './features/relationships/Relationships';
import {AccountOnboarding} from './features/account-security/AccountSecurity';
import { UserAdministration } from './features/administration/UserAdministration';
import { useEffect, useRef, useState } from 'react';
import { IdentityPanel, useIdentity } from './features/identity/IdentityPanel';
import { BrandPanel } from './components/BrandPanel';
import { ThemeToggle } from './components/ThemeToggle';
const modules = [
  {id:'overview',group:'GERAL',title:'Visão geral',icon:'VG',description:'Sua empresa e os acessos do NexForge CRM.'},
  {id:'relationship',group:'RELACIONAMENTO',title:'Leads, clientes e contatos',icon:'RC',description:'Organização dos relacionamentos e contatos comerciais.'},
  {id:'pipeline',group:'COMERCIAL',title:'Pipeline comercial',icon:'PC',description:'Captação, contato e qualificação de leads.'},
  {id:'opportunities',group:'COMERCIAL',title:'Oportunidades',icon:'OP',description:'Valores, fechamento, ganho/perda e atividades vinculadas.'},
  {id:'visits',group:'ATIVIDADES E VISITAS',title:'Agenda e visitas',icon:'AV',description:'Planejamento, roteiros e registro em campo.'},
  {id:'offline',group:'ATIVIDADES E VISITAS',title:'Operação offline',icon:'OF',description:'Carteira criptografada, registros locais e sincronização.'},
  {id:'field',group:'ATIVIDADES E VISITAS',title:'Rotas e visitas em campo',icon:'RV',description:'Roteiro diário, check-in, check-out e resultados.'},
  {id:'territories',group:'ATIVIDADES E VISITAS',title:'Carteiras e planejamento',icon:'CP',description:'Regiões, vendedores, carteiras e planos de visitas.'},
  {id:'catalog',group:'VENDAS',title:'Catálogo e preços',icon:'CT',description:'Produtos, caixas e tabelas de preços por abrangência.'},
  {id:'tickets',group:'SERVIÇOS',title:'Chamados',icon:'CH',description:'Abertura, triagem, distribuição e acompanhamento de chamados.'},
  {id:'technical',group:'SERVIÇOS',title:'Agenda e rota técnica',icon:'TC',description:'Atendimentos técnicos atribuídos, roteiro e execução.'},
  {id:'orders',group:'VENDAS',title:'Pedidos de venda e serviço',icon:'PV',description:'Pedidos fechados, aprovações, entregas, notas lançadas e previsão de faturamento.'},
  {id:'management',group:'GESTÃO',title:'Central gerencial',icon:'CG',description:'Indicadores comerciais, técnicos e gerenciais com filtros por território, responsável e período.'},
  {id:'reports',group:'GESTÃO',title:'Relatórios',icon:'RL',description:'Pedidos, vendas, serviços, itens, a faturar, faturamento e previsão em Excel.'},
  {id:'administration',group:'CONFIGURAÇÕES',title:'Usuários e equipes',icon:'CF',description:'Usuários, perfis e equipes das empresas autorizadas.'},
];
export function App() {
  const identity = useIdentity();
  const [offlinePortal,setOfflinePortal]=useState(!navigator.onLine);
  const [online,setOnline] = useState(navigator.onLine);
  const [menu,setMenu] = useState(false);
  const menuRef=useRef<HTMLElement>(null),menuButton=useRef<HTMLButtonElement>(null);
  useEffect(()=>{if(!menu)return;const media=window.matchMedia('(max-width:800px)');if(!media.matches)return;const panel=menuRef.current;panel?.querySelector<HTMLButtonElement>('button')?.focus();const key=(event:KeyboardEvent)=>{if(event.key==='Escape'){event.preventDefault();setMenu(false);}if(event.key==='Tab'){const items=[...panel!.querySelectorAll<HTMLElement>('button,input,a[href]')].filter(el=>!el.hasAttribute('disabled'));const first=items[0],last=items.at(-1);if(event.shiftKey&&document.activeElement===first){event.preventDefault();last?.focus();}else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first?.focus();}}};const resize=()=>{if(!media.matches)setMenu(false);};document.addEventListener('keydown',key);media.addEventListener('change',resize);return()=>{document.removeEventListener('keydown',key);media.removeEventListener('change',resize);menuButton.current?.focus({preventScroll:true});};},[menu]);
  const [search,setSearch] = useState('');
  const [selected,setSelected] = useState('overview');
  useEffect(() => {
    const update=()=>{setOnline(navigator.onLine);if(!navigator.onLine&&selected!=='offline')setOfflinePortal(true);};
    window.addEventListener('online',update); window.addEventListener('offline',update);
    return ()=> {window.removeEventListener('online',update);window.removeEventListener('offline',update);};
  },[selected]);
  useEffect(()=>{if(identity.networkUnavailable&&selected!=='offline')setOfflinePortal(true);},[identity.networkUnavailable,selected]);
  useEffect(()=>{setSelected('overview');setMenu(false);},[identity.account?.user.id,identity.account?.tenant.id]);
  const connection=<span className="nf-connection" role="status"><i className={online ? 'nf-dot' : 'nf-dot offline'}/>{online ? 'Conexão disponível' : 'Sem conexão'}</span>;
  if(offlinePortal)return <main className="nf-content"><OfflineWorkspace networkUnavailable={identity.networkUnavailable} account={identity.account??undefined} onClose={()=>setOfflinePortal(false)}/></main>;
  if(identity.checking) return <div className="nf-loading" role="status">Verificando sessão...</div>;
  if(!identity.account) return <main className="nf-login"><div className="nf-login-tools">{connection}<ThemeToggle/></div><div className="nf-login-layout"><BrandPanel/><div><IdentityPanel identity={identity}/></div></div></main>;
  const account=identity.account;
  if(account.security?.mustChangePassword||account.security?.privacyAcceptanceRequired)return <AccountOnboarding mustChangePassword={account.security.mustChangePassword} tenantName={account.tenant.name} onLogout={identity.logout}/>;
  const technicianOnly=account.permissions?.includes('technical:read')&&!account.permissions?.includes('lead:read');
  const availableModules=modules.filter(item=>(!technicianOnly||['overview','technical','tickets','management','orders','reports'].includes(item.id))&&(item.id!=='tickets'||account.permissions?.includes('ticket:read'))&&(item.id!=='technical'||account.permissions?.includes('technical:read'))&&(item.id!=='catalog'||account.permissions?.includes('catalog:read'))&&(item.id!=='orders'||account.permissions?.includes('order:read'))&&(item.id!=='reports'||account.permissions?.includes('order:read'))&&(item.id!=='offline'||account.permissions?.includes('activity:write'))&&(item.id!=='field'||account.permissions?.includes('visit:read'))&&(item.id!=='territories'||account.permissions?.some(value=>['region:read','portfolio:read','visit:read'].includes(value)))&&(item.id!=='visits'||account.permissions?.includes('activity:read'))&&(item.id!=='opportunities'||account.permissions?.includes('pipeline:read'))&&(item.id!=='pipeline'||account.permissions?.includes('lead:read'))&&(item.id!=='administration'||account.permissions?.includes('user:manage'))&&(!['relationship','pipeline'].includes(item.id)||account.permissions?.some(permission=>['lead:read','customer:read','contact:read'].includes(permission))));
  const current=modules.find(item=>item.id===selected)!;
  return <div className="nf-shell"><a className="nf-skip-link" href="#crm-main">Ir para o conteúdo</a>{menu&&<button className="nf-menu-backdrop" aria-label="Fechar menu de navegação" onClick={()=>setMenu(false)}/>}
    <aside ref={menuRef} id="crm-navigation" className={'nf-sidebar '+(menu?'is-open':'')} aria-label="Menu do CRM"><button type="button" className="nf-sidebar-close" onClick={()=>setMenu(false)} aria-label="Fechar menu" title="Fechar menu">✕</button>
      <a className="nf-sidebar-brand" href="/" aria-label="NexForge CRM"><img src="/brand/tagg-logo-compact.png" alt="TAGG Sistemas"/><strong>NexForge <b>CRM</b></strong><small>Plataforma Comercial Integrada</small></a>
      <label className="nf-menu-search">BUSCAR FUNÇÃO<input value={search} onChange={event=>setSearch(event.target.value)} placeholder="Digite para localizar um módulo"/></label>
      <nav aria-label="Navegação principal">{[...new Set(availableModules.map(item=>item.group))].map(group=>{const items=availableModules.filter(item=>item.group===group&&item.title.toLocaleLowerCase('pt-BR').includes(search.toLocaleLowerCase('pt-BR')));return items.length?<div className="nf-menu-group" key={group}><span>{group}</span>{items.map(item=><button key={item.id} type="button" className={selected===item.id?'is-active':''} onClick={()=>{setSelected(item.id);setMenu(false);}} aria-current={selected===item.id?'page':undefined}><i aria-hidden="true">{item.icon}</i><span>{item.title}</span></button>)}</div>:null;})}</nav>
      <small className="nf-sidebar-footer">NexForge by TAGG Sistemas</small>
    </aside>
    <div className="nf-workspace"><header className="nf-topbar"><div className="nf-topbar-brand"><button ref={menuButton} aria-controls="crm-navigation" className="nf-menu-toggle nf-secondary" onClick={()=>setMenu(!menu)} aria-label="Abrir ou fechar menu" aria-expanded={menu}>☰</button><strong>NexForge <span>• CRM</span></strong></div><div className="nf-user"><div><strong>{account.user.name}</strong><small>{account.tenant.name}</small><small>{account.profiles?.map(profile=>profile.name).join(', ')}</small></div><ThemeToggle/><button className="nf-secondary" onClick={identity.logout} disabled={identity.busy}>Encerrar sessão</button></div></header>
      <main id="crm-main" tabIndex={-1} className="nf-content"><div className="nf-page-heading"><div><span className="nf-breadcrumb">Início / {current.title}</span><h1>{selected==='overview'?(account.permissions?.includes('technical:read')&&!account.permissions?.includes('lead:read')?(account.permissions?.includes('technical:manage')?'Coordenação técnica':'Minha rota técnica'):'Dashboard comercial'):current.title}</h1><p>{account.tenant.name}</p></div>{connection}</div>
      {identity.message && <p role="alert" className="nf-error">{identity.message}</p>}
      {selected==='technical'||selected==='overview'&&account.permissions?.includes('technical:read')&&!account.permissions?.includes('lead:read')?<TechnicalWorkspace account={account}/>:selected==='overview'?<Dashboard account={account} onNavigate={module=>setSelected(module)}/>:selected==='pipeline'?<Dashboard account={account} pipeline/>:selected==='tickets'?<Tickets account={account}/>:selected==='management'?<Indicators account={account}/>:selected==='orders'?<Orders account={account}/>:selected==='reports'?<Reports account={account}/>:selected==='catalog'?<Catalog account={account}/>:selected==='offline'?<OfflineWorkspace networkUnavailable={identity.networkUnavailable} account={account}/>:selected==='field'?<FieldVisits account={account}/>:selected==='territories'?<Territories account={account}/>:selected==='visits'?<Agenda account={account}/>:selected==='opportunities'?<Opportunities account={account}/>:selected==='relationship'?<Relationships key={selected} account={account}/>:selected==='administration'&&account.permissions?.includes('user:manage')?<UserAdministration companies={account.companies}/>:<section className="nf-panel nf-empty"><span className="nf-module-icon">{current.icon}</span><h2>{current.title}</h2><p>{current.description}</p><span className="nf-badge">Módulo em desenvolvimento</span><p>Este módulo ainda não está disponível para operação.</p><button className="nf-secondary" onClick={()=>setSelected('overview')}>Voltar à visão geral</button></section>}
      </main><footer className="nf-footer">NexForge Plataforma Comercial Integrada — by TAGG Sistemas</footer>
    </div>
  </div>;
}

