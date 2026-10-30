import {describe,it,expect} from 'vitest';
import {inflateRawSync} from 'node:zlib';
import {buildXlsx,crc32,excelSerial} from '../../packages/contracts/src/xlsx.js';
import {availableOrderReports} from '../../packages/contracts/src/reports.js';
import {orderReportInput} from '../../apps/api/src/modules/orders/reports.js';
import {profileDefinitions} from '../../packages/contracts/src/profiles.js';
/** Reads a stored zip through its central directory, checking each CRC. */
function unzip(bytes:Uint8Array){
 const view=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength),end=bytes.length-22;expect(view.getUint32(end,true)).toBe(0x06054b50);
 const files=new Map<string,string>();let position=view.getUint32(end+16,true);
 for(let index=0;index<view.getUint16(end+10,true);index++){
  expect(view.getUint32(position,true)).toBe(0x02014b50);const size=view.getUint32(position+20,true),nameLength=view.getUint16(position+28,true),offset=view.getUint32(position+42,true),crc=view.getUint32(position+16,true);
  const name=new TextDecoder().decode(bytes.subarray(position+46,position+46+nameLength)),start=offset+30+view.getUint16(offset+26,true),data=view.getUint16(offset+8,true)===8?inflateRawSync(bytes.subarray(start,start+size)):bytes.subarray(start,start+size);
  expect(crc32(data)).toBe(crc);files.set(name,new TextDecoder().decode(data));position+=46+nameLength;
 }
 return files;
}
describe('order reports and Excel export',()=>{
 it('writes a valid workbook with typed cells, escaped text and money in reais',()=>{
  const files=unzip(buildXlsx('Pedidos/2030',[{label:'Pedido',kind:'text'},{label:'Total',kind:'cents'},{label:'Emissão',kind:'date'},{label:'Margem %',kind:'percent'}],[['PV-1 "Fazenda São José" & <b>',123456,'2030-01-31',33.3],['PV-2',null,null,null]]));
  expect([...files.keys()]).toEqual(['[Content_Types].xml','_rels/.rels','xl/workbook.xml','xl/_rels/workbook.xml.rels','xl/styles.xml','xl/worksheets/sheet1.xml']);
  const sheet=files.get('xl/worksheets/sheet1.xml')!;
  expect(sheet).toContain('<t xml:space="preserve">PV-1 &quot;Fazenda São José&quot; &amp; &lt;b&gt;</t>');expect(sheet).toContain('<c r="B2" s="2"><v>1234.56</v></c>');expect(sheet).toContain('<c r="C2" s="3"><v>47514</v></c>');
  expect(sheet).not.toContain('r="B3"');expect(files.get('xl/workbook.xml')).toContain('name="Pedidos 2030"');
 });
 it('converts calendar dates and São Paulo wall time to Excel serials',()=>{
  expect(excelSerial('1900-03-01','date')).toBe(61);expect(excelSerial('2030-01-31T15:30:00.000Z','datetime')).toBeCloseTo(47514+12.5/24,6);
 });
 it('offers each profile only the reports of the order kinds it works with',()=>{
  const reports=(key:keyof typeof profileDefinitions)=>availableOrderReports(profileDefinitions[key].permissions);
  expect(reports('manager')).toEqual(['pedidos','vendas','servicos','itens','a_faturar','faturamento','previsao']);
  expect(reports('sales_admin')).not.toContain('servicos');expect(reports('sales_admin')).toContain('vendas');
  expect(reports('technical_coordinator')).not.toContain('vendas');expect(reports('technical_coordinator')).toContain('servicos');
  expect(reports('technician')).toEqual([]);
  expect(orderReportInput.safeParse({type:'pedidos',startDate:'2030-01-01',endDate:'2031-06-01'}).success).toBe(false);expect(orderReportInput.safeParse({type:'pedidos',ownerId:'x'}).success).toBe(false);
 });
});
