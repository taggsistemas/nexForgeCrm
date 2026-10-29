import {useEffect,useState,type FormEvent} from 'react';
import {Modal} from '../../components/Modal';
import {OrderFromSource} from '../orders/Orders';
import {moneyToCents,proposalLineCents,proposalStatusNames,type OpportunityView,type ProposalRevisionView,type ProposalView} from '../../../../../packages/contracts/src/opportunities';
import type {ProductView} from '../../../../../packages/contracts/src/catalog';
type Line={productId:string;label:string;quantity:string;price:string;discount:string;reference:number|null};
type Action='send'|'revise'|'accept'|'refuse'|'cancel';
const money=(cents:number)=>new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(cents/100);
const day=(value:string)=>value.split('-').reverse().join('/');
const asInput=(cents:number)=>(cents/100).toFixed(2).replace('.',',');
const centsOrZero=(value:string)=>value.trim()?moneyToCents(value):0;
const actionNames:Record<Action,{label:string;title:string;text:string}>={
 send:{label:'Enviar ao cliente',title:'Enviar proposta',text:'A revisão enviada fica congelada. Alterações posteriores exigem nova revisão.'},
 revise:{label:'Nova revisão',title:'Criar nova revisão',text:'Uma nova revisão em rascunho é criada a partir desta, preservando a revisão enviada.'},
 accept:{label:'Registrar aceite',title:'Registrar aceite do cliente',text:'Registra que o cliente aceitou esta revisão. Não gera pedido nem receita; marque a oportunidade como ganha quando o negócio for confirmado.'},
 refuse:{label:'Registrar recusa',title:'Registrar recusa do cliente',text:'Informe o motivo da recusa.'},
 cancel:{label:'Cancelar',title:'Cancelar proposta',text:'A proposta cancelada não pode ser enviada nem aceita.'},
};
const available:Record<string,Action[]>={rascunho:['send','cancel'],enviada:['accept','refuse','revise','cancel'],recusada:['revise']};
async function call(company:string,path:string,options:RequestInit={}){
 const response=await fetch('/api/v1/companies/'+company+path,{...options,cache:'no-store',credentials:'same-origin',headers:{'Content-Type':'application/json',...options.headers}});
 if(!response.ok){const data=await response.json().catch(()=>({}));
  if(response.status===401||['PASSWORD_CHANGE_REQUIRED','PRIVACY_ACCEPTANCE_REQUIRED'].includes(data.code)){window.location.reload();throw Error('Atualize seu acesso.');}
  const reasons:Record<string,string>={VALIDITY_IN_PAST:'A validade não pode estar no passado.',EXPIRED:'A proposta está vencida. Crie uma nova revisão com nova validade.',ALREADY_ACCEPTED:'Esta oportunidade já tem uma proposta aceita.',INVALID_QUANTITY:'A quantidade não respeita as casas decimais do produto.',INVALID_PRODUCT:'Um produto não está mais ativo no catálogo.',INVALID_LINE:'Confira valores e descontos: o desconto não pode superar o valor da linha.',REASON_REQUIRED:'Informe o motivo.',STATUS:'A situação atual da proposta não permite esta ação.'};
  throw Error(data.code==='PROPOSAL_RULE_REJECTED'?reasons[data.reason]??'Ação não permitida.':data.code==='OPPORTUNITY_RULE_REJECTED'?'Oportunidades encerradas não aceitam alterações em propostas.':response.status===409?'A proposta foi alterada por outra pessoa. Atualize e tente novamente.':response.status===403?'Você não tem permissão para esta operação.':response.status===404?'Registro não encontrado ou fora da sua carteira.':'Não foi possível concluir. Confira os campos e sua conexão.');
 }
 return response.json();
}
/** Proposals of one opportunity. Totals shown in the editor are previews; the server recalculates every line.
 * Table prices are suggested only for approved customers; otherwise the field starts empty. */
