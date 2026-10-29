import {useEffect,useState,type FormEvent} from 'react';
import {Modal} from '../../components/Modal';
import {workOrderPartKindNames,type WorkOrderPartSummary,type WorkOrderPartView} from '../../../../../packages/contracts/src/technical';
type Product={id:string;code:string;description:string;unit:string;quantityDecimals:number};
const money=(cents:number)=>new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(cents/100);
const quantity=(value:string)=>value.replace('.',',');
async function call(company:string,path:string,options:RequestInit={}){
 const response=await fetch('/api/v1/companies/'+company+'/technical'+path,{...options,credentials:'same-origin',cache:'no-store',headers:{'Content-Type':'application/json'}});
 if(!response.ok)throw Error(response.status===403?'Peças só podem ser registradas pelo técnico da OS ou pela coordenação, até o encerramento.':response.status===400?'Confira a peça (produto ativo do catálogo), a quantidade e as casas decimais. A devolução não pode superar o consumido.':response.status===409?'A OS mudou. Atualize e tente novamente.':'Não foi possível concluir.');
 return response.json();
}
/** Parts of one work order: immutable entries, net balance per part, no stock movement or billing. */
export function WorkOrderParts({company,workId,canRegister,onChanged}:{company:string;workId:string;canRegister:boolean;onChanged:()=>void}){
 const [items,setItems]=useState<WorkOrderPartView[]|null>(null),[summary,setSummary]=useState<WorkOrderPartSummary[]>([]),[refresh,setRefresh]=useState(0),[open,setOpen]=useState(false);
 const [search,setSearch]=useState(''),[products,setProducts]=useState<Product[]>([]),[draft,setDraft]=useState({productId:'',kind:'consumo',quantity:'',note:''}),[busy,setBusy]=useState(false),[error,setError]=useState('');
 useEffect(()=>{const controller=new AbortController();call(company,'/'+workId+'/parts',{signal:controller.signal}).then(data=>{setItems(Array.isArray(data?.items)&&Array.isArray(data?.summary)?data.items:[]);setSummary(Array.isArray(data?.summary)?data.summary:[]);}).catch(()=>setItems([]));return()=>controller.abort();},[company,workId,refresh]);
 useEffect(()=>{if(!open)return;const controller=new AbortController(),timer=setTimeout(()=>call(company,'/'+workId+'/parts/options?search='+encodeURIComponent(search),{signal:controller.signal}).then(data=>setProducts(data.items??[])).catch(()=>{}),250);return()=>{controller.abort();clearTimeout(timer);};},[company,workId,open,search]);
 const chosen=products.find(item=>item.id===draft.productId);
 async function submit(event:FormEvent){
  event.preventDefault();setBusy(true);setError('');
  try{await call(company,'/'+workId+'/parts',{method:'POST',body:JSON.stringify({...draft,quantity:draft.quantity.trim().replace(',','.')})});setOpen(false);setRefresh(value=>value+1);onChanged();}
  catch(cause){setError((cause as Error).message);}finally{setBusy(false);}
 }
 if(items===null)return <p role="status">Carregando peças...</p>;
 return <section className="nf-history" aria-label="Peças utilizadas"><div className="nf-history-heading"><h3>Peças utilizadas</h3>{canRegister&&<button type="button" className="nf-secondary" onClick={()=>{setDraft({productId:'',kind:'consumo',quantity:'',note:''});setSearch('');setError('');setOpen(true);}}>Registrar peça</button>}</div>
  <p className="nf-field-hint">Registro da OS: não baixa estoque nem gera cobrança. Correções são feitas por devolução.</p>
  {!summary.length?<p className="nf-muted">Nenhuma peça registrada.</p>:<div className="nf-table-scroll"><table className="nf-admin-table"><thead><tr><th>Peça</th><th>Consumido</th><th>Devolvido</th><th>Saldo</th>{summary.some(item=>item.referenceTotalCents!==null)&&<th>Referência</th>}</tr></thead><tbody>{summary.map(item=><tr key={item.productId}><td>{item.code} — {item.description}</td><td>{quantity(item.consumed)} {item.unit}</td><td>{quantity(item.returned)} {item.unit}</td><td><strong>{quantity(item.net)} {item.unit}</strong></td>{summary.some(row=>row.referenceTotalCents!==null)&&<td>{item.referenceTotalCents===null?'—':money(item.referenceTotalCents)}</td>}</tr>)}</tbody></table></div>}
  {items.length>0&&<details><summary>Lançamentos ({items.length})</summary><ul className="nf-property-list">{items.map(item=><li key={item.id}><div><strong>{workOrderPartKindNames[item.kind]}: {quantity(item.quantity)} {item.unit} — {item.code} {item.description}</strong></div><small>{new Date(item.at).toLocaleString('pt-BR',{timeZone:'America/Sao_Paulo',dateStyle:'short',timeStyle:'short'})} · {item.actor}{item.referencePriceCents!==null?' · referência '+money(item.referencePriceCents)+'/'+item.unit:''}</small>{item.note&&<p>{item.note}</p>}</li>)}</ul></details>}
  <Modal open={open} title="Registrar peça" size="compact" busy={busy} onClose={()=>setOpen(false)}>
   <form className="nf-form" onSubmit={submit}><fieldset disabled={busy}>
    <label>Buscar no catálogo<input value={search} maxLength={80} onChange={event=>setSearch(event.target.value)} placeholder="Código ou descrição"/></label>
    <label>Peça<select required value={draft.productId} onChange={event=>setDraft(current=>({...current,productId:event.target.value}))}><option value="">Selecione</option>{products.map(item=><option key={item.id} value={item.id}>{item.code} — {item.description} ({item.unit})</option>)}</select></label>
    <div className="nf-admin-grid"><label>Lançamento<select value={draft.kind} onChange={event=>setDraft(current=>({...current,kind:event.target.value}))}><option value="consumo">Consumo</option><option value="devolucao">Devolução</option></select></label>
     <label>Quantidade{chosen?' ('+chosen.unit+(chosen.quantityDecimals?', até '+chosen.quantityDecimals+' casas':', inteira')+')':''}<input required inputMode="decimal" value={draft.quantity} maxLength={13} onChange={event=>setDraft(current=>({...current,quantity:event.target.value}))}/></label></div>
    <label>Observação<textarea maxLength={500} value={draft.note} onChange={event=>setDraft(current=>({...current,note:event.target.value}))}/></label>
    {error&&<p role="alert" className="nf-error">{error}</p>}<div className="nf-admin-actions"><button type="button" className="nf-secondary" onClick={()=>setOpen(false)}>Cancelar</button><button className="nf-primary">{busy?'Registrando...':'Registrar'}</button></div></fieldset></form>
  </Modal>
 </section>;
}
