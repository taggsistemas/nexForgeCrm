import {useEffect,useState} from 'react';
import type {AttendanceView} from '../../../../../packages/contracts/src/agenda';
import type {PropertyView} from '../../../../../packages/contracts/src/relationships';
const names:Record<string,string>={visita:'Visita',ligacao:'Ligação',email:'E-mail',reuniao:'Reunião',tarefa:'Tarefa',pendente:'Pendente',concluida:'Concluída',cancelada:'Cancelada',realizada:'Visita realizada',contato_ausente:'Contato ausente',cliente_fechado:'Cliente fechado',nao_realizada:'Visita não realizada'};
const when=(value:string)=>new Date(value).toLocaleString('pt-BR',{timeZone:'America/Sao_Paulo',dateStyle:'short',timeStyle:'short'});
/** Agenda and field history of a customer; optionally fixed to one equipment or filtered by property. Read-only. */
export function PartyAttendances({companyId,partyId,equipmentId,properties}:{companyId:string;partyId:string;equipmentId?:string;properties?:PropertyView[]}){
 const [propertyId,setPropertyId]=useState(''),[page,setPage]=useState(1),[rows,setRows]=useState<AttendanceView[]|null>(null),[total,setTotal]=useState(0),[error,setError]=useState('');
 useEffect(()=>{
  const controller=new AbortController();setRows(null);setError('');
  const query=new URLSearchParams({page:String(page),...(propertyId?{propertyId}:{}),...(equipmentId?{equipmentId}:{})});
  fetch('/api/v1/companies/'+companyId+'/agenda/parties/'+partyId+'/attendances?'+query,{credentials:'same-origin',cache:'no-store',signal:controller.signal})
   .then(async response=>{if(!response.ok)throw Error(response.status===403?'Seu perfil não consulta a agenda.':'Não foi possível carregar os atendimentos.');return response.json();})
   .then(data=>{setRows(data.items??[]);setTotal(data.total??0);}).catch(cause=>{if(!controller.signal.aborted){setRows([]);setError((cause as Error).message);}});
  return()=>controller.abort();
 },[companyId,partyId,equipmentId,propertyId,page]);
 return <section className="nf-attendances" aria-label="Atendimentos">
  {properties&&properties.length>0&&<label>Filtrar por propriedade<select value={propertyId} onChange={event=>{setPropertyId(event.target.value);setPage(1);}}><option value="">Todas</option>{properties.map(row=><option key={row.id} value={row.id}>{row.name}</option>)}</select></label>}
  {error&&<p role="alert" className="nf-error">{error}</p>}
  {rows===null?<p role="status">Carregando atendimentos...</p>:!rows.length?<p className="nf-muted">Nenhum atendimento registrado{equipmentId?' para este equipamento':propertyId?' nesta propriedade':''}.</p>:<ul className="nf-property-list">{rows.map(row=><li key={row.source+row.id}><div><strong>{row.title}</strong><span className="nf-badge">{names[row.fieldOutcome??'']??names[row.status]??row.status}</span></div>
   <p>{when(row.dueAt)} · {names[row.type]??row.type} · {row.ownerName}{row.opportunityTitle?' · Oportunidade: '+row.opportunityTitle:''}</p>
   {(row.propertyName||row.equipmentName)&&<small>{[row.propertyName,row.equipmentName].filter(Boolean).join(' · ')}</small>}
   {row.objective&&<p>Objetivo: {row.objective}</p>}{row.result&&<p>Resultado: {row.result}</p>}{row.nextAction&&<p>Próxima ação: {row.nextAction}</p>}</li>)}</ul>}
  {total>20&&<div className="nf-crm-pagination"><button type="button" className="nf-secondary" disabled={page<=1} onClick={()=>setPage(value=>value-1)}>Anterior</button><span>Página {page} · {total} atendimento(s)</span><button type="button" className="nf-secondary" disabled={page*20>=total} onClick={()=>setPage(value=>value+1)}>Próxima</button></div>}
 </section>;
}
