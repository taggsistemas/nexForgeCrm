import {useEffect,useMemo,useState,type FormEvent} from 'react';
import {Modal} from '../../components/Modal';
import {agendaTimeZones,calendarRange,addCalendarDays,dateParts,type AgendaActivityView,type AgendaSeriesView,type AgendaSource} from '../../../../../packages/contracts/src/agenda';
import {activityTypes,activityStatuses} from '../../../../../packages/contracts/src/opportunities';
type Account={companies:{id:string;name:string}[];permissions?:string[]};
type Editor={mode:'activity';record?:AgendaActivityView;series?:AgendaSeriesView|null}|{mode:'cancel';series:AgendaSeriesView};
const labels:Record<string,string>={visita:'Visita planejada',ligacao:'Ligação',email:'E-mail',reuniao:'Reunião',tarefa:'Tarefa',pendente:'Pendente',concluida:'Concluída',cancelada:'Cancelada',none:'Não repetir',daily:'Diária',weekly:'Semanal',monthly:'Mensal'};
const formatDate=(date:string)=>date.split('-').reverse().join('/');
async function api(company:string,path:string,options:RequestInit={}){
 let response:Response;
 try{response=await fetch('/api/v1/companies/'+company+'/agenda'+path,{...options,credentials:'same-origin',cache:'no-store',headers:{'Content-Type':'application/json',...options.headers}});}catch(error){if((error as Error).name==='AbortError')throw error;throw Error('Não foi possível conectar. Confira sua conexão.');}
 if(!response.ok){const data=await response.json().catch(()=>({}));
  if(response.status===401||['PASSWORD_CHANGE_REQUIRED','PRIVACY_ACCEPTANCE_REQUIRED'].includes(data.code)){window.location.reload();throw Error('Atualize seu acesso.');}
  throw Error(response.status===409?'O registro mudou. Feche o formulário, atualize a agenda e tente novamente.':response.status===404?'Atividade ou vínculo não encontrado no seu acesso.':response.status===403?'Você não tem permissão para esta operação.':data.code==='AGENDA_RULE_REJECTED'?'Confira o horário e a recorrência (máximo de 52 ocorrências em até 366 dias). Oportunidades encerradas não recebem novas atividades.':'Confira os campos, o período e o vínculo selecionado.');
 }return response.json();
}
export function Agenda({account}:{account:Account}){
 const permissions=account.permissions??[],canWrite=permissions.includes('activity:write');
 const [company,setCompany]=useState(account.companies[0]?.id??''),[timeZone,setTimeZone]=useState('America/Sao_Paulo'),[date,setDate]=useState(()=>dateParts(new Date(),'America/Sao_Paulo').date),[view,setView]=useState<'day'|'week'|'month'>('week');
 const [status,setStatus]=useState(''),[type,setType]=useState(''),[ownerId,setOwnerId]=useState(''),[overdue,setOverdue]=useState(false),[page,setPage]=useState(1),[refresh,setRefresh]=useState(0);
 const [rows,setRows]=useState<AgendaActivityView[]>([]),[counts,setCounts]=useState<Record<string,number>>({}),[total,setTotal]=useState(0),[owners,setOwners]=useState<{id:string;name:string}[]>([]);
 const [loading,setLoading]=useState(false),[busy,setBusy]=useState(false),[opening,setOpening]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState('');
 const [editor,setEditor]=useState<Editor|null>(null),[draft,setDraft]=useState<Record<string,string>>({}),[references,setReferences]=useState<{id:string;name:string}[]>([]),[referenceSearch,setReferenceSearch]=useState('');
 const range=useMemo(()=>calendarRange(date,view),[date,view]);
 useEffect(()=>{
  const controller=new AbortController();setOwners([]);
  api(company,'/owners',{signal:controller.signal}).then(data=>setOwners(data.items)).catch(cause=>{if(!controller.signal.aborted)setError(cause.message);});
  return()=>controller.abort();
 },[company,refresh]);
 useEffect(()=>{
  const controller=new AbortController();setLoading(true);setRows([]);setCounts({});setTotal(0);setError('');
  const query=new URLSearchParams({...range,timeZone,page:String(page),...(status?{status}:{}),...(type?{type}:{}),...(ownerId?{ownerId}:{}),...(overdue?{overdue:'true'}:{})});
  api(company,'/activities?'+query,{signal:controller.signal}).then(data=>{setRows(data.items);setTotal(data.total);setCounts(Object.fromEntries(data.dailyCounts.map((item:{date:string;total:number})=>[item.date,item.total])));}).catch(cause=>{if(!controller.signal.aborted)setError(cause.message);}).finally(()=>{if(!controller.signal.aborted)setLoading(false);});
  return()=>controller.abort();
 },[company,range,timeZone,page,status,type,ownerId,overdue,refresh]);
 useEffect(()=>{
  if(editor?.mode!=='activity'||editor.record)return;
  const controller=new AbortController(),timer=setTimeout(()=>api(company,'/references?'+new URLSearchParams({source:draft.source??'party',search:referenceSearch}),{signal:controller.signal}).then(data=>setReferences(data.items)).catch(cause=>{if(!controller.signal.aborted)setError(cause.message);}),250);
  return()=>{controller.abort();clearTimeout(timer);};
 },[company,editor?.mode,editor?.mode==='activity'?editor.record?.id:undefined,draft.source,referenceSearch]);
 function update(key:string,value:string){setDraft(current=>({...current,[key]:value}));}
 function resetPage(){setPage(1);setNotice('');}
 function newActivity(day=date){
  setError('');setNotice('');setReferenceSearch('');setReferences([]);
  setDraft({title:'',type:'tarefa',source:'party',linkId:'',startLocal:day+'T09:00',timeZone,notes:'',frequency:'none',interval:'1',count:'2',status:'pendente'});setEditor({mode:'activity'});
 }
 async function editActivity(row:AgendaActivityView){
  setOpening(true);setError('');
  try{
   const data=await api(company,'/activities/'+row.source+'/'+row.id),record=data.record as AgendaActivityView,parts=dateParts(new Date(record.dueAt),timeZone);
   setDraft({title:record.title,type:record.type,startLocal:parts.date+'T'+parts.time,timeZone,notes:record.notes,status:record.status});
   setEditor({mode:'activity',record,series:data.series});
  }catch(cause){setError((cause as Error).message);}finally{setOpening(false);}
 }
 function move(direction:number){
  if(view==='month'){const value=new Date(date.slice(0,7)+'-01T12:00:00Z');value.setUTCMonth(value.getUTCMonth()+direction);setDate(value.toISOString().slice(0,10));}
  else setDate(addCalendarDays(date,direction*(view==='week'?7:1)));resetPage();
 }
 async function submit(event:FormEvent<HTMLFormElement>){
  event.preventDefault();if(!editor)return;setBusy(true);setError('');
  try{
   if(editor.mode==='cancel'){
    const data=await api(company,'/series/'+editor.series.id+'/cancel',{method:'POST',body:JSON.stringify({version:editor.series.version})});
    setNotice(data.count+' ocorrência(s) futura(s) cancelada(s).');
   }else{
    const body={title:draft.title,type:draft.type,startLocal:draft.startLocal,timeZone:draft.timeZone,notes:draft.notes,...(editor.record?{version:editor.record.version,status:draft.status}:{link:{source:draft.source,id:draft.linkId},recurrence:{frequency:draft.frequency,interval:Number(draft.interval),count:draft.frequency==='none'?1:Number(draft.count)}})};
    const path='/activities'+(editor.record?'/'+editor.record.source+'/'+editor.record.id:'');
    const data=await api(company,path,{method:editor.record?'PATCH':'POST',body:JSON.stringify(body)});
    setNotice(editor.record?'Ocorrência atualizada.':data.count+' atividade(s) cadastrada(s).');
   }
   setEditor(null);setRefresh(value=>value+1);
  }catch(cause){setError((cause as Error).message);}finally{setBusy(false);}
 }
 const cellDays=Array.from({length:view==='day'?1:view==='week'?7:42},(_,index)=>addCalendarDays(range.startDate,index));
 return <section className="nf-crm nf-agenda">
  <div className="nf-crm-toolbar"><label>Empresa<select value={company} disabled={Boolean(editor)||opening} onChange={event=>{setCompany(event.target.value);setOwnerId('');resetPage();}}>{account.companies.map(item=><option key={item.id} value={item.id}>{item.name}</option>)}</select></label>{canWrite&&<button className="nf-primary" onClick={()=>newActivity()}>Nova atividade</button>}</div>
  {!editor&&error&&<p className="nf-error" role="alert">{error}</p>}{notice&&<p className="nf-admin-success" role="status">{notice}</p>}
  <section className="nf-panel">
   <div className="nf-section-heading"><h2>Agenda comercial</h2><div className="nf-agenda-switch" aria-label="Visualização da agenda">{(['day','week','month'] as const).map(item=><button key={item} aria-pressed={view===item} className={view===item?'nf-primary':'nf-secondary'} onClick={()=>{setView(item);resetPage();}}>{item==='day'?'Dia':item==='week'?'Semana':'Mês'}</button>)}</div></div>
   <div className="nf-agenda-controls"><button className="nf-secondary" aria-label="Período anterior" onClick={()=>move(-1)}>Anterior</button><label>Data de referência<input type="date" min="1900-01-01" max="2100-12-31" required value={date} onChange={event=>{if(event.target.value>='1900-01-01'&&event.target.value<='2100-12-31'){setDate(event.target.value);resetPage();}}}/></label><button className="nf-secondary" aria-label="Próximo período" onClick={()=>move(1)}>Próximo</button><button className="nf-secondary" onClick={()=>{setDate(dateParts(new Date(),timeZone).date);resetPage();}}>Hoje</button><button className="nf-secondary" onClick={()=>setRefresh(value=>value+1)}>Atualizar</button></div>
   <div className="nf-admin-grid nf-agenda-filters"><label>Fuso do calendário<select value={timeZone} onChange={event=>{setTimeZone(event.target.value);resetPage();}}>{agendaTimeZones.map(item=><option key={item} value={item}>{item}</option>)}</select></label><label>Responsável<select value={ownerId} onChange={event=>{setOwnerId(event.target.value);resetPage();}}><option value="">Todos do meu acesso</option>{owners.map(item=><option key={item.id} value={item.id}>{item.name}</option>)}</select></label><label>Status<select value={status} onChange={event=>{setStatus(event.target.value);resetPage();}}><option value="">Todos</option>{activityStatuses.map(item=><option key={item} value={item}>{labels[item]}</option>)}</select></label><label>Tipo de atividade<select value={type} onChange={event=>{setType(event.target.value);resetPage();}}><option value="">Todos</option>{activityTypes.map(item=><option key={item} value={item}>{labels[item]}</option>)}</select></label></div>
   <label className="nf-check nf-agenda-overdue"><input type="checkbox" checked={overdue} onChange={event=>{setOverdue(event.target.checked);resetPage();}}/>Somente pendentes atrasadas neste período</label>
   <p className="nf-muted">{formatDate(range.startDate)} a {formatDate(addCalendarDays(range.endDate,-1))} · Horários em {timeZone}. A carteira é herdada do vínculo.</p>
   {loading?<p role="status">Carregando agenda...</p>:<><div className="nf-agenda-calendar-scroll"><div className={'nf-agenda-calendar '+(view==='day'?'is-day':'')} role="grid" aria-label="Calendário comercial">
    {view!=='day'&&['Seg','Ter','Qua','Qui','Sex','Sáb','Dom'].map(day=><div role="columnheader" className="nf-agenda-weekday" key={day}>{day}</div>)}
    {cellDays.map(day=><div role="gridcell" className={'nf-agenda-cell '+(day===date?'is-selected':'')} key={day}><button className="nf-agenda-date" aria-label={'Abrir dia '+formatDate(day)} onClick={()=>{setDate(day);setView('day');resetPage();}}>{view==='month'?day.slice(8):formatDate(day)}</button><strong>{counts[day]??0} atividade(s)</strong>{rows.filter(row=>dateParts(new Date(row.dueAt),timeZone).date===day).slice(0,view==='month'?2:3).map(row=><button className={'nf-agenda-event status-'+row.status} key={row.source+row.id} disabled={opening} onClick={()=>editActivity(row)}>{dateParts(new Date(row.dueAt),timeZone).time} · {row.title}</button>)}{canWrite&&<button className="nf-agenda-add" aria-label={'Agendar em '+formatDate(day)} onClick={()=>newActivity(day)}>+ Agendar</button>}</div>)}
   </div></div><p className="nf-muted">Os totais dos dias incluem todo o resultado filtrado. Os títulos abaixo e no calendário correspondem à página atual.</p></>}
  </section>
  <section className="nf-panel"><div className="nf-section-heading"><h2>Atividades do período</h2><span>{total} registro(s)</span></div>
   {!loading&&!rows.length?<p>Nenhuma atividade neste período e escopo.</p>:<ul className="nf-agenda-list">{rows.map(row=>{const parts=dateParts(new Date(row.dueAt),timeZone);return <li key={row.source+row.id}><div><strong>{row.title}</strong><p>{formatDate(parts.date)} às {parts.time} · {labels[row.type]} · {labels[row.status]}{row.status==='pendente'&&new Date(row.dueAt).valueOf()<Date.now()?' · Atrasada':''}</p><p>{row.partyName}{row.opportunityTitle?' / '+row.opportunityTitle:''} · {row.ownerName}{row.seriesId?' · Recorrente':''}</p></div><button className="nf-secondary" disabled={opening} onClick={()=>editActivity(row)}>{canWrite?'Editar ocorrência':'Ver atividade'}</button></li>;})}</ul>}
   <div className="nf-crm-pagination"><button className="nf-secondary" disabled={loading||page<=1} onClick={()=>setPage(value=>value-1)}>Página anterior</button><span>Página {page} · até 50 por página</span><button className="nf-secondary" disabled={loading||page*50>=total} onClick={()=>setPage(value=>value+1)}>Próxima página</button></div>
  </section>
  <Modal open={Boolean(editor)} title={editor?.mode==='cancel'?'Cancelar próximas ocorrências':editor?.record?'Atividade da agenda':'Nova atividade da agenda'} busy={busy} onClose={()=>{setEditor(null);setError('');}}>
   <form className="nf-form" onSubmit={submit}><fieldset disabled={busy||!canWrite}>
    {editor?.mode==='cancel'?<p>Cancelar as ocorrências pendentes com horário igual ou posterior ao momento da confirmação? As ocorrências passadas e as já concluídas serão preservadas.</p>:<>{editor?.record&&<p>{editor.record.partyName} · {editor.record.ownerName}. A edição altera somente esta ocorrência.{editor.series?' Série '+labels[editor.series.frequency]+' em '+editor.series.timeZone+'.':''}</p>}
     <div className="nf-admin-grid"><label>Título da atividade<input required maxLength={160} value={draft.title??''} onChange={event=>update('title',event.target.value)}/></label><label>Tipo de compromisso<select value={draft.type??'tarefa'} onChange={event=>update('type',event.target.value)}>{activityTypes.map(item=><option key={item} value={item}>{labels[item]}</option>)}</select></label>
     {editor?.mode==='activity'&&!editor.record&&<><label>Vincular a<select value={draft.source??'party'} onChange={event=>{update('source',event.target.value);update('linkId','');setReferenceSearch('');setReferences([]);}}><option value="party">Lead ou cliente</option>{permissions.includes('pipeline:read')&&<option value="opportunity">Oportunidade aberta</option>}</select></label><label>Buscar vínculo<input maxLength={80} value={referenceSearch} onChange={event=>setReferenceSearch(event.target.value)}/></label><label>Cadastro vinculado<select required value={draft.linkId??''} onChange={event=>update('linkId',event.target.value)}><option value="">Selecione</option>{references.map(item=><option key={item.id} value={item.id}>{item.name}</option>)}</select></label></>}
     <label>Data e hora<input type="datetime-local" required value={draft.startLocal??''} onChange={event=>update('startLocal',event.target.value)}/></label><label>Fuso do compromisso<select value={draft.timeZone??timeZone} onChange={event=>update('timeZone',event.target.value)}>{agendaTimeZones.map(item=><option key={item} value={item}>{item}</option>)}</select></label>
     {editor?.mode==='activity'&&editor.record?<label>Status da ocorrência<select value={draft.status??'pendente'} onChange={event=>update('status',event.target.value)}>{activityStatuses.map(item=><option key={item} value={item}>{labels[item]}</option>)}</select></label>:<><label>Repetição<select value={draft.frequency??'none'} onChange={event=>update('frequency',event.target.value)}>{['none','daily','weekly','monthly'].map(item=><option key={item} value={item}>{labels[item]}</option>)}</select></label>{draft.frequency!=='none'&&<><label>Intervalo<input type="number" min="1" max="12" required value={draft.interval??'1'} onChange={event=>update('interval',event.target.value)}/></label><label>Total de ocorrências<input type="number" min="2" max="52" required value={draft.count??'2'} onChange={event=>update('count',event.target.value)}/></label><p>Inclui a primeira ocorrência. Máximo de 52 em até 366 dias; no mês sem o dia original, usa o último dia.</p></>}</>}
     </div><label className="nf-agenda-notes">Anotações<textarea maxLength={3000} value={draft.notes??''} onChange={event=>update('notes',event.target.value)}/></label></>}
    {error&&<p role="alert" className="nf-error">{error}</p>}</fieldset><div className="nf-admin-actions">{editor?.mode==='activity'&&editor.series?.state==='active'&&canWrite&&<button type="button" className="nf-secondary" onClick={()=>{if(editor.series)setEditor({mode:'cancel',series:editor.series});}}>Cancelar próximas ocorrências</button>}<button type="button" className="nf-secondary" disabled={busy} onClick={()=>{setEditor(null);setError('');}}>Fechar</button>{canWrite&&<button className="nf-primary" disabled={busy}>{busy?'Salvando...':editor?.mode==='cancel'?'Confirmar cancelamento':'Salvar atividade'}</button>}</div>
   </form>
  </Modal>
 </section>;
}
