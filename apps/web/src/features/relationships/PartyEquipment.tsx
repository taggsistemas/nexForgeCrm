import {useEffect,useState,type FormEvent} from 'react';
import {Modal} from '../../components/Modal';
import {HistoryTimeline} from '../../components/HistoryTimeline';
import {equipmentStatuses,equipmentStatusNames,type EquipmentView,type PartyHistoryEntry,type PartyListOptionView,type PartyView,type PropertyView} from '../../../../../packages/contracts/src/relationships';
import {relationshipApi} from './api';
import {optionLabel,selectableOptions} from './PartyLists';
import {PartyAttendances} from './PartyAttendances';
import {WorkOrderList} from '../technical/WorkOrderList';
import {ticketStatusNames,type TicketView} from '../../../../../packages/contracts/src/tickets';
const emptyDraft={propertyId:'',categoryId:'',brand:'',model:'',serialNumber:'',status:'em_operacao',installedAt:'',warrantyUntil:'',supplier:'',notes:''};
const day=(value:string|null)=>value?new Date(value+'T12:00:00Z').toLocaleDateString('pt-BR',{timeZone:'America/Sao_Paulo'}):'—';
export const equipmentFieldNames:Record<string,string>={'equipment.propertyId':'Propriedade','equipment.categoryId':'Categoria','equipment.brand':'Marca','equipment.model':'Modelo','equipment.serialNumber':'Número de série','equipment.status':'Situação','equipment.installedAt':'Instalação','equipment.warrantyUntil':'Garantia até','equipment.supplier':'Fornecedor'};
export const equipmentActionNames:Record<string,string>={'equipment.created':'Equipamento cadastrado','equipment.updated':'Equipamento alterado','equipment.archived':'Equipamento arquivado'};
export function equipmentValue(field:string,value:string){return field==='equipment.status'?equipmentStatusNames[value as keyof typeof equipmentStatusNames]??value:/^equipment\.(installedAt|warrantyUntil)$/.test(field)&&value?day(value):value||'vazio';}
/** Installed base of one customer. Each item sits on one of its active properties. */
export function PartyEquipment({companyId,record,lists,canWrite}:{companyId:string;record:PartyView;lists:PartyListOptionView[];canWrite:boolean}){
 const [rows,setRows]=useState<EquipmentView[]|null>(null),[properties,setProperties]=useState<PropertyView[]>([]),[filter,setFilter]=useState(''),[refresh,setRefresh]=useState(0);
 const [editor,setEditor]=useState<{row?:EquipmentView;archive?:boolean}|null>(null),[timeline,setTimeline]=useState<{row:EquipmentView;items:PartyHistoryEntry[]|null}|null>(null);
 const [draft,setDraft]=useState<Record<string,string>>(emptyDraft),[busy,setBusy]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState('');
 useEffect(()=>{
  const controller=new AbortController();
  relationshipApi(companyId,'/parties/'+record.id+'/properties?page=1',{signal:controller.signal}).then(data=>setProperties(data.items??[])).catch(()=>{});
  return()=>controller.abort();
 },[companyId,record.id]);
 useEffect(()=>{
  const controller=new AbortController();setRows(null);setError('');
  relationshipApi(companyId,'/parties/'+record.id+'/equipment?page=1'+(filter?'&propertyId='+filter:''),{signal:controller.signal}).then(data=>setRows(data.items??[])).catch(cause=>{if(!controller.signal.aborted){setRows([]);setError((cause as Error).message);}});
  return()=>controller.abort();
 },[companyId,record.id,filter,refresh]);
 function open(row?:EquipmentView,archive=false){setError('');setNotice('');setDraft(row?{propertyId:row.propertyId,categoryId:row.categoryId??'',brand:row.brand,model:row.model,serialNumber:row.serialNumber,status:row.status,installedAt:row.installedAt??'',warrantyUntil:row.warrantyUntil??'',supplier:row.supplier,notes:row.notes}:{...emptyDraft,propertyId:filter||properties[0]?.id||''});setEditor({row,archive});}
 async function showTimeline(row:EquipmentView){
  setTimeline({row,items:null});
  try{const data=await relationshipApi(companyId,'/parties/'+record.id+'/equipment/'+row.id+'/timeline');setTimeline({row,items:data.items??[]});}catch(cause){setTimeline(null);setError((cause as Error).message);}
 }
 const update=(key:string,value:string)=>setDraft(current=>({...current,[key]:value}));
 async function submit(event:FormEvent){
  event.preventDefault();if(!editor)return;
  if(!editor.archive&&draft.installedAt&&draft.warrantyUntil&&draft.warrantyUntil<draft.installedAt){setError('A garantia não pode terminar antes da instalação.');return;}
  const base='/parties/'+record.id+'/equipment'+(editor.row?'/'+editor.row.id:'');
  const body=editor.archive?{version:editor.row!.version}:{propertyId:draft.propertyId,categoryId:draft.categoryId||null,brand:draft.brand,model:draft.model,serialNumber:draft.serialNumber,status:draft.status,installedAt:draft.installedAt||null,warrantyUntil:draft.warrantyUntil||null,supplier:draft.supplier,notes:draft.notes,...(editor.row?{version:editor.row.version}:{})};
  setBusy(true);setError('');
  try{await relationshipApi(companyId,editor.archive?base+'/archive':base,{method:editor.row&&!editor.archive?'PATCH':'POST',body:JSON.stringify(body)});setNotice(editor.archive?'Equipamento arquivado.':'Equipamento salvo.');setEditor(null);setRefresh(value=>value+1);}
  catch(cause){setError((cause as Error).message);}finally{setBusy(false);}
 }
 const field=(key:string,label:string,max:number,required=false)=><label>{label}<input value={draft[key]??''} maxLength={max} required={required} onChange={event=>update(key,event.target.value)}/></label>;
 return <>
  <div className="nf-section-heading"><h3>Parque instalado</h3>{canWrite&&<button type="button" className="nf-primary" disabled={!properties.length} onClick={()=>open()}>+ Novo equipamento</button>}</div>
  {canWrite&&!properties.length&&<p className="nf-field-hint">Cadastre uma propriedade antes de incluir equipamentos.</p>}
  <label>Filtrar por propriedade<select value={filter} onChange={event=>setFilter(event.target.value)}><option value="">Todas as propriedades</option>{properties.map(row=><option key={row.id} value={row.id}>{row.name}</option>)}</select></label>
  {!editor&&!timeline&&error&&<p role="alert" className="nf-error">{error}</p>}{notice&&<p role="status" className="nf-admin-success">{notice}</p>}
  {rows===null?<p role="status">Carregando equipamentos...</p>:!rows.length?<p className="nf-muted">Nenhum equipamento cadastrado{filter?' nesta propriedade':''}.</p>:<ul className="nf-property-list">{rows.map(row=><li key={row.id}><div><strong>{row.brand} {row.model}</strong><span className="nf-badge">{equipmentStatusNames[row.status]}</span></div><p>{optionLabel(lists,row.categoryId)} · {row.propertyName}</p><small>Série: {row.serialNumber||'não informada'} · Instalação: {day(row.installedAt)} · Garantia até: {day(row.warrantyUntil)}</small><div className="nf-crm-row-actions"><button type="button" className="nf-secondary" onClick={()=>void showTimeline(row)}>Linha do tempo</button>{canWrite&&<><button type="button" className="nf-secondary" onClick={()=>open(row)}>Editar</button><button type="button" className="nf-secondary" onClick={()=>open(row,true)}>Arquivar</button></>}</div></li>)}</ul>}
  <Modal open={Boolean(editor)} title={editor?.archive?'Arquivar equipamento':editor?.row?'Editar equipamento':'Novo equipamento'} busy={busy} onClose={()=>{setEditor(null);setError('');}}>
   <form className="nf-form" onSubmit={submit}><fieldset disabled={busy}>
    {editor?.archive?<p>Arquivar <strong>{editor.row?.brand} {editor.row?.model}</strong>? O equipamento deixa o parque ativo e o número de série fica livre; a linha do tempo é preservada.</p>:<>
    <div className="nf-admin-grid">
     <label>Propriedade<select value={draft.propertyId} required onChange={event=>update('propertyId',event.target.value)}><option value="">Selecione</option>{properties.map(row=><option key={row.id} value={row.id}>{row.name}</option>)}</select></label>
     <label>Categoria<select value={draft.categoryId} onChange={event=>update('categoryId',event.target.value)}><option value="">Não informada</option>{selectableOptions(lists,'equipmentCategory',draft.categoryId??'').map(option=><option key={option.id} value={option.id}>{option.label}{option.active?'':' (inativa)'}</option>)}</select></label>
     {field('brand','Marca',80,true)}{field('model','Modelo',120,true)}{field('serialNumber','Número de série',80)}
     <label>Situação<select value={draft.status} onChange={event=>update('status',event.target.value)}>{equipmentStatuses.map(value=><option key={value} value={value}>{equipmentStatusNames[value]}</option>)}</select></label>
     <label>Data de instalação<input type="date" value={draft.installedAt} onChange={event=>update('installedAt',event.target.value)}/></label>
     <label>Garantia até<input type="date" value={draft.warrantyUntil} min={draft.installedAt||undefined} onChange={event=>update('warrantyUntil',event.target.value)}/></label>
     {field('supplier','Fornecedor / assistência',120)}
    </div>
    <p className="nf-field-hint">O número de série é único entre os equipamentos ativos da empresa; letras, espaços e traços são comparados sem distinção.</p>
    <label>Observações<textarea value={draft.notes} maxLength={2000} onChange={event=>update('notes',event.target.value)} placeholder="Configuração, acessórios e informações técnicas."/></label></>}
    {error&&<p role="alert" className="nf-error">{error}</p>}
    <div className="nf-admin-actions"><button type="button" className="nf-secondary" disabled={busy} onClick={()=>{setEditor(null);setError('');}}>Cancelar</button><button className="nf-primary" disabled={busy}>{busy?'Salvando...':editor?.archive?'Confirmar arquivamento':'Salvar equipamento'}</button></div>
   </fieldset></form>
  </Modal>
  <Modal open={Boolean(timeline)} title={timeline?'Linha do tempo — '+timeline.row.brand+' '+timeline.row.model:'Linha do tempo'} onClose={()=>setTimeline(null)}>
   {timeline?.items===null?<p role="status">Carregando linha do tempo...</p>:<HistoryTimeline title="Eventos do equipamento" events={(timeline?.items??[]).map(event=>({action:equipmentActionNames[event.action]??'Alteração registrada',actor:event.actor,at:event.at,detail:event.changes.map(change=>(equipmentFieldNames[change.field]??change.field)+': '+equipmentValue(change.field,change.before)+' → '+equipmentValue(change.field,change.after)).join(' · ')}))}/>}
   {timeline&&<section className="nf-history"><div className="nf-history-heading"><h3>Atendimentos no equipamento</h3></div><PartyAttendances companyId={companyId} partyId={record.id} equipmentId={timeline.row.id}/></section>}
   {timeline&&<EquipmentTickets companyId={companyId} partyId={record.id} equipmentId={timeline.row.id}/>}
   {timeline&&<WorkOrderList companyId={companyId} query={{partyId:record.id,equipmentId:timeline.row.id}} title="Ordens de serviço do equipamento"/>}
   <p className="nf-field-hint">Peças utilizadas aparecem em cada ordem de serviço.</p>
  </Modal>
 </>;
}
/** Tickets on one equipment; hidden when the profile cannot read tickets. */
function EquipmentTickets({companyId,partyId,equipmentId}:{companyId:string;partyId:string;equipmentId:string}){
 const [rows,setRows]=useState<TicketView[]|null>(null);
 useEffect(()=>{const controller=new AbortController();fetch('/api/v1/companies/'+companyId+'/tickets?status=all&partyId='+partyId+'&equipmentId='+equipmentId,{credentials:'same-origin',cache:'no-store',signal:controller.signal}).then(response=>response.ok?response.json():null).then(data=>setRows(data?data.items??[]:null)).catch(()=>{});return()=>controller.abort();},[companyId,partyId,equipmentId]);
 if(!rows)return null;
 return <section className="nf-history"><div className="nf-history-heading"><h3>Chamados do equipamento</h3><span>{rows.length} chamado(s)</span></div>{!rows.length?<p className="nf-muted">Nenhum chamado registrado.</p>:<ul className="nf-property-list">{rows.map(row=><li key={row.id}><div><strong>{row.number} · {row.title}</strong><span className="nf-badge">{ticketStatusNames[row.status]}</span></div><small>Aberto em {new Date(row.openedAt).toLocaleString('pt-BR',{timeZone:'America/Sao_Paulo',dateStyle:'short',timeStyle:'short'})}{row.previousTicketNumber?' · retorno de '+row.previousTicketNumber:''}</small>{row.solution&&<p>Solução: {row.solution}</p>}</li>)}</ul>}</section>;
}
