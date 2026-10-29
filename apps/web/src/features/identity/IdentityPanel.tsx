import {ForgotPassword,PrivacyText} from '../account-security/AccountSecurity';
import {Modal} from '../../components/Modal';
import { useEffect, useRef, useState, type FormEvent } from 'react';
export type Account = { security?:{mustChangePassword:boolean;privacyAcceptanceRequired:boolean}; permissions?: string[]; profiles?: {name:string}[]; user: { name: string; email: string }; tenant: { name: string }; companies: { id: string; name: string }[] };
export function useIdentity() {
  const epoch = useRef(0);
  const mutating = useRef(false);
  const seenSession = useRef(false);
  const [account, setAccount] = useState<Account | null>(null);
  const [checking, setChecking] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState(new URLSearchParams(window.location.search).has('passwordChanged')?'Senha alterada. Entre novamente com sua senha pessoal.':'');
  useEffect(() => {
    let disposed=false;
    const requests=new Set<AbortController>();
    let refreshing=false;
    async function refresh() {
      if(refreshing||mutating.current)return;
      refreshing=true;
      const controller=new AbortController();requests.add(controller);
      const generation=epoch.current;
      try {
        const response=await fetch('/api/v1/auth/session',{credentials:'same-origin',cache:'no-store',signal:controller.signal});
        if(disposed || generation!==epoch.current) return;
        if(response.ok) {
          const value=await response.json();
          if(disposed || generation!==epoch.current)return;
          seenSession.current=true;setAccount(value);
        } else if(response.status===401) {
          epoch.current++;
          if(seenSession.current)setMessage('Sua sessão expirou ou foi encerrada por um novo acesso. Entre novamente.');
          seenSession.current=false;setAccount(null);
        }
      } catch {} finally {
        refreshing=false;requests.delete(controller);
        if(!disposed)setChecking(false);
      }
    }
    const whenVisible=()=>{if(document.visibilityState==='visible' && navigator.onLine)void refresh();};
    void refresh();
    const timer=setInterval(whenVisible,15000);
    window.addEventListener('focus',whenVisible);
    window.addEventListener('online',whenVisible);
    document.addEventListener('visibilitychange',whenVisible);
    return ()=>{disposed=true;clearInterval(timer);for(const request of requests)request.abort();window.removeEventListener('focus',whenVisible);window.removeEventListener('online',whenVisible);document.removeEventListener('visibilitychange',whenVisible);};
  }, []);
  async function login(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget, fields = new FormData(form);
    epoch.current++;mutating.current=true;
    setBusy(true); setMessage('');
    try {
      const response = await fetch('/api/v1/auth/login', { method: 'POST', credentials: 'same-origin', cache: 'no-store', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: String(fields.get('email')).trim(), password: fields.get('password') }) });
      if (!response.ok) throw new Error(response.status === 429 ? 'Muitas tentativas. Aguarde alguns minutos.' : response.status === 401 ? 'Confira o e-mail e a senha.' : 'Não foi possível entrar. Verifique a conexão com o CRM.');
      seenSession.current=true;setAccount(await response.json()); form.reset();
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Não foi possível entrar.'); }
    finally { epoch.current++;mutating.current=false;setBusy(false); }
  }
  async function logout() {
    epoch.current++;mutating.current=true;
    setBusy(true); setMessage('');
    try {
      const response = await fetch('/api/v1/auth/logout', { method: 'POST', credentials: 'same-origin', cache: 'no-store' });
      if (!response.ok) throw new Error();
      seenSession.current=false;setAccount(null);
    } catch { setMessage('Não foi possível encerrar a sessão no servidor. Reconecte e tente novamente.'); }
    finally { epoch.current++;mutating.current=false;setBusy(false); }
  }
  return {account,checking,busy,message,login,logout};
}
export function IdentityPanel({ identity }: { identity: ReturnType<typeof useIdentity> }) {
  const [forgot,setForgot]=useState(false),[policy,setPolicy]=useState(false);
  return <section className="nf-login-card" aria-labelledby="access-title">
    <img src="/brand/tagg-logo-compact.png" alt="TAGG Sistemas" className="nf-access-logo"/>
    <h2 id="access-title">Acessar sua conta</h2><p>Entre com seu usuário para continuar.</p>
    <form onSubmit={identity.login}><label>E-mail<input type="email" name="email" required maxLength={254} autoComplete="username" placeholder="seu@email.com"/></label><label>Senha<input type="password" name="password" required maxLength={1024} autoComplete="current-password" placeholder="Sua senha"/></label>
    {identity.message && <p role="alert" className="nf-error">{identity.message}</p>}
    <button disabled={identity.busy} type="submit">{identity.busy ? 'Entrando...' : 'Entrar no CRM'}</button></form>
    <div className="nf-login-links"><button type="button" className="nf-text-button" onClick={()=>setForgot(true)}>Esqueci a senha</button><button type="button" className="nf-text-button" onClick={()=>setPolicy(true)}>Termos e privacidade</button></div><ForgotPassword open={forgot} onClose={()=>setForgot(false)}/><Modal open={policy} title="Termos de uso e privacidade" onClose={()=>setPolicy(false)}><PrivacyText/></Modal><small>Relacionamento e gestão comercial em uma plataforma.</small><a className="nf-master-link" href="/taggmaster">Acesso Tagg Master</a>
  </section>;
}
