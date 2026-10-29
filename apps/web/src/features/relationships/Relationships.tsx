import {QualificationModal,qualificationNames} from './QualificationModal';
import {useEffect,useState,type FormEvent} from 'react';
import {Modal} from '../../components/Modal';
import {brazilStates,digits,maskPhone,maskPostalCode,maskTaxId,maskStateRegistration,normalizeTaxId,validTaxId} from '../../../../../packages/contracts/src/customer';
import {customerTypes,leadStages,type PartyView,type ContactView} from '../../../../../packages/contracts/src/relationships';
type Ref={id:string;name:string;kind:'lead'|'customer'};
type Mode='lead'|'customer'|'contact';
type Row=PartyView|ContactView;
type Editor={action:'party'|'contact'|'archive'|'convert';record?:Row}|null;
type Account={user:{id?:string;name:string};companies:{id:string;name:string}[];permissions?:string[]};
const stageNames:Record<string,string>={novo:'Novo',em_contato:'Em contato',qualificado:'Qualificado',descartado:'Descartado'};
const emptyAddress={postalCode:'',street:'',number:'',complement:'',neighborhood:'',city:'',state:'',country:'Brasil'};
function draftOf(record?:Row):Record<string,string>{
 const address=record&&'kind'in record?record.address:emptyAddress;
 return {name:record?.name??'',contactName:record&&'kind'in record?record.contactName??'':'',legalName:record&&'kind'in record?record.legalName:'',taxId:record&&'kind'in record?record.taxId:'',stateRegistration:record&&'kind'in record?record.stateRegistration:'',email:record?.email??'',phone:record?.phone??'',position:record&&'position'in record?record.position:'',notes:record?.notes??'',ownerId:record?.ownerId??'',customerType:record&&'kind'in record?record.customerType:'outro',stage:record&&'kind'in record?record.stage:'novo',...address};
}
async function api(companyId:string,path:string,options:RequestInit={}){
 const response=await fetch('/api/v1/companies/'+companyId+'/crm'+path,{...options,credentials:'same-origin',cache:'no-store',headers:{'Content-Type':'application/json',...options.headers}});
 if(!response.ok){
  const data=await response.json().catch(()=>({}));
  if(data.code==='PORTFOLIO_TRANSFER_REQUIRED')throw Error('Este cadastro está em uma carteira. Transfira-o pelo módulo Carteiras e planejamento para mudar o vendedor.');
  if(data.code==='QUALIFICATION_WORKFLOW_REQUIRED')throw Error('Use a qualificação comercial e envie para análise administrativa. A conversão direta não está disponível.');
  if(data.code==='LEAD_QUALIFICATION_REQUIRED')throw Error('Complete os dados no modal de qualificação comercial e envie para análise administrativa.');
  if(response.status===401||['PASSWORD_CHANGE_REQUIRED','PRIVACY_ACCEPTANCE_REQUIRED'].includes(data.code)){window.location.reload();throw Error('Atualize o acesso para continuar.');}
  throw Error(response.status===409?'O registro foi alterado por outro usuário ou o documento já existe nesta empresa. Atualize a lista antes de tentar novamente.':response.status===404?'Registro não encontrado ou fora do seu acesso.':response.status===403?'Você não tem permissão para esta operação.':response.status===400?'Confira os campos, o documento e o responsável selecionado.':'Não foi possível concluir. Confira sua conexão.');
 }
 return response.json();
}
export function Relationships({account,initialMode,initialQualification='',initialStage=''}:{account:Account;initialMode?:Mode;initialQualification?:string;initialStage?:string}){
 const [qualificationFilter,setQualificationFilter]=useState(initialQualification);
 const [companyId,setCompanyId]=useState(account.companies[0]?.id??''),[mode,setMode]=useState<Mode>(initialMode??(account.permissions?.includes('lead:read')?'lead':account.permissions?.includes('customer:read')?'customer':'contact'));
 const [rows,setRows]=useState<Row[]>([]),[total,setTotal]=useState(0),[page,setPage]=useState(1),[search,setSearch]=useState(''),[searchInput,setSearchInput]=useState(''),[refresh,setRefresh]=useState(0);
 const [parent,setParent]=useState<Ref|null>(null),[references,setReferences]=useState<Ref[]>([]),[parentSearch,setParentSearch]=useState('');
 const [owners,setOwners]=useState<{id:string;name:string}[]>([]);
 const [loading,setLoading]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState('');
 const [editor,setEditor]=useState<Editor>(null),[draft,setDraft]=useState<Record<string,string>>(draftOf()),[documentKind,setDocumentKind]=useState<'CNPJ'|'CPF'>('CNPJ'),[cepStatus,setCepStatus]=useState('');
 const permissions=account.permissions??[],readPermission=mode==='customer'?'customer:read':mode==='contact'?'contact:read':'lead:read',writePermission=readPermission.replace(':read',':write');
 const canWrite=permissions.includes(writePermission);
 const canReadQualification=['qualification:read','qualification:edit','qualification:approve'].some(value=>permissions.includes(value));
 const leadEditor=editor?.action==='party'&&(editor.record&&'kind'in editor.record?editor.record.kind==='lead':mode==='lead');
 const fullDetails=!leadEditor;
 const [qualificationId,setQualificationId]=useState<string|null>(null);
 const listPath=mode==='contact'?(parent?'/parties/'+parent.id+'/contacts':''):(mode==='lead'?'/leads':'/customers');
 useEffect(()=>{
  if(!companyId||!permissions.some(value=>['lead:write','customer:write','contact:write'].includes(value))){setOwners([]);return;}
  const controller=new AbortController();setOwners([]);
  api(companyId,'/owners',{signal:controller.signal}).then(data=>setOwners(data.items)).catch(cause=>{if(!controller.signal.aborted)setError(cause.message);});
  return()=>controller.abort();
 },[companyId,refresh]);
 useEffect(()=>{
  if(!companyId||mode!=='contact')return;
  const controller=new AbortController(),timer=setTimeout(()=>{api(companyId,'/references?search='+encodeURIComponent(parentSearch),{signal:controller.signal}).then(data=>setReferences(data.items)).catch(cause=>{if(!controller.signal.aborted)setError(cause.message);});},250);
  return()=>{controller.abort();clearTimeout(timer);};
 },[companyId,mode,parentSearch,refresh]);
 useEffect(()=>{
  if(!companyId||!listPath){setRows([]);setTotal(0);return;}
  const controller=new AbortController();setLoading(true);setRows([]);setError('');
  api(companyId,listPath+'?page='+page+(initialStage?'&stage='+initialStage:'')+'&search='+encodeURIComponent(search)+(qualificationFilter?'&qualificationState='+qualificationFilter:''),{signal:controller.signal}).then(data=>{setRows(data.items);setTotal(data.total);}).catch(cause=>{if(!controller.signal.aborted)setError(cause.message);}).finally(()=>{if(!controller.signal.aborted)setLoading(false);});
  return()=>controller.abort();
 },[companyId,mode,parent?.id,page,search,refresh,qualificationFilter]);
 useEffect(()=>{
  if(editor?.action!=='party'||!['BR','BRASIL','BRAZIL'].includes((draft.country??'').toUpperCase())||digits(draft.postalCode??'').length!==8){setCepStatus('');return;}
  const controller=new AbortController(),snapshot={...draft};
  const timer=setTimeout(async()=>{
   setCepStatus('Buscando endereço...');
   const timeout=setTimeout(()=>controller.abort('timeout'),8000);
   try{
    const response=await fetch('https://viacep.com.br/ws/'+digits(snapshot.postalCode)+'/json/',{signal:controller.signal,credentials:'omit',referrerPolicy:'no-referrer'});
    if(!response.ok)throw Error();const data=await response.json();
    if(controller.signal.aborted)return;
    if(data.erro){setCepStatus('CEP não encontrado. Preencha o endereço manualmente.');return;}
    setDraft(current=>({...current,street:current.street===snapshot.street?data.logradouro??'':current.street,neighborhood:current.neighborhood===snapshot.neighborhood?data.bairro??'':current.neighborhood,city:current.city===snapshot.city?data.localidade??'':current.city,state:current.state===snapshot.state?data.uf??'':current.state}));
    setCepStatus('Endereço localizado. Confira os dados e informe o número.');
   }catch{if(!controller.signal.aborted||controller.signal.reason==='timeout')setCepStatus('Consulta indisponível. Preencha o endereço manualmente.');}finally{clearTimeout(timeout);}
  },350);
  return()=>{clearTimeout(timer);controller.abort();};
 },[editor?.action,draft.postalCode,draft.country,companyId]);
 function update(key:string,value:string){setDraft(current=>({...current,[key]:value}));}
 function open(action:NonNullable<Editor>['action'],record?:Row){
  setError('');setNotice('');setDraft({...draftOf(record),ownerId:record?.ownerId??account.user.id??owners[0]?.id??''});setDocumentKind(record&&'taxId'in record&&record.taxId.length===11?'CPF':'CNPJ');setEditor({action,record});
 }
 function changeMode(next:Mode){setMode(next);setQualificationFilter('');setPage(1);setSearch('');setSearchInput('');setError('');setNotice('');}
 async function submit(event:FormEvent<HTMLFormElement>){
  event.preventDefault();if(!editor)return;
  if(leadEditor&&!draft.phone&&!draft.email){setError('Informe pelo menos telefone ou e-mail para o primeiro contato.');return;}
  if(editor.action==='party'&&fullDetails&&draft.taxId&&(!validTaxId(draft.taxId)||normalizeTaxId(draft.taxId).length!==(documentKind==='CPF'?11:14))){setError('Informe um CPF ou CNPJ válido.');return;}
  const record=editor.record;let path='',method='POST',body:Record<string,unknown>={};
  if(editor.action==='contact'){
   const partyId=record&&'partyId'in record?record.partyId:parent?.id;
   if(!partyId){setError('Selecione um lead ou cliente para vincular o contato.');return;}
   path='/parties/'+partyId+'/contacts'+(record?'/'+record.id:'');method=record?'PATCH':'POST';
   body={...Object.fromEntries(['name','email','phone','position','notes'].map(key=>[key,draft[key]])),...(record?{version:record.version}:{})};
  }else if(editor.action==='party'){
   const kind=record&&'kind'in record?record.kind:mode;
   path=(kind==='lead'?'/leads':'/customers')+(record?'/'+record.id:'');method=record?'PATCH':'POST';
   body={...Object.fromEntries((leadEditor&&!fullDetails?['name','contactName','email','phone','stage','notes']:['name','contactName','legalName','taxId','stateRegistration','email','phone','customerType','stage','notes']).map(key=>[key,draft[key]])),...(draft.ownerId?{ownerId:draft.ownerId}:{}),address:Object.fromEntries(Object.keys(emptyAddress).map(key=>[key,draft[key]])),...(record?{version:record.version}:{})};
  }else if(editor.action==='convert'&&record){
   path='/leads/'+record.id+'/convert';body={version:record.version,customerType:draft.customerType};
  }else if(record){
   path='partyId'in record?'/parties/'+record.partyId+'/contacts/'+record.id+'/archive':(record.kind==='lead'?'/leads':'/customers')+'/'+record.id+'/archive';body={version:record.version};
  }
  setBusy(true);setError('');
  try{await api(companyId,path,{method,body:JSON.stringify(body)});setEditor(null);setNotice(editor.action==='archive'?'Registro arquivado.':editor.action==='convert'?'Lead convertido em cliente. Os contatos foram preservados.':'Registro salvo.');setPage(1);setRefresh(value=>value+1);if(editor.action==='convert')setMode('customer');}
  catch(cause){setError((cause as Error).message);}finally{setBusy(false);}
 }
 function field(key:string,label:string,maxLength:number,type='text',required=false){
  return <label>{label}<input name={key} type={type} value={draft[key]??''} required={required} maxLength={maxLength} autoComplete="off" onChange={event=>update(key,event.target.value)}/></label>;
 }
function actions(row:Row){return <div className="nf-crm-row-actions">{canWrite&&(!('kind'in row)||row.qualification?.state!=='submitted')&&<button className="nf-secondary" onClick={()=>open('partyId'in row?'contact':'party',row)}>Editar</button>}{'kind'in row&&permissions.includes('contact:read')&&<button className="nf-secondary" onClick={()=>{setParent({id:row.id,name:row.name,kind:row.kind});changeMode('contact');}}>Contatos</button>}{'kind'in row&&canReadQualification&&<button className="nf-primary" onClick={()=>setQualificationId(row.id)}>{row.qualification?.state==='submitted'?'Analisar qualificação':row.qualification?.state==='approved'||!permissions.includes('qualification:edit')?'Ver qualificação':row.kind==='customer'?'Revisar cliente legado':row.qualification?.state==='revision'?'Corrigir qualificação':'Qualificar'}</button>}{canWrite&&<button className="nf-secondary" onClick={()=>open('archive',row)}>Arquivar</button>}</div>;}
 const referenceOptions=parent&&!references.some(row=>row.id===parent.id)?[parent,...references]:references;
 const title=editor?.action==='archive'?'Arquivar registro':editor?.action==='convert'?'Converter lead em cliente':editor?.action==='contact'?(editor.record?'Editar contato':'Novo contato'):(editor?.record?'Editar cadastro':mode==='lead'?'Novo lead':'Novo cliente');
 return <section className="nf-crm">
  <div className="nf-crm-toolbar"><label>Empresa<select disabled={Boolean(qualificationId)||Boolean(editor)} value={companyId} onChange={event=>{setCompanyId(event.target.value);setParent(null);setReferences([]);setPage(1);}}>{account.companies.map(company=><option key={company.id} value={company.id}>{company.name}</option>)}</select></label><div role="tablist" aria-label="Relacionamento">{(['lead','customer','contact'] as const).filter(value=>permissions.includes(value==='lead'?'lead:read':value==='customer'?'customer:read':'contact:read')).map(value=><button type="button" role="tab" aria-selected={mode===value} className={mode===value?'nf-primary':'nf-secondary'} onClick={()=>changeMode(value)} key={value}>{value==='lead'?'Leads':value==='customer'?'Clientes':'Contatos'}</button>)}</div></div>
  {mode==='contact'&&<section className="nf-panel nf-crm-parent"><label>Buscar lead ou cliente<input value={parentSearch} onChange={event=>setParentSearch(event.target.value)} placeholder="Digite o nome para localizar o vínculo" maxLength={80}/></label><label>Vínculo do contato<select value={parent?.id??''} onChange={event=>{setParent(referenceOptions.find(row=>row.id===event.target.value)??null);setPage(1);}}><option value="">Selecione um lead ou cliente</option>{referenceOptions.map(row=><option key={row.id} value={row.id}>{row.name} — {row.kind==='lead'?'Lead':'Cliente'}</option>)}</select></label></section>}
  {!editor&&error&&<p role="alert" className="nf-error">{error}</p>}{notice&&<p role="status" className="nf-admin-success">{notice}</p>}
  <section className="nf-panel"><div className="nf-section-heading"><h2>{mode==='lead'?'Leads cadastrados':mode==='customer'?'Clientes cadastrados':'Contatos vinculados'}</h2>{canWrite&&mode!=='customer'&&(mode!=='contact'||parent)&&<button className="nf-primary" onClick={()=>open(mode==='contact'?'contact':'party')}>{mode==='lead'?'+ Novo lead':'+ Novo contato'}</button>}</div>
  {mode!=='contact'&&canReadQualification&&<label>Filtrar qualificação<select value={qualificationFilter} onChange={event=>{setQualificationFilter(event.target.value);setPage(1);}}><option value="">Todas</option>{['draft','submitted','revision','approved'].map(value=><option key={value} value={value}>{qualificationNames[value]}</option>)}</select></label>}
  <form className="nf-crm-search" onSubmit={event=>{event.preventDefault();setSearch(searchInput.trim());setPage(1);setRefresh(value=>value+1);}}><label>Buscar por nome, telefone ou e-mail<input value={searchInput} onChange={event=>setSearchInput(event.target.value)} maxLength={80} placeholder="Nome, e-mail, telefone ou documento"/></label><button className="nf-secondary">Buscar</button></form>
  {loading?<p role="status">Carregando registros...</p>:mode==='contact'&&!parent?<p className="nf-muted">Selecione um lead ou cliente para consultar e cadastrar seus contatos.</p>:!rows.length?<p className="nf-muted">Nenhum registro encontrado neste escopo.</p>:<div className="nf-table-scroll"><table className="nf-admin-table"><thead><tr><th>Nome</th><th>Contato</th><th>{mode==='lead'?'Etapa':mode==='customer'?'Tipo de cliente':'Cargo'}</th><th>Ações</th></tr></thead><tbody>{rows.map(row=><tr key={row.id}><td><strong>{row.name}</strong>{'legalName'in row&&<small>{row.legalName}</small>}{'taxId'in row&&row.taxId&&<small>{maskTaxId(row.taxId,row.taxId.length===11?'CPF':'CNPJ')}</small>}</td><td>{'contactName'in row&&<strong>{row.contactName}</strong>}{row.email||'—'}<small>{maskPhone(row.phone)}</small></td><td>{'kind'in row?(row.kind==='lead'?stageNames[row.stage]:row.customerType):row.position}{'kind'in row&&<small>{row.kind==='customer'&&(!row.qualification||row.qualification.state==='none')?'Legado — revisão pendente':qualificationNames[row.qualification?.state??'none']}</small>}</td><td>{actions(row)}</td></tr>)}</tbody></table></div>}
  {<div className="nf-crm-pagination"><button className="nf-secondary" disabled={loading||page<=1} onClick={()=>setPage(value=>value-1)}>Anterior</button><span>Página {page} · {total} registro(s)</span><button className="nf-secondary" disabled={loading||page*20>=total} onClick={()=>setPage(value=>value+1)}>Próxima</button></div>}</section>
  <Modal open={Boolean(editor)} title={title} busy={busy} onClose={()=>{setEditor(null);setError('');}}>
   <form className="nf-form" onSubmit={submit}><fieldset disabled={busy}>
   {leadEditor&&<p className="nf-muted">{fullDetails?'Complete contato, razão social, CPF/CNPJ e endereço para qualificar. IE é opcional.':'Registre os dados iniciais. Dados fiscais serão solicitados na qualificação; endereço é opcional nesta fase.'}</p>}
   {editor?.action==='archive'?<p>Arquivar <strong>{editor.record?.name}</strong>? O registro deixará as listas ativas. Arquivar não elimina os dados.</p>:editor?.action==='convert'?<><p>Converter <strong>{editor.record?.name}</strong> em cliente, preservando os contatos e o responsável.</p><label>Tipo de cliente<select value={draft.customerType} onChange={event=>update('customerType',event.target.value)}>{customerTypes.map(value=><option key={value} value={value}>{value}</option>)}</select></label></>:<><div className="nf-admin-grid">
    {field('name',editor?.action==='contact'?'Nome do contato':leadEditor?'Nome da empresa':'Nome / nome fantasia',editor?.action==='contact'?120:160,'text',true)}
    {editor?.action==='party'&&fullDetails&&field('legalName','Razão social / nome completo',160,'text',leadEditor&&fullDetails)}
    {editor?.action==='party'&&field('contactName','Nome do contato principal',120,'text',leadEditor&&fullDetails)}
    {field('email','E-mail',254,'email',leadEditor&&fullDetails)}
    <label>Telefone com DDD<input required={leadEditor&&fullDetails} name="phone" type="tel" value={maskPhone(draft.phone??'')} maxLength={15} onChange={event=>update('phone',maskPhone(event.target.value))}/></label>
    {editor?.action==='contact'?field('position','Cargo / função',120):<>{fullDetails&&<><label>Tipo de documento<select value={documentKind} onChange={event=>{setDocumentKind(event.target.value as 'CNPJ'|'CPF');update('taxId','');}}><option>CNPJ</option><option>CPF</option></select></label><label>{documentKind}<input required={leadEditor&&fullDetails} name="taxId" value={maskTaxId(draft.taxId??'',documentKind)} maxLength={18} onChange={event=>update('taxId',maskTaxId(event.target.value,documentKind))}/></label><label>Inscrição estadual<input name="stateRegistration" value={maskStateRegistration(draft.stateRegistration??'',draft.state??'')} maxLength={30} placeholder="IE ou ISENTO" onChange={event=>update('stateRegistration',event.target.value)}/></label><label>Tipo de cliente<select value={draft.customerType} onChange={event=>update('customerType',event.target.value)}>{customerTypes.map(value=><option key={value} value={value}>{value}</option>)}</select></label></>}{(mode==='lead'||editor?.record&&'kind'in editor.record&&editor.record.kind==='lead')&&<label>Etapa do lead<select value={draft.stage} onChange={event=>update('stage',event.target.value)}>{leadStages.filter(value=>value!=='qualificado').map(value=><option key={value} value={value}>{stageNames[value]}</option>)}</select></label>}<label>Responsável<select value={draft.ownerId} required onChange={event=>update('ownerId',event.target.value)}><option value="">Selecione</option>{owners.map(owner=><option key={owner.id} value={owner.id}>{owner.name}</option>)}</select></label></>}
   </div>
   {editor?.action==='party'&&<details open={fullDetails}><summary>Endereço {leadEditor&&!fullDetails?'(opcional)':''}</summary><fieldset className="nf-crm-address"><legend>Endereço</legend><div className="nf-admin-grid">{field('country','País',80)}
    <label>CEP<input required={leadEditor&&fullDetails&&['BR','BRASIL','BRAZIL'].includes((draft.country??'').toUpperCase())} name="postalCode" value={draft.postalCode??''} maxLength={20} onChange={event=>update('postalCode',['BR','BRASIL','BRAZIL'].includes((draft.country??'').toUpperCase())?maskPostalCode(event.target.value):event.target.value)}/></label>
    {field('street','Rua / logradouro',160,'text',leadEditor&&fullDetails)}{field('number','Número',20,'text',leadEditor&&fullDetails)}{field('complement','Complemento',120)}{field('neighborhood','Bairro',120,'text',leadEditor&&fullDetails)}{field('city','Cidade',120,'text',leadEditor&&fullDetails)}
    {['BR','BRASIL','BRAZIL'].includes((draft.country??'').toUpperCase())?<label>Estado / UF<select required={leadEditor&&fullDetails} value={draft.state??''} onChange={event=>update('state',event.target.value)}><option value="">Selecione</option>{brazilStates.map(value=><option key={value}>{value}</option>)}</select></label>:field('state','Estado / província',60)}
   </div><p role="status" className="nf-muted">{cepStatus}</p></fieldset></details>}
   <label>Anotações<textarea name="notes" value={draft.notes??''} maxLength={3000} onChange={event=>update('notes',event.target.value)} placeholder="Inclua apenas informações necessárias ao relacionamento comercial."/></label></>}
   {error&&<p role="alert" className="nf-error">{error}</p>}<div className="nf-admin-actions"><button type="button" className="nf-secondary" disabled={busy} onClick={()=>{setEditor(null);setError('');}}>Cancelar</button><button className="nf-primary" disabled={busy}>{busy?'Salvando...':editor?.action==='archive'?'Confirmar arquivamento':editor?.action==='convert'?'Confirmar conversão':'Salvar cadastro'}</button></div>
   </fieldset></form>
  </Modal>
 {qualificationId&&<QualificationModal company={companyId} id={qualificationId} permissions={permissions} onClose={()=>setQualificationId(null)} onChanged={()=>setRefresh(value=>value+1)}/>}
 </section>;
}
