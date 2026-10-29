export interface DashboardChartsData {asOf:string;months:{month:string;created:number;approved:number}[];qualification:{state:string;total:number}[]}
export const dashboardQualificationNames:Record<string,string>={none:'Não iniciada',draft:'Rascunho',submitted:'Em análise',revision:'Em revisão',approved:'Aprovada'};
export function chartMaximum(values:number[]){return Math.max(2,Math.ceil(Math.max(0,...values)/2)*2);}
