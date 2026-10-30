import {useEffect,useState,type FormEvent} from 'react';
import {Modal} from '../../components/Modal';
import {stockManualReasonNames,stockManualReasons,stockSourceNames,type StockBalanceView,type StockMovementView} from '../../../../../packages/contracts/src/supply';
import type {ProductView} from '../../../../../packages/contracts/src/catalog';
import {money,supplyCall,when} from './api';
type Account={companies:{id:string;name:string}[];permissions?:string[]};
/** Single warehouse per company: balances, the immutable movement ledger and manual entries/exits. Automatic movements come from deliveries, work-order parts and purchase receipts. */
export function Warehouse({account}:{account:Account}){
 const permissions=account.permissions??[],canWrite=permissions.includes('stock:write'),costs=permissions.includes('cost:read');
 const [company,setCompany]=useState(account.companies[0]?.id??''),[tab,setTab]=useState<'balances'|'movements'>('balances'),[refresh,setRefresh]=useState(0),[error,setError]=useState(''),[notice,setNotice]=useState('');
 const [balances,setBalances]=useState<StockBalanceView[]>([]),[total,setTotal]=useState(0),[negatives,setNegatives]=useState(0),[page,setPage]=useState(1),[filter,setFilter]=useState('all'),[search,setSearch]=useState(''),[searchDraft,setSearchDraft]=useState(''),[loading,setLoading]=useState(true);
 const [movements,setMovements]=useState<StockMovementView[]>([]),[movementTotal,setMovementTotal]=useState(0),[movementPage,setMovementPage]=useState(1),[source,setSource]=useState(''),[product,setProduct]=useState<{id:string;label:string}|null>(null);
 const [editor,setEditor]=useState<'entrada'|'saida'|null>(null),[draft,setDraft]=useState({productId:'',quantity:'',reason:'inventario',note:''}),[products,setProducts]=useState<ProductView[]>([]),[productSearch,setProductSearch]=useState(''),[busy,setBusy]=useState(false),[formError,setFormError]=useState('');
 useEffect(()=>{if(tab!=='balances')return;const controller=new AbortController();setLoading(true);
  supplyCall(company,'/stock?'+new URLSearchParams({page:String(page),filter,search}),{signal:controller.signal}).then(data=>{setBalances(data.items);setTotal(data.total);setNegatives(data.negativeCount);setError('');}).catch(cause=>{if(!controller.signal.aborted)setError((cause as Error).message);}).finally(()=>{if(!controller.signal.aborted)setLoading(false);});
  return()=>controller.abort();},[company,tab,page,filter,search,refresh]);
 useEffect(()=>{if(tab!=='movements')return;const controller=new AbortController();setLoading(true);
  supplyCall(company,'/stock/movements?'+new URLSearchParams({page:String(movementPage),...(source?{source}:{}),...(product?{productId:product.id}:{})}),{signal:controller.signal}).then(data=>{setMovements(data.items);setMovementTotal(data.total);setError('');}).catch(cause=>{if(!controller.signal.aborted)setError((cause as Error).message);}).finally(()=>{if(!controller.signal.aborted)setLoading(false);});
  return()=>controller.abort();},[company,tab,movementPage,source,product,refresh]);
 useEffect(()=>{if(!editor)return;const controller=new AbortController(),timer=setTimeout(()=>supplyCall(company,'/catalog/products?page=1&search='+encodeURIComponent(productSearch),{signal:controller.signal}).then(data=>setProducts((data.items??[]).filter((item:ProductView)=>item.kind==='product'))).catch(()=>{}),250);return()=>{controller.abort();clearTimeout(timer);};},[company,editor,productSearch]);
 function open(direction:'entrada'|'saida'){setFormError('');setNotice('');setProductSearch('');setDraft({productId:'',quantity:'',reason:direction==='entrada'?'inventario':'perda',note:''});setEditor(direction);}
 async function save(event:FormEvent){event.preventDefault();if(!editor)return;setBusy(true);setFormError('');
  try{const result=await supplyCall(company,'/stock/movements',{method:'POST',body:JSON.stringify({...draft,quantity:draft.quantity.replace(',','.'),direction:editor})});setEditor(null);setNotice((editor==='entrada'?'Entrada':'Saída')+' registrada. Saldo atual: '+result.balanceAfter.replace('.',',')+'.');setRefresh(value=>value+1);}
  catch(cause){setFormError((cause as Error).message);}finally{setBusy(false);}}
 function history(row:StockBalanceView){setProduct({id:row.productId,label:row.code+' — '+row.description});setMovementPage(1);setTab('movements');}
 return <section className="nf-crm nf-warehouse">
  <div className="nf-crm-toolbar"><label>Empresa<select value={company} onChange={event=>{setCompany(event.target.value);setPage(1);setMovementPage(1);}}>{account.companies.map(item=><option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
   {canWrite&&<><button className="nf-primary" onClick={()=>open('entrada')}>Entrada manual</button><button className="nf-secondary" onClick={()=>open('saida')}>Saída manual</button></>}</div>
  {negatives>0&&<p className="nf-warning" role="status">{negatives} item(ns) com saldo negativo por entregas ou peças de OS sem estoque. <button type="button" className="nf-secondary" onClick={()=>{setTab('balances');setFilter('negative');setPage(1);}}>Ver itens</button></p>}
  {error&&!editor&&<p role="alert" className="nf-error">{error}</p>}{notice&&<p role="status" className="nf-admin-success">{notice}</p>}
  <div role="tablist" aria-label="Visão do almoxarifado" className="nf-field-actions"><button role="tab" aria-selected={tab==='balances'} className={tab==='balances'?'nf-primary':'nf-secondary'} onClick={()=>setTab('balances')}>Saldos</button><button role="tab" aria-selected={tab==='movements'} className={tab==='movements'?'nf-primary':'nf-secondary'} onClick={()=>setTab('movements')}>Movimentações</button></div>
  {tab==='balances'?<section className="nf-panel"><div className="nf-section-heading"><h2>Saldos em estoque</h2><span>{total} produto(s)</span></div>
   <form className="nf-filter-bar" onSubmit={event=>{event.preventDefault();setSearch(searchDraft.trim());setPage(1);}}><label>Mostrar<select value={filter} onChange={event=>{setFilter(event.target.value);setPage(1);}}><option value="all">Produtos ativos e com saldo</option><option value="stocked">Somente com saldo</option><option value="negative">Saldo negativo</option></select></label>
    <label>Código ou descrição<input value={searchDraft} maxLength={80} onChange={event=>setSearchDraft(event.target.value)}/></label><button className="nf-secondary">Buscar</button></form>
   {loading?<p role="status">Carregando saldos…</p>:!balances.length?<p className="nf-muted">Nenhum produto neste filtro.</p>:<div className="nf-table-scroll"><table className="nf-admin-table nf-report-table"><thead><tr><th>Código</th><th>Descrição</th><th>Saldo</th><th>Un.</th>{costs&&<><th>Custo médio</th><th>Valor em estoque</th></>}<th><span className="nf-sr-only">Ações</span></th></tr></thead>
    <tbody>{balances.map(row=><tr key={row.productId} className={row.negative?'is-negative':''}><td data-label="Código">{row.code}</td><td data-label="Descrição">{row.description}</td><td data-label="Saldo"><strong>{row.quantity.replace('.',',')}</strong>{row.negative&&<span className="nf-badge nf-badge-danger"> negativo</span>}</td><td data-label="Un.">{row.unit}</td>
     {costs&&<><td data-label="Custo médio">{row.costCents===null||row.costCents===undefined?'—':money(row.costCents)}</td><td data-label="Valor em estoque">{row.valueCents===null||row.valueCents===undefined?'—':money(row.valueCents)}</td></>}<td><button type="button" className="nf-secondary" onClick={()=>history(row)}>Movimentações</button></td></tr>)}</tbody></table></div>}
   <div className="nf-crm-pagination"><button className="nf-secondary" disabled={loading||page<=1} onClick={()=>setPage(value=>value-1)}>Anterior</button><span>Página {page}</span><button className="nf-secondary" disabled={loading||page*30>=total} onClick={()=>setPage(value=>value+1)}>Próxima</button></div>
  </section>:<section className="nf-panel"><div className="nf-section-heading"><h2>Movimentações</h2><span>{movementTotal} registro(s)</span></div>
   <div className="nf-filter-bar"><label>Origem<select value={source} onChange={event=>{setSource(event.target.value);setMovementPage(1);}}><option value="">Todas</option>{Object.entries(stockSourceNames).map(([key,name])=><option key={key} value={key}>{name}</option>)}</select></label>
    <label>Produto<input readOnly value={product?.label??'Todos os produtos'}/></label>{product?<button type="button" className="nf-secondary" onClick={()=>{setProduct(null);setMovementPage(1);}}>Todos</button>:<span/>}</div>
   {loading?<p role="status">Carregando movimentações…</p>:!movements.length?<p className="nf-muted">Nenhuma movimentação.</p>:<div className="nf-table-scroll"><table className="nf-admin-table nf-report-table"><thead><tr><th>Data</th><th>Produto</th><th>Tipo</th><th>Quantidade</th><th>Saldo após</th><th>Origem</th><th>Motivo / observação</th><th>Responsável</th></tr></thead>
    <tbody>{movements.map(row=><tr key={row.id}><td data-label="Data">{when(row.createdAt)}</td><td data-label="Produto">{row.code} — {row.description}</td><td data-label="Tipo">{row.direction==='entrada'?'Entrada':'Saída'}</td><td data-label="Quantidade">{row.quantity.replace('.',',')} {row.unit}</td>
     <td data-label="Saldo após">{row.balanceAfter.replace('.',',')}{row.negativeAlert&&<span className="nf-badge nf-badge-danger"> negativo</span>}</td><td data-label="Origem">{stockSourceNames[row.source]}{row.reference?' '+row.reference:''}</td><td data-label="Motivo / observação">{[row.reason,row.note].filter(Boolean).join(' — ')||'—'}</td><td data-label="Responsável">{row.actor}</td></tr>)}</tbody></table></div>}
   <div className="nf-crm-pagination"><button className="nf-secondary" disabled={loading||movementPage<=1} onClick={()=>setMovementPage(value=>value-1)}>Anterior</button><span>Página {movementPage}</span><button className="nf-secondary" disabled={loading||movementPage*50>=movementTotal} onClick={()=>setMovementPage(value=>value+1)}>Próxima</button></div>
  </section>}
  <Modal open={Boolean(editor)} title={editor==='entrada'?'Entrada manual no almoxarifado':'Saída manual do almoxarifado'} busy={busy} size="compact" onClose={()=>setEditor(null)}>
   <form className="nf-form" onSubmit={save}><fieldset disabled={busy}>
    <p className="nf-field-hint">{editor==='saida'?'Saídas manuais não podem deixar o saldo negativo. ':''}Entregas de pedidos, peças de OS e recebimentos de compras movimentam o estoque automaticamente.</p>
    <label>Buscar produto<input value={productSearch} maxLength={80} onChange={event=>setProductSearch(event.target.value)} placeholder="Código, descrição ou SKU"/></label>
    <label>Produto<select required value={draft.productId} onChange={event=>setDraft({...draft,productId:event.target.value})}><option value="">Selecione</option>{products.map(item=><option key={item.id} value={item.id}>{item.code} — {item.description} ({item.unit})</option>)}</select></label>
    <div className="nf-admin-grid"><label>Quantidade<input required inputMode="decimal" maxLength={13} value={draft.quantity} onChange={event=>setDraft({...draft,quantity:event.target.value})}/></label>
     <label>Motivo<select value={draft.reason} onChange={event=>setDraft({...draft,reason:event.target.value})}>{stockManualReasons.map(value=><option key={value} value={value}>{stockManualReasonNames[value]}</option>)}</select></label></div>
    <label>Observação<textarea required minLength={3} maxLength={1000} value={draft.note} onChange={event=>setDraft({...draft,note:event.target.value})}/></label>
    {formError&&<p role="alert" className="nf-error">{formError}</p>}
    <div className="nf-admin-actions"><button type="button" className="nf-secondary" onClick={()=>setEditor(null)}>Cancelar</button><button className="nf-primary">{busy?'Salvando…':'Registrar'}</button></div>
   </fieldset></form>
  </Modal>
 </section>;
}
