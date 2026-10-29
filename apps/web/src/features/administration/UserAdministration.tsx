import {PasswordInput} from '../../components/PasswordInput';
import {Modal} from '../../components/Modal';
import {useEffect,useState,type FormEvent} from 'react';
type Profile={key:string;name:string;visibility:string};
type User={id:string;name:string;email:string;active:boolean;profileKey:string|null;profileName:string;companyIds:string[];supervisedUserIds:string[];protected:boolean};
async function api(path:string,options:RequestInit={}){
  const response=await fetch('/api/v1/admin'+path,{...options,credentials:'same-origin',cache:'no-store',headers:{'Content-Type':'application/json',...options.headers}});
  if(!response.ok){
    const data=await response.json().catch(()=>({}));if(data.code==='LICENSE_LIMIT_REACHED')throw Error('Limite de licenças atingido. Suspenda um usuário ou solicite mais licenças à TAGG.');
    if(response.status===401){window.location.reload();throw Error('Sessão encerrada. Entre novamente.');}
    throw Error(response.status===409?'Este e-mail já está cadastrado.':response.status===403?'Você não tem permissão para esta operação.':response.status===400?'Confira os campos, as empresas e os vendedores vinculados.':'Não foi possível concluir a operação.');
  }
  return response.json();
}
export function UserAdministration({companies}:{companies:{id:string;name:string}[]}){
  const [formOpen,setFormOpen]=useState(false);
  const [users,setUsers]=useState<User[]>([]),[profiles,setProfiles]=useState<Profile[]>([]);
  const [busy,setBusy]=useState(false),[loading,setLoading]=useState(true),[message,setMessage]=useState(''),[error,setError]=useState('');
  const [editing,setEditing]=useState<User|null>(null),[profileKey,setProfileKey]=useState('seller'),[active,setActive]=useState(true);
  const [companyIds,setCompanyIds]=useState(companies.map(company=>company.id)),[team,setTeam]=useState<string[]>([]);
  async function load(){const data=await api('/users');setUsers(data.items);setProfiles(data.profiles);}
  useEffect(()=>{let disposed=false;api('/users').then(data=>{if(!disposed){setUsers(data.items);setProfiles(data.profiles);}}).catch(cause=>{if(!disposed)setError(cause.message);}).finally(()=>{if(!disposed)setLoading(false);});return()=>{disposed=true;};},[]);
  function reset(){setEditing(null);setProfileKey('seller');setActive(true);setCompanyIds(companies.map(company=>company.id));setTeam([]);}
  async function submit(event:FormEvent<HTMLFormElement>){
    event.preventDefault();const form=event.currentTarget,fields=new FormData(form);
    if(!companyIds.length){setError('Selecione pelo menos uma empresa.');return;}
    if(!editing&&fields.get('password')!==fields.get('confirmPassword')){setError('As senhas não coincidem.');return;}
    setBusy(true);setError('');setMessage('');
    try{
      const shared={profileKey,supervisedUserIds:profileKey==='supervisor'?team:[]};
      await api(editing?'/users/'+editing.id:'/users',{method:editing?'PATCH':'POST',body:JSON.stringify(editing?{...shared,active}:{...shared,companyIds,name:fields.get('name'),email:fields.get('email'),password:fields.get('password')})});
      form.reset();reset();setFormOpen(false);setMessage(editing?'Usuário atualizado. As sessões anteriores foram encerradas.':'Usuário cadastrado. Ele deve trocar a senha temporária no primeiro acesso.');
      await load();
    }catch(cause){setError(cause instanceof Error?cause.message:'Falha ao salvar.');}finally{setBusy(false);}
  }
  return <section className="nf-admin">
    {error&&!formOpen&&<p role="alert" className="nf-error">{error}</p>}{message&&<p role="status" className="nf-admin-success">{message}</p>}
    <div className="nf-section-heading"><h2>Gerenciar usuários</h2><button className="nf-primary" disabled={loading||busy} onClick={()=>{reset();setError('');setMessage('');setFormOpen(true);}}>Novo usuário</button></div><Modal open={formOpen} title={editing?'Configurar usuário':'Cadastrar usuário'} busy={busy} onClose={()=>{setFormOpen(false);reset();}}><p className="nf-muted">Cada conta possui um perfil e acesso apenas às empresas autorizadas deste cliente.</p>
      <form className="nf-form" onSubmit={submit} key={editing?.id??'new'}>{error&&<p role="alert" className="nf-error">{error}</p>}<fieldset disabled={busy||loading}><div className="nf-admin-grid">
      {editing?<div className="nf-admin-summary"><strong>{editing.name}</strong><span>{editing.email}</span></div>:<><label>Nome do usuário<input name="name" required maxLength={120}/></label><label>E-mail<input name="email" type="email" required maxLength={254} autoComplete="off"/></label><label>Senha temporária<PasswordInput name="password" required minLength={12} maxLength={1024} autoComplete="new-password"/></label><label>Confirmar senha<PasswordInput name="confirmPassword" required minLength={12} maxLength={1024} autoComplete="new-password"/></label></>}
      <label>Perfil de acesso<select value={profileKey} required onChange={event=>{setProfileKey(event.target.value);setTeam([]);}}>{profiles.map(profile=><option key={profile.key} value={profile.key}>{profile.name}</option>)}</select></label>
      {editing&&<label className="nf-check"><input type="checkbox" checked={active} onChange={event=>setActive(event.target.checked)}/>Acesso ativo</label>}
      </div>
      {!editing&&<div className="nf-admin-group"><strong>Empresas autorizadas</strong>{companies.map(company=><label className="nf-check" key={company.id}><input type="checkbox" checked={companyIds.includes(company.id)} onChange={event=>setCompanyIds(current=>event.target.checked?[...current,company.id]:current.filter(id=>id!==company.id))}/>{company.name}</label>)}</div>}
      {profileKey==='supervisor'&&<div className="nf-admin-group"><strong>Vendedores da equipe</strong>{users.filter(user=>user.profileKey==='seller'&&user.active&&user.id!==editing?.id&&user.companyIds.every(id=>companyIds.includes(id))).map(user=><label className="nf-check" key={user.id}><input type="checkbox" checked={team.includes(user.id)} onChange={event=>setTeam(current=>event.target.checked?[...current,user.id]:current.filter(id=>id!==user.id))}/>{user.name}</label>)}<small className="nf-muted">O supervisor acessa seus próprios registros e os registros dos vendedores vinculados.</small></div>}
      <div className="nf-admin-actions">{editing&&<button className="nf-secondary" type="button" onClick={()=>{setFormOpen(false);reset();}}>Cancelar edição</button>}<button className="nf-primary" type="submit">{busy?'Salvando...':editing?'Salvar alterações':'Cadastrar usuário'}</button></div>
      </fieldset></form>
    </Modal>
    <section className="nf-panel"><h2>Usuários do cliente</h2>{loading?<p role="status">Carregando usuários...</p>:<div className="nf-table-scroll"><table className="nf-admin-table"><thead><tr><th>Usuário</th><th>Perfil</th><th>Status</th><th>Ações</th></tr></thead><tbody>{users.map(user=><tr key={user.id}><td><strong>{user.name}</strong><small>{user.email}</small></td><td>{user.profileName}</td><td>{user.active?'Ativo':'Suspenso'}</td><td>{user.protected?<small>Conta protegida</small>:<button className="nf-secondary" disabled={busy} onClick={()=>{setFormOpen(true);setEditing(user);setProfileKey(user.profileKey??'seller');setActive(user.active);setCompanyIds(user.companyIds);setTeam(user.supervisedUserIds);setMessage('');setError('');}}>Configurar</button>}</td></tr>)}</tbody></table></div>}</section>
    <section className="nf-panel"><h2>Perfis de acesso</h2><div className="nf-admin-profile-list">{profiles.map(profile=><div key={profile.key}><strong>{profile.name}</strong><span className="nf-muted">{profile.visibility==='company'?'Dados das empresas autorizadas':profile.visibility==='team'?'Dados próprios e da equipe vinculada':'Somente registros próprios'}</span></div>)}</div></section>
  </section>;
}
