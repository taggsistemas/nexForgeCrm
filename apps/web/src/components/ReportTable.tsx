import {buildXlsx,type XlsxCell,type XlsxColumnKind} from '../../../../packages/contracts/src/xlsx';
type Column={key:string;label:string;kind:XlsxColumnKind};
const money=(cents:number)=>new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(cents/100);
/** Screen text of a typed report cell (the Excel file receives the raw typed value). */
export function cellText(value:XlsxCell,kind:XlsxColumnKind){
 if(value===null||value==='')return '—';
 if(kind==='cents')return money(Number(value));
 if(kind==='date')return String(value).split('-').reverse().join('/');
 if(kind==='datetime')return new Date(String(value)).toLocaleString('pt-BR',{timeZone:'America/Sao_Paulo',dateStyle:'short',timeStyle:'short'});
 if(kind==='percent')return Number(value).toLocaleString('pt-BR',{maximumFractionDigits:1})+'%';
 if(kind==='number')return Number(value).toLocaleString('pt-BR',{maximumFractionDigits:3});
 return String(value);
}
/** Saves exactly the given rows as an .xlsx file generated in the browser. */
export function downloadXlsx(fileName:string,sheet:string,columns:readonly Column[],rows:readonly (readonly XlsxCell[])[]){
 const blob=new Blob([buildXlsx(sheet,columns,rows) as BlobPart],{type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'}),url=URL.createObjectURL(blob),link=document.createElement('a');
 link.href=url;link.download=fileName;document.body.appendChild(link);link.click();link.remove();URL.revokeObjectURL(url);
}
export function ReportTable({columns,rows,limit=50}:{columns:readonly Column[];rows:readonly (readonly XlsxCell[])[];limit?:number}){
 return <><div className="nf-table-scroll"><table className="nf-admin-table nf-report-table"><thead><tr>{columns.map(column=><th key={column.key}>{column.label}</th>)}</tr></thead>
  <tbody>{rows.slice(0,limit).map((row,index)=><tr key={index}>{columns.map((column,position)=><td key={column.key} data-label={column.label}>{cellText(row[position]??null,column.kind)}</td>)}</tr>)}</tbody></table></div>
  {rows.length>limit&&<p className="nf-muted">Exibindo as primeiras {limit} linhas. O arquivo Excel contém todas as {rows.length}.</p>}</>;
}
