import {useEffect,useState,type FormEvent} from 'react';
import {Modal} from '../../components/Modal';
import {brazilStates,maskPostalCode} from '../../../../../packages/contracts/src/customer';
import type {ContactView,PartyView,PropertyView} from '../../../../../packages/contracts/src/relationships';
import {relationshipApi} from './api';
type Draft=Record<string,string>;
const emptyDraft={name:'',regionId:'',postalCode:'',street:'',number:'',complement:'',neighborhood:'',city:'',state:'',country:'Brasil',latitude:'',longitude:'',notes:''};
function draftOf(row?:PropertyView):Draft{return row?{name:row.name,regionId:row.regionId??'',...row.address,latitude:row.coordinates?String(row.coordinates.latitude):'',longitude:row.coordinates?String(row.coordinates.longitude):'',notes:row.notes}:{...emptyDraft};}
const number=(value:string)=>Number(value.trim().replace(',','.'));
/** Properties of one customer or lead. Territory is chosen per property; coordinates are typed, never captured from the device. */
export function PartyProperties({companyId,record,canWrite}:{companyId:string;record:PartyView;canWrite:boolean}){
 const [rows,setRows]=useState<PropertyView[]|null>(null),[refresh,setRefresh]=useState(0),[regions,setRegions]=useState<{id:string;name:string}[]>([]),[contacts,setContacts]=useState<ContactView[]>([]);
 const [editor,setEditor]=useState<{row?:PropertyView;archive?:boolean}|null>(null),[draft,setDraft]=useState<Draft>(draftOf()),[contactIds,setContactIds]=useState<string[]>([]),[busy,setBusy]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState('');
 useEffect(()=>{
  const controller=new AbortController();setRows(null);setError('');
  relationshipApi(companyId,'/parties/'+record.id+'/properties?page=1',{signal:controller.signal}).then(data=>setRows(data.items??[])).catch(cause=>{if(!controller.signal.aborted){setRows([]);setError((cause as Error).message);}});
  return()=>controller.abort();
 },[companyId,record.id,refresh]);
 useEffect(()=>{
  if(!editor||editor.archive)return;
  const controller=new AbortController();
  fetch('/api/v1/companies/'+companyId+'/territories/options?kind=regions',{credentials:'same-origin',cache:'no-store',signal:controller.signal}).then(response=>response.ok?response.json():{items:[]}).then(data=>setRegions(Array.isArray(data?.items)?data.items:[])).catch(()=>{});
  relationshipApi(companyId,'/parties/'+record.id+'/contacts?page=1',{signal:controller.signal}).then(data=>setContacts(data.items??[])).catch(()=>{});
  return()=>controller.abort();
 },[companyId,record.id,editor]);
 function open(row?:PropertyView,archive=false){setError('');setNotice('');setDraft(draftOf(row));setContactIds(row?.contactIds??[]);setEditor({row,archive});}
 const update=(key:string,value:string)=>setDraft(current=>({...current,[key]:value}));
 async function submit(event:FormEvent){
  event.preventDefault();if(!editor)return;
  const hasCoordinates=Boolean(draft.latitude?.trim()||draft.longitude?.trim());
  if(!editor.archive&&hasCoordinates&&(!Number.isFinite(number(draft.latitude??''))||!Number.isFinite(number(draft.longitude??''))||Math.abs(number(draft.latitude??''))>90||Math.abs(number(draft.longitude??''))>180)){setError('Informe latitude entre -90 e 90 e longitude entre -180 e 180, ou deixe ambas em branco.');return;}
  const base='/parties/'+record.id+'/properties'+(editor.row?'/'+editor.row.id:'');
  const body=editor.archive?{version:editor.row!.version}:{name:draft.name,regionId:draft.regionId||null,address:Object.fromEntries(['postalCode','street','number','complement','neighborhood','city','state','country'].map(key=>[key,draft[key]??''])),coordinates:hasCoordinates?{latitude:number(draft.latitude!),longitude:number(draft.longitude!)}:null,contactIds,notes:draft.notes??'',...(editor.row?{version:editor.row.version}:{})};
  setBusy(true);setError('');
  try{await relationshipApi(companyId,editor.archive?base+'/archive':base,{method:editor.row&&!editor.archive?'PATCH':'POST',body:JSON.stringify(body)});setNotice(editor.archive?'Propriedade arquivada.':'Propriedade salva.');setEditor(null);setRefresh(value=>value+1);}
  catch(cause){setError((cause as Error).message);}finally{setBusy(false);}
 }
 const field=(key:string,label:string,max:number,required=false)=><label>{label}<input value={draft[key]??''} maxLength={max} required={required} onChange={event=>update(key,event.target.value)}/></label>;
 const brazil=['BR','BRASIL','BRAZIL'].includes((draft.country??'').toUpperCase());
 return <>
  <div className="nf-section-heading"><h3>Propriedades e locais de atendimento</h3>{canWrite&&<button type="button" className="nf-primary" onClick={()=>open()}>+ Nova propriedade</button>}</div>
  {!editor&&error&&<p role="alert" className="nf-error">{error}</p>}{notice&&<p role="status" className="nf-admin-success">{notice}</p>}
  {rows===null?<p role="status">Carregando propriedades...</p>:!rows.length?<p className="nf-muted">Nenhuma propriedade cadastrada. Cada propriedade tem território, endereço e contatos próprios.</p>:<ul className="nf-property-list">{rows.map(row=><li key={row.id}><div><strong>{row.name}</strong><span className="nf-badge">{row.regionName||'Sem território'}</span></div><p>{[row.address.street,row.address.number,row.address.neighborhood,row.address.city,row.address.state].filter(Boolean).join(', ')||'Endereço não informado'}</p><small>{row.contactIds.length} contato(s) vinculado(s){row.coordinates?' · Coordenadas informadas':''}</small>{canWrite&&<div className="nf-crm-row-actions"><button type="button" className="nf-secondary" onClick={()=>open(row)}>Editar</button><button type="button" className="nf-secondary" onClick={()=>open(row,true)}>Arquivar</button></div>}</li>)}</ul>}
  <Modal open={Boolean(editor)} title={editor?.archive?'Arquivar propriedade':editor?.row?'Editar propriedade':'Nova propriedade'} busy={busy} onClose={()=>{setEditor(null);setError('');}}>
   <form className="nf-form" onSubmit={submit}><fieldset disabled={busy}>
    {editor?.archive?<p>Arquivar <strong>{editor.row?.name}</strong>? A propriedade deixa as listas ativas; o histórico é preservado.</p>:<>
    <p className="nf-muted">Cliente: <strong>{record.name}</strong>. O território da propriedade orienta atendimentos e painéis, independentemente da carteira do vendedor.</p>
    <div className="nf-admin-grid">{field('name','Nome da propriedade',120,true)}
     <label>Território<select value={draft.regionId??''} onChange={event=>update('regionId',event.target.value)}><option value="">Não definido</option>{regions.map(region=><option key={region.id} value={region.id}>{region.name}</option>)}{draft.regionId&&!regions.some(region=>region.id===draft.regionId)&&<option value={draft.regionId}>{editor?.row?.regionName||'Território atual'}</option>}</select></label>
    </div>
    <fieldset className="nf-form-section"><legend>Endereço</legend><div className="nf-admin-grid">{field('country','País',80)}
     <label>CEP<input value={brazil?maskPostalCode(draft.postalCode??''):draft.postalCode??''} maxLength={20} onChange={event=>update('postalCode',brazil?maskPostalCode(event.target.value):event.target.value)}/></label>
     {field('street','Estrada / logradouro',160)}{field('number','Número / km',20)}{field('complement','Complemento',120)}{field('neighborhood','Localidade / bairro',120)}{field('city','Município',120)}
     {brazil?<label>UF<select value={draft.state??''} onChange={event=>update('state',event.target.value)}><option value="">Selecione</option>{brazilStates.map(value=><option key={value}>{value}</option>)}</select></label>:field('state','Estado / província',60)}
    </div></fieldset>
    <fieldset className="nf-form-section"><legend>Coordenadas (opcional)</legend><div className="nf-admin-grid"><label>Latitude<input inputMode="decimal" value={draft.latitude??''} maxLength={14} placeholder="-24.791234" onChange={event=>update('latitude',event.target.value)}/></label><label>Longitude<input inputMode="decimal" value={draft.longitude??''} maxLength={15} placeholder="-50.011234" onChange={event=>update('longitude',event.target.value)}/></label></div><p className="nf-field-hint">Digite as coordenadas do cadastro, se conhecidas. Elas não registram a presença de ninguém no local.</p></fieldset>
    <fieldset className="nf-form-section"><legend>Contatos da propriedade</legend>{!contacts.length?<p className="nf-muted">Nenhum contato cadastrado para este cliente.</p>:<div className="nf-check-grid">{contacts.map(contact=><label key={contact.id} className="nf-check"><input type="checkbox" checked={contactIds.includes(contact.id)} onChange={event=>setContactIds(current=>event.target.checked?[...current,contact.id]:current.filter(value=>value!==contact.id))}/>{contact.name}</label>)}</div>}</fieldset>
    <label>Observações<textarea value={draft.notes??''} maxLength={2000} onChange={event=>update('notes',event.target.value)} placeholder="Acesso, referências e informações úteis ao atendimento."/></label></>}
    {error&&<p role="alert" className="nf-error">{error}</p>}
    <div className="nf-admin-actions"><button type="button" className="nf-secondary" disabled={busy} onClick={()=>{setEditor(null);setError('');}}>Cancelar</button><button className="nf-primary" disabled={busy}>{busy?'Salvando...':editor?.archive?'Confirmar arquivamento':'Salvar propriedade'}</button></div>
   </fieldset></form>
  </Modal>
 </>;
}
