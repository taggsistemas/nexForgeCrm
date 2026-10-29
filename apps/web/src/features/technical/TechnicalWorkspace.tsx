import {useEffect,useState,type FormEvent} from 'react';
import {Modal} from '../../components/Modal';
import {HistoryTimeline,type HistoryEvent} from '../../components/HistoryTimeline';
import {businessDateTimeInput} from '../../../../../packages/contracts/src/business-time';
import {dateParts} from '../../../../../packages/contracts/src/agenda';
import {formatMinutes,technicalStateNames,workOrderOriginNames,type TechnicalWorkView} from '../../../../../packages/contracts/src/technical';
import type {TicketView} from '../../../../../packages/contracts/src/tickets';
import {OrderFromSource} from '../orders/Orders';
import {WorkOrderParts} from './WorkOrderParts';
type Account={companies:{id:string;name:string}[];permissions?:string[]};
type Option={id:string;name:string;propertyId?:string};
type Editor='new'|'detail'|'check-in'|'check-out'|'cancel'|'interrupt'|'close';
async function request(company:string,path='',options:RequestInit={}){
 const res=await fetch('/api/v1/companies/'+company+'/technical'+path,{...options,credentials:'same-origin',cache:'no-store',headers:{'Content-Type':'application/json'}});
 if(!res.ok)throw Error(res.status===409?'A OS mudou, há sobreposição na agenda ou já existe um atendimento aberto. Atualize o roteiro.':res.status===403?'Ação fora do seu acesso atual.':res.status===404?'OS, chamado ou cadastro indisponível no seu acesso.':'Confira cliente aprovado, propriedade, equipamento, serviço, técnico, regiões, horário e campos obrigatórios.');
 return res.json();
}
const format=(value:string)=>new Date(value).toLocaleString('pt-BR',{timeZone:'America/Sao_Paulo',dateStyle:'short',timeStyle:'short'});
const hoursToMinutes=(value:string)=>{const hours=Number(value.replace(',','.'));return Number.isFinite(hours)?Math.round(hours*60):NaN;};
function LocationPoint({position,label}:{position:TechnicalWorkView['checkIn'];label:string}){
 if(!position)return null;
 return <p>{label}: {position.latitude.toFixed(5)}, {position.longitude.toFixed(5)} · precisão informada de {Math.round(position.accuracy)} m. <a className="nf-location-link" href={'https://www.google.com/maps?q='+position.latitude+','+position.longitude} target="_blank" rel="noopener noreferrer">Ver no mapa</a></p>;
}
function TechnicalSelect({company,kind,label,value,onChange}:{company:string;kind:'customers'|'services'|'technicians';label:string;value:string;onChange:(id:string)=>void}){
 const [search,setSearch]=useState(''),[page,setPage]=useState(1),[items,setItems]=useState<Option[]>([]),[chosen,setChosen]=useState<Option|null>(null),[error,setError]=useState('');
 useEffect(()=>{const controller=new AbortController(),timer=setTimeout(()=>request(company,'/options?'+new URLSearchParams({search,page:String(page)}),{signal:controller.signal}).then(data=>{setItems(data[kind]);setError('');}).catch(cause=>{if(!controller.signal.aborted)setError(cause.message);}),250);return()=>{controller.abort();clearTimeout(timer);};},[company,kind,search,page]);
 const options=chosen&&!items.some(row=>row.id===chosen.id)?[chosen,...items]:items;
 return <fieldset className="nf-form-section"><legend>{label}</legend>
  <label>Buscar {label.toLowerCase()}<input maxLength={80} value={search} onChange={event=>{setSearch(event.target.value);setPage(1);}}/></label>
  <label>{label}<select required value={value} onChange={event=>{setChosen(options.find(row=>row.id===event.target.value)??null);onChange(event.target.value);}}><option value="">Selecione</option>{options.map(row=><option key={row.id} value={row.id}>{row.name}</option>)}</select></label>
  {(page>1||items.length>=30)&&<div className="nf-field-actions"><button type="button" className="nf-secondary" disabled={page<=1} onClick={()=>setPage(page-1)}>Anterior</button><button type="button" className="nf-secondary" disabled={items.length<30} onClick={()=>setPage(page+1)}>Próxima</button></div>}
  {error&&<p role="alert">{error}</p>}</fieldset>;
}
async function position(){
 if(!isSecureContext||!navigator.geolocation)throw Error('A localização precisa de HTTPS e permissão do navegador.');
 return new Promise<{latitude:number;longitude:number;accuracy:number}>((resolve,reject)=>navigator.geolocation.getCurrentPosition(value=>resolve({latitude:value.coords.latitude,longitude:value.coords.longitude,accuracy:value.coords.accuracy}),()=>reject(Error('Localização não autorizada ou indisponível. Nenhum atendimento foi registrado.')),{enableHighAccuracy:true,maximumAge:0,timeout:15000}));
}
const actionNames:Record<string,string>={'technical.created':'OS aberta','technical.check-in':'Check-in registrado','technical.check-out':'Execução concluída','technical.cancel':'OS cancelada','technical.interrupt':'Atendimento interrompido','technical.close':'OS encerrada pela coordenação','technical.part':'Peça registrada'};
const titles:Record<Editor,string>={new:'Nova ordem de serviço',detail:'Ordem de serviço',['check-in']:'Check-in técnico','check-out':'Concluir execução da OS',cancel:'Cancelar OS',interrupt:'Interromper atendimento',close:'Encerrar OS'};
/** Work orders: technicians execute only their own; coordination schedules, closes and authorizes billable hours. */
export function TechnicalWorkspace({account}:{account:Account}){
 const manage=account.permissions?.includes('technical:manage'),canReadTickets=account.permissions?.includes('ticket:read');
 const [company,setCompany]=useState(account.companies[0]?.id??''),[date,setDate]=useState(()=>dateParts(new Date(),'America/Sao_Paulo').date),[page,setPage]=useState(1),[total,setTotal]=useState(0),[refresh,setRefresh]=useState(0);
 const [items,setItems]=useState<TechnicalWorkView[]>([]),[loading,setLoading]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState('');
 const [editor,setEditor]=useState<Editor|null>(null),[record,setRecord]=useState<TechnicalWorkView|null>(null),[history,setHistory]=useState<HistoryEvent[]>([]),[draft,setDraft]=useState<Record<string,string>>({}),[authorized,setAuthorized]=useState(false);
 const [tickets,setTickets]=useState<TicketView[]>([]),[properties,setProperties]=useState<Option[]>([]),[equipment,setEquipment]=useState<Option[]>([]),[previous,setPrevious]=useState<TechnicalWorkView[]>([]);
 const update=(key:string,value:string)=>setDraft(current=>({...current,[key]:value}));
 useEffect(()=>{setItems([]);setTotal(0);},[company,date,page]);
 useEffect(()=>{const tick=()=>{if(!editor&&!busy&&!document.hidden&&navigator.onLine)setRefresh(value=>value+1);};const timer=setInterval(tick,15000);window.addEventListener('focus',tick);window.addEventListener('online',tick);return()=>{clearInterval(timer);window.removeEventListener('focus',tick);window.removeEventListener('online',tick);};},[editor,busy]);
 useEffect(()=>{const controller=new AbortController();setLoading(true);request(company,'?'+new URLSearchParams({date,page:String(page)}),{signal:controller.signal}).then(data=>{setItems(data.items);setTotal(data.total);setError('');}).catch(cause=>{if(!controller.signal.aborted)setError(cause.message);}).finally(()=>{if(!controller.signal.aborted)setLoading(false);});return()=>controller.abort();},[company,date,page,refresh]);
 useEffect(()=>{
  if(editor!=='new'||draft.origin!=='chamado'||!canReadTickets)return;
  const controller=new AbortController();fetch('/api/v1/companies/'+company+'/tickets?status=open',{credentials:'same-origin',cache:'no-store',signal:controller.signal}).then(response=>response.ok?response.json():{items:[]}).then(data=>setTickets((data.items??[]).filter((item:TicketView)=>item.canManage))).catch(()=>{});
  return()=>controller.abort();
 },[company,editor,draft.origin]);
 useEffect(()=>{
  if(editor!=='new'||draft.origin!=='programada'||!draft.partyId){setProperties([]);setEquipment([]);setPrevious([]);return;}
  const controller=new AbortController();
  request(company,'/options?partyId='+draft.partyId,{signal:controller.signal}).then(data=>{setProperties(data.properties??[]);setEquipment(data.equipment??[]);}).catch(()=>{});
  request(company,'/orders?partyId='+draft.partyId,{signal:controller.signal}).then(data=>setPrevious((data.items??[]).filter((item:TechnicalWorkView)=>item.state==='completed'))).catch(()=>{});
  return()=>controller.abort();
 },[company,editor,draft.origin,draft.partyId]);
 async function open(row:TechnicalWorkView,mode:Editor){
  setError('');setBusy(true);setAuthorized(false);setDraft({reason:''});
  try{const data=await request(company,'/'+row.id);setRecord(data.record);setHistory(data.history.map((event:HistoryEvent)=>({...event,action:actionNames[event.action]??event.action})));setEditor(mode);}
  catch(cause){setError((cause as Error).message);}finally{setBusy(false);}
 }
 function newOrder(){setDraft({origin:canReadTickets?'chamado':'programada',title:'',ticketId:'',partyId:'',propertyId:'',equipmentId:'',returnOfWorkId:'',serviceId:'',technicianId:'',startLocal:businessDateTimeInput(new Date(Date.now()+3600000)),durationMinutes:'60',notes:''});setRecord(null);setError('');setEditor('new');}
 async function submit(event:FormEvent){
  event.preventDefault();setBusy(true);setError('');
  try{
   if(!navigator.onLine)throw Error('A execução técnica exige conexão nesta etapa. Reconecte antes de registrar.');
   if(editor==='new'){
    const location=draft.origin==='chamado'?{ticketId:draft.ticketId}:{partyId:draft.partyId,propertyId:draft.propertyId,equipmentId:draft.equipmentId||null};
    const created=await request(company,'',{method:'POST',body:JSON.stringify({...location,returnOfWorkId:draft.returnOfWorkId||null,title:draft.title,serviceId:draft.serviceId,technicianId:draft.technicianId,startLocal:draft.startLocal,durationMinutes:Number(draft.durationMinutes),notes:draft.notes})});
    setNotice(created.number+' aberta.');
   }else if(record&&editor&&editor!=='detail'){
    let body:Record<string,unknown>;
    if(editor==='check-in')body={version:record.version,locationAuthorized:authorized,position:await position()};
    else if(editor==='check-out'){const laborMinutes=hoursToMinutes(draft.laborHours??'');if(!(laborMinutes>0))throw Error('Informe as horas trabalhadas, por exemplo 1,5.');body={version:record.version,locationAuthorized:authorized,position:await position(),diagnosis:draft.diagnosis,solution:draft.solution,laborMinutes,travelMinutes:Number(draft.travelMinutes||0),travelKm:Number(draft.travelKm||0)};}
    else if(editor==='close'){const billableMinutes=hoursToMinutes(draft.billableHours??'');if(!(billableMinutes>=0))throw Error('Informe as horas autorizadas para cobrança (0 quando não houver).');body={version:record.version,billableMinutes,note:draft.note??''};}
    else body={version:record.version,reason:draft.reason};
    await request(company,'/'+record.id+'/'+editor,{method:'POST',body:JSON.stringify(body)});setNotice(editor==='close'?'OS encerrada.':'OS atualizada.');
   }
   setEditor(null);setRefresh(value=>value+1);
  }catch(cause){setError((cause as Error).message);}finally{setBusy(false);}
 }
 return <section className="nf-crm nf-technical">
  <div className="nf-crm-toolbar"><label>Empresa<select disabled={Boolean(editor)} value={company} onChange={event=>{setCompany(event.target.value);setPage(1);}}>{account.companies.map(row=><option key={row.id} value={row.id}>{row.name}</option>)}</select></label>
   <label>Dia do roteiro<input type="date" required value={date} onChange={event=>{if(event.target.value){setDate(event.target.value);setPage(1);}}}/></label>
   <button className="nf-secondary" disabled={loading||busy} onClick={()=>setRefresh(value=>value+1)}>Atualizar roteiro</button>{manage&&<button className="nf-primary" onClick={newOrder}>Nova OS</button>}</div>
  <p className="nf-muted">Ordens de serviço por horário, com atendimentos abertos sempre visíveis. Tempo de atendimento, horas trabalhadas, deslocamento e horas faturáveis são registros separados; check-in/out não gera cobrança.</p>
  {!editor&&error&&<p role="alert" className="nf-error">{error}</p>}{notice&&<p role="status">{notice}</p>}
  {loading&&!items.length?<p role="status">Carregando roteiro técnico…</p>:!items.length?<section className="nf-panel"><h3>Nenhuma OS neste roteiro</h3><p>As ordens de serviço atribuídas ao técnico aparecerão aqui.</p></section>:
   <ol className="nf-field-stops">{items.map(row=><li key={row.id}><div><strong>{row.number?row.number+' · ':''}{row.title}</strong>
    <p>{row.partyName} · {row.serviceName}{row.origin!=='manual'?' · '+workOrderOriginNames[row.origin]+(row.ticketNumber?' '+row.ticketNumber:''):''}</p>
    {(row.propertyName||row.equipmentName)&&<p>{[row.propertyName+(row.regionName?' ('+row.regionName+')':''),row.equipmentName].filter(Boolean).join(' · ')}</p>}
    <p>{format(row.startAt)} · {row.technicianName} · <span className="nf-badge">{row.closedAt?'Encerrada':technicalStateNames[row.state]}</span>{row.returnOfNumber?' · Retorno de '+row.returnOfNumber:''}</p>
    <p>{row.address||'Endereço indisponível'}</p>{row.state==='in_progress'&&<LocationPoint position={row.checkIn} label="Último check-in registrado"/>}</div>
    <div className="nf-field-actions"><button className="nf-secondary" disabled={busy} onClick={()=>void open(row,'detail')}>Detalhes e histórico</button>
     {row.canExecute&&row.state==='pending'&&<button className="nf-primary" disabled={busy} onClick={()=>void open(row,'check-in')}>Check-in</button>}
     {row.canExecute&&row.state==='in_progress'&&<button className="nf-primary" disabled={busy} onClick={()=>void open(row,'check-out')}>Concluir execução</button>}
     {row.canClose&&<button className="nf-primary" disabled={busy} onClick={()=>void open(row,'close')}>Encerrar OS</button>}
     {row.canManage&&row.state==='pending'&&<button className="nf-secondary" disabled={busy} onClick={()=>void open(row,'cancel')}>Cancelar</button>}
     {row.canManage&&row.state==='in_progress'&&<button className="nf-secondary" disabled={busy} onClick={()=>void open(row,'interrupt')}>Interromper</button>}</div></li>)}</ol>}
  <div className="nf-crm-pagination"><button className="nf-secondary" disabled={page<=1||loading} onClick={()=>setPage(page-1)}>Anterior</button><span>Página {page} · {total} OS</span><button className="nf-secondary" disabled={page*20>=total||loading} onClick={()=>setPage(page+1)}>Próxima</button></div>
  <Modal open={Boolean(editor)} title={editor?titles[editor]+(record?.number&&editor!=='new'?' — '+record.number:''):''} busy={busy} onClose={()=>{setEditor(null);setError('');}}>
   {editor==='detail'&&record?<><h3>{record.title}</h3>
    <dl className="nf-record-summary">
     <div><dt>Origem</dt><dd>{workOrderOriginNames[record.origin]}{record.ticketNumber?' '+record.ticketNumber:''}{record.returnOfNumber?' · retorno de '+record.returnOfNumber:''}</dd></div>
     <div><dt>Cliente e local</dt><dd>{record.partyName}<br/>{[record.propertyName,record.equipmentName].filter(Boolean).join(' · ')||'Local não informado'}</dd></div>
     <div><dt>Técnico e serviço</dt><dd>{record.technicianName} · {record.serviceName}</dd></div>
     <div><dt>Agendamento</dt><dd>{format(record.startAt)} a {format(record.endAt)} · {record.closedAt?'Encerrada':technicalStateNames[record.state]}</dd></div>
     <div><dt>Tempo de atendimento</dt><dd>{formatMinutes(record.attendanceMinutes)} <small>(check-in a checkout, servidor)</small></dd></div>
     <div><dt>Horas trabalhadas</dt><dd>{formatMinutes(record.laborMinutes)} <small>(informadas pelo técnico)</small></dd></div>
     <div><dt>Deslocamento</dt><dd>{formatMinutes(record.travelMinutes)}{record.travelKm!==null?' · '+record.travelKm+' km':''}</dd></div>
     <div><dt>Horas faturáveis</dt><dd>{formatMinutes(record.billableMinutes)} <small>(autorizadas no encerramento)</small></dd></div>
     {record.diagnosis&&<div><dt>Diagnóstico</dt><dd>{record.diagnosis}</dd></div>}{record.solution&&<div><dt>Solução</dt><dd>{record.solution}</dd></div>}
     {record.closedAt&&<div><dt>Encerramento</dt><dd>{format(record.closedAt)}{record.closingNote?' · '+record.closingNote:''}</dd></div>}
    </dl>
    {record.checkedInAt&&<p>Entrada registrada: {format(record.checkedInAt)}</p>}{record.checkedOutAt&&<p>Saída registrada: {format(record.checkedOutAt)}</p>}{record.interruptedAt&&<p>Interrupção: {format(record.interruptedAt)} (não representa checkout geolocalizado)</p>}
    <LocationPoint position={record.checkIn} label="Posição de entrada"/><LocationPoint position={record.checkOut} label="Posição de saída"/>
    <p className="nf-field-hint">Posições pontuais informadas pelo aparelho, sem comprovação física nem acompanhamento em tempo real.</p>{record.notes&&<p>{record.notes}</p>}
    {record.closedAt&&<div className="nf-crm-row-actions"><OrderFromSource company={company} source={{workOrderId:record.id}} permissions={account.permissions??[]} label="Gerar pedido de serviço"/></div>}
    <WorkOrderParts company={company} workId={record.id} canRegister={record.canRegisterParts} onChanged={()=>setRefresh(value=>value+1)}/>
    <HistoryTimeline title="Histórico da OS" events={history}/></>:
   <form className="nf-form" onSubmit={submit}><fieldset disabled={busy}>
    {editor==='new'?<>
     <label>Título da OS<input required minLength={2} maxLength={160} value={draft.title??''} onChange={event=>update('title',event.target.value)}/></label>
     <div className="nf-admin-grid"><label>Origem<select value={draft.origin} onChange={event=>setDraft(current=>({...current,origin:event.target.value,ticketId:'',partyId:'',propertyId:'',equipmentId:'',returnOfWorkId:''}))}>{canReadTickets&&<option value="chamado">A partir de chamado</option>}<option value="programada">Manutenção programada</option></select></label>
      {draft.origin==='chamado'&&<label>Chamado em aberto<select required value={draft.ticketId??''} onChange={event=>update('ticketId',event.target.value)}><option value="">Selecione</option>{tickets.map(item=><option key={item.id} value={item.id}>{item.number} — {item.title} ({item.partyName})</option>)}</select></label>}</div>
     {draft.origin==='chamado'&&<p className="nf-field-hint">Cliente, propriedade e equipamento vêm do chamado.</p>}
     {draft.origin==='programada'&&<><TechnicalSelect company={company} kind="customers" label="Cliente aprovado" value={draft.partyId??''} onChange={id=>setDraft(old=>({...old,partyId:id,propertyId:'',equipmentId:'',returnOfWorkId:''}))}/>
      <div className="nf-admin-grid"><label>Propriedade<select required value={draft.propertyId??''} disabled={!draft.partyId} onChange={event=>setDraft(old=>({...old,propertyId:event.target.value,equipmentId:''}))}><option value="">Selecione</option>{properties.map(item=><option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
       <label>Equipamento<select value={draft.equipmentId??''} disabled={!draft.propertyId} onChange={event=>update('equipmentId',event.target.value)}><option value="">Não informado</option>{equipment.filter(item=>item.propertyId===draft.propertyId).map(item=><option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
       <label>Retorno pela mesma falha de<select value={draft.returnOfWorkId??''} disabled={!previous.length} onChange={event=>update('returnOfWorkId',event.target.value)}><option value="">Não é retorno</option>{previous.map(item=><option key={item.id} value={item.id}>{item.number||item.title} — {item.title}</option>)}</select></label></div></>}
     <div className="nf-admin-grid"><TechnicalSelect company={company} kind="services" label="Serviço" value={draft.serviceId??''} onChange={id=>update('serviceId',id)}/><TechnicalSelect company={company} kind="technicians" label="Técnico" value={draft.technicianId??''} onChange={id=>update('technicianId',id)}/></div>
     <div className="nf-admin-grid"><label>Data e hora (São Paulo)<input type="datetime-local" required value={draft.startLocal??''} onChange={event=>update('startLocal',event.target.value)}/></label><label>Duração planejada (minutos)<input required type="number" min={15} max={480} value={draft.durationMinutes??'60'} onChange={event=>update('durationMinutes',event.target.value)}/></label></div>
     <label>Orientações para o técnico<textarea maxLength={2000} value={draft.notes??''} onChange={event=>update('notes',event.target.value)}/></label></>
    :<><p>{record?.number?record.number+' · ':''}{record?.title} · {record?.partyName}</p>
     {editor==='check-out'&&<><label>Diagnóstico<textarea required minLength={5} maxLength={3000} value={draft.diagnosis??''} onChange={event=>update('diagnosis',event.target.value)}/></label><label>Solução aplicada<textarea required minLength={5} maxLength={3000} value={draft.solution??''} onChange={event=>update('solution',event.target.value)}/></label>
      <div className="nf-admin-grid"><label>Horas trabalhadas<input required inputMode="decimal" placeholder="Ex.: 1,5" value={draft.laborHours??''} onChange={event=>update('laborHours',event.target.value)}/></label><label>Deslocamento (minutos)<input type="number" min={0} max={1440} required value={draft.travelMinutes??''} onChange={event=>update('travelMinutes',event.target.value)}/></label><label>Deslocamento (km)<input type="number" min={0} max={2000} required value={draft.travelKm??''} onChange={event=>update('travelKm',event.target.value)}/></label></div>
      <p className="nf-field-hint">O tempo de atendimento é medido pelo servidor entre check-in e checkout. As horas faturáveis são autorizadas pela coordenação no encerramento.</p></>}
     {editor==='close'&&record&&<><p>Execução: {formatMinutes(record.laborMinutes)} trabalhadas · deslocamento {formatMinutes(record.travelMinutes)}{record.travelKm!==null?' / '+record.travelKm+' km':''} · atendimento {formatMinutes(record.attendanceMinutes)}.</p>
      <div className="nf-admin-grid"><label>Horas autorizadas para cobrança<input required inputMode="decimal" placeholder="0 quando não houver" value={draft.billableHours??''} onChange={event=>update('billableHours',event.target.value)}/></label></div><label>Observação do encerramento<textarea maxLength={1000} value={draft.note??''} onChange={event=>update('note',event.target.value)}/></label></>}
     {['cancel','interrupt'].includes(editor??'')&&<label>Justificativa<textarea required minLength={10} maxLength={1000} value={draft.reason??''} onChange={event=>update('reason',event.target.value)}/></label>}
     {['check-in','check-out'].includes(editor??'')&&<><p>Captura pontual autorizada de localização no início e no fim. A posição do aparelho é informativa e não comprova presença física. Não há rastreamento contínuo.</p><label className="nf-check"><input type="checkbox" required checked={authorized} onChange={event=>setAuthorized(event.target.checked)}/>Autorizo registrar minha localização nesta operação.</label></>}</>}
    <button className="nf-primary" disabled={busy}>{busy?'Processando…':'Confirmar'}</button></fieldset></form>}
   {editor&&error&&<p role="alert" className="nf-error">{error}</p>}
  </Modal>
 </section>;
}
