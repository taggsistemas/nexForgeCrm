/** Minimal XLSX (Office Open XML) writer: one worksheet, typed cells, stored (uncompressed) zip. No external dependency. */
export type XlsxCell=string|number|null;
export type XlsxColumnKind='text'|'cents'|'date'|'datetime'|'number'|'percent';
export interface XlsxColumn{label:string;kind:XlsxColumnKind}
const encoder=new TextEncoder();
const crcTable=(()=>{const table=new Uint32Array(256);for(let n=0;n<256;n++){let c=n;for(let k=0;k<8;k++)c=c&1?0xedb88320^(c>>>1):c>>>1;table[n]=c>>>0;}return table;})();
export function crc32(data:Uint8Array){let crc=0xffffffff;for(const byte of data)crc=crcTable[(crc^byte)&0xff]!^(crc>>>8);return (crc^0xffffffff)>>>0;}
/** Zip archive with stored entries (method 0); valid for spreadsheet applications. */
export function zipStore(files:{name:string;data:Uint8Array}[]){
 const parts:Uint8Array[]=[],central:Uint8Array[]=[];let offset=0;
 for(const file of files){
  const name=encoder.encode(file.name),crc=crc32(file.data),local=new Uint8Array(30+name.length),view=new DataView(local.buffer);
  view.setUint32(0,0x04034b50,true);view.setUint16(4,20,true);view.setUint16(6,0x0800,true);view.setUint16(8,0,true);view.setUint16(10,0,true);view.setUint16(12,0x21,true);
  view.setUint32(14,crc,true);view.setUint32(18,file.data.length,true);view.setUint32(22,file.data.length,true);view.setUint16(26,name.length,true);view.setUint16(28,0,true);local.set(name,30);
  const entry=new Uint8Array(46+name.length),cview=new DataView(entry.buffer);
  cview.setUint32(0,0x02014b50,true);cview.setUint16(4,20,true);cview.setUint16(6,20,true);cview.setUint16(8,0x0800,true);cview.setUint16(10,0,true);cview.setUint16(12,0,true);cview.setUint16(14,0x21,true);
  cview.setUint32(16,crc,true);cview.setUint32(20,file.data.length,true);cview.setUint32(24,file.data.length,true);cview.setUint16(28,name.length,true);cview.setUint32(42,offset,true);entry.set(name,46);
  parts.push(local,file.data);central.push(entry);offset+=local.length+file.data.length;
 }
 const size=central.reduce((sum,item)=>sum+item.length,0),end=new Uint8Array(22),eview=new DataView(end.buffer);
 eview.setUint32(0,0x06054b50,true);eview.setUint16(8,files.length,true);eview.setUint16(10,files.length,true);eview.setUint32(12,size,true);eview.setUint32(16,offset,true);
 const all=[...parts,...central,end],out=new Uint8Array(all.reduce((sum,item)=>sum+item.length,0));let position=0;for(const item of all){out.set(item,position);position+=item.length;}
 return out;
}
const escape=(value:string)=>value.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g,'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
const columnName=(index:number)=>{let name='';for(let n=index+1;n>0;n=Math.floor((n-1)/26))name=String.fromCharCode(65+(n-1)%26)+name;return name;};
const epoch=Date.UTC(1899,11,30);
/** Excel serial for a calendar date (YYYY-MM-DD) or an instant shown in America/Sao_Paulo wall time. */
export function excelSerial(value:string,kind:'date'|'datetime'){
 if(kind==='date'){const [year,month,day]=value.split('-').map(Number);return (Date.UTC(year!,month!-1,day!)-epoch)/86400000;}
 const parts=Object.fromEntries(new Intl.DateTimeFormat('en-CA',{timeZone:'America/Sao_Paulo',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(new Date(value)).map(part=>[part.type,part.value]));
 return Math.round((Date.UTC(Number(parts.year),Number(parts.month)-1,Number(parts.day),Number(parts.hour),Number(parts.minute))-epoch)/60000)/1440;
}
const styles={text:0,header:1,cents:2,date:3,datetime:4,number:5,percent:6};
function cell(ref:string,value:XlsxCell,kind:XlsxColumnKind){
 if(value===null||value==='')return '';
 if(kind==='text'||typeof value==='string'&&!['date','datetime'].includes(kind))return '<c r="'+ref+'" t="inlineStr"><is><t xml:space="preserve">'+escape(String(value))+'</t></is></c>';
 const number=kind==='cents'?Number(value)/100:kind==='date'||kind==='datetime'?excelSerial(String(value),kind):Number(value);
 return Number.isFinite(number)?'<c r="'+ref+'" s="'+styles[kind]+'"><v>'+number+'</v></c>':'';
}
/** Builds the workbook bytes. Money columns receive integer cents and are written in reais with two decimals. */
export function buildXlsx(sheetName:string,columns:readonly XlsxColumn[],rows:readonly (readonly XlsxCell[])[]){
 const name=escape(sheetName.replace(/[\\/?*[\]:]/g,' ').slice(0,31)||'Relatório');
 const header='<row r="1">'+columns.map((column,index)=>'<c r="'+columnName(index)+'1" t="inlineStr" s="1"><is><t>'+escape(column.label)+'</t></is></c>').join('')+'</row>';
 const body=rows.map((row,line)=>'<row r="'+(line+2)+'">'+columns.map((column,index)=>cell(columnName(index)+(line+2),row[index]??null,column.kind)).join('')+'</row>').join('');
 const widths='<cols>'+columns.map((column,index)=>'<col min="'+(index+1)+'" max="'+(index+1)+'" width="'+Math.min(60,Math.max(12,column.label.length+4,column.kind==='text'?28:14))+'" customWidth="1"/>').join('')+'</cols>';
 const sheet='<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>'+widths+'<sheetData>'+header+body+'</sheetData>'+(columns.length?'<autoFilter ref="A1:'+columnName(columns.length-1)+(rows.length+1)+'"/>':'')+'</worksheet>';
 const stylesXml='<?xml version="1.0" encoding="UTF-8" standalone="yes"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><numFmts count="4"><numFmt numFmtId="164" formatCode="&quot;R$&quot; #,##0.00"/><numFmt numFmtId="165" formatCode="dd/mm/yyyy"/><numFmt numFmtId="166" formatCode="dd/mm/yyyy hh:mm"/><numFmt numFmtId="167" formatCode="0.0&quot;%&quot;"/></numFmts><fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><name val="Calibri"/></font></fonts><fills count="2"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill></fills><borders count="1"><border/></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="7"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1"/><xf numFmtId="164" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/><xf numFmtId="165" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/><xf numFmtId="166" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="167" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/></cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>';
 const files={
  '[Content_Types].xml':'<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/></Types>',
  '_rels/.rels':'<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>',
  'xl/workbook.xml':'<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="'+name+'" sheetId="1" r:id="rId1"/></sheets>'+(columns.length?'<definedNames><definedName name="_xlnm._FilterDatabase" localSheetId="0" hidden="1">\''+name.replace(/'/g,"''")+'\'!$A$1:$'+columnName(columns.length-1)+'$'+(rows.length+1)+'</definedName></definedNames>':'')+'</workbook>',
  'xl/_rels/workbook.xml.rels':'<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>',
  'xl/styles.xml':stylesXml,
  'xl/worksheets/sheet1.xml':sheet,
 };
 return zipStore(Object.entries(files).map(([file,content])=>({name:file,data:encoder.encode(content)})));
}
