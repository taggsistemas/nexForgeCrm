import mongoose from 'mongoose';
import {readDatabaseConfig} from '../../infrastructure/config.js';
import {reviewTaxIds} from './tax-id-review.js';
async function run(){
 const config=readDatabaseConfig(process.env),apply=process.argv.includes('--apply');
 console.info('Revisão de CPF/CNPJ duplicados no grupo. Exibe somente identificadores internos; nenhum documento ou nome é mostrado.');
 await mongoose.connect(config.MONGODB_URI,{serverSelectionTimeoutMS:10000,autoIndex:false,autoCreate:false});
 try{
  const result=await reviewTaxIds(apply);
  if(!result.duplicates.length)console.info(result.applied?'Nenhum duplicado. Índice único por grupo criado e índice antigo por empresa removido.':'Nenhum duplicado encontrado. Execute com -- --apply para criar o índice único por grupo.');
  for(const group of result.duplicates)console.info('Grupo '+group.tenantId+': '+group.partyIds.length+' cadastros com o mesmo documento -> '+group.partyIds.join(', '));
  if(result.duplicates.length){console.info('Corrija ou arquive os cadastros listados e execute novamente. O índice não foi alterado.');process.exitCode=1;}
 }finally{await mongoose.disconnect();}
}
run().catch(()=>{console.error('TAX_ID_REVIEW_FAILED: confira MONGODB_URI e a conexão. Nenhum valor foi exibido.');process.exitCode=1;});
