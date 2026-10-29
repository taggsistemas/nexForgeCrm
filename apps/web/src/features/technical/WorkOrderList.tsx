import {useEffect,useState} from 'react';
import {OrderFromSource} from '../orders/Orders';
import {formatMinutes,technicalStateNames,type TechnicalWorkView} from '../../../../../packages/contracts/src/technical';
/** Work orders of a ticket or equipment; hidden when the profile cannot read technical work. */
export function WorkOrderList({companyId,query,title,permissions=[]}:{companyId:string;query:Record<string,string>;title:string;permissions?:readonly string[]}){
 const [rows,setRows]=useState<TechnicalWorkView[]|null>(null),key=new URLSearchParams(query).toString();
 useEffect(()=>{const controller=new AbortController();fetch('/api/v1/companies/'+companyId+'/technical/orders?'+key,{credentials:'same-origin',cache:'no-store',signal:controller.signal}).then(response=>response.ok?response.json():null).then(data=>setRows(data?data.items??[]:null)).catch(()=>{});return()=>controller.abort();},[companyId,key]);
 if(!rows)return null;
 return <section className="nf-history"><div className="nf-history-heading"><h3>{title}</h3><span>{rows.length} OS</span></div>
  {!rows.length?<p className="nf-muted">Nenhuma ordem de serviço registrada.</p>:<ul className="nf-property-list">{rows.map(row=><li key={row.id}><div><strong>{row.number||'Atendimento'} · {row.title}</strong><span className="nf-badge">{row.closedAt?'Encerrada':technicalStateNames[row.state]}</span></div>
   <small>{new Date(row.startAt).toLocaleString('pt-BR',{timeZone:'America/Sao_Paulo',dateStyle:'short',timeStyle:'short'})} · {row.technicianName}{row.returnOfNumber?' · retorno de '+row.returnOfNumber:''}</small>
   {row.diagnosis&&<p>Diagnóstico: {row.diagnosis}</p>}{row.solution&&<p>Solução: {row.solution}</p>}
   {row.parts?.length>0&&<small>Peças: {row.parts.map(part=>part.net.replace('.',',')+' '+part.unit+' '+part.description).join(' · ')}</small>}
   {row.laborMinutes!==null&&<small>Horas trabalhadas {formatMinutes(row.laborMinutes)} · deslocamento {formatMinutes(row.travelMinutes)} · faturáveis {formatMinutes(row.billableMinutes)}</small>}
   {row.closedAt&&<div className="nf-crm-row-actions"><OrderFromSource company={companyId} source={{workOrderId:row.id}} permissions={permissions} label="Gerar pedido de serviço"/></div>}</li>)}</ul>}
 </section>;
}
