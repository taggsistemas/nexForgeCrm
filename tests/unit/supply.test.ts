import {describe,it,expect} from 'vitest';
import {PdfDocument,parseJpeg,textWidth,winAnsi,wrapText} from '../../packages/contracts/src/pdf.js';
import {purchaseOrderPdf,workOrderPdf} from '../../packages/contracts/src/documents.js';
import {addressLine,averageCost,formatTaxId,type CompanyProfileView,type PurchaseView} from '../../packages/contracts/src/supply.js';
import {companyProfileInput,manualMovementInput,purchaseInput,purchaseReceiveInput,supplierInput} from '../../apps/api/src/modules/supply/input.js';
const id='64b7f0c2a1b2c3d4e5f60718';
const company:CompanyProfileView={legalName:'Só Leite Equipamentos Ltda',tradeName:'Só Leite',taxId:'11222333000181',stateRegistration:'',municipalRegistration:'',address:{street:'Rua São João',number:'10',complement:'',district:'',city:'Castro',state:'PR',zip:''},phone:'',email:'',website:'',logo:null,documentNotes:'Garantia de 90 dias.',purchaseApprovalLimitCents:0,version:1,updatedAt:null};
/** Every xref entry must point at its "N 0 obj" header, and startxref at the xref table. */
function checkStructure(bytes:Uint8Array){
 const text=new TextDecoder('latin1').decode(bytes),start=Number(/startxref\n(\d+)/.exec(text)![1]);expect(text.slice(start,start+4)).toBe('xref');
 const entries=[...text.slice(start).matchAll(/^(\d{10}) 00000 n $/gm)].map(match=>Number(match[1]));
 entries.forEach((offset,index)=>expect(text.slice(offset,offset+12)).toMatch(new RegExp('^'+(index+1)+' 0 obj')));
 return text;
}
describe('warehouse, purchases and documents',()=>{
 it('keeps a weighted average cost and formats company identifiers',()=>{
  expect(averageCost(10000,1000,4000,2000)).toBe(1286);expect(averageCost(0,1000,5000,2000)).toBe(2000);expect(averageCost(-3000,1000,5000,2500)).toBe(2500);expect(averageCost(5000,null,5000,700)).toBe(700);
  expect(formatTaxId('11222333000181')).toBe('11.222.333/0001-81');expect(formatTaxId('11144477735')).toBe('111.444.777-35');
  expect(addressLine({street:'Rua A',number:'1',city:'Castro',state:'PR',zip:'84165-000'})).toBe('Rua A, 1 · Castro/PR · CEP 84165-000');
 });
 it('encodes Portuguese text in WinAnsi, measures Helvetica and wraps long words',()=>{
  expect(winAnsi('São Ação—€')).toEqual([83,0xe3,111,32,65,0xe7,0xe3,111,0x97,0x80]);expect(winAnsi('★')).toEqual([63]);
  expect(textWidth('Ação',10)).toBeCloseTo(textWidth('Acao',10));expect(textWidth('W',10,true)).toBe(9.44);
  expect(wrapText('um dois três quatro',40,10)).toEqual(['um dois','três','quatro']);expect(wrapText('x'.repeat(30),40,10).every(line=>textWidth(line,10)<=40)).toBe(true);
 });
 it('writes a structurally valid PDF with escaped text, JPEG image and page numbering',()=>{
  const jpeg=Uint8Array.from([0xff,0xd8,0xff,0xe0,0,16,74,70,73,70,0,1,1,0,0,1,0,1,0,0,0xff,0xc0,0,17,8,0,40,0,120,3,1,0x22,0,2,0x11,1,3,0x11,1,0xff,0xd9]);
  expect(parseJpeg(jpeg)).toMatchObject({width:120,height:40,components:3});expect(parseJpeg(Uint8Array.from([0x89,0x50]))).toBeNull();
  const pdf=new PdfDocument();pdf.text(40,40,'Pedido (teste) \\ São',{bold:true});pdf.image(parseJpeg(jpeg)!,40,60,120,40);pdf.addPage();pdf.text(40,40,'Página 2');
  const text=checkStructure(pdf.build('Teste'));expect(text).toContain('(Pedido \\(teste\\) \\\\ S\\343o) Tj');expect(text).toContain('/Count 2');expect(text).toContain('/Filter /DCTDecode');
 });
 it('renders purchase and work order documents with company data and repeats the header on new pages',()=>{
  const items=Array.from({length:70},(_,index)=>({productId:String(index),code:'P-'+index,description:'Peça número '+index,kind:'product' as const,unit:'pc',quantityDecimals:0,quantity:'1',received:'0',pending:'1',unitCostCents:100,totalCents:100}));
  const purchase={id,number:'PC-000009',supplierId:id,supplierName:'Fornecedor Ágil',status:'aprovado',items,totalCents:7000,expectedDate:'2030-01-10',paymentTerms:'28 dias',notes:'',decisionNote:'',needsApproval:false,submittedAt:null,approvedAt:null,approvedBy:'',sentAt:null,receivedAt:null,cancelledAt:null,createdBy:'',canEdit:false,canSubmit:false,canApprove:false,canSend:false,canReceive:false,canCancel:false,version:1,createdAt:'2030-01-01T12:00:00Z',updatedAt:''} as PurchaseView;
  const text=checkStructure(purchaseOrderPdf(purchase,company,null));expect(text).toContain('/Count 2');expect((text.match(/\(PC-000009\) Tj/g)??[]).length).toBe(2);expect(text).toContain('(P\\341gina 2 de 2)');expect(text).toContain('(Garantia de 90 dias.)');expect(text).toContain('(Fornecedor \\301gil)');
  const work=checkStructure(workOrderPdf({id,title:'Troca de teteiras',partyId:id,partyName:'Fazenda Boa',address:'Estrada 1',serviceId:id,serviceName:'Manutenção',technicianId:id,technicianName:'Técnico',startAt:'2030-01-01T12:00:00Z',endAt:'2030-01-01T13:00:00Z',state:'completed',number:'OS-000001',diagnosis:'Desgaste',solution:'Troca',laborMinutes:90,travelMinutes:30,billableMinutes:60,closedAt:null} as never,company,[{code:'P-1',description:'Teteira',unit:'pc',net:'3'}]));
  expect(work).toContain('(Ordem de servi\\347o)');expect(work).toContain('(OS-000001)');expect(work).toContain('(1 h 30 min)');
 });
 it('rejects personal tax ids for the company, non-JPEG logos, invalid suppliers and unexplained movements',()=>{
  const profile={version:0,legalName:'Empresa',tradeName:'',taxId:'11.222.333/0001-81',stateRegistration:'',municipalRegistration:'',address:{},phone:'',email:'',website:'',logo:null,documentNotes:'',purchaseApprovalLimitCents:0};
  expect(companyProfileInput.parse(profile).taxId).toBe('11222333000181');
  for(const change of [{taxId:'111.444.777-35'},{taxId:'11.222.333/0001-80'},{logo:'data:image/png;base64,AAAA'},{email:'x'},{address:{state:'Paraná'}},{purchaseApprovalLimitCents:-1},{tenantId:id}])expect(companyProfileInput.safeParse({...profile,...change}).success).toBe(false);
  expect(supplierInput.safeParse({name:'Fornecedor',taxId:'11.444.777/0001-61'}).success).toBe(true);expect(supplierInput.safeParse({name:'Fornecedor',taxId:'123'}).success).toBe(false);expect(supplierInput.safeParse({name:'F'}).success).toBe(false);
  expect(manualMovementInput.safeParse({productId:id,direction:'saida',quantity:'1',reason:'perda',note:''}).success).toBe(false);expect(manualMovementInput.safeParse({productId:id,direction:'saida',quantity:'1',reason:'perda',note:'Avaria',balanceAfter:5}).success).toBe(false);
  expect(purchaseInput.safeParse({supplierId:id,items:[{productId:id,quantity:'1',unitCostCents:100}],expectedDate:'2030-01-01',totalCents:1}).success).toBe(false);
  expect(purchaseReceiveInput.safeParse({version:0,lines:[{productId:id,quantity:'0'}]}).success).toBe(false);
 });
});
