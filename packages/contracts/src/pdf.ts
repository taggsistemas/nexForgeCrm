/** Minimal PDF 1.4 writer: A4 pages, Helvetica/Helvetica-Bold with WinAnsi (Portuguese accents), lines, boxes and JPEG images. No dependency. */
const helvetica=[278,278,355,556,556,889,667,191,333,333,389,584,278,333,278,278,556,556,556,556,556,556,556,556,556,556,278,278,584,584,584,556,1015,667,667,722,722,667,611,778,722,278,500,667,556,833,722,778,667,778,722,667,611,722,667,944,667,667,611,278,278,278,469,556,333,556,556,500,556,556,278,556,556,222,222,500,222,833,556,556,556,556,333,500,278,556,500,722,500,500,500,334,260,334,584];
const helveticaBold=[278,333,474,556,556,889,722,238,333,333,389,584,278,333,278,278,556,556,556,556,556,556,556,556,556,556,333,333,584,584,584,611,975,722,722,722,722,667,611,778,722,278,556,722,611,833,722,778,667,778,722,667,611,722,667,944,667,667,611,333,278,333,584,556,333,556,611,556,611,556,333,611,611,278,278,556,278,889,611,611,611,611,389,556,333,611,556,778,556,556,500,389,280,389,584];
/** Unicode characters outside Latin-1 that WinAnsi encodes in 0x80–0x9F. */
const winAnsiExtra:Record<string,number>={'€':0x80,'‚':0x82,'ƒ':0x83,'„':0x84,'…':0x85,'†':0x86,'‡':0x87,'ˆ':0x88,'‰':0x89,'Š':0x8a,'‹':0x8b,'Œ':0x8c,'Ž':0x8e,'‘':0x91,'’':0x92,'“':0x93,'”':0x94,'•':0x95,'–':0x96,'—':0x97,'˜':0x98,'™':0x99,'š':0x9a,'›':0x9b,'œ':0x9c,'ž':0x9e,'Ÿ':0x9f,' ':0x20,' ':0x20};
export function winAnsi(value:string){return [...value.normalize('NFC')].map(char=>{const code=char.codePointAt(0)!;if(code>=32&&code<=126||code>=0xa0&&code<=0xff)return code===0xa0?32:code;return winAnsiExtra[char]??63;});}
/** Width in points; accented letters use the width of their base letter (Helvetica metrics). */
export function textWidth(value:string,size:number,bold=false){const table=bold?helveticaBold:helvetica;let width=0;for(const char of value){const base=char.normalize('NFD')[0]!,code=base.codePointAt(0)!;width+=code>=32&&code<=126?table[code-32]!:char==='—'?1000:556;}return width*size/1000;}
export function wrapText(value:string,maxWidth:number,size:number,bold=false){
 const lines:string[]=[];for(const paragraph of value.split(/\r?\n/)){let line='';for(const word of paragraph.split(/\s+/).filter(Boolean)){const next=line?line+' '+word:word;if(textWidth(next,size,bold)<=maxWidth){line=next;continue;}if(line)lines.push(line);
  if(textWidth(word,size,bold)>maxWidth){let piece='';for(const char of word){if(textWidth(piece+char,size,bold)>maxWidth){lines.push(piece);piece='';}piece+=char;}line=piece;}else line=word;}lines.push(line);}
 return lines;
}
const literal=(value:string)=>'('+winAnsi(value).map(code=>code===40||code===41||code===92?'\\'+String.fromCharCode(code):code>126?'\\'+code.toString(8).padStart(3,'0'):String.fromCharCode(code)).join('')+')';
const fixed=(value:number)=>Number(value.toFixed(2)).toString();
function rgb(color:string){const hex=color.replace('#','');return [0,2,4].map(index=>fixed(parseInt(hex.slice(index,index+2),16)/255)).join(' ');}
export interface JpegImage {data:Uint8Array;width:number;height:number;components:number}
/** Reads dimensions and color components from a baseline/progressive JPEG (SOF markers). */
export function parseJpeg(data:Uint8Array):JpegImage|null{
 if(data[0]!==0xff||data[1]!==0xd8)return null;let offset=2;
 while(offset+9<data.length){if(data[offset]!==0xff){offset++;continue;}const marker=data[offset+1]!,length=(data[offset+2]!<<8)+data[offset+3]!;
  if(marker>=0xc0&&marker<=0xcf&&![0xc4,0xc8,0xcc].includes(marker))return {data,height:(data[offset+5]!<<8)+data[offset+6]!,width:(data[offset+7]!<<8)+data[offset+8]!,components:data[offset+9]!};offset+=2+length;}
 return null;
}
export function dataUrlBytes(value:string){const base64=value.slice(value.indexOf(',')+1),binary=atob(base64);return Uint8Array.from(binary,char=>char.charCodeAt(0));}
export const pageWidth=595.28,pageHeight=841.89;
/** Layout uses a top-left origin (y grows downward); conversion to PDF coordinates happens here. */
export class PdfDocument{
 private pages:string[][]=[[]];private images:JpegImage[]=[];
 get pageCount(){return this.pages.length;}
 get page(){return this.pages.length-1;}
 addPage(){this.pages.push([]);return this.page;}
 private ops(page=this.page){return this.pages[page]!;}
 text(x:number,y:number,value:string,options:{size?:number;bold?:boolean;color?:string;align?:'left'|'right'|'center';page?:number}={}){
  const size=options.size??9,bold=options.bold??false,width=textWidth(value,size,bold),left=options.align==='right'?x-width:options.align==='center'?x-width/2:x;
  this.ops(options.page).push('BT '+rgb(options.color??'#111827')+' rg /'+(bold?'F2':'F1')+' '+fixed(size)+' Tf '+fixed(left)+' '+fixed(pageHeight-y-size)+' Td '+literal(value)+' Tj ET');
 }
 line(x1:number,y1:number,x2:number,y2:number,options:{width?:number;color?:string}={}){this.ops().push(fixed(options.width??0.5)+' w '+rgb(options.color??'#9ca3af')+' RG '+fixed(x1)+' '+fixed(pageHeight-y1)+' m '+fixed(x2)+' '+fixed(pageHeight-y2)+' l S');}
 rect(x:number,y:number,width:number,height:number,options:{fill?:string;stroke?:string}={}){const box=fixed(x)+' '+fixed(pageHeight-y-height)+' '+fixed(width)+' '+fixed(height)+' re ';this.ops().push(options.fill&&options.stroke?rgb(options.fill)+' rg '+rgb(options.stroke)+' RG '+box+'B':options.fill?rgb(options.fill)+' rg '+box+'f':rgb(options.stroke??'#9ca3af')+' RG 0.5 w '+box+'S');}
 image(image:JpegImage,x:number,y:number,width:number,height:number){let index=this.images.indexOf(image);if(index<0){this.images.push(image);index=this.images.length-1;}this.ops().push('q '+fixed(width)+' 0 0 '+fixed(height)+' '+fixed(x)+' '+fixed(pageHeight-y-height)+' cm /Im'+index+' Do Q');}
 build(title=''){
  const chunks:Uint8Array[]=[],offsets:number[]=[];let size=0;
  const push=(value:string|Uint8Array)=>{const bytes=typeof value==='string'?Uint8Array.from(value,char=>char.charCodeAt(0)&0xff):value;chunks.push(bytes);size+=bytes.length;};
  const object=(id:number,body:string|Uint8Array[])=>{offsets[id]=size;push(id+' 0 obj\n');if(typeof body==='string')push(body);else for(const part of body)push(part);push('\nendobj\n');};
  const imageBase=5,pageBase=imageBase+this.images.length,count=this.pages.length;
  push('%PDF-1.4\n%\xe2\xe3\xcf\xd3\n');
  object(1,'<< /Type /Catalog /Pages 2 0 R >>');
  object(2,'<< /Type /Pages /Count '+count+' /Kids ['+this.pages.map((_,index)=>(pageBase+index*2)+' 0 R').join(' ')+'] >>');
  object(3,'<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>');
  object(4,'<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>');
  this.images.forEach((image,index)=>object(imageBase+index,['<< /Type /XObject /Subtype /Image /Width '+image.width+' /Height '+image.height+' /ColorSpace /'+(image.components===1?'DeviceGray':image.components===4?'DeviceCMYK':'DeviceRGB')+' /BitsPerComponent 8 /Filter /DCTDecode'+(image.components===4?' /Decode [1 0 1 0 1 0 1 0]':'')+' /Length '+image.data.length+' >>\nstream\n',image.data,'\nendstream'].map(part=>typeof part==='string'?Uint8Array.from(part,char=>char.charCodeAt(0)):part)));
  const xobjects=this.images.length?' /XObject << '+this.images.map((_,index)=>'/Im'+index+' '+(imageBase+index)+' 0 R').join(' ')+' >>':'';
  this.pages.forEach((ops,index)=>{const content=ops.join('\n');object(pageBase+index*2,'<< /Type /Page /Parent 2 0 R /MediaBox [0 0 '+fixed(pageWidth)+' '+fixed(pageHeight)+'] /Resources << /Font << /F1 3 0 R /F2 4 0 R >>'+xobjects+' >> /Contents '+(pageBase+index*2+1)+' 0 R >>');object(pageBase+index*2+1,'<< /Length '+content.length+' >>\nstream\n'+content+'\nendstream');});
  const infoId=pageBase+count*2;object(infoId,'<< /Producer (NexForge CRM) /Title '+literal(title)+' >>');
  const xref=size,total=infoId+1;push('xref\n0 '+total+'\n0000000000 65535 f \n'+Array.from({length:total-1},(_,index)=>String(offsets[index+1]).padStart(10,'0')+' 00000 n \n').join(''));
  push('trailer\n<< /Size '+total+' /Root 1 0 R /Info '+infoId+' 0 R >>\nstartxref\n'+xref+'\n%%EOF\n')
  const out=new Uint8Array(size);let position=0;for(const chunk of chunks){out.set(chunk,position);position+=chunk.length;}return out;
 }
}
