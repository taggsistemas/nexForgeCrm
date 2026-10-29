/** Relationship API calls for the selected company; translates server codes into actionable messages. */
export async function relationshipApi(companyId:string,path:string,options:RequestInit={}){
 const response=await fetch('/api/v1/companies/'+companyId+'/crm'+path,{...options,credentials:'same-origin',cache:'no-store',headers:{'Content-Type':'application/json',...options.headers}});
 if(!response.ok){
  const data=await response.json().catch(()=>({}));
  if(data.code==='PORTFOLIO_TRANSFER_REQUIRED')throw Error('Este cadastro está em uma carteira. Transfira-o pelo módulo Carteiras e planejamento para mudar o vendedor.');
  if(data.code==='QUALIFICATION_WORKFLOW_REQUIRED')throw Error('Use a qualificação comercial e envie para análise administrativa. A conversão direta não está disponível.');
  if(data.code==='LEAD_QUALIFICATION_REQUIRED')throw Error('Complete os dados no modal de qualificação comercial e envie para análise administrativa.');
  if(data.code==='DOCUMENT_ALREADY_REGISTERED')throw Error('Este CPF/CNPJ já está cadastrado no grupo. Localize o cadastro existente ou peça a revisão ao administrador.');
  if(data.code==='INVALID_LIST_OPTION')throw Error('Uma opção selecionada não está mais disponível ou já existe com esse nome. Atualize as listas e tente novamente.');
  if(response.status===401||['PASSWORD_CHANGE_REQUIRED','PRIVACY_ACCEPTANCE_REQUIRED'].includes(data.code)){window.location.reload();throw Error('Atualize o acesso para continuar.');}
  throw Error(response.status===409?'O registro foi alterado por outro usuário. Atualize a lista antes de tentar novamente.':response.status===404?'Registro não encontrado ou fora do seu acesso.':response.status===403?'Você não tem permissão para esta operação.':response.status===400?'Confira os campos, o documento e o responsável selecionado.':'Não foi possível concluir. Confira sua conexão.');
 }
 return response.json();
}
