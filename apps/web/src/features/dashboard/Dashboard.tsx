import {DashboardCharts} from './DashboardCharts';
import {useEffect,useState} from 'react';
import {Modal} from '../../components/Modal';
import {Relationships} from '../relationships/Relationships';

type Account={user:{id?:string;name:string};companies:{id:string;name:string}[];permissions?:string[]};
const funnels=[
 {id:'new',label:'Novos leads',description:'Contatos que ainda precisam de abordagem.',action:'Ver leads',mode:'lead',stage:'novo',group:'progress'},
 {id:'contact',label:'Em contato',description:'Conversas comerciais em andamento.',action:'Acompanhar contatos',mode:'lead',stage:'em_contato',group:'progress'},
 {id:'approval',label:'Aguardando aprovação',description:'Qualificações enviadas para análise administrativa.',action:'Consultar análises',mode:'lead',qualification:'submitted',group:'attention'},
 {id:'revision',label:'Devolvidos para revisão',description:'Cadastros que precisam de correção e reenvio.',action:'Ver o que corrigir',mode:'lead',qualification:'revision',group:'attention'},
 {id:'customers',label:'Clientes qualificados',description:'Cadastros aprovados pelo administrativo.',action:'Consultar clientes',mode:'customer',qualification:'approved',group:'progress'},
 {id:'legacy',label:'Clientes a regularizar',description:'Clientes antigos que ainda precisam de revisão.',action:'Ver regularizações',mode:'customer',qualification:'none',group:'attention'},
] as const;
export function Dashboard({account,pipeline=false,onNavigate}:{account:Account;pipeline?:boolean;onNavigate?:(module:string)=>void}){
 const [refreshKey,setRefreshKey]=useState(0);
 const [company,setCompany]=useState(account.companies[0]?.id??''),[counts,setCounts]=useState<Record<string,number>>({}),[selected,setSelected]=useState<string|null>(null),[error,setError]=useState(''),[loading,setLoading]=useState(true),[updatedAt,setUpdatedAt]=useState<Date|null>(null);
 const allowed=funnels.filter(row=>account.permissions?.includes(row.mode==='lead'?'lead:read':'customer:read'));
 useEffect(()=>{
  const controller=new AbortController();let refreshing=false;
  async function refresh(){
   if(!company||document.hidden||refreshing)return;refreshing=true;
   try{
    const values=await Promise.all(allowed.map(async row=>{
     const query=new URLSearchParams({page:'1',...('stage'in row?{stage:row.stage}:{}),...('qualification'in row?{qualificationState:row.qualification}:{})});
     const res=await fetch('/api/v1/companies/'+company+'/crm/'+(row.mode==='lead'?'leads':'customers')+'?'+query,{signal:controller.signal,cache:'no-store'});
     if(!res.ok)throw Error('Não foi possível atualizar o painel. Confira seu acesso e conexão.');
     const data=await res.json();if(!Number.isSafeInteger(data.total)||data.total<0)throw Error('Indicador indisponível. Tente atualizar novamente.');return [row.id,data.total] as const;
    }));
    if(controller.signal.aborted)return;setCounts(Object.fromEntries(values));setUpdatedAt(new Date());setError('');
   }catch(cause){if(!controller.signal.aborted)setError((cause as Error).message);}
   finally{refreshing=false;if(!controller.signal.aborted)setLoading(false);}
  }
  setCounts({});setUpdatedAt(null);setLoading(true);void refresh();
  const timer=setInterval(()=>void refresh(),15000);window.addEventListener('focus',refresh);
  return()=>{controller.abort();clearInterval(timer);window.removeEventListener('focus',refresh);};
 },[company,account.permissions?.join(','),refreshKey]);
 const active=allowed.find(row=>row.id===selected),attention=allowed.filter(row=>row.group==='attention'),progress=allowed.filter(row=>row.group==='progress');
 const hasAttention=attention.some(row=>(counts[row.id]??0)>0),ready=!loading&&!error&&updatedAt!==null;
 const shortcuts=[
  {id:'relationship',label:'Leads e contatos',hint:'Consultar e cadastrar',permission:'lead:read'},
  {id:'visits',label:'Minha agenda',hint:'Compromissos e visitas',permission:'activity:read'},
  {id:'opportunities',label:'Negociações',hint:'Valores e fechamento',permission:'pipeline:read'},
  {id:'catalog',label:'Produtos e preços',hint:'Consultar catálogo',permission:'catalog:read'},
 ].filter(item=>account.permissions?.includes(item.permission));
 function cards(rows:typeof allowed){return <div className="nf-home-cards">{rows.map(row=>{
  const value=loading?'…':counts[row.id]??'—',pending=row.group==='attention'&&ready&&(counts[row.id]??0)>0;
  return <button key={row.id} data-metric={row.id} className={'nf-home-card'+(pending?' needs-attention':'')} aria-label={row.label+' '+value} onClick={()=>setSelected(row.id)}>
   <span className="nf-home-card-top"><strong>{row.label}</strong><span className="nf-home-count">{value}</span></span>
   <span className="nf-home-description">{row.description}</span><span className="nf-home-card-link">{row.action}<span aria-hidden="true"> →</span></span>
  </button>;
 })}</div>;}
 return <section className={'nf-dashboard nf-home'+(!pipeline?' nf-analytics':'')} aria-label={pipeline?'Resumo do pipeline':'Resumo comercial'}>
  <div className="nf-home-intro"><div><h2>{pipeline?'Do primeiro contato ao cliente':'Olá, '+(account.user.name.trim().split(/\s+/)[0]||'bem-vindo')+'. Por onde começar?'}</h2><p>{pipeline?'Veja os cadastros por situação. Selecione um número para consultar.':'Confira as pendências e continue seu trabalho por aqui.'}</p></div><label>Empresa<select value={company} onChange={event=>{setCompany(event.target.value);setCounts({});setUpdatedAt(null);setSelected(null);}}>{account.companies.map(row=><option key={row.id} value={row.id}>{row.name}</option>)}</select></label><button className="nf-secondary nf-dashboard-refresh" onClick={()=>setRefreshKey(value=>value+1)}>Atualizar painel</button></div>
  {error&&<p role="alert" className="nf-error">{error} {updatedAt?'Os números exibidos são da última atualização.':'Os números ainda não estão disponíveis.'}</p>}
  {attention.length>0&&<section className="nf-home-section" aria-labelledby="home-attention"><div className="nf-home-section-heading"><div><h3 id="home-attention">Precisa de atenção</h3><p>{account.permissions?.includes('qualification:approve')?'Analise os envios e acompanhe as correções.':'Acompanhe a análise e corrija os cadastros devolvidos.'}</p></div>{ready&&!hasAttention&&<span className="nf-home-clear">Nenhuma pendência de qualificação</span>}</div>{cards(attention)}</section>}
  {progress.length>0&&<section className="nf-home-section" aria-labelledby="home-progress"><div className="nf-home-section-heading"><div><h3 id="home-progress">Seu acompanhamento comercial</h3><p>Primeiro contato → conversa → cliente aprovado. Os números mostram a situação atual, sem filtro de período.</p></div></div>{cards(progress)}</section>}
  {!pipeline&&allowed.length>0&&<DashboardCharts company={company} refreshKey={refreshKey}/>}
  {!allowed.length&&<p className="nf-muted">Seu perfil não possui indicadores de leads ou clientes. Use as funções disponíveis no menu.</p>}
  {!pipeline&&onNavigate&&shortcuts.length>0&&<section className="nf-home-shortcuts" aria-label="Acessos rápidos"><h3>Acessos rápidos</h3><div>{shortcuts.map(item=><button key={item.id} className="nf-secondary" onClick={()=>onNavigate(item.id)}><strong>{item.label}</strong><span>{item.hint}</span></button>)}</div></section>}
  <div className="nf-home-footnote"><span role="status" aria-live="polite">{loading?'Carregando indicadores…':updatedAt?'Atualizado às '+updatedAt.toLocaleTimeString('pt-BR',{timeZone:'America/Sao_Paulo',hour:'2-digit',minute:'2-digit'})+' · atualização automática':error?'Atualização pendente':'Sem indicadores disponíveis'}</span><span>Somente dados da empresa e da carteira que você pode acessar.</span></div>
  {!pipeline&&<details className="nf-dashboard-help"><summary>Entenda os termos do CRM</summary><p><strong>Lead:</strong> pessoa ou empresa com quem você iniciou um contato. <strong>Qualificação:</strong> cadastro completo enviado ao administrativo. <strong>Cliente qualificado:</strong> cadastro aprovado. <strong>Oportunidade:</strong> uma negociação com valor e previsão de fechamento.</p><p>Os indicadores não são etapas exclusivas: um lead em contato também pode estar aguardando aprovação. Por isso, os números não devem ser somados como total de cadastros.</p></details>}
  <Modal open={Boolean(active)} title={active?.label??'Cadastros'} onClose={()=>setSelected(null)}>{active&&<Relationships key={company+active.id} account={{...account,companies:account.companies.filter(row=>row.id===company)}} initialMode={active.mode} initialStage={'stage'in active?active.stage:''} initialQualification={'qualification'in active?active.qualification:''}/>}</Modal>
 </section>;
}
