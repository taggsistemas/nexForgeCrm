import {useEffect,useState,type FormEvent} from 'react';
import {Modal} from '../../components/Modal';
import {companyProfile,downloadPdf} from '../../components/documentPdf';
import {salesOrderPdf,type DocumentCustomer} from '../../../../../packages/contracts/src/documents';
import {moneyToCents,proposalLineCents} from '../../../../../packages/contracts/src/opportunities';
import {orderApprovalReasonNames,orderKindNames,orderOriginNames,orderPaymentMethodNames,orderStatusNames,parsePaymentTerms,type OrderAction,type OrderEventView,type OrderView} from '../../../../../packages/contracts/src/orders';
import {paymentMethods} from '../../../../../packages/contracts/src/qualification';
import type {ProductView} from '../../../../../packages/contracts/src/catalog';
type Account={companies:{id:string;name:string}[];permissions?:string[]};
type Line={productId:string;label:string;quantity:string;price:string;discount:string;reference:number|null};
type Terms={expectedDeliveryDate:string;paymentMethod:string;terms:string;notes:string};
const money=(cents:number)=>new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(cents/100);
const day=(value:string)=>value.split('-').reverse().join('/');
const when=(value:string)=>new Date(value).toLocaleString('pt-BR',{timeZone:'America/Sao_Paulo',dateStyle:'short',timeStyle:'short'});
const asInput=(cents:number)=>(cents/100).toFixed(2).replace('.',',');
const centsOrZero=(value:string)=>value.trim()?moneyToCents(value):0;
const today=()=>new Date(Date.now()-3*3600000).toISOString().slice(0,10);
const blankTerms=():Terms=>({expectedDeliveryDate:new Date(Date.now()+15*86400000).toISOString().slice(0,10),paymentMethod:'boleto',terms:'30',notes:''});
const reasons:Record<string,string>={CUSTOMER_NOT_APPROVED:'O cliente precisa estar com a qualificação aprovada para receber pedidos.',PROPOSAL_NOT_ACCEPTED:'Somente propostas aceitas pelo cliente geram pedido.',WORK_ORDER_NOT_CLOSED:'A OS precisa estar encerrada pela coordenação.',NOTHING_BILLABLE:'A OS não tem horas faturáveis nem peças a cobrar.',INVALID_PRODUCT:'Um produto não está mais ativo no catálogo.',INVALID_QUANTITY:'A quantidade não respeita as casas decimais do produto.',INVALID_LINE:'O desconto não pode superar o valor da linha.',ITEMS_FROM_SOURCE:'Os itens de pedidos gerados por proposta ou OS não podem ser alterados.',REASON_REQUIRED:'Informe o motivo (mínimo de 5 caracteres).',SELF_APPROVAL:'Quem enviou o pedido não pode aprová-lo.',KIND_NOT_ALLOWED:'Seu perfil não trabalha com este tipo de pedido (venda ou serviço).',DUPLICATE_INVOICE:'Esta nota fiscal já foi lançada.',INVOICE_ABOVE_TOTAL:'A soma das notas não pode ultrapassar o total do pedido.',FUTURE_INVOICE:'A data de emissão não pode estar no futuro.',STATUS:'A situação atual do pedido não permite esta ação.'};
async function call(company:string,path:string,options:RequestInit={}){
 const response=await fetch('/api/v1/companies/'+company+path,{...options,cache:'no-store',credentials:'same-origin',headers:{'Content-Type':'application/json',...options.headers}});
 if(!response.ok){const data=await response.json().catch(()=>({}));
  if(response.status===401||['PASSWORD_CHANGE_REQUIRED','PRIVACY_ACCEPTANCE_REQUIRED'].includes(data.code)){window.location.reload();throw Error('Atualize seu acesso.');}
  throw Error(data.code==='ORDER_RULE_REJECTED'?reasons[data.reason]??'Ação não permitida.':response.status===409?'Registro alterado por outra pessoa ou pedido já gerado para esta origem. Atualize e tente novamente.':response.status===403?'Você não tem permissão para esta operação.':response.status===404?'Registro não encontrado ou fora da sua carteira.':'Não foi possível concluir. Confira os campos e sua conexão.');
 }
 return response.json();
}
function termsBody(terms:Terms){const days=parsePaymentTerms(terms.terms);if(!days)throw Error('Informe os prazos em dias, por exemplo 0 (à vista) ou 30/60/90.');return {expectedDeliveryDate:terms.expectedDeliveryDate,paymentMethod:terms.paymentMethod,paymentTermDays:days,notes:terms.notes};}
function TermsFields({value,onChange}:{value:Terms;onChange:(value:Terms)=>void}){
 const set=(key:keyof Terms,next:string)=>onChange({...value,[key]:next});
 return <><div className="nf-admin-grid"><label>Entrega prevista<input type="date" required value={value.expectedDeliveryDate} onChange={event=>set('expectedDeliveryDate',event.target.value)}/></label>
  <label>Forma de pagamento<select value={value.paymentMethod} onChange={event=>set('paymentMethod',event.target.value)}>{paymentMethods.map(item=><option key={item} value={item}>{orderPaymentMethodNames[item]}</option>)}</select></label>
  <label>Prazos (dias após a entrega)<input required value={value.terms} maxLength={60} inputMode="numeric" onChange={event=>set('terms',event.target.value)} aria-describedby="order-terms-hint"/></label></div>
  <p id="order-terms-hint" className="nf-field-hint">Ex.: 0 para à vista ou 30/60/90. As parcelas formam a previsão de faturamento. Fora da tabela, do crédito ou das condições aprovadas do cliente, o pedido vai para aprovação.</p>
  <label>Observações<textarea value={value.notes} maxLength={3000} onChange={event=>set('notes',event.target.value)}/></label></>;
}
/** "Gerar pedido" from an accepted proposal or a closed work order. Items come from the source on the server. */
export function OrderFromSource({company,source,permissions,label='Gerar pedido'}:{company:string;source:{proposalId:string;opportunityId:string}|{workOrderId:string};permissions:readonly string[];label?:string}){
 const [open,setOpen]=useState(false),[terms,setTerms]=useState(blankTerms()),[busy,setBusy]=useState(false),[error,setError]=useState(''),[created,setCreated]=useState('');
 if(!permissions.includes('order:write'))return null;
 async function submit(event:FormEvent){
  event.preventDefault();setBusy(true);setError('');
  try{const body={...source,...termsBody(terms)};const row=await call(company,'/orders/'+('workOrderId' in source?'from-work-order':'from-proposal'),{method:'POST',body:JSON.stringify(body)});setCreated(row.number);setOpen(false);}
  catch(cause){setError((cause as Error).message);}finally{setBusy(false);}
 }
 return <>{created?<span role="status" className="nf-badge">Pedido {created} criado em rascunho</span>:<button type="button" className="nf-primary" onClick={()=>{setTerms(blankTerms());setError('');setOpen(true);}}>{label}</button>}
  <Modal open={open} title={'workOrderId' in source?'Gerar pedido de serviço da OS':'Gerar pedido da proposta aceita'} busy={busy} onClose={()=>setOpen(false)}>
   <form className="nf-form" onSubmit={submit}><fieldset disabled={busy}>
    <p>{'workOrderId' in source?'Itens: horas faturáveis autorizadas no encerramento, ao preço de tabela do serviço, e as peças líquidas consumidas.':'Itens e preços vêm da revisão aceita. O pedido nasce em rascunho; envie-o na tela de pedidos.'}</p>
    <TermsFields value={terms} onChange={setTerms}/>{error&&<p role="alert" className="nf-error">{error}</p>}
    <div className="nf-admin-actions"><button type="button" className="nf-secondary" onClick={()=>setOpen(false)}>Cancelar</button><button className="nf-primary">{busy?'Gerando...':'Gerar pedido'}</button></div>
   </fieldset></form>
  </Modal></>;
}
const actionTexts:Record<OrderAction,{label:string;title:string;text:string;note?:'required'|'optional'}>={
 submit:{label:'Enviar',title:'Enviar pedido',text:'Dentro da tabela, do crédito e das condições aprovadas, o pedido é confirmado na hora. Caso contrário, segue para aprovação da gerência.'},
 approve:{label:'Aprovar',title:'Aprovar pedido',text:'Confirma o pedido apesar das exceções indicadas.',note:'optional'},
 reject:{label:'Devolver',title:'Devolver ao vendedor',text:'O pedido volta para rascunho para ajuste.',note:'required'},
 deliver:{label:'Registrar entrega',title:'Registrar entrega',text:'A data da entrega é registrada pelo servidor.'},
 cancel:{label:'Cancelar pedido',title:'Cancelar pedido',text:'Pedidos com nota lançada não podem ser cancelados.',note:'required'},
};
const eventNames:Record<string,string>={created:'Pedido criado',updated:'Rascunho alterado',submit:'Enviado',approve:'Aprovado',reject:'Devolvido ao vendedor',deliver:'Entrega registrada',cancel:'Cancelado',invoiced:'Nota fiscal lançada'};
const flags:Record<OrderAction,keyof OrderView>={submit:'canSubmit',approve:'canApprove',reject:'canApprove',deliver:'canDeliver',cancel:'canCancel'};
/** Sales and service orders: list, direct entry, approval, delivery, invoices registered by finance and billing forecast. */
export function Orders({account}:{account:Account}){
 const permissions=account.permissions??[],[company,setCompany]=useState(account.companies[0]?.id??'');
 const [rows,setRows]=useState<OrderView[]>([]),[total,setTotal]=useState(0),[page,setPage]=useState(1),[status,setStatus]=useState('open'),[search,setSearch]=useState(''),[searchDraft,setSearchDraft]=useState(''),[loading,setLoading]=useState(true),[refresh,setRefresh]=useState(0);
 const [error,setError]=useState(''),[notice,setNotice]=useState(''),[busy,setBusy]=useState(false),[formError,setFormError]=useState('');
 const [detail,setDetail]=useState<{record:OrderView;history:OrderEventView[];customer?:DocumentCustomer|null}|null>(null),[action,setAction]=useState<OrderAction|null>(null),[note,setNote]=useState('');
 const [editor,setEditor]=useState<{row?:OrderView}|null>(null),[terms,setTerms]=useState(blankTerms()),[lines,setLines]=useState<Line[]>([]);
 const [parties,setParties]=useState<{id:string;name:string}[]>([]),[partySearch,setPartySearch]=useState(''),[partyId,setPartyId]=useState('');
 const [products,setProducts]=useState<ProductView[]>([]),[productSearch,setProductSearch]=useState('');
 async function pdf(){if(!detail)return;try{downloadPdf(detail.record.number+'.pdf',salesOrderPdf(detail.record,await companyProfile(company),detail.customer));}catch(cause){setNotice('');setError((cause as Error).message);}}
 const [invoice,setInvoice]=useState<{number:string;issueDate:string;amount:string}|null>(null);
 useEffect(()=>{
  const controller=new AbortController();setLoading(true);
  call(company,'/orders?page='+page+'&status='+status+'&search='+encodeURIComponent(search),{signal:controller.signal}).then(data=>{setRows(data.items??[]);setTotal(data.total??0);setError('');}).catch(cause=>{if(!controller.signal.aborted){setRows([]);setError((cause as Error).message);}}).finally(()=>{if(!controller.signal.aborted)setLoading(false);});
  return()=>controller.abort();
 },[company,page,status,search,refresh]);
 useEffect(()=>{
  if(!editor||editor.row)return;const controller=new AbortController(),timer=setTimeout(()=>call(company,'/customers?page=1&qualificationState=approved&search='+encodeURIComponent(partySearch),{signal:controller.signal}).then(data=>setParties((data.items??[]).map((item:{id:string;name:string})=>({id:item.id,name:item.name})))).catch(()=>{}),250);
  return()=>{controller.abort();clearTimeout(timer);};
 },[company,editor,partySearch]);
 useEffect(()=>{
  if(!editor||!permissions.includes('catalog:read'))return;const controller=new AbortController(),timer=setTimeout(()=>call(company,'/catalog/products?page=1&search='+encodeURIComponent(productSearch),{signal:controller.signal}).then(data=>setProducts((data.items??[]).filter((item:ProductView)=>item.active))).catch(()=>{}),250);
  return()=>{controller.abort();clearTimeout(timer);};
 },[company,editor,productSearch]);
 async function openDetail(id:string){setNotice('');try{setDetail(await call(company,'/orders/'+id));}catch(cause){setError((cause as Error).message);}}
 function openEditor(row?:OrderView){
  setFormError('');setNotice('');setProductSearch('');setPartySearch('');setPartyId(row?.partyId??'');
  setTerms(row?{expectedDeliveryDate:row.expectedDeliveryDate,paymentMethod:row.paymentMethod,terms:row.paymentTermDays.join('/'),notes:row.notes}:blankTerms());
  setLines(row?row.items.map(item=>({productId:item.productId,label:item.code+' — '+item.description,quantity:item.quantity,price:asInput(item.unitPriceCents),discount:item.discountCents?asInput(item.discountCents):'',reference:item.referencePriceCents})):[]);
  setEditor({row});
 }
 async function addProduct(id:string){
  const product=products.find(item=>item.id===id),customer=editor?.row?.partyId??partyId;if(!product||lines.some(line=>line.productId===id))return;
  let reference:number|null=null;if(customer){try{reference=(await call(company,'/catalog/resolve?customerId='+customer+'&productId='+id)).price?.priceCents??null;}catch{reference=null;}}
  setLines(current=>[...current,{productId:id,label:product.code+' — '+product.description,quantity:'1',price:reference!==null?asInput(reference):'',discount:'',reference}]);
 }
 const setLine=(index:number,key:keyof Line,value:string)=>setLines(current=>current.map((line,position)=>position===index?{...line,[key]:value}:line));
 const preview=(line:Line)=>{try{const price=centsOrZero(line.price),discount=centsOrZero(line.discount);return price===undefined||discount===undefined?null:proposalLineCents(line.quantity.replace(',','.'),price,discount);}catch{return null;}};
 const editableItems=!editor?.row||editor.row.origin==='direto';
 async function save(event:FormEvent){
  event.preventDefault();if(!editor)return;setFormError('');
  try{
   const body:Record<string,unknown>=termsBody(terms);
   if(editableItems){if(!lines.length)throw Error('Inclua pelo menos um item do catálogo.');body.items=lines.map(line=>{const unitPriceCents=centsOrZero(line.price),discountCents=centsOrZero(line.discount);if(unitPriceCents===undefined||discountCents===undefined||preview(line)===null)throw Error('Confira quantidade, preço e desconto de '+line.label+'.');return {productId:line.productId,quantity:line.quantity.replace(',','.'),unitPriceCents,discountCents};});}
   if(!editor.row&&!partyId)throw Error('Selecione o cliente.');
   setBusy(true);
   if(editor.row){const {record}=await call(company,'/orders/'+editor.row.id,{method:'PATCH',body:JSON.stringify({...body,version:editor.row.version})});setDetail(await call(company,'/orders/'+record.id));}
   else{const row=await call(company,'/orders',{method:'POST',body:JSON.stringify({...body,partyId})});setNotice('Pedido '+row.number+' criado em rascunho.');}
   setEditor(null);setRefresh(value=>value+1);
  }catch(cause){setFormError((cause as Error).message);}finally{setBusy(false);}
 }
 async function act(event:FormEvent){
  event.preventDefault();if(!detail||!action)return;setBusy(true);setFormError('');
  try{const {record}=await call(company,'/orders/'+detail.record.id+'/'+action,{method:'POST',body:JSON.stringify({version:detail.record.version,note})});setAction(null);setNotice(actionTexts[action].title+': '+orderStatusNames[record.status as OrderView['status']]+'.');setDetail(await call(company,'/orders/'+detail.record.id));setRefresh(value=>value+1);}
  catch(cause){setFormError((cause as Error).message);}finally{setBusy(false);}
 }
 async function registerInvoice(event:FormEvent){
  event.preventDefault();if(!detail||!invoice)return;const amountCents=moneyToCents(invoice.amount);if(!amountCents){setFormError('Informe o valor da nota.');return;}
  setBusy(true);setFormError('');
  try{await call(company,'/orders/'+detail.record.id+'/invoices',{method:'POST',body:JSON.stringify({version:detail.record.version,number:invoice.number,issueDate:invoice.issueDate,amountCents})});setInvoice(null);setNotice('Nota '+invoice.number+' lançada.');setDetail(await call(company,'/orders/'+detail.record.id));setRefresh(value=>value+1);}
  catch(cause){setFormError((cause as Error).message);}finally{setBusy(false);}
 }
 const record=detail?.record;
 return <section className="nf-crm nf-orders">
  <div className="nf-crm-toolbar"><label>Empresa<select value={company} disabled={Boolean(editor||detail)} onChange={event=>{setCompany(event.target.value);setPage(1);}}>{account.companies.map(item=><option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
   {permissions.includes('order:write')&&<button className="nf-primary" onClick={()=>openEditor()}>Novo pedido</button>}</div>
  {!editor&&!detail&&error&&<p role="alert" className="nf-error">{error}</p>}{!detail&&notice&&<p role="status" className="nf-admin-success">{notice}</p>}
  <section className="nf-panel"><div className="nf-section-heading"><h2>Pedidos de venda e serviço</h2><span>{total} pedido(s)</span></div>
   <p className="nf-field-hint">Pedidos nascem de proposta aceita, de OS encerrada ou por lançamento direto. As notas fiscais são emitidas pelo financeiro no sistema próprio e lançadas aqui.</p>
   <form className="nf-filter-bar" onSubmit={event=>{event.preventDefault();setSearch(searchDraft.trim());setPage(1);}}><label>Situação<select value={status} onChange={event=>{setStatus(event.target.value);setPage(1);}}><option value="open">Em andamento</option>{Object.entries(orderStatusNames).map(([key,name])=><option key={key} value={key}>{name}</option>)}<option value="all">Todos</option></select></label>
    <label>Número do pedido<input value={searchDraft} maxLength={80} onChange={event=>setSearchDraft(event.target.value)}/></label><button className="nf-secondary">Buscar</button></form>
   {loading?<p role="status">Carregando pedidos...</p>:!rows.length?<p className="nf-muted">Nenhum pedido neste filtro.</p>:<ul className="nf-property-list">{rows.map(row=><li key={row.id}><div><strong>{row.number} · {row.partyName}</strong><span className="nf-badge">{orderStatusNames[row.status]}</span></div>
    <p>{orderKindNames[row.kind]} · {orderOriginNames[row.origin]}{row.proposalNumber?' '+row.proposalNumber:''}{row.workOrderNumber?' '+row.workOrderNumber:''} · {money(row.totalCents)}</p>
    <small>Entrega prevista {day(row.expectedDeliveryDate)} · Faturado {money(row.invoicedCents)} · A faturar {money(row.remainingCents)}{row.approvalReasons.length&&row.status==='aguardando_aprovacao'?' · '+row.approvalReasons.map(item=>orderApprovalReasonNames[item]).join('; '):''}</small>
    <div className="nf-crm-row-actions"><button type="button" className={row.canApprove||row.canInvoice?'nf-primary':'nf-secondary'} onClick={()=>void openDetail(row.id)}>{row.canApprove?'Analisar aprovação':row.canInvoice?'Lançar nota':'Ver pedido'}</button></div></li>)}</ul>}
   <div className="nf-crm-pagination"><button className="nf-secondary" disabled={loading||page<=1} onClick={()=>setPage(value=>value-1)}>Anterior</button><span>Página {page}</span><button className="nf-secondary" disabled={loading||page*20>=total} onClick={()=>setPage(value=>value+1)}>Próxima</button></div>
  </section>
  <Modal open={Boolean(record)} title={record?'Pedido '+record.number+' — '+record.partyName:''} onClose={()=>{setDetail(null);setNotice('');setError('');}}>
   {record&&<div className="nf-order-detail">
    {notice&&<p role="status" className="nf-admin-success">{notice}</p>}{error&&<p role="alert" className="nf-error">{error}</p>}
    <p><span className="nf-badge">{orderStatusNames[record.status]}</span> {orderKindNames[record.kind]} · {orderOriginNames[record.origin]}{record.proposalNumber?' '+record.proposalNumber:''}{record.workOrderNumber?' '+record.workOrderNumber:''}</p>
    {record.status==='aguardando_aprovacao'&&<p className="nf-warning">Aprovação necessária: {record.approvalReasons.map(item=>orderApprovalReasonNames[item]).join('; ')}.</p>}
    {record.decisionNote&&<p>Observação da decisão: {record.decisionNote}</p>}
    <div className="nf-table-scroll"><table className="nf-admin-table nf-proposal-items"><thead><tr><th>Item</th><th>Quantidade</th><th>Preço unitário</th><th>Desconto</th><th>Total</th>{record.costCents!==undefined&&<th>Custo</th>}</tr></thead><tbody>{record.items.map(item=><tr key={item.productId}><td>{item.code} — {item.description}{item.referencePriceCents!==null&&<small>Tabela: {money(item.referencePriceCents)}</small>}</td><td data-label="Quantidade">{item.quantity.replace('.',',')} {item.unit}</td><td data-label="Preço unitário">{money(item.unitPriceCents)}</td><td data-label="Desconto">{money(item.discountCents)}</td><td data-label="Total">{money(item.totalCents)}</td>{record.costCents!==undefined&&<td data-label="Custo">{item.costCents===null||item.costCents===undefined?'sem custo':money(item.costCents)}</td>}</tr>)}</tbody></table></div>
    <dl className="nf-record-summary"><div><dt>Total</dt><dd>{money(record.totalCents)}</dd></div><div><dt>Faturado</dt><dd>{money(record.invoicedCents)}</dd></div><div><dt>A faturar</dt><dd>{money(record.remainingCents)}</dd></div>
     {record.marginCents!==undefined&&<div><dt>Margem bruta</dt><dd>{record.marginCents===null?'sem custo completo':money(record.marginCents)+(record.marginPercent!==null?' ('+String(record.marginPercent).replace('.',',')+'%)':'')}</dd></div>}
     <div><dt>Pagamento</dt><dd>{orderPaymentMethodNames[record.paymentMethod]} · {record.paymentTermDays.join('/')} dias</dd></div><div><dt>Entrega</dt><dd>{record.deliveredAt?'Entregue em '+when(record.deliveredAt):'Prevista '+day(record.expectedDeliveryDate)}</dd></div></dl>
    {record.notes&&<p>Observações: {record.notes}</p>}
    <h3>Previsão de faturamento</h3><ul className="nf-order-installments">{record.installments.map((item,index)=><li key={index}>{day(item.dueDate)} · {money(item.amountCents)}</li>)}</ul>
    <h3>Notas fiscais lançadas</h3>{!record.invoices.length?<p className="nf-muted">Nenhuma nota lançada.</p>:<ul className="nf-order-installments">{record.invoices.map(item=><li key={item.number}>NF {item.number} · emitida {day(item.issueDate)} · {money(item.amountCents)} · lançada por {item.registeredBy}</li>)}</ul>}
    <div className="nf-crm-row-actions"><button type="button" className="nf-secondary" onClick={()=>void pdf()}>Baixar PDF</button>{record.canEdit&&<button type="button" className="nf-secondary" onClick={()=>openEditor(record)}>Editar rascunho</button>}
     {(Object.keys(actionTexts) as OrderAction[]).filter(key=>record[flags[key]]).map(key=><button key={key} type="button" className={['submit','approve','deliver'].includes(key)?'nf-primary':'nf-secondary'} onClick={()=>{setNote('');setFormError('');setAction(key);}}>{actionTexts[key].label}</button>)}
     {record.canInvoice&&<button type="button" className="nf-primary" onClick={()=>{setFormError('');setInvoice({number:'',issueDate:today(),amount:asInput(record.remainingCents)});}}>Lançar nota fiscal</button>}</div>
    <h3>Histórico</h3><ul className="nf-order-installments">{detail!.history.map((item,index)=><li key={index}>{when(item.at)} · {eventNames[item.action]??item.action} · {item.actor}{item.note?' — '+item.note:''}</li>)}</ul>
   </div>}
  </Modal>
  <Modal open={Boolean(action)} title={action&&record?actionTexts[action].title+' — '+record.number:''} busy={busy} size="compact" onClose={()=>setAction(null)}>
   <form className="nf-form" onSubmit={act}><fieldset disabled={busy}><p>{action&&actionTexts[action].text}</p>
    {action&&actionTexts[action].note&&<label>{actionTexts[action].note==='required'?'Motivo':'Observação'}<textarea required={actionTexts[action].note==='required'} minLength={actionTexts[action].note==='required'?5:undefined} maxLength={1000} value={note} onChange={event=>setNote(event.target.value)}/></label>}
    {formError&&<p role="alert" className="nf-error">{formError}</p>}
    <div className="nf-admin-actions"><button type="button" className="nf-secondary" onClick={()=>setAction(null)}>Voltar</button><button className="nf-primary">{busy?'Salvando...':'Confirmar'}</button></div></fieldset></form>
  </Modal>
  <Modal open={Boolean(invoice)} title={record?'Lançar nota fiscal — '+record.number:''} busy={busy} size="compact" onClose={()=>setInvoice(null)}>
   {invoice&&<form className="nf-form" onSubmit={registerInvoice}><fieldset disabled={busy}><p>A nota é emitida no sistema do financeiro; aqui fica o registro para acompanhamento. Quando a soma cobre o total, o pedido passa a faturado.</p>
    <label>Número da nota<input required maxLength={40} value={invoice.number} onChange={event=>setInvoice({...invoice,number:event.target.value})}/></label>
    <label>Data de emissão<input type="date" required max={today()} value={invoice.issueDate} onChange={event=>setInvoice({...invoice,issueDate:event.target.value})}/></label>
    <label>Valor (R$)<input required inputMode="decimal" maxLength={20} value={invoice.amount} onChange={event=>setInvoice({...invoice,amount:event.target.value})}/></label>
    {formError&&<p role="alert" className="nf-error">{formError}</p>}
    <div className="nf-admin-actions"><button type="button" className="nf-secondary" onClick={()=>setInvoice(null)}>Voltar</button><button className="nf-primary">{busy?'Salvando...':'Lançar nota'}</button></div></fieldset></form>}
  </Modal>
  <Modal open={Boolean(editor)} title={editor?.row?'Editar '+editor.row.number:'Novo pedido'} busy={busy} onClose={()=>setEditor(null)}>
   <form className="nf-form" onSubmit={save}><fieldset disabled={busy}>
    {!editor?.row&&<div className="nf-admin-grid"><label>Buscar cliente aprovado<input value={partySearch} maxLength={80} onChange={event=>setPartySearch(event.target.value)}/></label>
     <label>Cliente<select required value={partyId} onChange={event=>{setPartyId(event.target.value);setLines([]);}}><option value="">Selecione</option>{parties.map(item=><option key={item.id} value={item.id}>{item.name}</option>)}</select></label></div>}
    {editableItems?<><div className="nf-admin-grid"><label>Buscar no catálogo<input value={productSearch} maxLength={80} onChange={event=>setProductSearch(event.target.value)} placeholder="Código, descrição ou SKU"/></label>
     <label>Incluir item<select value="" disabled={!editor?.row&&!partyId} onChange={event=>void addProduct(event.target.value)}><option value="">Selecione um produto ou serviço</option>{products.filter(item=>!lines.some(line=>line.productId===item.id)).map(item=><option key={item.id} value={item.id}>{item.code} — {item.description}</option>)}</select></label></div>
     {!lines.length?<p className="nf-muted">Nenhum item incluído.</p>:<div className="nf-table-scroll"><table className="nf-admin-table nf-proposal-items"><thead><tr><th>Item</th><th>Quantidade</th><th>Preço unitário (R$)</th><th>Desconto (R$)</th><th>Total</th><th><span className="nf-sr-only">Remover</span></th></tr></thead><tbody>{lines.map((line,index)=><tr key={line.productId}><td>{line.label}{line.reference!==null&&<small>Tabela: {money(line.reference)}</small>}</td>
      <td data-label="Quantidade"><input aria-label={'Quantidade de '+line.label} inputMode="decimal" value={line.quantity} maxLength={13} onChange={event=>setLine(index,'quantity',event.target.value)}/></td>
      <td data-label="Preço unitário (R$)"><input aria-label={'Preço unitário de '+line.label} inputMode="decimal" value={line.price} maxLength={20} onChange={event=>setLine(index,'price',event.target.value)}/></td>
      <td data-label="Desconto (R$)"><input aria-label={'Desconto de '+line.label} inputMode="decimal" value={line.discount} maxLength={20} onChange={event=>setLine(index,'discount',event.target.value)}/></td>
      <td data-label="Total">{preview(line)===null?'—':money(preview(line)!)}</td><td><button type="button" className="nf-secondary" onClick={()=>setLines(current=>current.filter((_,position)=>position!==index))}>Remover</button></td></tr>)}</tbody></table></div>}
     <p className="nf-proposal-total">Total previsto: <strong>{money(lines.reduce((sum,line)=>sum+(preview(line)??0),0))}</strong></p></>
    :<p className="nf-field-hint">Os itens vêm da {editor?.row?.origin==='os'?'OS encerrada':'proposta aceita'} e não podem ser alterados aqui.</p>}
    <TermsFields value={terms} onChange={setTerms}/>
    {formError&&<p role="alert" className="nf-error">{formError}</p>}
    <div className="nf-admin-actions"><button type="button" className="nf-secondary" onClick={()=>setEditor(null)}>Cancelar</button><button className="nf-primary">{busy?'Salvando...':'Salvar rascunho'}</button></div>
   </fieldset></form>
  </Modal>
 </section>;
}
