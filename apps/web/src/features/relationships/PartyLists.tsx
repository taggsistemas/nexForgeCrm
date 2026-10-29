import {useEffect,useState,type FormEvent} from 'react';
import {Modal} from '../../components/Modal';
import {partyListKinds,partyListNames,type PartyListKind,type PartyListOptionView} from '../../../../../packages/contracts/src/relationships';
import {relationshipApi} from './api';
export const classificationFields:{key:'originId'|'segmentId'|'classificationId'|'potentialId';kind:PartyListKind}[]=[{key:'originId',kind:'origin'},{key:'segmentId',kind:'segment'},{key:'classificationId',kind:'classification'},{key:'potentialId',kind:'potential'}];
/** Company lists; a failed read leaves selects empty instead of inventing options. */
export function usePartyLists(companyId:string,refresh=0){
 const [items,setItems]=useState<PartyListOptionView[]>([]);
 useEffect(()=>{
  if(!companyId){setItems([]);return;}
  const controller=new AbortController();setItems([]);
  relationshipApi(companyId,'/lists',{signal:controller.signal}).then(data=>setItems(Array.isArray(data?.items)?data.items:[])).catch(()=>{});
  return()=>controller.abort();
 },[companyId,refresh]);
 return items;
}
export function optionLabel(items:PartyListOptionView[],id:string|null|undefined){return id?items.find(item=>item.id===id)?.label??'Opção indisponível':'—';}
/** Active options plus the record's current one, even if it was deactivated later. */
export function selectableOptions(items:PartyListOptionView[],kind:PartyListKind,current:string){return items.filter(item=>item.kind===kind&&(item.active||item.id===current)).sort((a,b)=>a.order-b.order||a.label.localeCompare(b.label,'pt-BR'));}
export function PartyListSettings({companyId,open,onClose,onChanged}:{companyId:string;open:boolean;onClose:()=>void;onChanged:()=>void}){
 const [refresh,setRefresh]=useState(0),items=usePartyLists(open?companyId:'',refresh);
 const [kind,setKind]=useState<PartyListKind>('origin'),[label,setLabel]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState('');
 async function save(path:string,method:string,body:unknown,message:string){
  setBusy(true);setError('');setNotice('');
  try{await relationshipApi(companyId,path,{method,body:JSON.stringify(body)});setNotice(message);setRefresh(value=>value+1);onChanged();}catch(cause){setError((cause as Error).message);}finally{setBusy(false);}
 }
 function add(event:FormEvent){event.preventDefault();if(!label.trim())return;const order=items.filter(item=>item.kind===kind).reduce((max,item)=>Math.max(max,item.order+1),0);void save('/lists','POST',{kind,label:label.trim(),order},'Opção incluída.').then(()=>setLabel(''));}
 return <Modal open={open} title="Listas do cadastro" busy={busy} onClose={onClose}>
  <p className="nf-muted">As opções valem para esta empresa. Desativar uma opção impede novos usos, mas preserva os cadastros que já a utilizam.</p>
  <div role="tablist" aria-label="Lista" className="nf-crm-toolbar">{partyListKinds.map(value=><button key={value} type="button" role="tab" aria-selected={kind===value} className={kind===value?'nf-primary':'nf-secondary'} onClick={()=>{setKind(value);setNotice('');setError('');}}>{partyListNames[value]}</button>)}</div>
  <form className="nf-form" onSubmit={add}><fieldset disabled={busy}><div className="nf-admin-grid"><label>Nova opção de {partyListNames[kind].toLocaleLowerCase('pt-BR')}<input value={label} maxLength={80} onChange={event=>setLabel(event.target.value)}/></label></div><div className="nf-admin-actions"><button className="nf-primary">Incluir opção</button></div></fieldset></form>
  {error&&<p role="alert" className="nf-error">{error}</p>}{notice&&<p role="status" className="nf-admin-success">{notice}</p>}
  <div className="nf-table-scroll"><table className="nf-admin-table"><thead><tr><th>Opção</th><th>Situação</th><th>Ações</th></tr></thead><tbody>{items.filter(item=>item.kind===kind).sort((a,b)=>a.order-b.order).map(item=><ListRow key={item.id+':'+item.version} item={item} busy={busy} onSave={(body,message)=>save('/lists/'+item.id,'PATCH',{...body,version:item.version},message)}/>)}</tbody></table></div>
 </Modal>;
}
function ListRow({item,busy,onSave}:{item:PartyListOptionView;busy:boolean;onSave:(body:Record<string,unknown>,message:string)=>void}){
 const [label,setLabel]=useState(item.label);
 return <tr><td><label className="nf-sr-only" htmlFor={'list-'+item.id}>Nome da opção</label><input id={'list-'+item.id} value={label} maxLength={80} disabled={busy} onChange={event=>setLabel(event.target.value)}/></td><td>{item.active?'Ativa':'Inativa'}</td><td><div className="nf-crm-row-actions"><button type="button" className="nf-secondary" disabled={busy||!label.trim()||label.trim()===item.label} onClick={()=>onSave({label:label.trim()},'Opção renomeada.')}>Salvar nome</button><button type="button" className="nf-secondary" disabled={busy} onClick={()=>onSave({active:!item.active},item.active?'Opção desativada.':'Opção reativada.')}>{item.active?'Desativar':'Reativar'}</button></div></td></tr>;
}
