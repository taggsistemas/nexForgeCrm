import {useState,type FormEvent} from 'react';
import {Modal} from '../../components/Modal';
import {moneyToCents} from '../../../../../packages/contracts/src/opportunities';
import type {ProductView} from '../../../../../packages/contracts/src/catalog';
/** Unit cost used to freeze order margins. Visible only with cost:read; edited only with cost:manage. Empty means unknown. */
export function ProductCost({company,row,onSaved}:{company:string;row:ProductView;onSaved:()=>void}){
 const [open,setOpen]=useState(false),[value,setValue]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState('');
 async function save(event:FormEvent){
  event.preventDefault();const costCents=value.trim()?moneyToCents(value):null;if(costCents===undefined){setError('Informe um valor válido, por exemplo 1.234,56.');return;}
  setBusy(true);setError('');
  try{const response=await fetch('/api/v1/companies/'+company+'/catalog/products/'+row.id+'/cost',{method:'PUT',credentials:'same-origin',cache:'no-store',headers:{'Content-Type':'application/json'},body:JSON.stringify({costCents,costVersion:row.costVersion??0})});
   if(!response.ok)throw Error(response.status===409?'O custo foi alterado por outra pessoa. Atualize a lista.':response.status===403?'Sem permissão para alterar custos.':'Não foi possível salvar o custo.');setOpen(false);onSaved();}
  catch(cause){setError((cause as Error).message);}finally{setBusy(false);}
 }
 return <><button type="button" className="nf-secondary" onClick={()=>{setValue(row.costCents===null||row.costCents===undefined?'':(row.costCents/100).toFixed(2).replace('.',','));setError('');setOpen(true);}}>Custo</button>
  <Modal open={open} title={'Custo unitário — '+row.code} busy={busy} size="compact" onClose={()=>setOpen(false)}>
   <form className="nf-form" onSubmit={save}><fieldset disabled={busy}><p>O custo é congelado em cada pedido no envio e usado para a margem. Alterações não mudam pedidos já enviados. Deixe vazio quando o custo for desconhecido.</p>
    <label>Custo por {row.unit} (R$)<input inputMode="decimal" maxLength={20} value={value} onChange={event=>setValue(event.target.value)}/></label>
    {error&&<p role="alert" className="nf-error">{error}</p>}
    <div className="nf-admin-actions"><button type="button" className="nf-secondary" onClick={()=>setOpen(false)}>Voltar</button><button className="nf-primary">{busy?'Salvando...':'Salvar custo'}</button></div></fieldset></form>
  </Modal></>;
}
