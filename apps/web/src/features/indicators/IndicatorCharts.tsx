import {useId} from 'react';
import {chartMaximum} from '../../../../../packages/contracts/src/dashboard';
import {indicatorText,type IndicatorChart} from '../../../../../packages/contracts/src/indicators';
const colors=['#6254f3','#43b9a4','#efa84c'];
const valueText=(chart:IndicatorChart,value:number)=>indicatorText({key:'',label:'',value,unit:chart.unit,definition:''});
/** Short axis labels: "R$ 12 mil" for money, plain counts otherwise. */
const axisText=(chart:IndicatorChart,value:number)=>chart.unit==='cents'?new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL',notation:'compact',maximumFractionDigits:1}).format(value/100):String(Math.round(value));
const monthText=(label:string)=>/^\d{4}-\d{2}$/.test(label)?new Date(label+'-15T12:00:00Z').toLocaleDateString('pt-BR',{month:'short',timeZone:'UTC'}).replace('.',''):label;
function Bars({chart}:{chart:IndicatorChart}){
 const max=chartMaximum(chart.points.flatMap(point=>point.values)),slot=550/Math.max(1,chart.points.length),width=Math.min(26,(slot-14)/chart.series.length);
 return <svg className="nf-monthly-chart" viewBox="0 0 600 190" role="img" aria-label={chart.title+'. Os valores exatos estão na tabela do gráfico.'}>
  {[0,.5,1].map(step=><g key={step}><line x1="45" x2="595" y1={155-step*125} y2={155-step*125} stroke="currentColor" opacity=".12"/><text x="40" y={159-step*125} textAnchor="end" fill="currentColor" fontSize="10">{axisText(chart,max*step)}</text></g>)}
  {chart.points.map((point,index)=>{const x=50+index*slot+(slot-width*chart.series.length)/2;return <g key={point.label}><title>{monthText(point.label)+': '+point.values.map((value,serie)=>chart.series[serie]+' '+valueText(chart,value)).join('; ')}</title>
   {point.values.map((value,serie)=><rect key={serie} x={x+serie*width} y={155-value/max*125} width={Math.max(2,width-3)} height={value/max*125} rx="3" fill={colors[serie%colors.length]}/>)}
   <text x={x+width*chart.series.length/2} y="178" textAnchor="middle" fill="currentColor" fontSize="11">{monthText(point.label)}</text></g>;})}
 </svg>;
}
function Ranking({chart}:{chart:IndicatorChart}){
 const max=Math.max(1,...chart.points.map(point=>point.values[0]??0));
 return <ol className="nf-ranking">{chart.points.map(point=><li key={point.label}><span>{point.label}</span><div aria-hidden="true"><i style={{width:Math.max(2,(point.values[0]??0)/max*100)+'%'}}/></div><strong>{valueText(chart,point.values[0]??0)}</strong></li>)}</ol>;
}
/** Server-computed charts for the indicators the profile received; each one carries its values as a table. */
export function IndicatorCharts({charts}:{charts:IndicatorChart[]}){
 const id=useId();
 if(!charts.length)return null;
 return <section className="nf-indicator-charts" aria-label="Gráficos dos indicadores">{charts.map(chart=><article key={chart.key} className="nf-analytics-panel" aria-labelledby={id+chart.key}>
  <div className="nf-analytics-heading"><div><h3 id={id+chart.key}>{chart.title}</h3><p>{chart.subtitle}</p></div></div>
  {chart.series.length>1&&<div className="nf-chart-legend">{chart.series.map((serie,index)=><span key={serie}><i style={{background:colors[index%colors.length]}}/>{serie}</span>)}</div>}
  {chart.points.every(point=>point.values.every(value=>!value))?<p className="nf-chart-empty">Sem movimento no período exibido.</p>:chart.kind==='ranking'?<Ranking chart={chart}/>:<Bars chart={chart}/>}
  <details className="nf-chart-data"><summary>Ver valores do gráfico</summary><table><thead><tr><th>{chart.kind==='ranking'?'Responsável':'Período'}</th>{chart.series.map(serie=><th key={serie}>{serie}</th>)}</tr></thead>
   <tbody>{chart.points.map(point=><tr key={point.label}><th>{monthText(point.label)}</th>{point.values.map((value,index)=><td key={index}>{valueText(chart,value)}</td>)}</tr>)}</tbody></table></details>
 </article>)}</section>;
}
