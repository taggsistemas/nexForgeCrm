import {useEffect,useState,type FormEvent} from 'react';
import {Modal} from '../../components/Modal';
import {addressLine,formatTaxId,type CompanyAddress,type SupplierView} from '../../../../../packages/contracts/src/supply';
import {supplyCall} from './api';
type Account={companies:{id:string;name:string}[];permissions?:string[]};
const blankAddress:CompanyAddress={street:'',number:'',complement:'',district:'',city:'',state:'',zip:''};
const blank={name:'',tradeName:'',taxId:'',stateRegistration:'',contactName:'',phone:'',email:'',address:blankAddress,paymentTerms:'',notes:'',active:true};
/** Address fields shared by supplier and company data forms. */
export function AddressFields({value,onChange}:{value:CompanyAddress;onChange:(value:CompanyAddress)=>void}){
 const set=(key:keyof CompanyAddress,next:string)=>onChange({...value,[key]:next});
 return <fieldset><legend>Endereço</legend><div className="nf-admin-grid">
  <label>Logradouro<input maxLength={160} value={value.street} onChange={event=>set('street',event.target.value)}/></label><label>Número<input maxLength={20} value={value.number} onChange={event=>set('number',event.target.value)}/></label>
  <label>Complemento<input maxLength={80} value={value.complement} onChange={event=>set('complement',event.target.value)}/></label><label>Bairro<input maxLength={80} value={value.district} onChange={event=>set('district',event.target.value)}/></label>
  <label>Cidade<input maxLength={80} value={value.city} onChange={event=>set('city',event.target.value)}/></label><label>UF<input maxLength={2} value={value.state} onChange={event=>set('state',event.target.value.toUpperCase())}/></label>
  <label>CEP<input maxLength={9} inputMode="numeric" value={value.zip} onChange={event=>set('zip',event.target.value)}/></label></div></fieldset>;
}
export function Suppliers({account}:{account:Account}){
 const canWrite=account.permissions?.includes('supplier:write');
 const [company,setCompany]=useState(account.companies[0]?.id??''),[rows,setRows]=useState<SupplierView[]>([]),[total,setTotal]=useState(0),[page,setPage]=useState(1),[active,setActive]=useState('true'),[search,setSearch]=useState(''),[searchDraft,setSearchDraft]=useState(''),[loading,setLoading]=useState(true),[refresh,setRefresh]=useState(0);
 const [error,setError]=useState(''),[notice,setNotice]=useState(''),[editor,setEditor]=useState<{row?:SupplierView}|null>(null),[draft,setDraft]=useState(blank),[busy,setBusy]=useState(false),[formError,setFormError]=useState('');
 useEffect(()=>{const controller=new AbortController();setLoading(true);
  supplyCall(company,'/suppliers?'+new URLSearchParams({page:String(page),active,search}),{signal:controller.signal}).then(data=>{setRows(data.items);setTotal(data.total);setError('');}).catch(cause=>{if(!controller.signal.aborted)setError((cause as Error).message);}).finally(()=>{if(!controller.signal.aborted)setLoading(false);});
  return()=>controller.abort();},[company,page,active,search,refresh]);
 function open(row?:SupplierView){setFormError('');setNotice('');setDraft(row?{name:row.name,tradeName:row.tradeName,taxId:formatTaxId(row.taxId),stateRegistration:row.stateRegistration,contactName:row.contactName,phone:row.phone,email:row.email,address:row.address,paymentTerms:row.paymentTerms,notes:row.notes,active:row.active}:blank);setEditor({row});}
 const set=(key:keyof typeof blank,value:string|boolean)=>setDraft(current=>({...current,[key]:value}));
 async function save(event:FormEvent){event.preventDefault();if(!editor)return;setBusy(true);setFormError('');
  try{await supplyCall(company,'/suppliers'+(editor.row?'/'+editor.row.id:''),{method:editor.row?'PATCH':'POST',body:JSON.stringify({...draft,...(editor.row?{version:editor.row.version}:{})})});setEditor(null);setNotice('Fornecedor salvo.');setRefresh(value=>value+1);}
  catch(cause){setFormError((cause as Error).message);}finally{setBusy(false);}}
 return <section className="nf-crm nf-suppliers">
  <div className="nf-crm-toolbar"><label>Empresa<select value={company} onChange={event=>{setCompany(event.target.value);setPage(1);}}>{account.companies.map(item=><option key={item.id} value={item.id}>{item.name}</option>)}</select></label>{canWrite&&<button className="nf-primary" onClick={()=>open()}>Novo fornecedor</button>}</div>
  {error&&!editor&&<p role="alert" className="nf-error">{error}</p>}{notice&&<p role="status" className="nf-admin-success">{notice}</p>}
  <section className="nf-panel"><div className="nf-section-heading"><h2>Fornecedores</h2><span>{total} fornecedor(es)</span></div>
   <form className="nf-filter-bar" onSubmit={event=>{event.preventDefault();setSearch(searchDraft.trim());setPage(1);}}><label>Situação<select value={active} onChange={event=>{setActive(event.target.value);setPage(1);}}><option value="true">Ativos</option><option value="false">Inativos</option><option value="all">Todos</option></select></label>
    <label>Nome, fantasia ou CNPJ/CPF<input value={searchDraft} maxLength={80} onChange={event=>setSearchDraft(event.target.value)}/></label><button className="nf-secondary">Buscar</button></form>
   {loading?<p role="status">Carregando fornecedores…</p>:!rows.length?<p className="nf-muted">Nenhum fornecedor neste filtro.</p>:<ul className="nf-property-list">{rows.map(row=><li key={row.id}><div><strong>{row.name}</strong>{!row.active&&<span className="nf-badge">Inativo</span>}</div>
    <p>{[row.tradeName,row.taxId?formatTaxId(row.taxId):'',row.contactName,row.phone,row.email].filter(Boolean).join(' · ')}</p>{addressLine(row.address)&&<small>{addressLine(row.address)}</small>}{row.paymentTerms&&<small>Condições: {row.paymentTerms}</small>}
    {canWrite&&<div className="nf-crm-row-actions"><button type="button" className="nf-secondary" onClick={()=>open(row)}>Editar</button></div>}</li>)}</ul>}
   <div className="nf-crm-pagination"><button className="nf-secondary" disabled={loading||page<=1} onClick={()=>setPage(value=>value-1)}>Anterior</button><span>Página {page}</span><button className="nf-secondary" disabled={loading||page*20>=total} onClick={()=>setPage(value=>value+1)}>Próxima</button></div>
  </section>
  <Modal open={Boolean(editor)} title={editor?.row?'Editar fornecedor':'Novo fornecedor'} busy={busy} onClose={()=>setEditor(null)}>
   <form className="nf-form" onSubmit={save}><fieldset disabled={busy}><div className="nf-admin-grid">
    <label>Razão social / nome<input required minLength={2} maxLength={160} value={draft.name} onChange={event=>set('name',event.target.value)}/></label><label>Nome fantasia<input maxLength={160} value={draft.tradeName} onChange={event=>set('tradeName',event.target.value)}/></label>
    <label>CNPJ ou CPF<input inputMode="numeric" maxLength={18} value={draft.taxId} onChange={event=>set('taxId',event.target.value)}/></label><label>Inscrição estadual<input maxLength={30} value={draft.stateRegistration} onChange={event=>set('stateRegistration',event.target.value)}/></label>
    <label>Contato<input maxLength={120} value={draft.contactName} onChange={event=>set('contactName',event.target.value)}/></label><label>Telefone<input maxLength={40} value={draft.phone} onChange={event=>set('phone',event.target.value)}/></label>
    <label>E-mail<input type="email" maxLength={160} value={draft.email} onChange={event=>set('email',event.target.value)}/></label><label>Condições de pagamento<input maxLength={300} value={draft.paymentTerms} onChange={event=>set('paymentTerms',event.target.value)}/></label></div>
    <AddressFields value={draft.address} onChange={address=>setDraft(current=>({...current,address}))}/>
    <label>Observações<textarea maxLength={2000} value={draft.notes} onChange={event=>set('notes',event.target.value)}/></label>
    {editor?.row&&<label className="nf-check"><input type="checkbox" checked={draft.active} onChange={event=>set('active',event.target.checked)}/>Fornecedor ativo (inativos não recebem novos pedidos de compra)</label>}
    {formError&&<p role="alert" className="nf-error">{formError}</p>}
    <div className="nf-admin-actions"><button type="button" className="nf-secondary" onClick={()=>setEditor(null)}>Cancelar</button><button className="nf-primary">{busy?'Salvando…':'Salvar fornecedor'}</button></div>
   </fieldset></form>
  </Modal>
 </section>;
}
