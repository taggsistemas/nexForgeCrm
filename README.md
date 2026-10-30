# NexForge CRM
CRM independente do NexForge ERP: TypeScript, React/Vite, Express e MongoDB.
Repositório: https://github.com/taggsistemas/nexForgeCrm.

## Incremento atual
- Interface responsiva com formulário de acesso e roadmap sem números fictícios.
- Modelos de identidade, tenant, empresas, vínculos, perfis e sessões.
- Login por organização, sessão revogável e logout; bootstrap administrativo.
- API com liveness/readiness e configuração própria.
- PWA configurada para cache apenas do shell público.
- Contratos iniciais e metadados para complementar o Graphify.
- Módulos comerciais, dados offline e integração ERP ainda não implementados.
- Identidade visual provisória, pendente de conferir tokens oficiais NexForge.

## Executar
Node 24, npm 11 e MongoDB próprio com replica set.
1. npm install
2. Usar o .env existente com a URI exclusiva do CRM. Somente se não existir, copiar .env.example e configurar.
3. Executar npm run master:bootstrap (credenciais digitadas no terminal).
4. npm run dev
5. Abrir http://localhost:5173/taggmaster para cadastrar clientes e seus administradores.
6. O cliente acessa http://localhost:5173 com a organização, e-mail e senha cadastrados.
A API só inicia após conectar ao banco; nunca usar a URI do ERP.

## Verificar
npm run check
npx playwright install chromium
npm run test:e2e

Sem dependências: npm run test:native e npm run graph:metadata.
Dependências e lockfile agora estão presentes. Build e TypeScript passaram.
Os testes HTTP encontram EACCES no loopback deste ambiente; validar fora dele.
Os testes MongoDB exigem URI exclusiva de teste e não usam o .env de produção.
Ver docs/verification.md e resultado do CI remoto.

## Documentação
docs/taggmaster.md, docs/architecture.md, docs/authentication.md, docs/roadmap.md,
docs/integrations.md e tools/graph/README.md.
Graphify (grafo AST local para consultas dos agentes): `npm run graph:install` uma vez e `npm run graph:build`; ver tools/graph/README.md. Os metadados declarados continuam complementares.

## Publicação
Frontend e API são workspaces separados no mesmo repositório. Consulte [o guia de publicação](docs/deployment.md) para os dois serviços no Render ou Nginx + Node em servidor próprio. Modelos em deploy/ não publicam serviços automaticamente.

## Segurança
O tenant é determinado por sessão validada no servidor. Nenhum dado do frontend concede autorização. Consulte [regras, evidências e pendências](docs/security.md).

## Usuários, perfis e sessão única
O administrador do cliente acessa Configurações > Usuários e equipes. Cada novo login substitui a sessão anterior da conta. Veja [operação e matriz de acesso](docs/user-administration.md). Para comprovar isolamento em MongoDB local temporário, execute npm run test:db; o comando não carrega o .env do CRM.

## Leads, clientes, contatos e acesso
O menu Relacionamento oferece leads, clientes e contatos vinculados, pesquisa, responsável, edição, arquivamento e conversão de lead em cliente. Formulários de cadastro/edição usam modais. A API aplica escopo de tenant, empresa e carteira/equipe.

Novos usuários recebem senha temporária e devem trocá-la no primeiro acesso. O aviso de privacidade exige aceite versionado antes do acesso comercial. Recuperação por e-mail exige SMTP no backend; sem configuração o serviço informa indisponibilidade. Consulte [relacionamento e acesso](docs/relationships.md), [escopo comercial futuro](docs/commercial-scope.md) e [minuta de tratamento de dados](docs/data-processing-agreement.md).

O cadastro inicial de leads agora é simplificado e o menu Pipeline comercial acompanha Novo, Em contato, Qualificado e Descartado. Dados completos são cobrados no modal de qualificação e validados na API antes da conversão. Consulte [qualificação progressiva](docs/lead-qualification.md).

No menu **Oportunidades**, registre negociações de leads qualificados/clientes com valor estimado, fechamento, ganho/perda e atividades vinculadas. Todos os formulários usam modais; a carteira acompanha o cadastro pai. Consulte [oportunidades e atividades](docs/opportunities.md).

O menu **Agenda e visitas** agora oferece agenda comercial diária/semanal/mensal, filtros, atividades vinculadas e recorrências. Atividades existentes de oportunidades aparecem sem duplicação. Consulte [agenda comercial](docs/agenda.md).

No menu **Carteiras e planejamento**, organize regiões e carteiras de vendedores, mova cadastros e prepare planos semanais, mensais, trimestrais ou semestrais. Publique o rascunho para gerar visitas na agenda. Consulte [carteiras e planos](docs/territories.md).

Rotas e visitas em campo: consulte [docs/field-visits.md](docs/field-visits.md). Roteiro cronológico, check-in/out autorizado e acompanhamento por carteira; otimização viária e gravação offline ainda não disponíveis.

Revisão antes da operação offline: [regras comerciais e lacunas atuais](docs/commercial-rules-review.md). Qualificação com análise administrativa e crédito/pagamento implementada; veja docs/lead-qualification.md. Catálogo completo, tabelas/pedidos e metas continuam futuros; offline está documentado em docs/offline.md; não confundir o escopo desses módulos com funcionalidades entregues.

Trial, licenças e preços contratuais no TAGG Master: [docs/subscriptions.md](docs/subscriptions.md). Base de 25 usuários ativos por tenant, trial opcional de 30 dias, adicionais configuráveis e controles no backend; sem faturamento automático. Senhas podem ser mostradas/ocultadas por campo.

## Offline entregue
Carteira protegida por senha local, fila de atividades/visitas, reenvio idempotente, conflitos e autorização atual na sincronização. Há limites de validade e escopo; ver [docs/offline.md](docs/offline.md) antes do piloto. Prepare online antes de usar sem rede. Catálogo/preços, propostas/pedidos e gestão seguem nos próximos incrementos.


Interface compacta e testes de geometria: consulte docs/ux-layout.md. Execute `npm run test:layout` para verificar modais e responsividade em navegador real sem servidor HTTP; os fluxos completos continuam em `npm run test:e2e`.
