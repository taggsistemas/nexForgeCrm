import type {CompanyProfileView} from '../../../../packages/contracts/src/supply';
/** Company data for documents; every member of the company can read it. */
export async function companyProfile(company:string):Promise<CompanyProfileView>{
 const response=await fetch('/api/v1/companies/'+company+'/supply/company-profile',{credentials:'same-origin',cache:'no-store'});
 if(!response.ok)throw Error('Não foi possível carregar os dados da empresa para o documento.');return (await response.json()).record;
}
/** Saves a PDF generated in the browser from the same data shown on screen. */
export function downloadPdf(fileName:string,bytes:Uint8Array){
 const blob=new Blob([bytes as BlobPart],{type:'application/pdf'}),url=URL.createObjectURL(blob),link=document.createElement('a');
 link.href=url;link.download=fileName;document.body.appendChild(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);
}
