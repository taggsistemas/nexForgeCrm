import {PdfDocument,dataUrlBytes,pageHeight,pageWidth,parseJpeg,textWidth,wrapText} from './pdf.js';
import {addressLine,formatTaxId,purchaseStatusNames,type CompanyProfileView,type PurchaseView,type SupplierView} from './supply.js';
import {orderKindNames,orderOriginNames,orderPaymentMethodNames,orderStatusNames,type OrderView} from './orders.js';
import {formatMinutes,technicalStateNames,type TechnicalWorkView} from './technical.js';
const margin=36,bottom=pageHeight-56,contentWidth=pageWidth-margin*2;
const money=(cents:number)=>new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(cents/100);
const day=(value:string|null|undefined)=>value?value.slice(0,10).split('-').reverse().join('/'):'—';
const when=(value:string|null|undefined)=>value?new Date(value).toLocaleString('pt-BR',{timeZone:'America/Sao_Paulo',dateStyle:'short',timeStyle:'short'}):'—';
const qty=(value:string)=>value.replace('.',',');
export interface DocumentParty {title:string;name:string;lines:string[]}
export interface DocumentColumn {label:string;width:number;align?:'left'|'right'}
export interface BusinessDocument {company:CompanyProfileView;title:string;number:string;status:string;meta:[string,string][];parties:DocumentParty[];columns:DocumentColumn[];rows:string[][];totals:[string,string][];sections:{title:string;text:string}[];signatures?:string[]}
/** Common layout for sales orders, purchase orders and work orders: the company's own data and logo head every page. */
export function renderBusinessDocument(doc:BusinessDocument){
 const pdf=new PdfDocument(),company=doc.company,logo=company.logo?parseJpeg(dataUrlBytes(company.logo)):null;let y=margin;
 const header=()=>{
  y=margin;let left=margin;
  if(logo){const scale=Math.min(110/logo.width,46/logo.height);pdf.image(logo,margin,y,logo.width*scale,logo.height*scale);left=margin+logo.width*scale+12;}
  pdf.text(left,y,company.tradeName||company.legalName||'Empresa',{size:12,bold:true});
  const info=[company.tradeName&&company.legalName!==company.tradeName?company.legalName:'',[company.taxId?'CNPJ '+formatTaxId(company.taxId):'',company.stateRegistration?'IE '+company.stateRegistration:'',company.municipalRegistration?'IM '+company.municipalRegistration:''].filter(Boolean).join(' · '),addressLine(company.address),[company.phone,company.email,company.website].filter(Boolean).join(' · ')].filter(Boolean);
  info.forEach((line,index)=>pdf.text(left,y+16+index*10,line,{size:7.5,color:'#374151'}));
  pdf.text(pageWidth-margin,y,doc.title,{size:13,bold:true,align:'right'});pdf.text(pageWidth-margin,y+17,doc.number,{size:11,bold:true,align:'right',color:'#1d4ed8'});pdf.text(pageWidth-margin,y+31,doc.status,{size:8,align:'right',color:'#374151'});
  y=Math.max(y+56,y+16+info.length*10+6);pdf.line(margin,y,pageWidth-margin,y,{width:1,color:'#111827'});y+=10;
 };
 const ensure=(height:number,repeat?:()=>void)=>{if(y+height>bottom){pdf.addPage();header();repeat?.();}};
 header();
 // Metadata grid in two columns.
 for(let index=0;index<doc.meta.length;index+=2){ensure(14);for(let column=0;column<2;column++){const item=doc.meta[index+column];if(!item)continue;const x=margin+column*contentWidth/2;pdf.text(x,y,item[0]+':',{size:8,bold:true});pdf.text(x+textWidth(item[0]+': ',8,true),y,item[1],{size:8});}y+=13;}
 y+=4;
 // Party boxes side by side.
 if(doc.parties.length){const width=(contentWidth-(doc.parties.length-1)*10)/doc.parties.length,heights=doc.parties.map(party=>30+party.lines.flatMap(line=>wrapText(line,width-12,8)).length*10),height=Math.max(...heights);ensure(height);
  doc.parties.forEach((party,index)=>{const x=margin+index*(width+10);pdf.rect(x,y,width,height,{stroke:'#d1d5db'});pdf.text(x+6,y+5,party.title.toUpperCase(),{size:7,bold:true,color:'#6b7280'});pdf.text(x+6,y+14,party.name,{size:9,bold:true});let line=y+26;for(const text of party.lines)for(const part of wrapText(text,width-12,8)){pdf.text(x+6,line,part,{size:8,color:'#374151'});line+=10;}});y+=height+12;}
 // Items table with repeated header on page breaks.
 const scale=contentWidth/doc.columns.reduce((sum,column)=>sum+column.width,0),widths=doc.columns.map(column=>column.width*scale);
 const tableHeader=()=>{pdf.rect(margin,y,contentWidth,16,{fill:'#e5e7eb'});let x=margin;doc.columns.forEach((column,index)=>{pdf.text(column.align==='right'?x+widths[index]!-4:x+4,y+4,column.label,{size:7.5,bold:true,align:column.align==='right'?'right':'left'});x+=widths[index]!;});y+=18;};
 if(doc.columns.length){ensure(40);tableHeader();
  for(const row of doc.rows){const cells=row.map((cell,index)=>wrapText(cell,widths[index]!-8,8)),height=Math.max(...cells.map(lines=>lines.length))*10+4;ensure(height,tableHeader);
   let x=margin;cells.forEach((lines,index)=>{const column=doc.columns[index]!;lines.forEach((line,position)=>pdf.text(column.align==='right'?x+widths[index]!-4:x+4,y+position*10,line,{size:8,align:column.align==='right'?'right':'left'}));x+=widths[index]!;});
   y+=height;pdf.line(margin,y-2,pageWidth-margin,y-2,{color:'#e5e7eb'});}
  if(!doc.rows.length){pdf.text(margin+4,y,'Nenhum item.',{size:8,color:'#6b7280'});y+=14;}
 }
 y+=4;for(const [label,value] of doc.totals){ensure(14);pdf.text(pageWidth-margin-120,y,label,{size:9,bold:true,align:'right'});pdf.text(pageWidth-margin,y,value,{size:9,bold:true,align:'right'});y+=13;}
 for(const section of doc.sections){if(!section.text)continue;const lines=wrapText(section.text,contentWidth,8.5);ensure(26);y+=6;pdf.text(margin,y,section.title,{size:9,bold:true});y+=13;for(const line of lines){ensure(11);pdf.text(margin,y,line,{size:8.5,color:'#1f2937'});y+=11;}}
 if(doc.signatures?.length){ensure(70);y+=40;const width=(contentWidth-(doc.signatures.length-1)*30)/doc.signatures.length;doc.signatures.forEach((label,index)=>{const x=margin+index*(width+30);pdf.line(x,y,x+width,y,{color:'#111827'});pdf.text(x+width/2,y+4,label,{size:8,align:'center'});});y+=20;}
 const generated='Emitido em '+when(new Date().toISOString())+' · NexForge CRM';
 for(let page=0;page<pdf.pageCount;page++){
  const notes=company.documentNotes?wrapText(company.documentNotes,contentWidth-90,7):[];notes.slice(0,2).forEach((line,index)=>pdf.text(margin,bottom+14+index*9,line,{size:7,color:'#6b7280',page}));
  pdf.text(margin,bottom+34,generated,{size:7,color:'#6b7280',page});pdf.text(pageWidth-margin,bottom+34,'Página '+(page+1)+' de '+pdf.pageCount,{size:7,color:'#6b7280',align:'right',page});
 }
 return pdf.build(doc.title+' '+doc.number);
}
export interface DocumentCustomer {name:string;legalName?:string;taxId?:string;stateRegistration?:string;address?:string;phone?:string;email?:string}
const customerLines=(customer:DocumentCustomer|null|undefined)=>customer?[customer.legalName&&customer.legalName!==customer.name?customer.legalName:'',[customer.taxId?'CPF/CNPJ '+formatTaxId(customer.taxId):'',customer.stateRegistration?'IE '+customer.stateRegistration:''].filter(Boolean).join(' · '),customer.address??'',[customer.phone,customer.email].filter(Boolean).join(' · ')].filter(Boolean):[];
/** Sales/service order. Costs and margin are internal and never printed. */
export function salesOrderPdf(order:OrderView,company:CompanyProfileView,customer?:DocumentCustomer|null){
 return renderBusinessDocument({company,title:order.kind==='servico'?'Pedido de serviço':'Pedido de venda',number:order.number,status:orderStatusNames[order.status],
  meta:[['Emissão',when(order.createdAt)],['Origem',orderOriginNames[order.origin]+(order.proposalNumber?' '+order.proposalNumber:'')+(order.workOrderNumber?' '+order.workOrderNumber:'')],['Tipo',orderKindNames[order.kind]],['Confirmação',when(order.confirmedAt)],['Pagamento',(orderPaymentMethodNames[order.paymentMethod]??order.paymentMethod)+' · '+order.paymentTermDays.join('/')+' dias'],['Entrega',order.deliveredAt?'Entregue em '+when(order.deliveredAt):'Prevista '+day(order.expectedDeliveryDate)]],
  parties:[{title:'Cliente',name:customer?.name??order.partyName,lines:customerLines(customer)}],
  columns:[{label:'Código',width:62},{label:'Descrição',width:190},{label:'Qtd.',width:44,align:'right'},{label:'Un.',width:30},{label:'Preço unit.',width:66,align:'right'},{label:'Desconto',width:58,align:'right'},{label:'Total',width:70,align:'right'}],
  rows:order.items.map(item=>[item.code,item.description,qty(item.quantity),item.unit,money(item.unitPriceCents),money(item.discountCents),money(item.totalCents)]),
  totals:[['Total do pedido',money(order.totalCents)],...(order.invoicedCents?[['Faturado',money(order.invoicedCents)] as [string,string],['A faturar',money(order.remainingCents)] as [string,string]]:[])],
  sections:[{title:'Parcelas previstas',text:order.installments.map((item,index)=>(index+1)+'ª '+day(item.dueDate)+' — '+money(item.amountCents)).join('   ·   ')},{title:'Notas fiscais',text:order.invoices.map(item=>'NF '+item.number+' de '+day(item.issueDate)+' — '+money(item.amountCents)).join('   ·   ')},{title:'Observações',text:order.notes}],
  signatures:['Cliente','Vendedor']});
}
export function purchaseOrderPdf(purchase:PurchaseView,company:CompanyProfileView,supplier?:SupplierView|null){
 return renderBusinessDocument({company,title:'Pedido de compra',number:purchase.number,status:purchaseStatusNames[purchase.status],
  meta:[['Emissão',when(purchase.createdAt)],['Entrega prevista',day(purchase.expectedDate)],['Condição de pagamento',purchase.paymentTerms||'—'],['Aprovação',purchase.approvedBy?purchase.approvedBy+' em '+when(purchase.approvedAt):purchase.needsApproval?'Pendente':'Dentro do limite da empresa']],
  parties:[{title:'Fornecedor',name:supplier?.name??purchase.supplierName,lines:supplier?[supplier.tradeName&&supplier.tradeName!==supplier.name?supplier.tradeName:'',[supplier.taxId?'CPF/CNPJ '+formatTaxId(supplier.taxId):'',supplier.stateRegistration?'IE '+supplier.stateRegistration:''].filter(Boolean).join(' · '),addressLine(supplier.address),[supplier.contactName,supplier.phone,supplier.email].filter(Boolean).join(' · ')].filter(Boolean):[]},
   {title:'Entregar em',name:company.tradeName||company.legalName,lines:[addressLine(company.address),[company.phone,company.email].filter(Boolean).join(' · ')].filter(Boolean)}],
  columns:[{label:'Código',width:62},{label:'Descrição',width:220},{label:'Qtd.',width:50,align:'right'},{label:'Un.',width:30},{label:'Custo unit.',width:70,align:'right'},{label:'Total',width:75,align:'right'}],
  rows:purchase.items.map(item=>[item.code,item.description,qty(item.quantity),item.unit,money(item.unitCostCents),money(item.totalCents)]),
  totals:[['Total do pedido',money(purchase.totalCents)]],sections:[{title:'Observações',text:purchase.notes}],signatures:['Comprador','Fornecedor']});
}
export interface DocumentPart {code:string;description:string;unit:string;net:string}
export function workOrderPdf(work:TechnicalWorkView,company:CompanyProfileView,parts:DocumentPart[]){
 return renderBusinessDocument({company,title:'Ordem de serviço',number:work.number||'OS',status:work.closedAt?'Encerrada':technicalStateNames[work.state]??work.state,
  meta:[['Serviço',work.serviceName],['Técnico',work.technicianName],['Agendamento',when(work.startAt)+' a '+when(work.endAt)],['Origem',work.ticketNumber?'Chamado '+work.ticketNumber:work.returnOfNumber?'Retorno de '+work.returnOfNumber:'Manual'],['Check-in',when(work.checkedInAt)],['Check-out',when(work.checkedOutAt)],
   ['Horas trabalhadas',formatMinutes(work.laborMinutes)],['Deslocamento',formatMinutes(work.travelMinutes)+(work.travelKm!==null&&work.travelKm!==undefined?' · '+work.travelKm+' km':'')],['Horas faturáveis',formatMinutes(work.billableMinutes)],['Encerramento',when(work.closedAt)]],
  parties:[{title:'Cliente',name:work.partyName,lines:[work.address,[work.propertyName,work.equipmentName].filter(Boolean).join(' · ')].filter(Boolean)}],
  columns:[{label:'Código',width:70},{label:'Peça / material',width:280},{label:'Qtd. líquida',width:70,align:'right'},{label:'Un.',width:40}],
  rows:parts.map(part=>[part.code,part.description,qty(part.net),part.unit]),totals:[],
  sections:[{title:'Descrição',text:work.title+(work.notes?'\n'+work.notes:'')},{title:'Diagnóstico',text:work.diagnosis},{title:'Solução',text:work.solution},{title:'Observações do encerramento',text:work.closingNote??''}],
  signatures:['Técnico','Cliente']});
}
