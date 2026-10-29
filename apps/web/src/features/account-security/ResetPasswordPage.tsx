import {PasswordInput} from '../../components/PasswordInput';
import {useState,type FormEvent} from 'react';
import {Modal} from '../../components/Modal';
import {BrandPanel} from '../../components/BrandPanel';
import {securityApi} from './AccountSecurity';
const fragment=new URLSearchParams(window.location.hash.slice(1));
const initialToken=window.location.pathname==='/reset-password'?fragment.get('token')??'':'';
if(window.location.pathname==='/reset-password'&&window.location.hash)window.history.replaceState(null,'','/reset-password');
export function ResetPasswordPage(){
 const [token,setToken]=useState(initialToken),[busy,setBusy]=useState(false),[error,setError]=useState(''),[done,setDone]=useState(false);
 async function submit(event:FormEvent<HTMLFormElement>){
  event.preventDefault();const form=event.currentTarget,fields=new FormData(form);
  if(fields.get('newPassword')!==fields.get('confirmPassword')){setError('As senhas não coincidem.');return;}
  setBusy(true);setError('');
  try{await securityApi('/password/reset',{token,newPassword:fields.get('newPassword')});form.reset();setToken('');setDone(true);}catch(cause){setError((cause as Error).message);}finally{setBusy(false);}
 }
 return <main className="nf-login"><div className="nf-login-layout"><BrandPanel/><section className="nf-login-card"><h2>Recuperação de acesso</h2><p>Defina uma senha pessoal e entre novamente.</p></section></div><Modal open title="Definir nova senha" onClose={()=>{}} busy={busy} dismissible={false}>
  {done?<><p role="status">Senha atualizada. As sessões anteriores foram encerradas.</p><a className="nf-primary" href="/">Voltar ao login</a></>:!token?<><p role="alert">O link não contém um código válido. Solicite uma nova recuperação no login.</p><a href="/">Voltar ao login</a></>:<form className="nf-form" onSubmit={submit}><label>Nova senha<PasswordInput name="newPassword" required minLength={12} maxLength={1024} autoComplete="new-password"/></label><label>Confirmar nova senha<PasswordInput name="confirmPassword" required minLength={12} maxLength={1024} autoComplete="new-password"/></label>{error&&<p role="alert" className="nf-error">{error}</p>}<button className="nf-primary" disabled={busy}>{busy?'Salvando...':'Salvar nova senha'}</button><a href="/">Voltar ao login</a></form>}
 </Modal></main>;
}
