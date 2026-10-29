import nodemailer from 'nodemailer';
import {z} from 'zod';
export interface RecoveryMessage {to:string;url:string;expiresMinutes:number}
export type RecoveryMailer=(message:RecoveryMessage)=>Promise<void>;
const schema=z.object({
 SMTP_HOST:z.string().trim().min(1).max(253),SMTP_PORT:z.coerce.number().int().min(1).max(65535).default(587),
 SMTP_SECURE:z.enum(['true','false']).default('false'),SMTP_USER:z.string().optional(),SMTP_PASSWORD:z.string().optional(),
 SMTP_FROM:z.email().max(254),
}).refine(value=>Boolean(value.SMTP_USER)===Boolean(value.SMTP_PASSWORD));
export function createSmtpMailer(env:NodeJS.ProcessEnv):RecoveryMailer|undefined{
 if(!env.SMTP_HOST&&!env.SMTP_FROM&&!env.SMTP_USER&&!env.SMTP_PASSWORD)return undefined;
 const parsed=schema.safeParse(env);if(!parsed.success)throw new Error('SMTP_CONFIGURATION_INVALID');
 const c=parsed.data,secure=c.SMTP_SECURE==='true';
 if(c.SMTP_PORT===465&&!secure)throw new Error('SMTP_CONFIGURATION_INVALID');
 const transport=nodemailer.createTransport({host:c.SMTP_HOST,port:c.SMTP_PORT,secure,requireTLS:!secure,auth:c.SMTP_USER?{user:c.SMTP_USER,pass:c.SMTP_PASSWORD!}:undefined,connectionTimeout:10000,greetingTimeout:10000,socketTimeout:15000,logger:false,debug:false});
 return async message=>{
  await transport.sendMail({from:{name:'NexForge CRM',address:c.SMTP_FROM},to:message.to,subject:'Redefinição de senha — NexForge CRM',
   text:'Recebemos uma solicitação de redefinição de senha. Abra o link abaixo em até '+message.expiresMinutes+' minutos:\n\n'+message.url+'\n\nSe você não solicitou esta troca, ignore a mensagem. Sua senha atual continua válida.'});
 };
}
