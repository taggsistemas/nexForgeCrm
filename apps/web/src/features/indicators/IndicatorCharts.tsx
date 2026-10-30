import {useId} from 'react';
import {indicatorText,type IndicatorChart} from '../../../../../packages/contracts/src/indicators';
const colors=['#3b82f6','#f59e0b','#14b8a6','#8b5cf6','#ef4444','#22c55e','#ec4899','#64748b','#eab308','#0ea5e9'];
const valueText=(chart:IndicatorChart,value:number)=>indicatorText({key:'',label:'',value,unit:chart.unit,definition:''});
/** Short axis labels: "R$ 12 mil" for money, plain counts otherwise. */
const axisText=(chart:IndicatorChart,value:number)=>chart.unit==='cents'?new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL',notation:'compact',maximumFractionDigits:1}).format(value/100):String(Math.round(value));
const monthText=(label:string)=>{if(!/^\d{4}-\d{2}$/.test(label))return label;const text=new Date(label+'-15T12:00:00Z').toLocaleDateString('pt-BR',{month:'short',timeZone:'UTC'}).replace('.','');return text.charAt(0).toUpperCase()+text.slice(1);};
/** Rounded maximum for the axis (1, 2, 2.5 or 5 × 10^n). */
function niceMax(values:number[]){const max=Math.max(1,...values),power=10**Math.floor(Math.log10(max)),step=[1,2,2.5,5,10].find(item=>item*power>=max)!;return step*power;}
const width=620,height=220,left=58,right=12,top=14,bottom=186,plot=width-left-right;
function Axis({chart,max}:{chart:IndicatorChart;max:number}){
 return <>{[0,.25,.5,.75,1].map(step=><g key={step}><line x1={left} x2={width-right} y1={bottom-step*(bottom-top)} y2={bottom-step*(bottom-top)} stroke="currentColor" opacity=".1"/><text x={left-6} y={bottom-step*(bottom-top)+3} textAnchor="end" fill="currentColor" opacity=".7" fontSize="10">{axisText(chart,max*step)}</text></g>)}</>;
}
const labels=(chart:IndicatorChart,x:(index:number)=>number)=>chart.points.map((point,index)=><text key={point.label} x={x(index)} y={bottom+16} textAnchor="middle" fill="currentColor" opacity=".75" fontSize="10.5">{monthText(point.label)}</text>);
function Bars({chart}:{chart:IndicatorChart}){
 const max=niceMax(chart.points.flatMap(point=>point.values)),slot=plot/Math.max(1,chart.points.length),bar=Math.min(18,(slot-8)/chart.series.length);
 const x=(index:number)=>left+index*slot+slot/2;
 return <svg className="nf-monthly-chart" viewBox={'0 0 '+width+' '+height} role="img" aria-label={chart.title+'. Os valores exatos estão na tabela do gráfico.'}><Axis chart={chart} max={max}/>
  {chart.points.map((point,index)=>{const start=x(index)-bar*chart.series.length/2;return <g key={point.label}><title>{monthText(point.label)+': '+point.values.map((value,serie)=>chart.series[serie]+' '+valueText(chart,value)).join('; ')}</title>
   {point.values.map((value,serie)=>{const h=value/max*(bottom-top),color=colors[serie%colors.length];return <rect key={serie} x={start+serie*bar+1} y={bottom-h} width={Math.max(2,bar-2)} height={h} fill={color} fillOpacity=".28" stroke={color} strokeWidth="1.2"/>;})}</g>;})}
  {labels(chart,x)}</svg>;
}
/** Smooth monotone-ish curve through the points with a soft area underneath. */
function path(points:[number,number][]){return points.map(([px,py],index)=>{if(!index)return 'M'+px+' '+py;const [qx,qy]=points[index-1]!,mid=(qx+px)/2;return 'C'+mid+' '+qy+' '+mid+' '+py+' '+px+' '+py;}).join(' ');}
function Lines({chart}:{chart:IndicatorChart}){
 const max=niceMax(chart.points.flatMap(point=>point.values)),step=plot/Math.max(1,chart.points.length-1),x=(index:number)=>left+index*step,y=(value:number)=>bottom-value/max*(bottom-top);
 return <svg className="nf-monthly-chart" viewBox={'0 0 '+width+' '+height} role="img" aria-label={chart.title+'. Os valores exatos estão na tabela do gráfico.'}><Axis chart={chart} max={max}/>
  {chart.series.map((serie,index)=>{const color=colors[index%colors.length],points=chart.points.map((point,position)=>[x(position),y(point.values[index]??0)] as [number,number]),curve=path(points);
   return <g key={serie}><path d={curve+' L'+x(chart.points.length-1)+' '+bottom+' L'+left+' '+bottom+' Z'} fill={color} fillOpacity={index?0.12:0.18}/><path d={curve} fill="none" stroke={color} strokeWidth="2.2"/>
    {points.map(([px,py],position)=><circle key={position} cx={px} cy={py} r="3" fill={color}><title>{monthText(chart.points[position]!.label)+' · '+serie+': '+valueText(chart,chart.points[position]!.values[index]??0)}</title></circle>)}</g>;})}
  {labels(chart,x)}</svg>;
}
function Pie({chart}:{chart:IndicatorChart}){
 const values=chart.points.map(point=>Math.max(0,point.values[0]??0)),total=values.reduce((sum,value)=>sum+value,0);let angle=-Math.PI/2;
 const arc=(value:number)=>{const start=angle,end=angle+value/total*Math.PI*2;angle=end;const large=end-start>Math.PI?1:0,r=70,ir=40,p=(a:number,radius:number)=>(90+radius*Math.cos(a))+' '+(90+radius*Math.sin(a));
  if(value>=total)return 'M'+p(0,r)+' A'+r+' '+r+' 0 1 1 '+p(Math.PI,r)+' A'+r+' '+r+' 0 1 1 '+p(0,r)+' M'+p(0,ir)+' A'+ir+' '+ir+' 0 1 0 '+p(Math.PI,ir)+' A'+ir+' '+ir+' 0 1 0 '+p(0,ir)+' Z';
  return 'M'+p(start,r)+' A'+r+' '+r+' 0 '+large+' 1 '+p(end,r)+' L'+p(end,ir)+' A'+ir+' '+ir+' 0 '+large+' 0 '+p(start,ir)+' Z';};
 return <div className="nf-pie"><svg viewBox="0 0 180 180" role="img" aria-label={chart.title+'. Os valores exatos estão na legenda.'}>{chart.points.map((point,index)=>values[index]?<path key={point.label} d={arc(values[index]!)} fill={colors[index%colors.length]} fillRule="evenodd"><title>{point.label+': '+valueText(chart,values[index]!)}</title></path>:null)}
  <text x="90" y="87" textAnchor="middle" fontSize="10" fill="currentColor" opacity=".7">Total</text><text x="90" y="102" textAnchor="middle" fontSize="11" fontWeight="700" fill="currentColor">{axisText(chart,total)}</text></svg>
  <ul className="nf-pie-legend">{chart.points.map((point,index)=><li key={point.label}><i style={{background:colors[index%colors.length]}}/><span>{point.label}</span><strong>{valueText(chart,values[index]!)}</strong><small>{total?(values[index]!/total*100).toLocaleString('pt-BR',{maximumFractionDigits:1})+'%':'—'}</small></li>)}</ul></div>;
}
function Ranking({chart}:{chart:IndicatorChart}){
 const max=Math.max(1,...chart.points.map(point=>point.values[0]??0));
 return <ol className="nf-ranking">{chart.points.map(point=><li key={point.label}><span>{point.label}</span><div aria-hidden="true"><i style={{width:Math.max(2,(point.values[0]??0)/max*100)+'%'}}/></div><strong>{valueText(chart,point.values[0]??0)}</strong></li>)}</ol>;
}
/** Server-computed charts for the indicators the profile received; each one carries its values as a table. */
export function IndicatorCharts({charts}:{charts:IndicatorChart[]}){
 const id=useId();
 if(!charts.length)return null;
 return <section className="nf-indicator-charts" aria-label="Gráficos dos indicadores">{charts.map(chart=><article key={chart.key} className={'nf-analytics-panel is-'+chart.kind} aria-labelledby={id+chart.key}>
  <div className="nf-analytics-heading"><div><h3 id={id+chart.key}>{chart.title}</h3><p>{chart.subtitle}</p></div></div>
  {chart.series.length>1&&chart.kind!=='pie'&&<div className="nf-chart-legend">{chart.series.map((serie,index)=><span key={serie}><i style={{background:colors[index%colors.length]}}/>{serie}</span>)}</div>}
  {chart.points.every(point=>point.values.every(value=>!value))?<p className="nf-chart-empty">Sem movimento no período exibido.</p>:chart.kind==='ranking'?<Ranking chart={chart}/>:chart.kind==='pie'?<Pie chart={chart}/>:chart.kind==='line'?<Lines chart={chart}/>:<Bars chart={chart}/>}
  <details className="nf-chart-data"><summary>Ver valores do gráfico</summary><table><thead><tr><th>{chart.kind==='ranking'||chart.kind==='pie'?'Item':'Período'}</th>{chart.series.map(serie=><th key={serie}>{serie}</th>)}</tr></thead>
   <tbody>{chart.points.map(point=><tr key={point.label}><th>{monthText(point.label)}</th>{point.values.map((value,index)=><td key={index}>{valueText(chart,value)}</td>)}</tr>)}</tbody></table></details>
 </article>)}</section>;
}
