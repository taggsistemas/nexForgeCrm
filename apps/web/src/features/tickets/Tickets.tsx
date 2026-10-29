import {useEffect,useState,type FormEvent} from 'react';
import {Modal} from '../../components/Modal';
import {HistoryTimeline} from '../../components/HistoryTimeline';
import {WorkOrderList} from '../technical/WorkOrderList';
import {defaultTicketCriticalityNames,ticketCriticalities,ticketOrigins,ticketOriginNames,ticketStatusNames,openTicketStatuses,type TicketAction,type TicketCriticality,type TicketEventView,type TicketSettingsView,type TicketView} from '../../../../../packages/contracts/src/tickets';
type Account={companies:{id:string;name:string}[];permissions?:string[]};
type Option={id:string;name:string;propertyId?:string};
const when=(value:string|null)=>value?new Date(value).toLocaleString('pt-BR',{timeZone:'America/Sao_Paulo',dateStyle:'short',timeStyle:'short'}):'—';
const duration=(minutes:number|null)=>minutes===null?'—':minutes<60?minutes+' min':minutes<1440?Math.floor(minutes/60)+' h '+(minutes%60)+' min':Math.floor(minutes/1440)+' d '+Math.floor(minutes%1440/60)+' h';
const eventNames:Record<string,string>={work_order_created:'OS aberta',opened:'Chamado aberto',first_response:'Primeiro retorno',assigned:'Designação',deadline_set:'Prazo pactuado',escalated:'Escalonamento',status_changed:'Situação alterada',resolved:'Chamado resolvido',cancelled:'Chamado cancelado'};
const actionNames:Record<TicketAction,string>={'first-response':'Registrar primeiro retorno',assign:'Designar responsável',deadline:'Definir prazo pactuado',escalate:'Escalonar',status:'Alterar situação',resolve:'Resolver',cancel:'Cancelar chamado'};
async function api(company:string,path:string,options:RequestInit={}){
 const response=await fetch('/api/v1/companies/'+company+'/tickets'+path,{...options,credentials:'same-origin',cache:'no-store',headers:{'Content-Type':'application/json',...options.headers}});
 if(!response.ok){const data=await response.json().catch(()=>({}));
  if(response.status===401||['PASSWORD_CHANGE_REQUIRED','PRIVACY_ACCEPTANCE_REQUIRED'].includes(data.code)){window.location.reload();throw Error('Atualize seu acesso.');}
  const reasons:Record<string,string>={CLOSED:'O chamado já foi encerrado.',ALREADY_RESPONDED:'O primeiro retorno já foi registrado.',SAME_ASSIGNEE:'Esse responsável já está designado.',DEADLINE_BEFORE_OPENING:'O prazo precisa ser posterior à abertura.',OPEN_WORK_ORDER:'Há ordem de serviço pendente ou em andamento para este chamado. Conclua ou cancele a OS antes de resolver.'};
  throw Error(data.code==='TICKET_RULE_REJECTED'?reasons[data.reason]??'Ação não permitida.':data.code==='INVALID_REFERENCE'?'Propriedade, equipamento, responsável ou chamado anterior inválidos para este acesso.':response.status===409?'O chamado foi alterado por outra pessoa. Atualize e tente novamente.':response.status===403?'Você não tem permissão para esta operação.':response.status===404?'Registro não encontrado ou fora do seu acesso.':'Confira os campos e sua conexão.');
 }return response.json();
}
/** Ticket queue. Times are calculated from server records; the page never sends instants other than the agreed deadline. */
export function Tickets({account}:{account:Account}){
 const permissions=account.permissions??[],canOpen=permissions.includes('ticket:write');
 const [company,setCompany]=useState(account.companies[0]?.id??''),[status,setStatus]=useState('open'),[criticality,setCriticality]=useState(''),[regionId,setRegionId]=useState(''),[overdue,setOverdue]=useState(false),[search,setSearch]=useState(''),[searchDraft,setSearchDraft]=useState(''),[page,setPage]=useState(1),[refresh,setRefresh]=useState(0);
 const [rows,setRows]=useState<TicketView[]>([]),[total,setTotal]=useState(0),[counts,setCounts]=useState<Record<string,number>>({}),[loading,setLoading]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState('');
 const [settings,setSettings]=useState<TicketSettingsView>({criticalities:ticketCriticalities.map(key=>({key,label:defaultTicketCriticalityNames[key]})),version:0}),[regions,setRegions]=useState<Option[]>([]);
 const [opening,setOpening]=useState(false),[detail,setDetail]=useState<{record:TicketView;history:TicketEventView[]}|null>(null),[action,setAction]=useState<TicketAction|null>(null),[settingsEditor,setSettingsEditor]=useState<TicketSettingsView|null>(null);
 const [draft,setDraft]=useState<Record<string,string>>({}),[parties,setParties]=useState<Option[]>([]),[properties,setProperties]=useState<Option[]>([]),[equipment,setEquipment]=useState<Option[]>([]),[previous,setPrevious]=useState<TicketView[]>([]),[assignees,setAssignees]=useState<Option[]>([]),[busy,setBusy]=useState(false),[formError,setFormError]=useState('');
 const label=(key:TicketCriticality)=>settings.criticalities.find(item=>item.key===key)?.label??defaultTicketCriticalityNames[key];
 useEffect(()=>{
  const controller=new AbortController();
  api(company,'/settings',{signal:controller.signal}).then(data=>{if(Array.isArray(data?.criticalities))setSettings(data);}).catch(()=>{});
  if(permissions.includes('region:read'))fetch('/api/v1/companies/'+company+'/territories/options?kind=regions',{credentials:'same-origin',cache:'no-store',signal:controller.signal}).then(response=>response.ok?response.json():{items:[]}).then(data=>setRegions(data.items??[])).catch(()=>{});
  return()=>controller.abort();
 },[company]);
 useEffect(()=>{
  const controller=new AbortController();setLoading(true);setError('');
  const query=new URLSearchParams({page:String(page),status,...(criticality?{criticality}:{}),...(regionId?{regionId}:{}),...(overdue?{overdue:'true'}:{}),...(search?{search}:{})});
  api(company,'?'+query,{signal:controller.signal}).then(data=>{setRows(data.items);setTotal(data.total);setCounts(data.openByCriticality??{});}).catch(cause=>{if(!controller.signal.aborted){setRows([]);setError((cause as Error).message);}}).finally(()=>{if(!controller.signal.aborted)setLoading(false);});
  return()=>controller.abort();
 },[company,page,status,criticality,regionId,overdue,search,refresh]);
 useEffect(()=>{
  if(!opening)return;const controller=new AbortController(),timer=setTimeout(()=>api(company,'/options?search='+encodeURIComponent(draft.partySearch??''),{signal:controller.signal}).then(data=>setParties(data.parties??[])).catch(()=>{}),250);
  return()=>{controller.abort();clearTimeout(timer);};
 },[company,opening,draft.partySearch]);
 useEffect(()=>{
  if(!opening||!draft.partyId){setProperties([]);setEquipment([]);setPrevious([]);return;}
  const controller=new AbortController();
  api(company,'/options?partyId='+draft.partyId,{signal:controller.signal}).then(data=>{setProperties(data.properties??[]);setEquipment(data.equipment??[]);}).catch(()=>{});
  api(company,'?status=closed&partyId='+draft.partyId,{signal:controller.signal}).then(data=>setPrevious((data.items??[]).filter((item:TicketView)=>item.status==='resolvido'))).catch(()=>{});
  return()=>controller.abort();
 },[company,opening,draft.partyId]);
 const update=(key:string,value:string)=>setDraft(current=>({...current,[key]:value}));
 async function openDetail(id:string){setError('');try{setDetail(await api(company,'/'+id));}catch(cause){setError((cause as Error).message);}}
 function startAction(next:TicketAction){setFormError('');setDraft({status:'aguardando_cliente'});setAction(next);if(next==='assign'||next==='escalate')api(company,'/assignees').then(data=>setAssignees(data.items??[])).catch(()=>setAssignees([]));}
 async function create(event:FormEvent){
  event.preventDefault();setBusy(true);setFormError('');
  try{const created=await api(company,'',{method:'POST',body:JSON.stringify({partyId:draft.partyId,propertyId:draft.propertyId,equipmentId:draft.equipmentId||null,origin:draft.origin,criticality:draft.criticality,title:draft.title,description:draft.description,previousTicketId:draft.previousTicketId||null})});setOpening(false);setNotice('Chamado '+created.number+' aberto.');setPage(1);setRefresh(value=>value+1);}
  catch(cause){setFormError((cause as Error).message);}finally{setBusy(false);}
 }
 async function act(event:FormEvent){
  event.preventDefault();if(!detail||!action)return;setBusy(true);setFormError('');
  const version=detail.record.version,bodies:Record<TicketAction,Record<string,unknown>>={'first-response':{version,note:draft.note},assign:{version,assigneeId:draft.assigneeId,note:draft.note??''},deadline:{version,agreedDeadline:draft.deadline?new Date(draft.deadline).toISOString():'',note:draft.note??''},escalate:{version,reason:draft.note,...(draft.assigneeId?{assigneeId:draft.assigneeId}:{})},status:{version,status:draft.status,note:draft.note??''},resolve:{version,solution:draft.note},cancel:{version,reason:draft.note}};
  try{await api(company,'/'+detail.record.id+'/'+action,{method:'POST',body:JSON.stringify(bodies[action])});setAction(null);setDetail(await api(company,'/'+detail.record.id));setRefresh(value=>value+1);}
  catch(cause){setFormError((cause as Error).message);}finally{setBusy(false);}
 }
 const record=detail?.record,open=record&&(openTicketStatuses as readonly string[]).includes(record.status);
 return <section className="nf-crm nf-tickets">
  <div className="nf-crm-toolbar"><label>Empresa<select value={company} disabled={opening||Boolean(detail)} onChange={event=>{setCompany(event.target.value);setPage(1);}}>{account.companies.map(item=><option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
   {canOpen&&<button className="nf-primary" onClick={()=>{setFormError('');setDraft({origin:'telefone',criticality:'alto'});setOpening(true);}}>Abrir chamado</button>}{permissions.includes('list:manage')&&<button className="nf-secondary" onClick={()=>setSettingsEditor(settings)}>Configurar criticidade</button>}</div>
  {!opening&&!detail&&error&&<p role="alert" className="nf-error">{error}</p>}{notice&&<p role="status" className="nf-admin-success">{notice}</p>}
  <div className="nf-ticket-counters" aria-label="Chamados abertos por criticidade">{ticketCriticalities.map(key=><button key={key} type="button" className={'nf-ticket-counter is-'+key+(criticality===key?' is-active':'')} aria-pressed={criticality===key} onClick={()=>{setCriticality(criticality===key?'':key);setPage(1);}}><strong>{counts[key]??0}</strong><span>{label(key)}</span></button>)}</div>
  <section className="nf-panel"><div className="nf-section-heading"><h2>Fila de chamados</h2><span>{total} chamado(s)</span></div>
   <div className="nf-admin-grid"><label>Situação<select value={status} onChange={event=>{setStatus(event.target.value);setPage(1);}}><option value="open">Em aberto</option><option value="closed">Encerrados</option><option value="all">Todos</option></select></label>{regions.length>0&&<label>Território<select value={regionId} onChange={event=>{setRegionId(event.target.value);setPage(1);}}><option value="">Todos</option>{regions.map(item=><option key={item.id} value={item.id}>{item.name}</option>)}</select></label>}
    <form className="nf-crm-search" onSubmit={event=>{event.preventDefault();setSearch(searchDraft.trim());setPage(1);}}><label>Número ou título<input value={searchDraft} maxLength={80} onChange={event=>setSearchDraft(event.target.value)}/></label><button className="nf-secondary">Buscar</button></form></div>
   <label className="nf-check"><input type="checkbox" checked={overdue} onChange={event=>{setOverdue(event.target.checked);setPage(1);}}/>Somente com prazo pactuado vencido</label>
   {loading?<p role="status">Carregando chamados...</p>:!rows.length?<p className="nf-muted">Nenhum chamado neste filtro.</p>:<ul className="nf-property-list nf-ticket-list">{rows.map(row=><li key={row.id} className={'is-'+row.criticality}><div><strong>{row.number} · {row.title}</strong><span className={'nf-badge nf-ticket-badge is-'+row.criticality}>{label(row.criticality)}</span></div>
    <p>{row.partyName} · {row.propertyName}{row.regionName?' ('+row.regionName+')':''}{row.equipmentName?' · '+row.equipmentName:''}</p>
    <small>{ticketStatusNames[row.status]} · Aberto em {when(row.openedAt)} · Responsável: {row.assigneeName||'não designado'} · Primeiro retorno: {duration(row.responseMinutes)}{row.agreedDeadline?' · Prazo: '+when(row.agreedDeadline):''}{row.overdue?' · PRAZO VENCIDO':''}{row.escalationLevel?' · Escalonado '+row.escalationLevel+'x':''}</small>
    <div className="nf-crm-row-actions"><button type="button" className={row.canManage?'nf-primary':'nf-secondary'} onClick={()=>void openDetail(row.id)}>{row.canManage?'Triar e acompanhar':'Ver chamado'}</button></div></li>)}</ul>}
   <div className="nf-crm-pagination"><button className="nf-secondary" disabled={loading||page<=1} onClick={()=>setPage(value=>value-1)}>Anterior</button><span>Página {page}</span><button className="nf-secondary" disabled={loading||page*20>=total} onClick={()=>setPage(value=>value+1)}>Próxima</button></div>
  </section>
  <Modal open={opening} title="Abrir chamado" busy={busy} onClose={()=>setOpening(false)}>
   <form className="nf-form" onSubmit={create}><fieldset disabled={busy}><div className="nf-admin-grid">
    <label>Buscar cliente<input value={draft.partySearch??''} maxLength={80} onChange={event=>update('partySearch',event.target.value)}/></label>
    <label>Cliente<select required value={draft.partyId??''} onChange={event=>setDraft(current=>({...current,partyId:event.target.value,propertyId:'',equipmentId:'',previousTicketId:''}))}><option value="">Selecione</option>{parties.map(item=><option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
    <label>Propriedade<select required value={draft.propertyId??''} disabled={!draft.partyId} onChange={event=>setDraft(current=>({...current,propertyId:event.target.value,equipmentId:''}))}><option value="">Selecione</option>{properties.map(item=><option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
    <label>Equipamento<select value={draft.equipmentId??''} disabled={!draft.propertyId} onChange={event=>update('equipmentId',event.target.value)}><option value="">Não informado</option>{equipment.filter(item=>item.propertyId===draft.propertyId).map(item=><option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
    <label>Origem<select value={draft.origin??'telefone'} onChange={event=>update('origin',event.target.value)}>{ticketOrigins.map(item=><option key={item} value={item}>{ticketOriginNames[item]}</option>)}</select></label>
    <label>Criticidade<select value={draft.criticality??'alto'} onChange={event=>update('criticality',event.target.value)}>{ticketCriticalities.map(item=><option key={item} value={item}>{label(item)}</option>)}</select></label>
    <label>Título<input required minLength={3} maxLength={160} value={draft.title??''} onChange={event=>update('title',event.target.value)}/></label>
    <label>Retorno pela mesma falha de<select value={draft.previousTicketId??''} disabled={!previous.length} onChange={event=>update('previousTicketId',event.target.value)}><option value="">Não é reincidência</option>{previous.map(item=><option key={item.id} value={item.id}>{item.number} — {item.title}</option>)}</select></label>
   </div><label>Descrição do problema<textarea required minLength={10} maxLength={3000} value={draft.description??''} onChange={event=>update('description',event.target.value)}/></label>
   <p className="nf-field-hint">A data de abertura é registrada pelo servidor. O prazo é pactuado depois, na triagem; não há SLA automático.</p>
   {formError&&<p role="alert" className="nf-error">{formError}</p>}<div className="nf-admin-actions"><button type="button" className="nf-secondary" onClick={()=>setOpening(false)}>Cancelar</button><button className="nf-primary">{busy?'Abrindo...':'Abrir chamado'}</button></div></fieldset></form>
  </Modal>
  <Modal open={Boolean(detail)} title={record?record.number+' — '+record.title:'Chamado'} onClose={()=>{setDetail(null);setAction(null);}}>
   {record&&<><dl className="nf-record-summary">
    <div><dt>Criticidade e situação</dt><dd>{label(record.criticality)} · {ticketStatusNames[record.status]}{record.escalationLevel?' · escalonado '+record.escalationLevel+'x':''}</dd></div>
    <div><dt>Cliente e local</dt><dd>{record.partyName}<br/>{record.propertyName}{record.regionName?' ('+record.regionName+')':''}{record.equipmentName?' · '+record.equipmentName:''}</dd></div>
    <div><dt>Responsável</dt><dd>{record.assigneeName||'Não designado'}</dd></div>
    <div><dt>Origem</dt><dd>{ticketOriginNames[record.origin]}{record.previousTicketNumber?' · retorno de '+record.previousTicketNumber:''}</dd></div>
    <div><dt>Abertura</dt><dd>{when(record.openedAt)}</dd></div>
    <div><dt>Primeiro retorno</dt><dd>{when(record.firstResponseAt)} ({duration(record.responseMinutes)})</dd></div>
    <div><dt>Prazo pactuado</dt><dd>{when(record.agreedDeadline)}{record.overdue?' · vencido':''}</dd></div>
    <div><dt>Resolução</dt><dd>{when(record.resolvedAt)} ({duration(record.resolutionMinutes)})</dd></div>
    <div><dt>Descrição</dt><dd>{record.description}</dd></div>
    {record.solution&&<div><dt>Solução</dt><dd>{record.solution}</dd></div>}
   </dl>
   {open&&record.canManage&&<div className="nf-crm-row-actions nf-ticket-actions">{(Object.keys(actionNames) as TicketAction[]).filter(item=>item!=='first-response'||!record.firstResponseAt).map(item=><button key={item} type="button" className={item==='resolve'||item==='first-response'?'nf-primary':'nf-secondary'} onClick={()=>startAction(item)}>{actionNames[item]}</button>)}</div>}
   {permissions.includes('technical:read')&&<WorkOrderList companyId={company} query={{ticketId:record.id}} title="Ordens de serviço do chamado"/>}
   <HistoryTimeline title="Histórico do chamado" events={detail!.history.map(item=>({action:eventNames[item.action]??item.action,actor:item.actor,at:item.at,detail:[item.fromAssignee||item.toAssignee?(item.fromAssignee||'sem responsável')+' → '+(item.toAssignee||'sem responsável'):'',ticketStatusNames[item.statusAfter as keyof typeof ticketStatusNames]].filter(Boolean).join(' · '),reason:item.note,reasonLabel:'Registro'}))}/></>}
  </Modal>
  <Modal open={Boolean(action)} title={action?actionNames[action]:''} size="compact" busy={busy} onClose={()=>setAction(null)}>
   <form className="nf-form" onSubmit={act}><fieldset disabled={busy}>
    {(action==='assign'||action==='escalate')&&<label>{action==='assign'?'Responsável':'Novo responsável (opcional)'}<select required={action==='assign'} value={draft.assigneeId??''} onChange={event=>update('assigneeId',event.target.value)}><option value="">{action==='assign'?'Selecione':'Manter atual'}</option>{assignees.map(item=><option key={item.id} value={item.id}>{item.name}</option>)}</select></label>}
    {action==='deadline'&&<label>Prazo pactuado com o cliente<input type="datetime-local" required value={draft.deadline??''} onChange={event=>update('deadline',event.target.value)}/></label>}
    {action==='status'&&<label>Nova situação<select value={draft.status??'aguardando_cliente'} onChange={event=>update('status',event.target.value)}>{openTicketStatuses.map(item=><option key={item} value={item}>{ticketStatusNames[item]}</option>)}</select></label>}
    <label>{action==='resolve'?'Solução aplicada':action==='escalate'||action==='cancel'?'Motivo':action==='first-response'?'Retorno dado ao cliente':'Observação'}<textarea required={['first-response','escalate','resolve','cancel'].includes(action??'')} minLength={action==='first-response'?3:['escalate','resolve','cancel'].includes(action??'')?10:0} maxLength={3000} value={draft.note??''} onChange={event=>update('note',event.target.value)}/></label>
    <p className="nf-field-hint">A data e a hora deste registro são definidas pelo servidor.</p>
    {formError&&<p role="alert" className="nf-error">{formError}</p>}<div className="nf-admin-actions"><button type="button" className="nf-secondary" onClick={()=>setAction(null)}>Voltar</button><button className="nf-primary">{busy?'Salvando...':'Confirmar'}</button></div></fieldset></form>
  </Modal>
  <Modal open={Boolean(settingsEditor)} title="Configurar criticidade" busy={busy} onClose={()=>setSettingsEditor(null)}>
   <form className="nf-form" onSubmit={async event=>{event.preventDefault();if(!settingsEditor)return;setBusy(true);setFormError('');try{setSettings(await api(company,'/settings',{method:'PUT',body:JSON.stringify(settingsEditor)}));setSettingsEditor(null);setNotice('Criticidades atualizadas.');}catch(cause){setFormError((cause as Error).message);}finally{setBusy(false);}}}><fieldset disabled={busy}>
    <p className="nf-muted">Os três níveis são fixos e ordenam a fila; ajuste apenas os nomes exibidos. Prazos continuam pactuados caso a caso.</p>
    <div className="nf-admin-grid">{settingsEditor?.criticalities.map((item,index)=><label key={item.key}>{defaultTicketCriticalityNames[item.key]}<input required maxLength={40} value={item.label} onChange={event=>setSettingsEditor(current=>current&&{...current,criticalities:current.criticalities.map((row,position)=>position===index?{...row,label:event.target.value}:row)})}/></label>)}</div>
    {formError&&<p role="alert" className="nf-error">{formError}</p>}<div className="nf-admin-actions"><button type="button" className="nf-secondary" onClick={()=>setSettingsEditor(null)}>Cancelar</button><button className="nf-primary">Salvar</button></div></fieldset></form>
  </Modal>
 </section>;
}
