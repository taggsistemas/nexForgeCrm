import {useEffect,useState} from 'react';
import {Modal} from '../../components/Modal';
import {IndicatorCharts} from './IndicatorCharts';
import {ReportTable,downloadXlsx} from '../../components/ReportTable';
import {addCalendarDays,dateParts} from '../../../../../packages/contracts/src/agenda';
import {indicatorCsv,indicatorDrillable,indicatorText,indicatorViewNames,indicatorViews,type IndicatorDetail,type IndicatorReport,type IndicatorSectionKey,type IndicatorView} from '../../../../../packages/contracts/src/indicators';
type Account={companies:{id:string;name:string}[];permissions?:string[]};
type Option={id:string;name:string};
async function lookup(company:string,path:string,signal:AbortSignal){const response=await fetch('/api/v1/companies/'+company+path,{credentials:'same-origin',cache:'no-store',signal});return response.ok?response.json():{items:[]};}
/** Management indicators with shared filters. Values come from the server after the profile scope; the page never totals records itself. */
export function Indicators({account}:{account:Account}){
 const permissions=account.permissions??[],commercial=permissions.includes('lead:read')||permissions.includes('customer:read'),technical=permissions.includes('ticket:read')||permissions.includes('technical:read');
 const today=dateParts(new Date(),'America/Sao_Paulo').date;
 const [company,setCompany]=useState(account.companies[0]?.id??''),[view,setView]=useState<IndicatorView>(commercial&&technical?'gerencial':commercial?'comercial':'tecnica'),[startDate,setStartDate]=useState(addCalendarDays(today,-29)),[endDate,setEndDate]=useState(today),[regionId,setRegionId]=useState(''),[ownerId,setOwnerId]=useState(''),[refresh,setRefresh]=useState(0);
 const [detail,setDetail]=useState<{section:IndicatorSectionKey;key:string;data:IndicatorDetail|null;error:string}|null>(null);
 const [report,setReport]=useState<IndicatorReport|null>(null),[loading,setLoading]=useState(false),[error,setError]=useState(''),[regions,setRegions]=useState<Option[]>([]),[owners,setOwners]=useState<Option[]>([]);
 useEffect(()=>{
  const controller=new AbortController();setRegions([]);setOwners([]);setRegionId('');setOwnerId('');
  if(permissions.includes('region:read'))lookup(company,'/territories/options?kind=regions',controller.signal).then(data=>setRegions(data.items??[])).catch(()=>{});
  if(permissions.includes('activity:read'))lookup(company,'/agenda/owners',controller.signal).then(data=>setOwners(data.items??[])).catch(()=>{});
  else if(permissions.includes('ticket:manage'))lookup(company,'/tickets/assignees',controller.signal).then(data=>setOwners(data.items??[])).catch(()=>{});
  return()=>controller.abort();
 },[company]);
 useEffect(()=>{
  if(!startDate||!endDate||endDate<startDate){setError('Informe um período válido.');return;}
  const controller=new AbortController();setLoading(true);setError('');
  const query=new URLSearchParams({view,startDate,endDate,...(regionId?{regionId}:{}),...(ownerId?{ownerId}:{})});setDetail(null);
  fetch('/api/v1/companies/'+company+'/indicators?'+query,{credentials:'same-origin',cache:'no-store',signal:controller.signal})
   .then(async response=>{if(!response.ok)throw Error(response.status===400?'Período de até 366 dias, com data final posterior à inicial.':'Não foi possível carregar os indicadores.');return response.json();})
   .then(data=>setReport(data)).catch(cause=>{if(!controller.signal.aborted){setReport(null);setError((cause as Error).message);}}).finally(()=>{if(!controller.signal.aborted)setLoading(false);});
  return()=>controller.abort();
 },[company,view,startDate,endDate,regionId,ownerId,refresh]);
 async function openDetail(section:IndicatorSectionKey,key:string){
  setDetail({section,key,data:null,error:''});
  try{const query=new URLSearchParams({section,key,view,startDate,endDate,...(regionId?{regionId}:{}),...(ownerId?{ownerId}:{})}),response=await fetch('/api/v1/companies/'+company+'/indicators/details?'+query,{credentials:'same-origin',cache:'no-store'});
   if(!response.ok)throw Error(response.status===403?'Seu perfil não tem acesso a estes registros.':'Não foi possível carregar os registros.');
   const data=await response.json() as IndicatorDetail;setDetail(current=>current?.section===section&&current.key===key?{section,key,data,error:''}:current);}
  catch(cause){setDetail(current=>current?.section===section&&current.key===key?{section,key,data:null,error:(cause as Error).message}:current);}
 }
 function exportCsv(){
  if(!report)return;
  const blob=new Blob(['﻿'+indicatorCsv(report)],{type:'text/csv;charset=utf-8'}),url=URL.createObjectURL(blob),link=document.createElement('a');
  link.href=url;link.download='indicadores-'+report.view+'-'+report.filters.startDate+'-a-'+report.filters.endDate+'.csv';document.body.appendChild(link);link.click();link.remove();URL.revokeObjectURL(url);
 }
 const views=indicatorViews.filter(item=>item==='gerencial'?commercial&&technical:item==='comercial'?commercial:technical);
 return <section className="nf-crm nf-indicators">
  <div className="nf-crm-toolbar"><label>Empresa<select value={company} onChange={event=>setCompany(event.target.value)}>{account.companies.map(item=><option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
   <div role="tablist" aria-label="Visão dos indicadores">{views.map(item=><button key={item} type="button" role="tab" aria-selected={view===item} className={view===item?'nf-primary':'nf-secondary'} onClick={()=>setView(item)}>{indicatorViewNames[item]}</button>)}</div>
   <button type="button" className="nf-secondary" disabled={!report||loading} onClick={exportCsv}>Exportar CSV</button></div>
  <section className="nf-panel"><div className="nf-admin-grid nf-indicator-filters">
   <label>Início<input type="date" required value={startDate} onChange={event=>setStartDate(event.target.value)}/></label><label>Fim<input type="date" required value={endDate} onChange={event=>setEndDate(event.target.value)}/></label>
   {regions.length>0&&<label>Território<select value={regionId} onChange={event=>setRegionId(event.target.value)}><option value="">Todos</option>{regions.map(item=><option key={item.id} value={item.id}>{item.name}</option>)}</select></label>}
   {owners.length>0&&<label>Responsável<select value={ownerId} onChange={event=>setOwnerId(event.target.value)}><option value="">Todos do meu acesso</option>{owners.map(item=><option key={item.id} value={item.id}>{item.name}</option>)}</select></label>}
  </div><p className="nf-muted">Valores calculados no servidor para o seu acesso, com datas em São Paulo. Território é a região da propriedade; responsável é o dono da carteira (comercial), o designado do chamado ou o técnico da OS. Valores comerciais não são receita nem faturamento.</p>
   <button type="button" className="nf-secondary" disabled={loading} onClick={()=>setRefresh(value=>value+1)}>Atualizar</button></section>
  {error&&<p role="alert" className="nf-error">{error}</p>}
  {report&&<IndicatorCharts charts={report.charts??[]}/>}
  {loading&&!report?<p role="status">Calculando indicadores...</p>:report&&(!report.sections.length?<p className="nf-muted">Seu perfil não possui indicadores nesta visão.</p>:report.sections.map(section=><section key={section.key} className="nf-panel nf-indicator-section" aria-labelledby={'indicator-'+section.key}>
   <h2 id={'indicator-'+section.key}>{section.title}</h2>
   <div className="nf-indicator-grid">{section.indicators.map(item=>indicatorDrillable(section.key,item.key)?<button type="button" key={item.key} className={'nf-indicator-card is-drill'+(detail?.section===section.key&&detail.key===item.key?' is-active':'')} aria-haspopup="dialog" onClick={()=>void openDetail(section.key,item.key)}><span>{item.label}</span><strong>{indicatorText(item)}</strong><small>{item.definition}</small><em>Ver registros</em></button>:<article key={item.key} className="nf-indicator-card"><span>{item.label}</span><strong>{indicatorText(item)}</strong><small>{item.definition}</small></article>)}</div>
  </section>))}
  <Modal open={Boolean(detail)} title={detail?detail.data?.title??report?.sections.find(item=>item.key===detail.section)?.indicators.find(item=>item.key===detail.key)?.label??'Registros':''} onClose={()=>setDetail(null)}>
   {detail&&<div className="nf-indicator-detail">
    {detail.error?<p role="alert" className="nf-error">{detail.error}</p>:!detail.data?<p role="status">Carregando registros...</p>:<>
     <div className="nf-section-heading"><p className="nf-muted">{detail.data.note}</p><span>{detail.data.rows.length} registro(s)</span>{detail.data.rows.length>0&&<button type="button" className="nf-secondary" onClick={()=>downloadXlsx('detalhe-'+detail.section+'-'+detail.key+'-'+startDate+'-a-'+endDate+'.xlsx',detail.data!.title,detail.data!.columns,detail.data!.rows)}>Baixar Excel</button>}</div>
     {detail.data.truncated&&<p className="nf-warning">Exibindo os primeiros 500 registros. Refine os filtros para ver todos.</p>}
     {!detail.data.rows.length?<p className="nf-muted">Nenhum registro.</p>:<ReportTable columns={detail.data.columns} rows={detail.data.rows} limit={100}/>}</>}
   </div>}
  </Modal>
  {report&&<p className="nf-muted">Atualizado em {new Date(report.asOf).toLocaleString('pt-BR',{timeZone:'America/Sao_Paulo',dateStyle:'short',timeStyle:'short'})}.</p>}
 </section>;
}
