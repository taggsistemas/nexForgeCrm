import {useEffect} from 'react';
import {createPortal} from 'react-dom';
import {orderKindNames,orderOriginNames,orderPaymentMethodNames,orderStatusNames,type OrderView} from '../../../../../packages/contracts/src/orders';
const money=(cents:number)=>new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(cents/100);
const day=(value:string)=>value.split('-').reverse().join('/');
const when=(value:string)=>new Date(value).toLocaleString('pt-BR',{timeZone:'America/Sao_Paulo',dateStyle:'short',timeStyle:'short'});
/** Printable order document. Rendered outside the app root so print CSS can hide everything else; costs and margin are internal and never printed. */
export function OrderPrint({order,companyName,onDone}:{order:OrderView;companyName:string;onDone:()=>void}){
 useEffect(()=>{const done=()=>onDone();window.addEventListener('afterprint',done);const timer=setTimeout(()=>window.print(),50);return()=>{clearTimeout(timer);window.removeEventListener('afterprint',done);};},[onDone]);
 return createPortal(<article className="nf-print-area" aria-hidden="true">
  <header><div><strong>{companyName}</strong><span>Pedido de {orderKindNames[order.kind].toLocaleLowerCase('pt-BR')}</span></div><div><h1>{order.number}</h1><span>{orderStatusNames[order.status]}</span></div></header>
  <dl>
   <div><dt>Cliente</dt><dd>{order.partyName}</dd></div><div><dt>Origem</dt><dd>{orderOriginNames[order.origin]}{order.proposalNumber?' '+order.proposalNumber:''}{order.workOrderNumber?' '+order.workOrderNumber:''}</dd></div>
   <div><dt>Emissão</dt><dd>{when(order.createdAt)}</dd></div><div><dt>Confirmação</dt><dd>{order.confirmedAt?when(order.confirmedAt):'—'}</dd></div>
   <div><dt>Entrega</dt><dd>{order.deliveredAt?'Entregue em '+when(order.deliveredAt):'Prevista para '+day(order.expectedDeliveryDate)}</dd></div>
   <div><dt>Pagamento</dt><dd>{orderPaymentMethodNames[order.paymentMethod]??order.paymentMethod} · {order.paymentTermDays.join('/')} dias</dd></div>
  </dl>
  <table><thead><tr><th>Código</th><th>Descrição</th><th>Qtd.</th><th>Un.</th><th>Preço unit.</th><th>Desconto</th><th>Total</th></tr></thead>
   <tbody>{order.items.map(item=><tr key={item.productId}><td>{item.code}</td><td>{item.description}</td><td>{item.quantity.replace('.',',')}</td><td>{item.unit}</td><td>{money(item.unitPriceCents)}</td><td>{money(item.discountCents)}</td><td>{money(item.totalCents)}</td></tr>)}</tbody>
   <tfoot><tr><td colSpan={6}>Total do pedido</td><td>{money(order.totalCents)}</td></tr></tfoot></table>
  {order.installments.length>0&&<section><h2>Parcelas</h2><ul>{order.installments.map((item,index)=><li key={index}>{index+1}ª · {day(item.dueDate)} · {money(item.amountCents)}</li>)}</ul></section>}
  {order.invoices.length>0&&<section><h2>Notas fiscais</h2><ul>{order.invoices.map(item=><li key={item.number}>NF {item.number} · {day(item.issueDate)} · {money(item.amountCents)}</li>)}</ul></section>}
  {order.notes&&<section><h2>Observações</h2><p>{order.notes}</p></section>}
  <footer>Impresso em {when(new Date().toISOString())} · NexForge CRM</footer>
 </article>,document.body);
}
