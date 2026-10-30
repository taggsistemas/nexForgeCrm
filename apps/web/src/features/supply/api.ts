const reasons:Record<string,string>={INSUFFICIENT_STOCK:'Saldo insuficiente: saídas manuais não podem deixar o estoque negativo.',INVALID_PRODUCT:'Produto inativo, inexistente ou que não é estocável (serviços não têm estoque).',INVALID_QUANTITY:'A quantidade não respeita as casas decimais do produto.',ABOVE_PENDING:'A quantidade recebida é maior que o saldo pendente do item.',INVALID_SUPPLIER:'Fornecedor inativo ou inexistente.',DUPLICATE_ITEM:'O mesmo produto aparece mais de uma vez no pedido.',STATUS:'A situação atual não permite esta ação.',SELF_APPROVAL:'Quem enviou o pedido não pode aprová-lo.',REASON_REQUIRED:'Informe o motivo (mínimo de 5 caracteres).'};
/** Supply API (warehouse, suppliers, purchases and company data) with readable messages for each rule. */
export async function supplyCall(company:string,path:string,options:RequestInit={}){
 const response=await fetch('/api/v1/companies/'+company+(path.startsWith('/catalog')?'':'/supply')+path,{...options,cache:'no-store',credentials:'same-origin',headers:{'Content-Type':'application/json',...options.headers}});
 if(!response.ok){const data=await response.json().catch(()=>({}));
  if(response.status===401||['PASSWORD_CHANGE_REQUIRED','PRIVACY_ACCEPTANCE_REQUIRED'].includes(data.code)){window.location.reload();throw Error('Atualize seu acesso.');}
  throw Error(data.code==='SUPPLY_RULE_REJECTED'?reasons[data.reason]??'Ação não permitida.':data.code==='INVALID_INPUT'?(data.message&&!data.message.startsWith('Invalid')?data.message:'Confira os campos obrigatórios e os formatos (CNPJ/CPF, e-mail, UF, CEP).'):response.status===409?'Registro alterado por outra pessoa ou CPF/CNPJ já cadastrado. Atualize e tente novamente.':response.status===403?'Você não tem permissão para esta operação.':response.status===404?'Registro não encontrado.':'Não foi possível concluir. Confira sua conexão.');
 }
 return response.status===204?null:response.json();
}
export const money=(cents:number)=>new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(cents/100);
export const day=(value:string)=>value.slice(0,10).split('-').reverse().join('/');
export const when=(value:string)=>new Date(value).toLocaleString('pt-BR',{timeZone:'America/Sao_Paulo',dateStyle:'short',timeStyle:'short'});
export const asInput=(cents:number)=>(cents/100).toFixed(2).replace('.',',');
