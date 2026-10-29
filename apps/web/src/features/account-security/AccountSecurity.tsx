import {useEffect,useState,type FormEvent} from 'react';
import {Modal} from '../../components/Modal';
type Policy={version:string;title:string;sections:{title:string;text:string}[];contact?:string};
export function PrivacyText({onLoaded}:{onLoaded?:(version:string)=>void}){
 const [policy,setPolicy]=useState<Policy|null>(null),[error,setError]=useState('');
 useEffect(()=>{const controller=new AbortController();fetch('/api/v1/auth/privacy-policy',{signal:controller.signal,credentials:'same-origin',cache:'no-store'}).then(async response=>{if(!response.ok)throw Error();return response.json();}).then(data=>{if(!controller.signal.aborted){setPolicy(data);onLoaded?.(data.version);}}).catch(()=>{if(!controller.signal.aborted)setError('Não foi possível carregar os termos. Atualize a página e tente novamente.');});return()=>controller.abort();},[]);
 if(error)return <p role="alert" className="nf-error">{error}</p>;
 if(!policy)return <p role="status">Carregando termos e privacidade...</p>;
 return <div className="nf-policy"><p>Versão {policy.version}</p>{policy.sections.map(section=><section key={section.title}><h3>{section.title}</h3><p>{section.text}</p></section>)}{policy.contact&&<p>Canal de privacidade: <a href={'mailto:'+policy.contact}>{policy.contact}</a></p>}</div>;
}
export async function securityApi(path:string,body:unknown){
 let response:Response;try{response=await fetch('/api/v1/auth'+path,{method:'POST',credentials:'same-origin',cache:'no-store',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});}catch{throw Error('Não foi possível acessar o CRM. Confira sua conexão e tente novamente.');}
 if(!response.ok)throw Error(response.status===429?'Muitas tentativas. Aguarde alguns minutos.':response.status===503?'Recuperação indisponível no momento. Contate o administrador.':path==='/password/change'?'Confira a senha atual e escolha uma nova senha diferente, com pelo menos 12 caracteres.':path==='/privacy/accept'?'Não foi possível registrar o aceite. Atualize a página e tente novamente.':'O link é inválido, expirou ou já foi utilizado. Solicite uma nova recuperação.');
 return response.status===204?null:response.json();
}
export function ForgotPassword({open,onClose}:{open:boolean;onClose:()=>void}){
 const [busy,setBusy]=useState(false),[error,setError]=useState(''),[done,setDone]=useState(false);
 useEffect(()=>{if(open){setError('');setDone(false);}},[open]);
 async function submit(event:FormEvent<HTMLFormElement>){
  event.preventDefault();const form=event.currentTarget,fields=new FormData(form);setBusy(true);setError('');
  try{await securityApi('/password/forgot',{email:fields.get('email')});form.reset();setDone(true);}catch(cause){setError((cause as Error).message);}finally{setBusy(false);}
 }
 return <Modal open={open} title="Recuperar acesso" onClose={onClose} busy={busy}>{done?<p role="status">Se houver uma conta ativa, as instruções serão enviadas ao e-mail cadastrado. Confira também a pasta de spam.</p>:<form className="nf-form" onSubmit={submit}><p>Informe o e-mail da sua conta para receber um link de troca de senha.</p><label>E-mail cadastrado<input name="email" type="email" required maxLength={254} autoComplete="email"/></label>{error&&<p role="alert" className="nf-error">{error}</p>}<button className="nf-primary" disabled={busy}>{busy?'Solicitando...':'Enviar instruções'}</button></form>}</Modal>;
}
export function AccountOnboarding({mustChangePassword,tenantName,onLogout}:{mustChangePassword:boolean;tenantName:string;onLogout:()=>Promise<void>}){
 const [busy,setBusy]=useState(false),[error,setError]=useState(''),[version,setVersion]=useState('');
 async function submit(event:FormEvent<HTMLFormElement>){
  event.preventDefault();const fields=new FormData(event.currentTarget);
  if(mustChangePassword&&fields.get('newPassword')!==fields.get('confirmPassword')){setError('As senhas não coincidem.');return;}
  setBusy(true);setError('');
  try{
   if(mustChangePassword){await securityApi('/password/change',{currentPassword:fields.get('currentPassword'),newPassword:fields.get('newPassword')});window.location.assign('/?passwordChanged=1');}
   else {await securityApi('/privacy/accept',{version,accepted:fields.get('accepted')==='on'});window.location.reload();}
  }catch(cause){setError((cause as Error).message);setBusy(false);}
 }
 return <main className="nf-loading"><Modal open title={mustChangePassword?'Defina sua senha pessoal':'Termos de uso e privacidade'} onClose={()=>{}} busy={busy} dismissible={false}>
  <p className="nf-muted">Organização: {tenantName}</p>
  <form className="nf-form" onSubmit={submit}>
   {mustChangePassword?<><p>Antes de operar o CRM, substitua a senha temporária fornecida pelo administrador.</p><label>Senha temporária / atual<input name="currentPassword" type="password" required maxLength={1024} autoComplete="current-password"/></label><label>Nova senha pessoal<input name="newPassword" type="password" required minLength={12} maxLength={1024} autoComplete="new-password"/></label><label>Confirmar nova senha<input name="confirmPassword" type="password" required minLength={12} maxLength={1024} autoComplete="new-password"/></label></>:<><PrivacyText onLoaded={setVersion}/><label className="nf-check"><input name="accepted" type="checkbox" required disabled={!version}/>Li os Termos de uso e o Aviso de privacidade e aceito as regras de uso.</label></>}
   {error&&<p role="alert" className="nf-error">{error}</p>}
   <div className="nf-admin-actions"><button type="button" className="nf-secondary" disabled={busy} onClick={()=>void onLogout()}>Sair</button><button className="nf-primary" disabled={busy||(!mustChangePassword&&!version)}>{busy?'Aguarde...':mustChangePassword?'Alterar senha':'Aceitar termos e continuar'}</button></div>
  </form>
 </Modal></main>;
}
