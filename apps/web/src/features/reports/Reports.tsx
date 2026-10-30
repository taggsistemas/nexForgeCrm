import {useState,type FormEvent} from 'react';
import {addCalendarDays,dateParts} from '../../../../../packages/contracts/src/agenda';
import {availableOrderReports,orderReportInfo,type OrderReport,type OrderReportType} from '../../../../../packages/contracts/src/reports';
import {ReportTable,downloadXlsx} from '../../components/ReportTable';
type Account={companies:{id:string;name:string}[];permissions?:string[]};
/** Order reports: rows come from the server already limited to the profile (order kinds and live portfolio); the Excel file holds exactly those rows. */
export function Reports({account}:{account:Account}){
 const types=availableOrderReports(account.permissions??[]),today=dateParts(new Date(),'America/Sao_Paulo').date;
 const [company,setCompany]=useState(account.companies[0]?.id??''),[type,setType]=useState<OrderReportType>(types[0]??'pedidos'),[startDate,setStartDate]=useState(addCalendarDays(today,-29)),[endDate,setEndDate]=useState(today);
 const [report,setReport]=useState<OrderReport|null>(null),[loading,setLoading]=useState(false),[error,setError]=useState('');
 const info=orderReportInfo[type];
 async function generate(event:FormEvent){
  event.preventDefault();if(info.period!=='current'&&(!startDate||!endDate||endDate<startDate)){setError('Informe um período válido.');return;}
  setLoading(true);setError('');setReport(null);
  try{const response=await fetch('/api/v1/companies/'+company+'/orders/reports/'+type+'?'+new URLSearchParams({startDate,endDate}),{credentials:'same-origin',cache:'no-store'});
   if(!response.ok)throw Error(response.status===400?'Período de até 366 dias, com data final posterior à inicial.':response.status===403?'Seu perfil não tem acesso a este relatório.':'Não foi possível gerar o relatório.');
   setReport(await response.json());}
  catch(cause){setError((cause as Error).message);}finally{setLoading(false);}
 }
 function download(){
  if(!report)return;
  downloadXlsx('relatorio-'+report.type.replace('_','-')+'-'+(orderReportInfo[report.type].period==='current'?today:report.filters.startDate+'-a-'+report.filters.endDate)+'.xlsx',report.title,report.columns,report.rows);
 }
 if(!types.length)return <section className="nf-panel"><p className="nf-muted">Seu perfil não possui relatórios disponíveis.</p></section>;
 return <section className="nf-crm nf-reports">
  <section className="nf-panel"><form className="nf-report-form" onSubmit={generate}>
   <label>Empresa<select value={company} onChange={event=>{setCompany(event.target.value);setReport(null);}}>{account.companies.map(item=><option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
   <label>Relatório<select value={type} onChange={event=>{setType(event.target.value as OrderReportType);setReport(null);}}>{types.map(item=><option key={item} value={item}>{orderReportInfo[item].title}</option>)}</select></label>
   {info.period!=='current'&&<><label>Início<input type="date" required value={startDate} onChange={event=>setStartDate(event.target.value)}/></label><label>Fim<input type="date" required value={endDate} onChange={event=>setEndDate(event.target.value)}/></label></>}
   <button className="nf-primary" disabled={loading}>{loading?'Gerando...':'Gerar relatório'}</button>
  </form><p className="nf-muted">{info.description} Somente os registros do seu acesso entram no relatório; custo e margem aparecem apenas para perfis autorizados.</p></section>
  {error&&<p role="alert" className="nf-error">{error}</p>}
  {report&&<section className="nf-panel" aria-labelledby="report-title"><div className="nf-section-heading"><h2 id="report-title">{report.title}</h2><span>{report.rows.length} linha(s)</span><button type="button" className="nf-primary" disabled={!report.rows.length} onClick={download}>Baixar Excel</button></div>
   {report.truncated&&<p className="nf-warning">O relatório foi limitado a 5.000 pedidos. Reduza o período para obter todos os registros.</p>}
   {!report.rows.length?<p className="nf-muted">Nenhum registro neste filtro.</p>:<ReportTable columns={report.columns} rows={report.rows}/>}
  </section>}
 </section>;
}
