import {useEffect,useState} from 'react';
import {Modal} from '../../components/Modal';
import {HistoryTimeline} from '../../components/HistoryTimeline';
import {maskPhone,maskTaxId} from '../../../../../packages/contracts/src/customer';
import {contactChannelNames,contactRoleNames,partyListNames,type ContactView,type PartyHistoryEntry,type PartyListOptionView,type PartyView} from '../../../../../packages/contracts/src/relationships';
import {relationshipApi} from './api';
import {classificationFields,optionLabel} from './PartyLists';
import {qualificationNames} from './QualificationModal';
import {PartyProperties} from './PartyProperties';
import {PartyEquipment,equipmentActionNames,equipmentFieldNames,equipmentValue} from './PartyEquipment';
type Tab='summary'|'properties'|'equipment'|'contacts'|'history';
const tabNames:Record<Tab,string>={summary:'Resumo',properties:'Propriedades',equipment:'Equipamentos',contacts:'Contatos',history:'Histórico'};
const fieldNames:Record<string,string>={name:'Nome',legalName:'Razão social',taxId:'CPF/CNPJ',stateRegistration:'Inscrição estadual',ownerId:'Responsável comercial',technicalOwnerId:'Responsável técnico',originId:'Origem',segmentId:'Segmento',classificationId:'Classificação',potentialId:'Potencial',kind:'Tipo de cadastro',communicationConsent:'Consentimento de comunicação',propertyName:'Propriedade',propertyCity:'Município',propertyRegionId:'Território',propertyCoordinates:'Coordenadas',label:'Nome da opção',active:'Opção ativa'};
const actionNames:Record<string,string>={'lead.created':'Lead cadastrado','customer.created':'Cliente cadastrado','party.updated':'Cadastro alterado','party.archived':'Cadastro arquivado','lead.converted':'Lead convertido em cliente','customer.regularized':'Cliente regularizado','lead.stage_changed':'Etapa do lead alterada','contact.created':'Contato incluído','contact.updated':'Contato alterado','contact.archived':'Contato arquivado','property.created':'Propriedade cadastrada','property.updated':'Propriedade alterada','property.archived':'Propriedade arquivada','qualification.draft_saved':'Qualificação salva','qualification.submitted':'Qualificação enviada para análise','qualification.returned':'Qualificação devolvida','qualification.approved':'Qualificação aprovada'};
const shown=(field:string,value:string)=>field.startsWith('equipment.')?equipmentValue(field,value):field==='taxId'&&value?maskTaxId(value,value.length===11?'CPF':'CNPJ'):field==='communicationConsent'?(value==='true'?'Concedido':'Não concedido'):field==='kind'?(value==='lead'?'Lead':value==='customer'?'Cliente':value):value||'vazio';
/** Read-only customer record. Editing stays in the existing modals; this view never widens access. */
export function PartyRecord({companyId,record,lists,people,permissions,onClose,onManageContacts}:{companyId:string;record:PartyView|null;lists:PartyListOptionView[];people:Map<string,string>;permissions:readonly string[];onClose:()=>void;onManageContacts?:(record:PartyView)=>void}){
 const [tab,setTab]=useState<Tab>('summary'),[contacts,setContacts]=useState<ContactView[]|null>(null),[history,setHistory]=useState<PartyHistoryEntry[]|null>(null),[error,setError]=useState('');
 useEffect(()=>{setTab('summary');setContacts(null);setHistory(null);setError('');},[record?.id]);
 useEffect(()=>{
  if(!record||['summary','properties','equipment'].includes(tab))return;
  const controller=new AbortController();setError('');
  const path=tab==='contacts'?'/parties/'+record.id+'/contacts?page=1':'/parties/'+record.id+'/history';
  relationshipApi(companyId,path,{signal:controller.signal}).then(data=>tab==='contacts'?setContacts(data.items??[]):setHistory(data.items??[])).catch(cause=>{if(!controller.signal.aborted)setError((cause as Error).message);});
  return()=>controller.abort();
 },[companyId,record?.id,tab]);
 if(!record)return null;
 const address=[record.address.street,record.address.number,record.address.neighborhood,record.address.city,record.address.state].filter(Boolean).join(', ');
 const qualification=record.kind==='customer'&&(!record.qualification||record.qualification.state==='none')?'Legado — revisão pendente':qualificationNames[record.qualification?.state??'none'];
 return <Modal open title={'Ficha — '+record.name} onClose={onClose}>
  <div role="tablist" aria-label="Seções da ficha" className="nf-record-tabs">{(Object.keys(tabNames) as Tab[]).map(value=><button key={value} type="button" role="tab" id={'record-tab-'+value} aria-controls={'record-panel-'+value} aria-selected={tab===value} className={tab===value?'nf-primary':'nf-secondary'} onClick={()=>setTab(value)}>{tabNames[value]}</button>)}</div>
  {error&&<p role="alert" className="nf-error">{error}</p>}
  <section role="tabpanel" id={'record-panel-'+tab} aria-labelledby={'record-tab-'+tab}>
  {tab==='summary'&&<dl className="nf-record-summary">
   <div><dt>Tipo</dt><dd>{record.kind==='lead'?'Lead':'Cliente'} · {qualification}</dd></div>
   <div><dt>Razão social</dt><dd>{record.legalName||'—'}</dd></div>
   <div><dt>CPF/CNPJ</dt><dd>{record.taxId?maskTaxId(record.taxId,record.taxId.length===11?'CPF':'CNPJ'):'—'}</dd></div>
   <div><dt>Contato principal</dt><dd>{record.contactName||'—'}<br/>{record.email||'—'} · {maskPhone(record.phone)||'—'}</dd></div>
   {classificationFields.map(item=><div key={item.key}><dt>{partyListNames[item.kind]}</dt><dd>{optionLabel(lists,record[item.key])}</dd></div>)}
   <div><dt>Próxima ação</dt><dd>{record.nextAction?.date?new Date(record.nextAction.date+'T12:00:00Z').toLocaleDateString('pt-BR',{timeZone:'America/Sao_Paulo'}):'Sem data'}{record.nextAction?.description?' — '+record.nextAction.description:''}</dd></div>
   <div><dt>Responsável comercial</dt><dd>{people.get(record.ownerId)??'Responsável da carteira'}</dd></div>
   <div><dt>Responsável técnico</dt><dd>{record.technicalOwnerId?people.get(record.technicalOwnerId)??'Definido':'Não definido'}</dd></div>
   <div><dt>Endereço</dt><dd>{address||'Não informado'}</dd></div>
   {record.notes&&<div><dt>Anotações</dt><dd>{record.notes}</dd></div>}
  </dl>}
  {tab==='properties'&&<PartyProperties companyId={companyId} record={record} canWrite={permissions.includes(record.kind==='lead'?'lead:write':'customer:write')}/>}
  {tab==='equipment'&&<PartyEquipment companyId={companyId} record={record} lists={lists} canWrite={permissions.includes(record.kind==='lead'?'lead:write':'customer:write')}/>}
  {tab==='contacts'&&(contacts===null?<p role="status">Carregando contatos...</p>:<>{!contacts.length?<p className="nf-muted">Nenhum contato vinculado.</p>:<div className="nf-table-scroll"><table className="nf-admin-table"><thead><tr><th>Nome</th><th>Papéis</th><th>Canal preferido</th><th>Comunicação</th></tr></thead><tbody>{contacts.map(contact=><tr key={contact.id}><td><strong>{contact.name}</strong><small>{contact.email||maskPhone(contact.phone)||'—'}</small></td><td>{contact.roles?.length?contact.roles.map(role=>contactRoleNames[role]).join(', '):'—'}</td><td>{contact.preferredChannel?contactChannelNames[contact.preferredChannel]:'—'}</td><td>{contact.communicationConsent?.granted?'Autorizada':'Não autorizada'}</td></tr>)}</tbody></table></div>}{onManageContacts&&<div className="nf-admin-actions"><button type="button" className="nf-secondary" onClick={()=>onManageContacts(record)}>Gerenciar contatos</button></div>}</>)}
  {tab==='history'&&(history===null?<p role="status">Carregando histórico...</p>:<HistoryTimeline title="Alterações registradas" events={history.map(event=>({action:actionNames[event.action]??equipmentActionNames[event.action]??'Alteração registrada',actor:event.actor,at:event.at,reason:event.reason,detail:event.changes.map(change=>(fieldNames[change.field]??equipmentFieldNames[change.field]??change.field)+': '+shown(change.field,change.before)+' → '+shown(change.field,change.after)).join(' · ')}))}/>)}
  </section>
 </Modal>;
}
