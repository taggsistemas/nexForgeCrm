import { useEffect, useState } from 'react';
const modules = [
  ['01', 'Relacionamento', 'Leads, clientes e contatos em uma visão comercial.'],
  ['02', 'Pipeline comercial', 'Oportunidades, etapas e próximos passos.'],
  ['03', 'Agenda e visitas', 'Planejamento, roteiros e registro em campo.'],
  ['04', 'Propostas e pedidos', 'Negociação, aprovações e histórico comercial.'],
  ['05', 'Gestão comercial', 'Metas, comissões, forecast e acompanhamento.'],
  ['06', 'Administração', 'Empresas, equipes, perfis e permissões.'],
];
export function App() {
  const [online, setOnline] = useState(navigator.onLine);
  useEffect(() => {
    const update = () => setOnline(navigator.onLine);
    window.addEventListener('online', update); window.addEventListener('offline', update);
    return () => { window.removeEventListener('online', update); window.removeEventListener('offline', update); };
  }, []);
  return <div className="layout">
    <aside className="sidebar"><a className="brand" href="#inicio"><span className="mark">N</span><span>NexForge <b>CRM</b></span></a><p className="caption">ESPAÇO COMERCIAL</p><nav aria-label="Navegação principal"><a className="active" href="#inicio">Visão geral <span>↗</span></a><a href="#modulos">Módulos do produto</a><a href="#fundacao">Fundação</a></nav><div className="sidebar-note"><span className="dot"/>Produto independente<p>Uma base própria para conectar relacionamentos e resultados.</p></div></aside>
    <div className="workspace"><header><span>Workspace / Visão geral</span><span className="connection" role="status"><i className={online ? 'dot' : 'dot offline'}/>{online ? 'Conexão disponível' : 'Sem conexão'}</span></header>
    <main id="inicio"><div className="eyebrow">NEXFORGE CRM · FUNDAÇÃO DO PRODUTO</div><section className="hero"><div><h1>Relacionamentos que<br/>movem negócios.</h1><p>Planeje sua operação comercial, acompanhe oportunidades e leve sua equipe mais longe.</p><a className="primary" href="#modulos">Conhecer os módulos <span>↓</span></a></div><div className="hero-art" aria-hidden="true"><div className="orbit"/><span className="art-label">CONECTAR</span><strong>N<span>↗</span></strong><span className="art-footer">Planejar. Visitar. Conquistar.</span></div></section>
    <section id="fundacao" className="foundation"><div><span className="eyebrow">PRIMEIRO MARCO</span><h2>Uma base para crescer com segurança</h2><p>Estrutura inicial em desenvolvimento. Autenticação e módulos comerciais serão entregues nas próximas etapas.</p></div><span className="badge">Fundação em construção</span></section>
    <section id="modulos"><div className="section-title"><h2>Sua operação, conectada</h2><span>Roadmap do produto</span></div><div className="cards">{modules.map(([number, title, description]) => <article key={number}><div className="card-top"><span className="number">{number}</span><span className="planned">Planejado</span></div><h3>{title}</h3><p>{description}</p></article>)}</div></section>
    <footer>NexForge CRM <span>Ambiente inicial · sem dados comerciais</span></footer></main></div></div>;
}