export function OpportunityProposals({company,opportunity,permissions}:{company:string;opportunity:OpportunityView;permissions:readonly string[]}){
 const open=['descoberta','proposta','negociacao'].includes(opportunity.stage),canWrite=open&&permissions.includes('proposal:write');
 const [rows,setRows]=useState<ProposalView[]|null>(null),[refresh,setRefresh]=useState(0),[error,setError]=useState(''),[notice,setNotice]=useState('');
 const [editor,setEditor]=useState<{row?:ProposalView}|null>(null),[action,setAction]=useState<{row:ProposalView;action:Action}|null>(null),[revisions,setRevisions]=useState<{row:ProposalView;items:ProposalRevisionView[]|null}|null>(null);
 const [validUntil,setValidUntil]=useState(''),[notes,setNotes]=useState(''),[lines,setLines]=useState<Line[]>([]),[reason,setReason]=useState(''),[busy,setBusy]=useState(false),[formError,setFormError]=useState('');
 const [products,setProducts]=useState<ProductView[]>([]),[productSearch,setProductSearch]=useState('');
 useEffect(()=>{
  const controller=new AbortController();setRows(null);
  call(company,'/opportunities/'+opportunity.id+'/proposals',{signal:controller.signal}).then(data=>setRows(data.items??[])).catch(cause=>{if(!controller.signal.aborted){setRows([]);setError((cause as Error).message);}});
  return()=>controller.abort();
 },[company,opportunity.id,refresh]);
 useEffect(()=>{
  if(!editor||!permissions.includes('catalog:read'))return;
  const controller=new AbortController(),timer=setTimeout(()=>call(company,'/catalog/products?page=1&search='+encodeURIComponent(productSearch),{signal:controller.signal}).then(data=>setProducts((data.items??[]).filter((item:ProductView)=>item.active))).catch(()=>{}),250);
  return()=>{controller.abort();clearTimeout(timer);};
 },[company,editor,productSearch]);
 function openEditor(row?:ProposalView){
  setFormError('');setNotice('');setProductSearch('');setValidUntil(row?.validUntil??new Date(Date.now()+15*86400000).toISOString().slice(0,10));setNotes(row?.notes??'');
  setLines(row?row.items.map(item=>({productId:item.productId,label:item.code+' — '+item.description,quantity:item.quantity,price:asInput(item.unitPriceCents),discount:item.discountCents?asInput(item.discountCents):'',reference:item.referencePriceCents})):[]);
  setEditor({row});
 }
 async function addProduct(id:string){
  const product=products.find(item=>item.id===id);if(!product||lines.some(line=>line.productId===id))return;
  let reference:number|null=null;
  if(permissions.includes('catalog:read')){try{reference=(await call(company,'/catalog/resolve?customerId='+opportunity.partyId+'&productId='+id)).price?.priceCents??null;}catch{reference=null;}}
  setLines(current=>[...current,{productId:id,label:product.code+' — '+product.description,quantity:'1',price:reference!==null?asInput(reference):'',discount:'',reference}]);
 }
 const setLine=(index:number,key:keyof Line,value:string)=>setLines(current=>current.map((line,position)=>position===index?{...line,[key]:value}:line));
 const preview=(line:Line)=>{try{const price=centsOrZero(line.price),discount=centsOrZero(line.discount);return price===undefined||discount===undefined?null:proposalLineCents(line.quantity.replace(',','.'),price,discount);}catch{return null;}};
 const total=lines.reduce((sum,line)=>sum+(preview(line)??0),0);
 async function save(event:FormEvent){
  event.preventDefault();if(!editor)return;
  if(!lines.length){setFormError('Inclua pelo menos um item do catálogo.');return;}
  const items=[];for(const line of lines){const unitPriceCents=centsOrZero(line.price),discountCents=centsOrZero(line.discount);if(unitPriceCents===undefined||discountCents===undefined||preview(line)===null){setFormError('Confira quantidade, preço e desconto de '+line.label+'.');return;}items.push({productId:line.productId,quantity:line.quantity.replace(',','.'),unitPriceCents,discountCents});}
  setBusy(true);setFormError('');
  try{await call(company,'/opportunities/'+opportunity.id+'/proposals'+(editor.row?'/'+editor.row.id:''),{method:editor.row?'PATCH':'POST',body:JSON.stringify({validUntil,notes,items,...(editor.row?{version:editor.row.version}:{})})});setEditor(null);setNotice('Proposta salva.');setRefresh(value=>value+1);}
  catch(cause){setFormError((cause as Error).message);}finally{setBusy(false);}
 }
 async function act(event:FormEvent){
  event.preventDefault();if(!action)return;setBusy(true);setFormError('');
  try{await call(company,'/opportunities/'+opportunity.id+'/proposals/'+action.row.id+'/'+action.action,{method:'POST',body:JSON.stringify({version:action.row.version,reason})});setAction(null);setNotice(actionNames[action.action].title+': concluído.');setRefresh(value=>value+1);}
  catch(cause){setFormError((cause as Error).message);}finally{setBusy(false);}
 }
 async function showRevisions(row:ProposalView){setRevisions({row,items:null});try{setRevisions({row,items:(await call(company,'/opportunities/'+opportunity.id+'/proposals/'+row.id+'/revisions')).items??[]});}catch(cause){setRevisions(null);setError((cause as Error).message);}}
 return <section className="nf-proposals">
  <div className="nf-section-heading"><h3>Propostas</h3>{canWrite&&<button type="button" className="nf-primary" onClick={()=>openEditor()}>Nova proposta</button>}</div>
  <p className="nf-field-hint">Proposta não é receita nem pedido. O aceite registra a decisão do cliente; o ganho é marcado na oportunidade.</p>
  {!editor&&!action&&error&&<p role="alert" className="nf-error">{error}</p>}{notice&&<p role="status" className="nf-admin-success">{notice}</p>}
  {rows===null?<p role="status">Carregando propostas...</p>:!rows.length?<p className="nf-muted">Nenhuma proposta registrada.</p>:<ul className="nf-property-list">{rows.map(row=><li key={row.id}><div><strong>{row.number} · rev. {row.revision}</strong><span className="nf-badge">{proposalStatusNames[row.status]}{row.expired?' · vencida':''}</span></div><p>{money(row.totalCents)} · {row.items.length} item(ns) · válida até {day(row.validUntil)}</p>{row.decisionReason&&<small>Motivo: {row.decisionReason}</small>}
   <div className="nf-crm-row-actions"><button type="button" className="nf-secondary" onClick={()=>void showRevisions(row)}>Revisões</button>{canWrite&&row.status==='rascunho'&&<button type="button" className="nf-secondary" onClick={()=>openEditor(row)}>Editar</button>}{row.status==='aceita'&&<OrderFromSource company={company} source={{proposalId:row.id,opportunityId:opportunity.id}} permissions={permissions}/>}{canWrite&&(available[row.status]??[]).map(value=><button key={value} type="button" className={value==='accept'||value==='send'?'nf-primary':'nf-secondary'} onClick={()=>{setReason('');setFormError('');setAction({row,action:value});}}>{actionNames[value].label}</button>)}</div></li>)}</ul>}
  <Modal open={Boolean(editor)} title={editor?.row?'Editar '+editor.row.number+' (rev. '+editor.row.revision+')':'Nova proposta'} busy={busy} onClose={()=>setEditor(null)}>
   <form className="nf-form" onSubmit={save}><fieldset disabled={busy}>
    <div className="nf-admin-grid"><label>Válida até<input type="date" required value={validUntil} onChange={event=>setValidUntil(event.target.value)}/></label>
     <label>Buscar no catálogo<input value={productSearch} maxLength={80} onChange={event=>setProductSearch(event.target.value)} placeholder="Código, descrição ou SKU"/></label>
     <label>Incluir item<select value="" onChange={event=>void addProduct(event.target.value)}><option value="">Selecione um produto ou serviço</option>{products.filter(item=>!lines.some(line=>line.productId===item.id)).map(item=><option key={item.id} value={item.id}>{item.code} — {item.description}</option>)}</select></label></div>
    {!lines.length?<p className="nf-muted">Nenhum item incluído.</p>:<div className="nf-table-scroll"><table className="nf-admin-table nf-proposal-items"><thead><tr><th>Item</th><th>Quantidade</th><th>Preço unitário (R$)</th><th>Desconto (R$)</th><th>Total</th><th><span className="nf-sr-only">Remover</span></th></tr></thead><tbody>{lines.map((line,index)=><tr key={line.productId}><td>{line.label}{line.reference!==null&&<small>Tabela: {money(line.reference)}</small>}</td>
     <td data-label="Quantidade"><input aria-label={'Quantidade de '+line.label} inputMode="decimal" value={line.quantity} maxLength={13} onChange={event=>setLine(index,'quantity',event.target.value)}/></td>
     <td data-label="Preço unitário (R$)"><input aria-label={'Preço unitário de '+line.label} inputMode="decimal" value={line.price} maxLength={20} onChange={event=>setLine(index,'price',event.target.value)}/></td>
     <td data-label="Desconto (R$)"><input aria-label={'Desconto de '+line.label} inputMode="decimal" value={line.discount} maxLength={20} onChange={event=>setLine(index,'discount',event.target.value)}/></td>
     <td data-label="Total">{preview(line)===null?'—':money(preview(line)!)}</td><td><button type="button" className="nf-secondary" onClick={()=>setLines(current=>current.filter((_,position)=>position!==index))}>Remover</button></td></tr>)}</tbody></table></div>}
    <p className="nf-proposal-total">Total previsto: <strong>{money(total)}</strong></p>
    <label>Condições e observações<textarea value={notes} maxLength={3000} onChange={event=>setNotes(event.target.value)} placeholder="Prazo de entrega, pagamento, garantia e demais condições."/></label>
    {formError&&<p role="alert" className="nf-error">{formError}</p>}
    <div className="nf-admin-actions"><button type="button" className="nf-secondary" onClick={()=>setEditor(null)}>Cancelar</button><button className="nf-primary">{busy?'Salvando...':'Salvar rascunho'}</button></div>
   </fieldset></form>
  </Modal>
  <Modal open={Boolean(action)} title={action?actionNames[action.action].title+' — '+action.row.number:''} busy={busy} size="compact" onClose={()=>setAction(null)}>
   <form className="nf-form" onSubmit={act}><fieldset disabled={busy}><p>{action&&actionNames[action.action].text}</p>
    {action&&['accept','refuse','cancel'].includes(action.action)&&<label>{action.action==='refuse'?'Motivo da recusa':'Observação'}<textarea required={action.action==='refuse'} maxLength={1000} value={reason} onChange={event=>setReason(event.target.value)}/></label>}
    {formError&&<p role="alert" className="nf-error">{formError}</p>}
    <div className="nf-admin-actions"><button type="button" className="nf-secondary" onClick={()=>setAction(null)}>Voltar</button><button className="nf-primary">{busy?'Salvando...':'Confirmar'}</button></div></fieldset></form>
  </Modal>
  <Modal open={Boolean(revisions)} title={revisions?'Revisões enviadas — '+revisions.row.number:''} onClose={()=>setRevisions(null)}>
   {revisions?.items===null?<p role="status">Carregando revisões...</p>:!revisions?.items.length?<p className="nf-muted">Nenhuma revisão enviada ainda.</p>:<div className="nf-table-scroll"><table className="nf-admin-table"><thead><tr><th>Revisão</th><th>Enviada em</th><th>Itens</th><th>Total</th><th>Validade</th></tr></thead><tbody>{revisions.items.map(item=><tr key={item.revision}><td>rev. {item.revision}</td><td>{item.sentAt?new Date(item.sentAt).toLocaleString('pt-BR',{timeZone:'America/Sao_Paulo'}):'—'}</td><td>{item.itemCount}</td><td>{money(item.totalCents)}</td><td>{day(item.validUntil)}</td></tr>)}</tbody></table></div>}
  </Modal>
 </section>;
}
