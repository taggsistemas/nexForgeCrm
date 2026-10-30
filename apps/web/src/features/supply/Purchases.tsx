import {useEffect,useState,type FormEvent} from 'react';
import {Modal} from '../../components/Modal';
import {companyProfile,downloadPdf} from '../../components/documentPdf';
import {purchaseOrderPdf} from '../../../../../packages/contracts/src/documents';
import {moneyToCents,proposalLineCents} from '../../../../../packages/contracts/src/opportunities';
import {purchaseStatusNames,type PurchaseAction,type PurchaseEventView,type PurchaseView,type SupplierView} from '../../../../../packages/contracts/src/supply';
import type {ProductView} from '../../../../../packages/contracts/src/catalog';
import {asInput,day,money,supplyCall,when} from './api';
type Account={companies:{id:string;name:string}[];permissions?:string[]};
type Line={productId:string;label:string;unit:string;quantity:string;cost:string};
const actionTexts:Record<PurchaseAction,{label:string;title:string;text:string;note?:'required'|'optional'}>={
 submit:{label:'Enviar para aprovação',title:'Enviar pedido de compra',text:'Até o limite configurado nos dados da empresa o pedido é aprovado na hora; acima dele, segue para a gerência.'},
 approve:{label:'Aprovar',title:'Aprovar pedido de compra',text:'Libera o pedido para envio ao fornecedor.',note:'optional'},
 reject:{label:'Devolver',title:'Devolver para ajuste',text:'O pedido volta para rascunho.',note:'required'},
 send:{label:'Marcar como enviado',title:'Marcar como enviado ao fornecedor',text:'Registra que o pedido (PDF) foi enviado ao fornecedor.'},
 cancel:{label:'Cancelar',title:'Cancelar pedido de compra',text:'Pedidos com itens já recebidos não podem ser cancelados.',note:'required'},
};
const flags:Record<PurchaseAction,keyof PurchaseView>={submit:'canSubmit',approve:'canApprove',reject:'canApprove',send:'canSend',cancel:'canCancel'};
const eventNames:Record<string,string>={created:'Pedido criado',updated:'Rascunho alterado',submit:'Enviado para aprovação',approve:'Aprovado',reject:'Devolvido',send:'Enviado ao fornecedor',cancel:'Cancelado',received:'Recebimento registrado'};
/** Purchase orders: totals on the server, approval above the company limit, PDF for the supplier and receipts that feed the warehouse. */
export function Purchases({account}:{account:Account}){
 const permissions=account.permissions??[],canWrite=permissions.includes('purchase:write'),costs=permissions.includes('cost:read');
 const [company,setCompany]=useState(account.companies[0]?.id??''),[rows,setRows]=useState<PurchaseView[]>([]),[total,setTotal]=useState(0),[page,setPage]=useState(1),[status,setStatus]=useState('open'),[search,setSearch]=useState(''),[searchDraft,setSearchDraft]=useState(''),[loading,setLoading]=useState(true),[refresh,setRefresh]=useState(0);
 const [error,setError]=useState(''),[notice,setNotice]=useState(''),[busy,setBusy]=useState(false),[formError,setFormError]=useState('');
 const [detail,setDetail]=useState<{record:PurchaseView;supplier:SupplierView|null;history:PurchaseEventView[]}|null>(null),[action,setAction]=useState<PurchaseAction|null>(null),[note,setNote]=useState('');
 const [editor,setEditor]=useState<{row?:PurchaseView}|null>(null),[draft,setDraft]=useState({supplierId:'',expectedDate:'',paymentTerms:'',notes:''}),[lines,setLines]=useState<Line[]>([]);
 const [suppliers,setSuppliers]=useState<SupplierView[]>([]),[supplierSearch,setSupplierSearch]=useState(''),[products,setProducts]=useState<ProductView[]>([]),[productSearch,setProductSearch]=useState('');
 const [receiving,setReceiving]=useState<Record<string,string>|null>(null),[receiveNote,setReceiveNote]=useState('');
 useEffect(()=>{const controller=new AbortController();setLoading(true);
  supplyCall(company,'/purchases?'+new URLSearchParams({page:String(page),status,search}),{signal:controller.signal}).then(data=>{setRows(data.items);setTotal(data.total);setError('');}).catch(cause=>{if(!controller.signal.aborted)setError((cause as Error).message);}).finally(()=>{if(!controller.signal.aborted)setLoading(false);});
  return()=>controller.abort();},[company,page,status,search,refresh]);
 useEffect(()=>{if(!editor)return;const controller=new AbortController(),timer=setTimeout(()=>{supplyCall(company,'/suppliers?active=true&search='+encodeURIComponent(supplierSearch),{signal:controller.signal}).then(data=>setSuppliers(data.items??[])).catch(()=>{});},250);return()=>{controller.abort();clearTimeout(timer);};},[company,editor,supplierSearch]);
 useEffect(()=>{if(!editor)return;const controller=new AbortController(),timer=setTimeout(()=>{supplyCall(company,'/catalog/products?page=1&search='+encodeURIComponent(productSearch),{signal:controller.signal}).then(data=>setProducts((data.items??[]).filter((item:ProductView)=>item.active))).catch(()=>{});},250);return()=>{controller.abort();clearTimeout(timer);};},[company,editor,productSearch]);
 async function openDetail(id:string){setNotice('');setError('');try{setDetail(await supplyCall(company,'/purchases/'+id));}catch(cause){setError((cause as Error).message);}}
 function openEditor(row?:PurchaseView){setFormError('');setNotice('');setSupplierSearch('');setProductSearch('');
  setDraft({supplierId:row?.supplierId??'',expectedDate:row?.expectedDate??new Date(Date.now()+10*86400000).toISOString().slice(0,10),paymentTerms:row?.paymentTerms??'',notes:row?.notes??''});
  setLines(row?row.items.map(item=>({productId:item.productId,label:item.code+' — '+item.description,unit:item.unit,quantity:item.quantity.replace('.',','),cost:asInput(item.unitCostCents)})):[]);setEditor({row});}
 function addProduct(id:string){const product=products.find(item=>item.id===id);if(!product||lines.some(line=>line.productId===id))return;setLines(current=>[...current,{productId:id,label:product.code+' — '+product.description,unit:product.unit,quantity:'1',cost:product.costCents===null||product.costCents===undefined?'':asInput(product.costCents)}]);}
 const preview=(line:Line)=>{try{const cost=moneyToCents(line.cost);return cost===undefined?null:proposalLineCents(line.quantity.replace(',','.'),cost,0);}catch{return null;}};
 async function save(event:FormEvent){event.preventDefault();if(!editor)return;setFormError('');
  try{if(!lines.length)throw Error('Inclua pelo menos um item.');const items=lines.map(line=>{const unitCostCents=moneyToCents(line.cost);if(unitCostCents===undefined||preview(line)===null)throw Error('Confira quantidade e custo de '+line.label+'.');return {productId:line.productId,quantity:line.quantity.replace(',','.'),unitCostCents};});
   setBusy(true);const body=JSON.stringify({...draft,items,...(editor.row?{version:editor.row.version}:{})});
   if(editor.row){await supplyCall(company,'/purchases/'+editor.row.id,{method:'PATCH',body});setDetail(await supplyCall(company,'/purchases/'+editor.row.id));}else{const created=await supplyCall(company,'/purchases',{method:'POST',body});setNotice('Pedido de compra '+created.number+' criado em rascunho.');}
   setEditor(null);setRefresh(value=>value+1);}catch(cause){setFormError((cause as Error).message);}finally{setBusy(false);}}
 async function act(event:FormEvent){event.preventDefault();if(!detail||!action)return;setBusy(true);setFormError('');
  try{const {record}=await supplyCall(company,'/purchases/'+detail.record.id+'/'+action,{method:'POST',body:JSON.stringify({version:detail.record.version,note})});setAction(null);setNotice(actionTexts[action].title+': '+purchaseStatusNames[record.status as PurchaseView['status']]+'.');setDetail(await supplyCall(company,'/purchases/'+detail.record.id));setRefresh(value=>value+1);}
  catch(cause){setFormError((cause as Error).message);}finally{setBusy(false);}}
 async function receive(event:FormEvent){event.preventDefault();if(!detail||!receiving)return;setBusy(true);setFormError('');
  try{const lines=Object.entries(receiving).filter(([,value])=>value.trim()&&Number(value.replace(',','.'))>0).map(([productId,value])=>({productId,quantity:value.replace(',','.')}));if(!lines.length)throw Error('Informe a quantidade recebida de pelo menos um item.');
   const {record}=await supplyCall(company,'/purchases/'+detail.record.id+'/receive',{method:'POST',body:JSON.stringify({version:detail.record.version,lines,note:receiveNote})});setReceiving(null);setNotice('Recebimento registrado: '+purchaseStatusNames[record.status as PurchaseView['status']]+'. Produtos entraram no almoxarifado.');setDetail(await supplyCall(company,'/purchases/'+detail.record.id));setRefresh(value=>value+1);}
  catch(cause){setFormError((cause as Error).message);}finally{setBusy(false);}}
 async function pdf(){if(!detail)return;try{downloadPdf(detail.record.number+'.pdf',purchaseOrderPdf(detail.record,await companyProfile(company),detail.supplier));}catch(cause){setError((cause as Error).message);}}
 const record=detail?.record;
 return <section className="nf-crm nf-purchases">
  <div className="nf-crm-toolbar"><label>Empresa<select value={company} disabled={Boolean(editor||detail)} onChange={event=>{setCompany(event.target.value);setPage(1);}}>{account.companies.map(item=><option key={item.id} value={item.id}>{item.name}</option>)}</select></label>{canWrite&&<button className="nf-primary" onClick={()=>openEditor()}>Novo pedido de compra</button>}</div>
  {!detail&&!editor&&error&&<p role="alert" className="nf-error">{error}</p>}{!detail&&notice&&<p role="status" className="nf-admin-success">{notice}</p>}
  <section className="nf-panel"><div className="nf-section-heading"><h2>Pedidos de compra</h2><span>{total} pedido(s)</span></div>
   <form className="nf-filter-bar" onSubmit={event=>{event.preventDefault();setSearch(searchDraft.trim());setPage(1);}}><label>Situação<select value={status} onChange={event=>{setStatus(event.target.value);setPage(1);}}><option value="open">Em andamento</option>{Object.entries(purchaseStatusNames).map(([key,name])=><option key={key} value={key}>{name}</option>)}<option value="all">Todos</option></select></label>
    <label>Número do pedido<input value={searchDraft} maxLength={80} onChange={event=>setSearchDraft(event.target.value)}/></label><button className="nf-secondary">Buscar</button></form>
   {loading?<p role="status">Carregando pedidos de compra…</p>:!rows.length?<p className="nf-muted">Nenhum pedido de compra neste filtro.</p>:<ul className="nf-property-list">{rows.map(row=><li key={row.id}><div><strong>{row.number} · {row.supplierName}</strong><span className="nf-badge">{purchaseStatusNames[row.status]}</span></div>
    <p>{money(row.totalCents)} · {row.items.length} item(ns) · entrega prevista {day(row.expectedDate)}</p>
    <div className="nf-crm-row-actions"><button type="button" className={row.canApprove||row.canReceive?'nf-primary':'nf-secondary'} onClick={()=>void openDetail(row.id)}>{row.canApprove?'Analisar aprovação':row.canReceive?'Receber':'Ver pedido'}</button></div></li>)}</ul>}
   <div className="nf-crm-pagination"><button className="nf-secondary" disabled={loading||page<=1} onClick={()=>setPage(value=>value-1)}>Anterior</button><span>Página {page}</span><button className="nf-secondary" disabled={loading||page*20>=total} onClick={()=>setPage(value=>value+1)}>Próxima</button></div>
  </section>
  <Modal open={Boolean(record)} title={record?'Pedido de compra '+record.number+' — '+record.supplierName:''} onClose={()=>{setDetail(null);setNotice('');setError('');}}>
   {record&&<div className="nf-order-detail">{notice&&<p role="status" className="nf-admin-success">{notice}</p>}{error&&<p role="alert" className="nf-error">{error}</p>}
    <p><span className="nf-badge">{purchaseStatusNames[record.status]}</span> Criado por {record.createdBy} em {when(record.createdAt)}{record.approvedBy?' · aprovado por '+record.approvedBy:''}</p>
    {record.status==='aguardando_aprovacao'&&<p className="nf-warning">Acima do limite de aprovação da empresa: depende da gerência.</p>}{record.decisionNote&&<p>Observação da decisão: {record.decisionNote}</p>}
    <div className="nf-table-scroll"><table className="nf-admin-table nf-proposal-items"><thead><tr><th>Item</th><th>Quantidade</th><th>Recebido</th><th>Pendente</th><th>Custo unit.</th><th>Total</th></tr></thead><tbody>{record.items.map(item=><tr key={item.productId}><td>{item.code} — {item.description}{item.kind==='service'&&<small>Serviço: não entra no estoque</small>}</td><td data-label="Quantidade">{item.quantity.replace('.',',')} {item.unit}</td><td data-label="Recebido">{item.received.replace('.',',')}</td><td data-label="Pendente">{item.pending.replace('.',',')}</td><td data-label="Custo unit.">{money(item.unitCostCents)}</td><td data-label="Total">{money(item.totalCents)}</td></tr>)}</tbody></table></div>
    <dl className="nf-record-summary"><div><dt>Total</dt><dd>{money(record.totalCents)}</dd></div><div><dt>Entrega prevista</dt><dd>{day(record.expectedDate)}</dd></div><div><dt>Pagamento</dt><dd>{record.paymentTerms||'—'}</dd></div>{record.receivedAt&&<div><dt>Recebido em</dt><dd>{when(record.receivedAt)}</dd></div>}</dl>
    {record.notes&&<p>Observações: {record.notes}</p>}
    <div className="nf-crm-row-actions"><button type="button" className="nf-secondary" onClick={()=>void pdf()}>Baixar PDF</button>{record.canEdit&&<button type="button" className="nf-secondary" onClick={()=>openEditor(record)}>Editar rascunho</button>}
     {(Object.keys(actionTexts) as PurchaseAction[]).filter(key=>record[flags[key]]).map(key=><button key={key} type="button" className={['submit','approve','send'].includes(key)?'nf-primary':'nf-secondary'} onClick={()=>{setNote('');setFormError('');setAction(key);}}>{actionTexts[key].label}</button>)}
     {record.canReceive&&<button type="button" className="nf-primary" onClick={()=>{setFormError('');setReceiveNote('');setReceiving(Object.fromEntries(record.items.filter(item=>Number(item.pending)>0).map(item=>[item.productId,item.pending.replace('.',',')])));}}>Registrar recebimento</button>}</div>
    <h3>Histórico</h3><ul className="nf-order-installments">{detail!.history.map((item,index)=><li key={index}>{when(item.at)} · {eventNames[item.action]??item.action} · {item.actor}{item.note?' — '+item.note:''}</li>)}</ul>
   </div>}
  </Modal>
  <Modal open={Boolean(action)} title={action&&record?actionTexts[action].title+' — '+record.number:''} busy={busy} size="compact" onClose={()=>setAction(null)}>
   <form className="nf-form" onSubmit={act}><fieldset disabled={busy}><p>{action&&actionTexts[action].text}</p>
    {action&&actionTexts[action].note&&<label>{actionTexts[action].note==='required'?'Motivo':'Observação'}<textarea required={actionTexts[action].note==='required'} minLength={actionTexts[action].note==='required'?5:undefined} maxLength={1000} value={note} onChange={event=>setNote(event.target.value)}/></label>}
    {formError&&<p role="alert" className="nf-error">{formError}</p>}
    <div className="nf-admin-actions"><button type="button" className="nf-secondary" onClick={()=>setAction(null)}>Voltar</button><button className="nf-primary">{busy?'Salvando…':'Confirmar'}</button></div></fieldset></form>
  </Modal>
  <Modal open={Boolean(receiving)} title={record?'Registrar recebimento — '+record.number:''} busy={busy} onClose={()=>setReceiving(null)}>
   {receiving&&record&&<form className="nf-form" onSubmit={receive}><fieldset disabled={busy}><p>Informe o que chegou. Produtos entram no almoxarifado pelo custo do pedido e atualizam o custo médio; o restante continua pendente.</p>
    {record.items.filter(item=>item.productId in receiving).map(item=><label key={item.productId}>{item.code} — {item.description} (pendente {item.pending.replace('.',',')} {item.unit})<input inputMode="decimal" maxLength={13} value={receiving[item.productId]} onChange={event=>setReceiving({...receiving,[item.productId]:event.target.value})}/></label>)}
    <label>Observação (ex.: número da nota do fornecedor)<input maxLength={1000} value={receiveNote} onChange={event=>setReceiveNote(event.target.value)}/></label>
    {formError&&<p role="alert" className="nf-error">{formError}</p>}
    <div className="nf-admin-actions"><button type="button" className="nf-secondary" onClick={()=>setReceiving(null)}>Voltar</button><button className="nf-primary">{busy?'Salvando…':'Registrar recebimento'}</button></div></fieldset></form>}
  </Modal>
  <Modal open={Boolean(editor)} title={editor?.row?'Editar '+editor.row.number:'Novo pedido de compra'} busy={busy} onClose={()=>setEditor(null)}>
   <form className="nf-form" onSubmit={save}><fieldset disabled={busy}>
    <div className="nf-admin-grid"><label>Buscar fornecedor<input value={supplierSearch} maxLength={80} onChange={event=>setSupplierSearch(event.target.value)}/></label>
     <label>Fornecedor<select required value={draft.supplierId} onChange={event=>setDraft({...draft,supplierId:event.target.value})}><option value="">Selecione</option>{editor?.row&&!suppliers.some(item=>item.id===editor.row!.supplierId)&&<option value={editor.row.supplierId}>{editor.row.supplierName}</option>}{suppliers.map(item=><option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
     <label>Buscar no catálogo<input value={productSearch} maxLength={80} onChange={event=>setProductSearch(event.target.value)} placeholder="Código, descrição ou SKU"/></label>
     <label>Incluir item<select value="" onChange={event=>addProduct(event.target.value)}><option value="">Selecione um produto ou serviço</option>{products.filter(item=>!lines.some(line=>line.productId===item.id)).map(item=><option key={item.id} value={item.id}>{item.code} — {item.description}</option>)}</select></label></div>
    {!lines.length?<p className="nf-muted">Nenhum item incluído.</p>:<div className="nf-table-scroll"><table className="nf-admin-table nf-proposal-items"><thead><tr><th>Item</th><th>Quantidade</th><th>Custo unitário (R$)</th><th>Total</th><th><span className="nf-sr-only">Remover</span></th></tr></thead><tbody>{lines.map((line,index)=><tr key={line.productId}><td>{line.label}</td>
     <td data-label="Quantidade"><input aria-label={'Quantidade de '+line.label} inputMode="decimal" maxLength={13} value={line.quantity} onChange={event=>setLines(current=>current.map((row,position)=>position===index?{...row,quantity:event.target.value}:row))}/></td>
     <td data-label="Custo unitário (R$)"><input aria-label={'Custo unitário de '+line.label} inputMode="decimal" maxLength={20} value={line.cost} onChange={event=>setLines(current=>current.map((row,position)=>position===index?{...row,cost:event.target.value}:row))}/></td>
     <td data-label="Total">{preview(line)===null?'—':money(preview(line)!)}</td><td><button type="button" className="nf-secondary" onClick={()=>setLines(current=>current.filter((_,position)=>position!==index))}>Remover</button></td></tr>)}</tbody></table></div>}
    <p className="nf-proposal-total">Total previsto: <strong>{money(lines.reduce((sum,line)=>sum+(preview(line)??0),0))}</strong>{costs&&<small> · custo atual do catálogo sugerido</small>}</p>
    <div className="nf-admin-grid"><label>Entrega prevista<input type="date" required value={draft.expectedDate} onChange={event=>setDraft({...draft,expectedDate:event.target.value})}/></label><label>Condição de pagamento<input maxLength={300} value={draft.paymentTerms} onChange={event=>setDraft({...draft,paymentTerms:event.target.value})} placeholder="Ex.: 28/56 dias, boleto"/></label></div>
    <label>Observações para o fornecedor<textarea maxLength={3000} value={draft.notes} onChange={event=>setDraft({...draft,notes:event.target.value})}/></label>
    {formError&&<p role="alert" className="nf-error">{formError}</p>}
    <div className="nf-admin-actions"><button type="button" className="nf-secondary" onClick={()=>setEditor(null)}>Cancelar</button><button className="nf-primary">{busy?'Salvando…':'Salvar rascunho'}</button></div>
   </fieldset></form>
  </Modal>
 </section>;
}
