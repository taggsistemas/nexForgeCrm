import {useEffect,useState,type FormEvent} from 'react';
import {Modal} from '../../components/Modal';
import {moneyToCents} from '../../../../../packages/contracts/src/opportunities';
import {addressLine,formatTaxId,type CompanyProfileView} from '../../../../../packages/contracts/src/supply';
import {AddressFields} from './Suppliers';
import {asInput,money,supplyCall,when} from './api';
type Account={companies:{id:string;name:string}[];permissions?:string[]};
/** Converts any uploaded image to a JPEG on a white background (max 600×240), so it embeds directly in the PDFs. */
async function logoJpeg(file:File){
 if(!file.type.startsWith('image/'))throw Error('Escolha uma imagem (PNG, JPG ou WebP).');if(file.size>5*1024*1024)throw Error('Imagem muito grande (máximo 5 MB).');
 const bitmap=await createImageBitmap(file),scale=Math.min(1,600/bitmap.width,240/bitmap.height),canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.round(bitmap.width*scale));canvas.height=Math.max(1,Math.round(bitmap.height*scale));
 const context=canvas.getContext('2d')!;context.fillStyle='#ffffff';context.fillRect(0,0,canvas.width,canvas.height);context.drawImage(bitmap,0,0,canvas.width,canvas.height);
 for(const quality of [0.9,0.8,0.65,0.5]){const value=canvas.toDataURL('image/jpeg',quality);if(value.length<=400000)return value;}throw Error('Não foi possível reduzir a imagem. Use um logotipo menor.');
}
/** Company data printed on sales orders, purchase orders and work orders; also holds the purchase approval limit. */
export function CompanyData({account}:{account:Account}){
 const [company,setCompany]=useState(account.companies[0]?.id??''),[record,setRecord]=useState<CompanyProfileView|null>(null),[error,setError]=useState(''),[notice,setNotice]=useState(''),[refresh,setRefresh]=useState(0);
 const [draft,setDraft]=useState<(Omit<CompanyProfileView,'purchaseApprovalLimitCents'|'updatedAt'>&{limit:string})|null>(null),[busy,setBusy]=useState(false),[formError,setFormError]=useState('');
 useEffect(()=>{const controller=new AbortController();setRecord(null);supplyCall(company,'/company-profile',{signal:controller.signal}).then(data=>{setRecord(data.record);setError('');}).catch(cause=>{if(!controller.signal.aborted)setError((cause as Error).message);});return()=>controller.abort();},[company,refresh]);
 function open(){if(!record)return;setFormError('');setNotice('');const {purchaseApprovalLimitCents,updatedAt,...rest}=record;void updatedAt;setDraft({...rest,taxId:formatTaxId(rest.taxId),limit:asInput(purchaseApprovalLimitCents)});}
 const set=(key:string,value:unknown)=>setDraft(current=>current?{...current,[key]:value}:current);
 async function save(event:FormEvent){event.preventDefault();if(!draft)return;setFormError('');
  const limit=draft.limit.trim()?moneyToCents(draft.limit):0;if(limit===undefined){setFormError('Confira o limite de aprovação de compras.');return;}
  const {limit:_limit,...fields}=draft;void _limit;setBusy(true);
  try{const data=await supplyCall(company,'/company-profile',{method:'PUT',body:JSON.stringify({...fields,purchaseApprovalLimitCents:limit})});setRecord(data.record);setDraft(null);setNotice('Dados da empresa salvos. Os próximos PDFs já usam estas informações.');setRefresh(value=>value+1);}
  catch(cause){setFormError((cause as Error).message);}finally{setBusy(false);}}
 return <section className="nf-crm nf-company-data">
  <div className="nf-crm-toolbar"><label>Empresa<select value={company} onChange={event=>setCompany(event.target.value)}>{account.companies.map(item=><option key={item.id} value={item.id}>{item.name}</option>)}</select></label><button className="nf-primary" disabled={!record} onClick={open}>Editar dados da empresa</button></div>
  {error&&<p role="alert" className="nf-error">{error}</p>}{notice&&<p role="status" className="nf-admin-success">{notice}</p>}
  {!record?<p role="status">Carregando…</p>:<section className="nf-panel"><div className="nf-company-card">{record.logo?<img src={record.logo} alt="Logotipo da empresa"/>:<span className="nf-muted">Sem logotipo</span>}
   <div><h2>{record.tradeName||record.legalName||'Dados ainda não preenchidos'}</h2>{record.tradeName&&record.legalName!==record.tradeName&&<p>{record.legalName}</p>}
    <p>{[record.taxId?'CNPJ '+formatTaxId(record.taxId):'',record.stateRegistration?'IE '+record.stateRegistration:'',record.municipalRegistration?'IM '+record.municipalRegistration:''].filter(Boolean).join(' · ')}</p>
    <p>{addressLine(record.address)}</p><p>{[record.phone,record.email,record.website].filter(Boolean).join(' · ')}</p></div></div>
   <dl className="nf-record-summary"><div><dt>Limite para aprovação de compras</dt><dd>{record.purchaseApprovalLimitCents?'Acima de '+money(record.purchaseApprovalLimitCents):'Todas as compras precisam de aprovação'}</dd></div><div><dt>Texto do rodapé dos documentos</dt><dd>{record.documentNotes||'—'}</dd></div><div><dt>Última alteração</dt><dd>{record.updatedAt?when(record.updatedAt):'—'}</dd></div></dl>
   <p className="nf-field-hint">Estes dados aparecem no cabeçalho dos PDFs de pedidos de venda, pedidos de compra e ordens de serviço.</p></section>}
  <Modal open={Boolean(draft)} title="Dados da empresa" busy={busy} onClose={()=>setDraft(null)}>
   {draft&&<form className="nf-form" onSubmit={save}><fieldset disabled={busy}><div className="nf-admin-grid">
    <label>Razão social<input required minLength={2} maxLength={160} value={draft.legalName} onChange={event=>set('legalName',event.target.value)}/></label><label>Nome fantasia<input maxLength={160} value={draft.tradeName} onChange={event=>set('tradeName',event.target.value)}/></label>
    <label>CNPJ<input inputMode="numeric" maxLength={18} value={draft.taxId} onChange={event=>set('taxId',event.target.value)}/></label><label>Inscrição estadual<input maxLength={30} value={draft.stateRegistration} onChange={event=>set('stateRegistration',event.target.value)}/></label>
    <label>Inscrição municipal<input maxLength={30} value={draft.municipalRegistration} onChange={event=>set('municipalRegistration',event.target.value)}/></label><label>Telefone<input maxLength={40} value={draft.phone} onChange={event=>set('phone',event.target.value)}/></label>
    <label>E-mail<input type="email" maxLength={160} value={draft.email} onChange={event=>set('email',event.target.value)}/></label><label>Site<input maxLength={160} value={draft.website} onChange={event=>set('website',event.target.value)}/></label></div>
    <AddressFields value={draft.address} onChange={address=>set('address',address)}/>
    <fieldset><legend>Logotipo</legend>{draft.logo&&<img className="nf-company-logo-preview" src={draft.logo} alt="Pré-visualização do logotipo"/>}
     <label>Escolher imagem<input type="file" accept="image/png,image/jpeg,image/webp" onChange={event=>{const file=event.target.files?.[0];if(file)void logoJpeg(file).then(value=>set('logo',value)).catch(cause=>setFormError((cause as Error).message));}}/></label>
     {draft.logo&&<button type="button" className="nf-secondary" onClick={()=>set('logo',null)}>Remover logotipo</button>}</fieldset>
    <label>Texto do rodapé dos documentos<textarea maxLength={1000} value={draft.documentNotes} onChange={event=>set('documentNotes',event.target.value)} placeholder="Ex.: validade, garantia, dados bancários."/></label>
    <label>Aprovar compras acima de (R$)<input inputMode="decimal" maxLength={20} value={draft.limit} onChange={event=>set('limit',event.target.value)} aria-describedby="limit-hint"/></label><p id="limit-hint" className="nf-field-hint">Pedidos de compra acima deste valor dependem de Gerencial ou Direção. Com 0, todos dependem.</p>
    {formError&&<p role="alert" className="nf-error">{formError}</p>}
    <div className="nf-admin-actions"><button type="button" className="nf-secondary" onClick={()=>setDraft(null)}>Cancelar</button><button className="nf-primary">{busy?'Salvando…':'Salvar dados'}</button></div>
   </fieldset></form>}
  </Modal>
 </section>;
}
