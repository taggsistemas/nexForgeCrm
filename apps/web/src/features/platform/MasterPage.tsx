import { BrandPanel } from '../../components/BrandPanel';
import { ThemeToggle } from '../../components/ThemeToggle';
import { ClientRegistrationForm } from './ClientRegistrationForm';
import { maskTaxId } from '../../../../../packages/contracts/src/customer';
import type { CustomerRegistration } from '../../../../../packages/contracts/src/customer';
import { useEffect, useRef, useState, type FormEvent } from 'react';
type Master = { id: string; name: string; email: string };
type Client = { registration?: CustomerRegistration; id: string; name: string; slug: string; active: boolean; companyName: string; admin: { name: string; email: string } | null; createdAt: string };
type ClientList = { items: Client[]; total: number; page: number; pageSize: number };
class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) { super(message); this.status = status; }
}
async function api<T>(path: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch('/api/v1/taggmaster' + path, { ...options, credentials: 'same-origin', cache: 'no-store', headers: { 'Content-Type': 'application/json', ...options.headers } });
  if (!response.ok) {
    const data = await response.json().catch(() => ({})) as { code?: string; fields?: { path: string; message: string }[] };
    const message = data.code === 'CLIENT_ALREADY_EXISTS' ? 'O identificador da organização ou o e-mail já está cadastrado.' :
      response.status === 401 ? 'Acesso não autorizado. Confira suas credenciais de Tagg Master.' :
      response.status === 429 ? 'Muitas tentativas. Aguarde alguns minutos.' :
      response.status === 400 ? data.fields?.map(field => field.message).join(' ') || 'Confira os campos e use uma senha com pelo menos 12 caracteres.' :
      response.status === 403 ? 'Acesso recusado. Verifique a origem configurada para o CRM.' :
      'Não foi possível concluir. Verifique a conexão com a API e o banco.';
    throw new ApiError(response.status, message);
  }
  return response.status === 204 ? undefined as T : response.json() as Promise<T>;
}
export function MasterPage() {
  const authEpoch = useRef(0);
  const dialog = useRef<HTMLDialogElement>(null);
  const [admin, setAdmin] = useState<Master | null>(null);
  const [checking, setChecking] = useState(true);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [refresh, setRefresh] = useState(0);
  const [list, setList] = useState<ClientList>({ items: [], total: 0, page: 1, pageSize: 20 });
  useEffect(() => {
    document.title = 'Tagg Master | NexForge CRM';
    const controller = new AbortController();
    api<{ admin: Master }>('/session', { signal: controller.signal }).then(data => setAdmin(data.admin)).catch(cause => {
      if (!controller.signal.aborted && !(cause instanceof ApiError && cause.status === 401)) setError('API indisponível. Inicie o backend e tente entrar novamente.');
    }).finally(() => { if (!controller.signal.aborted) setChecking(false); });
    return () => controller.abort();
  }, []);
  useEffect(() => {
    if (!admin) return;
    const controller = new AbortController();
    setLoading(true);
    api<ClientList>('/clients?page=' + page + '&search=' + encodeURIComponent(search), { signal: controller.signal })
      .then(data => setList(data)).catch(cause => {
        if (controller.signal.aborted) return;
        setError(cause instanceof Error ? cause.message : 'Não foi possível carregar os clientes.');
        if (cause instanceof ApiError && cause.status === 401) { setAdmin(null); setList({ items: [], total: 0, page: 1, pageSize: 20 }); }
      }).finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [admin, page, search, refresh]);
  useEffect(()=>{
    if(!admin)return;
    const controller=new AbortController();
    const generation=authEpoch.current;
    async function verify(){
      if(document.visibilityState!=='visible'||!navigator.onLine)return;
      try{
        await api('/session',{signal:controller.signal});
      }catch(cause){
        if(controller.signal.aborted||generation!==authEpoch.current)return;
        if(cause instanceof ApiError&&cause.status===401){
          setAdmin(null);setList({items:[],total:0,page:1,pageSize:20});
          setError('Sua sessão expirou ou foi encerrada por um novo acesso. Entre novamente.');
        }
      }
    }
    const timer=setInterval(verify,15000);
    window.addEventListener('focus',verify);window.addEventListener('online',verify);document.addEventListener('visibilitychange',verify);
    return()=>{controller.abort();clearInterval(timer);window.removeEventListener('focus',verify);window.removeEventListener('online',verify);document.removeEventListener('visibilitychange',verify);};
  },[admin]);
  async function login(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    authEpoch.current++;
    const form = event.currentTarget, data = new FormData(form);
    setBusy(true); setError(''); setNotice('');
    try {
      const result = await api<{ admin: Master }>('/login', { method: 'POST', body: JSON.stringify({ email: String(data.get('email')).trim(), password: data.get('password') }) });
      form.reset(); setAdmin(result.admin);
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Não foi possível entrar.'); }
    finally { setBusy(false); }
  }
  async function logout() {
    authEpoch.current++;
    setBusy(true); setError('');
    try { await api<void>('/logout', { method: 'POST' }); setAdmin(null); setList({ items: [], total: 0, page: 1, pageSize: 20 }); setNotice(''); setSearch(''); setSearchInput(''); setPage(1); }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Não foi possível sair.'); }
    finally { setBusy(false); }
  }
  async function createClient(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget, fields = new FormData(form);
    const body = { ...Object.fromEntries(['name', 'slug', 'companyName', 'adminName', 'adminEmail', 'adminPassword', 'taxId', 'stateRegistration', 'contactName', 'contactEmail', 'phone'].map(key => [key, fields.get(key)])), address: Object.fromEntries(['postalCode','street','number','complement','neighborhood','city','state','country'].map(key => [key,fields.get(key)])), contract: { start: fields.get('contractStart'), end: fields.get('contractEnd') } };
    if (fields.get('adminPassword') !== fields.get('confirmPassword')) { setError('As senhas do administrador não coincidem.'); return; }
    setBusy(true); setError(''); setNotice('');
    try {
      const result = await api<{ client: Client }>('/clients', { method: 'POST', body: JSON.stringify(body) });
      form.reset(); dialog.current?.close(); setPage(1); setSearch(''); setSearchInput(''); setRefresh(value => value + 1);
      setNotice('Cliente ' + result.client.name + ' cadastrado. Login no CRM: e-mail ' + result.client.admin?.email + '. Use a senha definida no cadastro.');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Não foi possível cadastrar.');
      if (cause instanceof ApiError && cause.status === 401) setAdmin(null);
    } finally { setBusy(false); }
  }
  async function toggle(client: Client) {
    setBusy(true); setError(''); setNotice('');
    try {
      await api('/clients/' + client.id + '/status', { method: 'PATCH', body: JSON.stringify({ active: !client.active }) });
      setNotice(client.active ? 'Cliente suspenso. O acesso será recusado nas próximas requisições autenticadas.' : 'Cliente reativado.');
      setRefresh(value => value + 1);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Não foi possível atualizar.');
      if (cause instanceof ApiError && cause.status === 401) setAdmin(null);
    } finally { setBusy(false); }
  }
  return <div className={"master-shell " + (admin ? "master-authenticated" : "master-public")}>
    {!admin && <div className="nf-master-theme"><ThemeToggle/></div>}<header className="master-top"><a className="brand" href="/"><img className="master-logo" src="/brand/tagg-sistemas-logo.png" alt="TAGG Sistemas"/><span>NexForge <b>CRM</b></span></a><span className="master-label">TAGG MASTER</span><ThemeToggle/>{admin && <button className="master-outline" onClick={logout} disabled={busy}>Sair do Tagg Master</button>}</header>
    <aside className="master-side"><img src="/brand/tagg-sistemas-logo.png" alt="TAGG Sistemas"/><strong>NexForge CRM</strong><p>Administração da plataforma</p><a href="#clients-title">Empresas clientes</a><span>TAGG MASTER</span></aside><main className="master-main"><div className="eyebrow">ADMINISTRAÇÃO DA PLATAFORMA</div><h1>{admin ? 'Painel Master da TAGG' : 'Acesso Tagg Master'}</h1><p className="master-intro">{admin ? 'Cadastre organizações e os administradores responsáveis por cada cliente.' : 'Área exclusiva para gerenciar os clientes da plataforma.'}</p>
    {error && <p role="alert" className="master-feedback master-error">{error}</p>}
    {notice && <p role="status" className="master-feedback master-success">{notice}</p>}
    {checking ? <p role="status">Verificando sessão...</p> : !admin ?
    <div className="master-login-layout"><BrandPanel/><section className="master-login"><img className="master-login-logo" src="/brand/tagg-logo-compact.png" alt="TAGG"/><h2>Acessar Tagg Master</h2><p>Entre com sua conta para administrar a plataforma.</p><form onSubmit={login}><label>E-mail master<input name="email" type="email" required maxLength={254} autoComplete="username"/></label><label>Senha master<input name="password" type="password" required maxLength={1024} autoComplete="current-password"/></label><button type="submit" disabled={busy}>{busy ? 'Entrando...' : 'Entrar no Tagg Master'}</button></form><a href="/">Voltar ao login dos clientes</a></section></div> :
    <><div className="master-account">Conectado como <strong>{admin.name}</strong><span>{admin.email}</span></div>
    <dialog ref={dialog} aria-labelledby="new-client-title" className="master-dialog" onCancel={event => { if (busy) event.preventDefault(); }}><section className="master-card" aria-labelledby="new-client-title"><div className="master-section-heading"><h2 id="new-client-title">Nova empresa</h2><button type="button" className="master-outline" disabled={busy} onClick={() => dialog.current?.close()} aria-label="Fechar cadastro">Fechar</button></div><p>O cadastro cria a organização, a primeira empresa e o acesso administrador.</p><ClientRegistrationForm onSubmit={createClient} busy={busy} error={error}/></section></dialog>
    <section className="master-card" aria-labelledby="clients-title"><div className="master-section-heading"><div><h2 id="clients-title">Empresas clientes</h2><p className="master-intro">Gerencie as empresas e os administradores do NexForge CRM.</p></div><button type="button" onClick={() => { setError(''); dialog.current?.showModal(); }}>+ Nova empresa</button></div><form className="master-search" onSubmit={event => { event.preventDefault(); setError(''); setSearch(searchInput.trim()); setPage(1); setRefresh(value => value + 1); }}><label>Buscar cliente<input value={searchInput} onChange={event => setSearchInput(event.target.value)} maxLength={80} placeholder="Nome ou identificador"/></label><button type="submit" disabled={busy}>Buscar</button></form>
    {loading ? <p role="status">Carregando clientes...</p> : list.items.length === 0 ? <p>Nenhum cliente encontrado.</p> :
    <div className="master-table-scroll"><table className="master-table"><thead><tr><th>Código</th><th>Empresa</th><th>Contato / contrato</th><th>Administrador</th><th>Status</th><th>Ações</th></tr></thead><tbody>{list.items.map(client => <tr key={client.id}><td>{client.slug}</td><td><strong>{client.name}</strong><small>{client.companyName}</small>{client.registration && <small>{maskTaxId(client.registration.taxId,client.registration.taxId.length === 11 ? 'CPF' : 'CNPJ')}</small>}</td><td>{client.registration ? <><strong>{client.registration.contactName}</strong><small>{client.registration.contactEmail}</small><small>{client.registration.contract.start.split('-').reverse().join('/')} a {client.registration.contract.end.split('-').reverse().join('/')}</small></> : 'Cadastro anterior'}</td><td>{client.admin?.name ?? 'Não informado'}<small>{client.admin?.email ?? 'Não informado'}</small></td><td><span className={'master-client-status ' + (client.active ? 'is-active' : '')}>{client.active ? 'Ativa' : 'Suspensa'}</span></td><td><button type="button" className="master-outline" disabled={busy} onClick={() => toggle(client)} aria-label={(client.active ? 'Suspender ' : 'Reativar ') + client.name}>{client.active ? 'Suspender acesso' : 'Reativar acesso'}</button></td></tr>)}</tbody></table></div>}
    <div className="master-pagination"><button type="button" disabled={page <= 1 || loading || busy} onClick={() => setPage(value => value - 1)}>Anterior</button><span>Página {page}</span><button type="button" disabled={page * list.pageSize >= list.total || loading || busy} onClick={() => setPage(value => value + 1)}>Próxima</button></div></section></>}
    </main></div>;
}
