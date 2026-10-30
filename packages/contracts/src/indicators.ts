/** Management indicators. Every value is computed on the server after the profile scope and the shared filters. */
export const indicatorViews=['comercial','tecnica','gerencial'] as const;
export type IndicatorView=typeof indicatorViews[number];
export const indicatorViewNames:Readonly<Record<IndicatorView,string>>={comercial:'Comercial',tecnica:'Técnica',gerencial:'Gerencial'};
export type IndicatorUnit='count'|'cents'|'percent'|'minutes';
export interface IndicatorValue{key:string;label:string;value:number|null;unit:IndicatorUnit;definition:string}
export type IndicatorSectionKey='campo'|'carteira'|'visitas'|'oportunidades'|'propostas'|'pedidos'|'chamados'|'ordens';
/** Indicators whose cards open the underlying records (same scope and filters as the value). */
export const indicatorDrillKeys:Readonly<Record<IndicatorSectionKey,readonly string[]>>={
 campo:['visits','works'],carteira:['customers','leads','upcoming','overdue'],visitas:['planned','completed','realized'],oportunidades:['open','won'],propostas:['sent','accepted','refused'],
 pedidos:['confirmed','invoiced','backlog','pendingApproval','undelivered','forecastOverdue','forecast30','forecast60','forecast90','forecastLater'],chamados:['critical','open','overdue','opened','resolved'],ordens:['open','completed','closed'],
};
export function indicatorDrillable(section:IndicatorSectionKey,key:string){return indicatorDrillKeys[section]?.includes(key)??false;}
/** Chart data computed on the server: monthly lines/bars, share (pie) or ranking. Values follow the unit. */
export interface IndicatorChart{key:string;title:string;subtitle:string;kind:'bars'|'line'|'pie'|'ranking';unit:IndicatorUnit;series:string[];points:{label:string;values:number[]}[]}
export interface IndicatorSection{key:IndicatorSectionKey;title:string;indicators:IndicatorValue[]}
export interface IndicatorReport{asOf:string;view:IndicatorView;filters:{startDate:string;endDate:string;regionId:string|null;ownerId:string|null};sections:IndicatorSection[];charts:IndicatorChart[]}
/** Ratio as a percentage with one decimal; null when there is no denominator, never a fabricated zero. */
export function percent(part:number,total:number){return total>0?Math.round(part*1000/total)/10:null;}
export function indicatorText(item:IndicatorValue){
 if(item.value===null)return 'sem base';
 if(item.unit==='cents')return new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(item.value/100);
 if(item.unit==='percent')return item.value.toLocaleString('pt-BR',{maximumFractionDigits:1})+'%';
 if(item.unit==='minutes'){const hours=Math.floor(item.value/60),rest=Math.round(item.value%60);return hours?hours+' h'+(rest?' '+rest+' min':''):rest+' min';}
 return item.value.toLocaleString('pt-BR');
}
/** CSV with the same numbers shown on screen; semicolon-separated for spreadsheets in pt-BR. */
export function indicatorCsv(report:IndicatorReport){
 const cell=(value:string)=>'\"'+value.replace(/\"/g,'\"\"')+'\"';
 const lines=[['Seção','Indicador','Valor','Definição'].map(cell).join(';')];
 for(const section of report.sections)for(const item of section.indicators)lines.push([section.title,item.label,indicatorText(item),item.definition].map(cell).join(';'));
 lines.push(['Filtros','Período',report.filters.startDate+' a '+report.filters.endDate,'Datas de calendário em America/Sao_Paulo; data final inclusiva'].map(cell).join(';'));
 return lines.join('\r\n');
}
/** Detail rows behind one indicator; columns use the same typed cells as the Excel export. */
export interface IndicatorDetail{section:IndicatorSectionKey;key:string;title:string;note:string;columns:{key:string;label:string;kind:'text'|'cents'|'date'|'datetime'|'number'|'percent'}[];rows:(string|number|null)[][];truncated:boolean}
/** Month keys (YYYY-MM) of the six calendar months ending at the given date. */
export function lastMonths(endDate:string,count=6){const [year,month]=endDate.split('-').map(Number);return Array.from({length:count},(_,index)=>{const date=new Date(Date.UTC(year!,month!-1-(count-1-index),1));return date.toISOString().slice(0,7);});}
