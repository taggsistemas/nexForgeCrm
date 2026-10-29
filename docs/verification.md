# Verificação — 2026-10-28
## Configuração e arquivos
O .env existente contém MONGODB_URI, PORT e WEB_ORIGIN.
Foi preservado; sua URL e credenciais não foram exibidas. Está ignorado pelo Git.
As alterações feitas pelo usuário em dependências e lockfile foram preservadas.
Nenhuma conta ou cliente foi criado no banco real durante a implementação.

## Aprovado localmente neste incremento
- npm run typecheck.
- npm run build: backend e frontend, incluindo geração do service worker.
- Quatro testes nativos de segurança e cinco verificações de escopo.
- Trinta testes unitários Vitest.
- Metadados declarados: 26 nós e 23 relações.
- git diff --check.

## Tentado e bloqueado
npm run check iniciou, mas os vinte testes HTTP falharam com
connect EACCES 127.0.0.1 em portas locais do Supertest.
Isso é uma restrição de conexão deste ambiente, não aprovação dos endpoints.
Testes reais de persistência (dois) foram pulados por ausência de MONGODB_TEST_URI.
Não usar a URI real do cliente para habilitá-los: alocar ambiente de teste próprio.
npm run test:e2e foi iniciado, mas não ultrapassou a espera pelo servidor local.
A execução foi interrompida; E2E não aprovado e sem validação visual concluída.
Graphify não instalado; metadados declarados não são extração AST.

## GitHub
https://github.com/taggsistemas/nexForgeCrm
O CI do commit inicial 8e29a6b passou:
https://github.com/taggsistemas/nexForgeCrm/actions/runs/40762303417
Isso não valida as alterações locais subsequentes.
Nenhuma nova publicação foi feita nesta etapa.

## Uso
npm run master:bootstrap — pede nome, e-mail e senha oculta no terminal.
npm run dev — inicia API e frontend.
Abrir /taggmaster para cadastrar clientes e seus administradores.
Detalhes: docs/taggmaster.md.

## Correção do bootstrap master
O erro original informado pelo usuário era genérico; não é possível inferir sua causa retroativamente.
O comando agora verifica conexão/conta antes de pedir credenciais e só inicializa PlatformAdmin.
Validação, senha divergente, DNS, autenticação, permissão e índices têm códigos seguros.
npm run master:check executado com o .env existente: DB_DNS_FAILED na etapa connection.
Isso foi observado no ambiente restrito do agente; não comprova a causa no PC do usuário.
A inspeção segura confirmou URI presente, esquema válido, credenciais e banco explícitos,
sem marcadores de exemplo detectados; nenhum valor foi exposto ou alterado.
Nenhum cadastro real foi efetuado. Tests/unit: 30 aprovados; TypeScript e build aprovados.
npm run check: 20 testes HTTP continuam bloqueados por EACCES no loopback e 2 testes MongoDB pulados.
E2E novamente tentado, mas não concluiu a espera pelo servidor; interrompido, não aprovado.

## Diagnóstico de rede detalhado
Comando db:diagnose adicionado: DNS SRV, endereços, TCP e TLS, com códigos seguros
e comparação IPv4/IPv6. No máximo três nós e um endereço de cada família por nó.
Não envia credenciais ou operações MongoDB e não altera o .env.
TypeScript e build aprovados; metadados: 27 nós e 24 relações.
Testes unitários atualizados para códigos, proteção dos dados e timeout do diagnóstico.
A rede do ambiente do agente falhou no DNS SRV; isso não comprova a falha do PC do usuário.
HTTP/E2E mantêm as restrições de loopback registradas anteriormente; não foram
repetidos nesta alteração exclusiva de diagnóstico CLI.

## Correção da URI padrão
Diagnóstico passou a usar o parser do próprio driver para URLs com vários servidores,
sem depender de new URL. Adicionados testes de seed list, authSource e IPv6.
Ajuste local do .env é restrito ao padrão authSource=admin/nexforgeCrm com banco vazio.
Nenhuma credencial, host ou URL foi exibida; o .env permanece ignorado pelo Git.

## Refinamento das causas internas do driver
Erros AggregateError.errors e originalError agora são percorridos.
Falhas de handshake TLS e códigos adicionais de certificados são classificados
sem exibir mensagens brutas, endereços, URI ou credenciais.
Validação local da configuração: URI padrão com três servidores, banco CRM,
authSource admin, TLS e replicaSet presentes; ambiente coincide com o .env.
Isso comprova parsing/configuração local, não existência do cluster ou conexão remota.
TypeScript, build e 44 testes unitários aprovados. HTTP/E2E sem nova execução
nesta correção exclusiva de classificação de erros; bloqueios anteriores mantidos.

## TLS com código UNCLASSIFIED
O relatório fornecido pelo usuário mostrou DNS e TCP aprovados nos três nós e falha
TLS em todos eles. O código UNCLASSIFIED era limitação da classificação do diagnóstico.
A classificação passou a ser compartilhada entre bootstrap e diagnóstico, preservando
códigos simbólicos nativos OpenSSL/TLS e erros de certificados, sem dados sensíveis.
Nenhuma configuração TLS ou credencial foi alterada.
TypeScript, build, 53 testes unitários e metadados (28 nós, 25 relações) aprovados.
A causa remota da falha TLS ainda depende do novo código retornado no PC do usuário.
HTTP/E2E não repetidos nesta mudança exclusiva de diagnóstico; limitações prévias mantidas.

## Falha na etapa lookup
O novo resultado do usuário avançou da conexão para a consulta de existência.
Permissões do usuário MongoDB sobre nexforgeCrm são a próxima hipótese a verificar.
A classificação agora reconhece mensagens de recusa de ações e preserva o código
Atlas 8000; não trata todo código 8000 como autorização (pode ser autenticação).
Erros na consulta continuam impedindo cadastro, sem sobrescrever uma conta existente.
TypeScript, build e 56 testes unitários aprovados. Permissões reais e cadastro
master ainda não foram confirmados. .env e permissões Atlas não foram alterados.
HTTP/E2E não repetidos nesta mudança exclusiva de diagnóstico CLI.

## Cadastro comercial completo — 28/10/2026
Incluídos CPF/CNPJ numérico ou alfanumérico, IE, contato, telefone, e-mail, endereço, administrador e período contratual. Validação e normalização no backend; dados gravados em Tenant.registration na transação de provisionamento. Cadastros antigos continuam compatíveis.
Verificação: npm run check aprovado (86 testes Vitest, 2 testes MongoDB ignorados sem MONGODB_TEST_URI; 4 testes nativos e 5 verificações de acesso; TypeScript, build e metadados do grafo aprovados). Após pequenos ajustes de acessibilidade, tipo de documento e testes E2E, typecheck/build/grafo aprovados novamente.
E2E: 14 casos aprovados em desktop e celular no Chrome instalado, com configuração temporária de channel chrome. O Chromium gerenciado pelo Playwright não está instalado neste ambiente; a primeira execução padrão falhou antes de abrir o navegador. A execução final reutilizou um preview iniciado separadamente e concluiu com exit 0 (14 passed). CEP e APIs mockados; não houve consulta real do ViaCEP nem gravação no banco de produção. Capturas desktop e mobile conferidas visualmente. O teste MongoDB isolado foi ampliado para conferir persistência, mas permanece sem execução por falta da URI de testes.

## Revisão de segurança e próximos incrementos — 28/10/2026
Identidade visual do cliente e master alinhada ao ERP, com login dedicado, menu lateral, temas e sessão. 16 E2E de interface passaram após remover estilos globais legados que ocultavam texto do menu no celular; capturas conferidas. Guia de publicação e exemplos Render/Nginx adicionados, sem publicação externa.
Segurança: adicionados bloqueio de chaves perigosas na entrada HTTP, validação de credenciais também nos serviços, no-store global em /api e middleware de autorização por sessão/tenant/empresa/permissão para os futuros módulos. Testes HTTP com serviços simulados e testes unitários aprovados: 98 Vitest; 3 MongoDB não executados sem MONGODB_TEST_URI. Build/typecheck/nativos aprovados. Grafo declarado atualizado (37 nós/41 arestas); não é extração Graphify AST.
Auditoria npm registrada em artifacts/security-audit*.json: produção com zero alertas conhecidos; cadeia de build PWA com quatro alertas baixos. Downgrade incompatível sugerido pelo audit não aplicado. CI passa a bloquear alertas moderados ou superiores. Ver docs/security.md para limites e pendências; não é uma declaração de segurança completa.

E2E da revisão: 18 casos aprovados no Chrome instalado, em desktop e celular (inclui tentativa de XSS em nomes recebidos da API). APIs e CEP simulados nos testes de navegador; o runner concluiu com exit 0 usando preview separado. O banco real e a infraestrutura de produção permanecem fora deste aceite.

## Incremento: sessão única, perfis e administração do tenant
- npm run check aprovado: 102 testes unitários/HTTP, 4 nativos e 5 verificações de escopo, typecheck, build e metadados declarados. As 6 integrações MongoDB ficam ignoradas apenas nessa execução sem URI externa.
- npm run test:db aprovado: 6 casos em 3 suítes com MongoDB 8.0.17 real, replica set local e bancos aleatórios. Inclui leituras/alterações/exclusões entre tenants, primeiro upsert concorrente de sessão, logout antigo, perfis, equipes, administração, auditoria e revogação de sessão por alteração de perfil.
- Testes descobriram erro de rollback __v em subdocumentos estritos de cadastro. Desabilitado versionKey apenas nos subdocumentos sem _id; validação strict continua throw. Provisionamento, conflito e rollback foram retestados em MongoDB real.
- O primeiro início do MongoDB falhou ao renomear arquivos WiredTiger no diretório temporário restrito do Windows. O runner passou a usar diretório temporário próprio dentro de artifacts, com verificação de contenção antes da remoção. Não houve elevação nem uso do banco da aplicação.
- 24 E2E aprovados no Chrome instalado em desktop/celular, incluindo criação/configuração de usuário e revogação de sessões de cliente/master por perda de foco. Dois casos de administração foram repetidos para capturas e conferência visual.
- Perfis padrão: administrador do sistema, gerencial, administrativo de vendas, supervisor, vendedor. Supervisor revalida vendedores ativos no mesmo tenant; promoção ou suspensão remove o vínculo na mesma transação.
- APIs administrativas foram testadas com persistência real, recusando tenant/empresa externos, mass assignment, alteração da própria conta/principal e equipes inválidas. Operações são auditadas. Cadastros e senhas reais do usuário não foram usados.
- Grafo declarado atualizado: 49 nós e 58 arestas. Graphify AST e implantação externa continuam separados deste aceite.

## Incremento: leads, clientes, contatos e segurança de acesso
- npm run check aprovado: 108 testes unitários/HTTP, 4 nativos e 5 verificações de escopo, TypeScript e build. Os 9 casos MongoDB são ignorados nesse comando sem URI e executados separadamente.
- npm run test:db aprovado: 9 casos reais em 5 suítes, MongoDB local temporário com replica set e bancos aleatórios. Inclui isolamento entre tenants, carteira/equipe, referência pai, conversão, alteração parcial, arquivamento, conflitos concorrentes, senha temporária, versão de credenciais, aceite versionado e reset de uso único. Banco da aplicação e .env reais não foram utilizados.
- 30 E2E aprovados no Chrome instalado, desktop/celular, incluindo modais, CEP, contatos, conversão, primeiro acesso, privacidade e recuperação. APIs/CEP simulados no navegador; capturas do modal conferidas. Configuração local temporária de channel chrome removida após a execução.
- Recuperação testada com mailer simulado; envio SMTP real não executado porque não está configurado. Configurar variáveis SMTP e PRIVACY_CONTACT_EMAIL no backend. Recuperação do TAGG Master permanece separada.
- Auditoria npm --omit=dev: zero vulnerabilidades conhecidas nesta execução. Não equivale a auditoria completa da infraestrutura.
- Grafo declarado validado após atualização: 73 nós, 87 arestas. Graphify AST continua etapa separada.
- Pedidos/status e escopos de preços registrados como futuros, sem telas operacionais. Operação comercial offline permanece pendente. Minuta de tratamento de dados e aviso precisam completar dados operacionais e passar por revisão antes da produção.

## Incremento: captação simples e pipeline de qualificação
- npm run check aprovado: 111 testes unitários/HTTP, 4 nativos e 5 verificações de escopo; typecheck e build aprovados. Nove casos MongoDB são ignorados apenas no comando sem URI.
- npm run test:db aprovado: 9 casos reais em 5 suítes com MongoDB local temporário, sem .env nem banco da aplicação. Ampliada integração para cadastro inicial mínimo, recusa de qualificação/conversão incompleta, rollback, filtro de etapa, escopo entre tenants, qualificação completa e auditoria de transições. Também recusa retirar dados obrigatórios de lead qualificado.
- 30 E2E aprovados no Chrome instalado em desktop/celular. Fluxo: cadastro sem campos fiscais, endereço opcional recolhido, qualificação em modal, CEP, deslocamento entre colunas e conversão preservando contatos. APIs e CEP simulados no navegador; capturas do pipeline e modal conferidas. Teste antigo de navegação passou a usar Agenda e visitas, pois Pipeline deixou de ser placeholder. Configuração temporária local removida após testes.
- Grafo declarado validado: 78 nós e 96 arestas, incluindo regra de qualificação, filtro, evento e testes. Não representa extração Graphify AST.
- Sem mudanças no ERP, .env, dados existentes ou implantação externa. Pipeline de leads entregue; oportunidades com valores e fechamento permanecem no próximo incremento.

## Incremento: oportunidades e atividades vinculadas
- npm run check aprovado: 115 testes unitários/HTTP, 4 nativos e 5 verificações de escopo, typecheck e build. Treze casos MongoDB ficam ignorados apenas no comando sem URI de testes.
- npm run test:db aprovado: 13 casos reais em 6 suítes. O novo módulo valida acesso próprio/equipe/empresa/tenant, referências cruzadas, qualificação antes da oportunidade, transferência de carteira sem ownerId copiado, arquivamento do pai, filtros e paginação, escape de pesquisa, centavos inteiros, versão otimista, perda com motivo, timestamps do servidor, status de atividades e histórico.
- A integração inclui corrida entre criar atividade e encerrar oportunidade: transações serializam as operações; atividade não é criada após encerramento confirmado. Dados da aplicação e .env não foram usados; apenas bancos temporários locais aleatórios.
- 34 E2E aprovados no Chrome instalado, desktop/celular, com APIs simuladas. Fluxo novo cobre modais, valor em BRL, vínculo, atividade, conclusão, histórico, ganho e perda com motivo. Um seletor de teste foi corrigido para usar o papel combobox; a primeira tentativa também sofreu resposta transitória durante reconstrução do preview. Execução final completa, sem reconstrução concorrente, terminou com exit 0.
- Capturas desktop/mobile conferidas. Após ajuste visual do seletor de empresa e espaçamento do histórico: typecheck/build repetidos e 4 E2E do módulo repetidos. Nenhuma chamada a SMTP, ERP ou banco de produção foi feita.
- Metadados declarados do grafo validados: 107 nós e 136 arestas, com contratos, models, permissões, endpoints, serviços, eventos e testes deste módulo. Graphify AST continua uma etapa separada.
- Ganho/perda são terminais neste incremento; ganho não gera pedido/faturamento. Agenda geral, calendário, recorrências, notificações e operação comercial offline continuam pendentes. Nenhuma implantação externa foi realizada.

## Incremento: agenda comercial e recorrências
- npm run check aprovado: 121 testes unitários/HTTP, 4 nativos e 5 verificações de escopo; TypeScript, build e metadados declarados aprovados. Os 17 testes MongoDB ficam ignorados apenas nesse comando sem URI externa e são executados pelo runner isolado.
- npm run test:db aprovado: 17 casos reais em 7 suítes. A agenda cobre unificação sem cópia de atividades antigas, acesso próprio/equipe/empresa/tenant, troca e arquivamento de carteira, fontes e referências, recorrência mensal com âncora, edição individual com conflito, encerramento de oportunidade, cancelamento de série e totais completos além de 50 itens.
- Falha simulada de auditoria confirmou rollback de série e ocorrências. A primeira execução identificou a exigência ordered:true do Mongoose ao criar vários documentos numa sessão; corrigida e retestada. A revisão de precisão da conversão IANA também exigiu normalizar os segundos com dois dígitos; testes finais passaram após a correção.
- Testes unitários verificam semanas iniciando na segunda, grade mensal de 42 dias, fim de mês, horário de verão histórico, recusa de horário inexistente, quantidade/horizonte limitados e injeções de campos/filtros.
- 38 E2E aprovados no Chrome instalado em desktop/celular, com APIs simuladas. Incluem dia/semana/mês, filtros, modal recorrente, edição em ambas as fontes, conclusão, cancelamento e perfil somente leitura. Capturas de calendário/modal conferidas visualmente. Ajuste final mantém o botão Fechar habilitado na visualização sem escrita.
- Grafo declarado validado: 132 nós e 174 arestas. A extração Graphify AST permanece separada. Novos contratos, serviços, models, rotas, eventos e testes estão no manifesto.
- Nenhuma alteração no ERP ou .env; testes usam somente bancos MongoDB locais temporários. Nenhuma implantação externa, envio de notificações ou gravação comercial offline foi executada. Planejamento de visitas, rotas e localização continuam como próximos incrementos.

## Incremento: regiões, carteiras e planejamento de visitas
- npm run check aprovado: 126 testes unitários/HTTP, 4 nativos e 5 verificações de escopo; TypeScript, build e metadados declarados aprovados. Os 22 casos MongoDB ficam ignorados apenas no comando sem URI e são executados no runner isolado.
- npm run test:db aprovado: 22 casos reais em 8 suítes. Inclui referências de tenant/empresa, permissões gerenciais/supervisor/vendedor, vendedor ativo, região inválida/duplicada, transferência em lote com rollback de cliente e contato, bloqueio de ownerId fora da carteira, acesso dinâmico a oportunidades/agenda, períodos canônicos e carteira vazia após suspensão do vendedor.
- Planejamento testado com validação de vínculo, duração/período, inserções concorrentes com sobreposição, publicação concorrente sem duplicação, referência única na agenda, cancelamento seguro após transferência, preservação de atividades passadas/concluídas, limite de reagendamento e encerramento sem pendências. Falha de auditoria simulada confirmou rollback da publicação e estado do rascunho.
- 42 E2E aprovados no Chrome instalado, desktop/celular, com APIs simuladas. Fluxo novo: região → carteira → transferência → plano → item → publicação → atividade na agenda. Perfis sem gestão não exibem comandos de atribuição/região. Capturas conferidas. Após ajuste final da apresentação dos períodos, os 4 casos E2E do módulo foram repetidos.
- Grafo declarado validado: 175 nós e 232 arestas. Novos models, funções, componentes, rotas, eventos, permissões e testes registrados. Não é extração Graphify AST.
- Nenhuma alteração no ERP ou .env, nem implantação externa. Banco da aplicação não foi usado pelos testes. Abrangência regional é classificação manual; não há geocodificação, cálculo de rota, localização, check-in ou operação offline nesta entrega. A prevenção de sobreposição é interna a cada plano, sem promessa de conflito global entre agendas.

## Incremento: roteiro diário e execução de visitas em campo
- npm run check aprovado: 130 testes unitários/HTTP, 4 nativos e 5 verificações de escopo; TypeScript e builds aprovados. Casos MongoDB são ignorados somente no comando sem URI e executados pelo runner temporário.
- npm run test:db aprovado: 27 casos reais em 9 suítes. Novos casos cobrem tenant, propriedade/equipe atual, Origin, DTO estrito, autorização da localização, concorrência entre check-ins, atendimento único, horário do servidor, conclusão transacional, conflito de versão, rollback de auditoria, bloqueio de edição comum/arquivamento/cancelamento durante visita, publicação de plano, série recorrente e transferência seguida de interrupção gerencial justificada.
- 46 E2E aprovados no Chrome instalado, em desktop e celular simulado, com APIs e localização simuladas. Os quatro casos novos exercitam check-in/out em modais, registro e resultado, ausência de overflow horizontal e localização negada sem POST. Após ajuste final de espaçamento, build e os quatro E2E do módulo foram novamente aprovados; capturas desktop/mobile conferidas.
- Metadados declarados validados: 190 nós e 241 arestas. Extração Graphify AST não foi executada.
- Nenhuma alteração no ERP ou .env, nenhum acesso de teste ao banco da aplicação, nenhuma implantação ou push externo. A localização real precisa ser homologada no aparelho, com HTTPS e permissão do navegador. Roteiro é cronológico; otimização viária/geocodificação e gravação offline permanecem futuras. Apenas visitas diretas de Party/planos publicados são executadas neste incremento; atividades de oportunidades seguem na agenda.

## Correções: lead mínimo e qualificação com análise administrativa
- npm run check aprovado: 134 testes unitários/HTTP, 4 nativos, 5 verificações de escopo, TypeScript e builds. Metadados declarados aprovados com 200 nós/250 arestas; não são Graphify AST.
- npm run test:db aprovado: 32 casos reais em 9 suítes, com MongoDB temporário isolado e sem carregar .env. Cadastro inicial recusa fiscal/comercial e exige canal; conversão livre/criação direta de cliente recusam. Qualificação testa completude, IE, condições, retorno com motivo, nova revisão, aprovação por outro usuário, concorrência e rollback de auditoria. Inclui duplicidade fiscal dentro da empresa, mesmo documento em outro tenant, perda de acesso e snapshot inválido após transferência, além de regularização explícita de legado preservando ID/contatos.
- 46 E2E aprovados em Chrome desktop/celular simulado, com APIs simuladas. O fluxo de relacionamento cobre cadastro sem documentos, qualificação, revisão administrativa, reenvio e aprovação/conversão, incluindo condições de pagamento. Após revisão final de CEP internacional, os 6 E2E de relacionamento/conta passaram novamente. Capturas do modal de análise conferidas.
- Fixtures de outros domínios agora identificam explicitamente clientes sintéticos pré-existentes; não usam criação direta de cliente pelo serviço, que foi bloqueada. Os testes do novo fluxo usam API real e serviços transacionais com usuários/perfis persistidos.
- Regressão encontrou erro do Mongoose ao hidratar campo immutable com default em FieldExecution.locationNoticeVersion. Default removido; novos check-ins atribuem a versão explicitamente, registros anteriores sem versão não recebem evidência inventada. Check-out e regressões do módulo de campo passaram no runner MongoDB.
- Não houve migração em massa, acesso ao banco da aplicação, alteração em .env/ERP ou implantação/push. Clientes legados permanecem clientes sem aprovação implícita; pedidos futuros deverão validar aprovação. Mudanças futuras de condições já aprovadas exigirão fluxo próprio. Catálogo/preços/pedidos/metas, offline e finalização da instalação móvel permanecem nas etapas seguintes.

## TAGG Master: trial, capacidade e visibilidade de senha
- npm run check aprovado: 137 casos unitários/HTTP, 4 nativos, 5 verificações de escopo, TypeScript e builds. Metadados declarados: 211 nós/258 arestas; extração Graphify AST separada.
- npm run test:db aprovado: 35 casos em 10 suítes MongoDB reais e temporárias, sem .env da aplicação. Cobrem trial exato de 30 dias, autenticação/sessão após vencimento, reativação sem extensão, conversão para contratado, primeira ativação explícita em cliente legado, impedimento de repetir trial, Master isolado de cookie tenant, concorrência pela última licença, criação versus reativação, redução abaixo do uso e rollback de auditoria.
- 54 E2E aprovados em Chrome instalado com viewport desktop/celular simulado, APIs simuladas. Incluem trial/licenças no cadastro e edição, preços em centavos, conversão pelo Master, mensagem de teste vencido e mostrar/ocultar senha sem submissão nem perda de valor. Após ajustes finais de status/reset/primeira ativação, 12 E2E dos fluxos afetados foram novamente aprovados. Captura do modal de plano conferida.
- Licenças por Membership ativa do tenant, incluindo administrador, independentes da quantidade de empresas/sessões. Legados não recebem trial automático; usuários existentes não são suspensos por migração. Valor adicional não foi inventado: configurável, com estimativa e valores a definir, sem faturamento/cobrança automatizados.
- Nenhuma migração em massa, conexão de testes com banco real, alteração no ERP/.env ou push/deploy externo. Instalação móvel final e operação offline continuam próximas etapas; a PWA ainda não sincroniza dados comerciais offline. Licenças/grants futuros precisam respeitar trial e autenticação atual na sincronização.

## Revalidação da operação offline — 2026-10-29

- Implementação presente no commit `77cdc45`: carteira criptografada, atividades, relatos de visitas e sincronização explícita. Uso e limites em `docs/offline.md`.
- TypeScript, build da API/PWA, 4 testes nativos, 5 verificações de fronteira e 108 testes sem conexão passaram. Metadados declarados: 226 nós e 269 arestas; não são Graphify AST.
- `npm run check` não passou: 31 testes HTTP falharam com `connect EACCES 127.0.0.1`; 43 testes MongoDB foram ignorados sem URI.
- `npm run test:db` tentou iniciar MongoDB temporário separado, mas foi bloqueado pelo mesmo EACCES. Integração real não validada nesta execução.
- Homologação completa pendente em ambiente com conexões locais e em celulares físicos com HTTPS. Sem alterações no banco da aplicação ou ERP.
- `npm run test:e2e` foi iniciado, mas ficou aguardando o servidor de preview sem executar casos; interrompido nesta sessão. Nenhum E2E aprovado é atribuído a esta execução.

## Homologação comercial, dashboard e catálogo — 2026-10-29

- Implementados indicadores clicáveis com listas/busca em modal, clientes aprovados no pipeline, atualização de decisões remotas de qualificação sem sobrescrever alterações locais, São Paulo na interface e explicação de oportunidades/roteiro diário. Offline abre automaticamente sem rede/falha de transporte da sessão; reconexão sincroniza carteira desbloqueada, preservando IDs e as validações do servidor.
- Catálogo e preços: novos contratos, DTOs, modelos/índices, sequência por empresa, auditoria transacional, composições de caixas, precisão decimal, peso/fiscal/prazo, seis abrangências, resolução por Party/carteira/equipe atual e modais. Administrativo de vendas recebeu `catalog:manage`; vendedor/supervisor continuam sem manutenção. Ver `catalog-pricing.md` e `usability-review.md`.
- `npm run check` foi executado: passaram 4 testes nativos, 5 verificações de fronteira, TypeScript e 112 testes unitários. Os 31 testes HTTP falharam por `connect EACCES 127.0.0.1`; 47 casos MongoDB ficaram ignorados sem URI. Portanto, check completo não aprovado. `npm exec vitest run tests/unit` confirmou separadamente 112/112 casos.
- `npm run test:db` foi tentado com replica set local temporário, sem carregar `.env`; bloqueado por `connect EACCES 127.0.0.1`. Os quatro novos testes reais de catálogo permanecem sem execução. Abrangem autorização, códigos, componentes, conflitos otimistas, precedência/fallback e rollback da auditoria.
- `npm run test:e2e -- --config playwright.local.config.ts` foi iniciado com Chrome instalado; permaneceu aguardando o servidor de preview sem executar casos e foi interrompido. Nenhum E2E aprovado nesta sessão. Novos cenários incluem catálogo/preço em centavos, indicadores com cliente aprovado e devolução remota em modal aberto preservando rascunho sujo; regressões offline foram adaptadas ao acesso automático.
- Não houve conexão de teste com banco da aplicação, mudança em `.env`/ERP, migração de clientes, push ou implantação. Homologação integral e em celulares físicos permanece pendente. Pedidos, cobrança, estoque, recálculo por peso aferido e otimização viária não foram implementados neste incremento.
- Build da API e da PWA aprovado em comando separado. Coleta dos E2E aprovada: 74 casos em desktop/celular, sem execução de navegador. Metadados declarados validados: 240 nós e 283 arestas; extração Graphify AST não executada.

## UX/UI compacta e automação de layout — 2026-10-29

- Menu agrupado sem cabeçalhos repetidos, layout com menos espaços, três colunas nos modais desktop, indicadores mais compactos e ajuda recolhível. Celular mantém controles de 44px e campos de 16px; agenda inicia no dia. Título/fechar do modal permanecem visíveis, fundo fica bloqueado e política usa a rolagem principal. Editor aninhado bloqueia o conteúdo do modal anterior.
- `npm run test:layout`: 12/12 aprovados em Chrome real (1366×768, 1280×600 e 393×851). Verifica dashboard acima da dobra, menu, modais longos/aninhados, uma rolagem vertical por modal ativo, bloqueio/restauração do fundo, ausência de overflow lateral e alvos de toque. Capturas sintéticas desktop/mobile conferidas. Esses testes usam CSS e componente Modal reais com fixtures; não são execução completa dos fluxos da aplicação.
- A primeira execução revelou IDs duplicados nas duas renderizações SSR independentes do fixture aninhado. Corrigido o prefixo de IDs do fixture, sem alterar a identificação acessível da aplicação. Suíte completa repetida e aprovada após a correção e bloqueio do modal ancestral.
- `npm run check`: tipos, 4 nativos, 5 verificações de fronteira e 112 unitários aprovados; 31 HTTP falharam por `connect EACCES 127.0.0.1`, 47 MongoDB ignorados sem URI. Não representa aprovação integral. Não houve repetição do banco temporário nesta etapa visual; bloqueio de conexão já documentado no incremento anterior.
- `npm run test:e2e -- --config playwright.local.config.ts` foi tentado; permaneceu aguardando o preview HTTP sem executar os fluxos e foi interrompido. Novos testes de layout sem servidor executaram de fato; fluxos E2E/integração permanecem pendentes neste ambiente.
- Builds da API/PWA aprovados separadamente. Grafo declarado validado com 243 nós e 291 arestas, não Graphify AST. CI configurada para executar a suíte de layout após instalar Chromium e guardar relatórios/capturas; não foi disparada execução remota, push ou deploy.
- Documentação: `ux-layout.md`. Comando reutilizável: `npm run test:layout`. Nenhuma alteração adicional em autenticação, dados comerciais, .env ou ERP nesta etapa visual.

## Dashboard inicial orientado a ações — 2026-10-29

- Tela inicial separada em atenção, acompanhamento e atalhos autorizados; saudação, empresa e última atualização. Indicadores explicam o significado e a próxima ação, abrindo os cadastros em modal. Alertas/estado vazio dependem de leitura bem-sucedida; erro não vira zero. Ajuda explica sobreposição entre etapas e pendências, sem totais/taxas artificiais.
- Mantidos filtros e autorização atuais do backend. Troca de empresa limpa os indicadores e fecha o detalhe; requisições antigas abortadas não atualizam a tela. Não houve alterações em APIs ou dados comerciais.
- `npm run test:layout`: 15/15 aprovados em Chrome real, incluindo novo cenário com o componente Dashboard real em desktop, tela baixa e celular. Captura da página inicial conferida; a renderização de layout inicial usa dados sintéticos e estado de carregamento, sem testar as consultas HTTP.
- TypeScript e builds API/PWA aprovados. `npm run check`: 112 unitários, 4 nativos e 5 fronteiras passaram; os 31 HTTP falharam por EACCES no loopback, 47 MongoDB ignorados sem URI. E2E completo tentado, mas ficou aguardando o preview HTTP e foi interrompido sem casos executados. Não afirmar aprovação completa.
- Grafo declarado validado: 243 nós e 293 arestas. Graphify AST não executado. Documentação em `dashboard.md`; nenhum push, deploy, acesso ao banco da aplicação ou alteração no ERP.

## Dashboard com gráficos da referência — 2026-10-29

- Referência visual local inspecionada sem modificar o arquivo original. Dashboard com cards roxos, destaque escuro, pendências laterais, barras mensais e semicircular de qualificação; temas claro/escuro e consulta em modal mantidos.
- Novo GET `/crm/dashboard` calcula séries de seis meses e distribuição de qualificação usando agregação, com filtros autorizados aplicados antes dos facets. DTO estrito, sem aceitar tenant/owner/período do frontend e sem cache autenticado. Métricas usam a carteira atual; não representam histórico de transferências, receita ou conversão por coorte.
- `npm run test:layout`: 18/18 aprovados em Chrome real, desktop/tela baixa/celular. Estados com dados sintéticos e vazio, barras, valores em tabela, percentual semicircular, modais e overflow conferidos. Primeiro teste detectou cards abaixo da dobra em tela baixa; espaçamento corrigido e suíte inteira aprovada. Captura da composição com gráficos conferida; não é captura com dados de clientes reais.
- `npm run check`: TypeScript, 4 nativos, 5 fronteiras e 116 unitários passaram. Os 31 HTTP falharam por EACCES; 48 casos MongoDB ignorados sem URI. Unidade nova cobre meses no fuso de São Paulo, escopo antes da agregação, DTO, tipos legíveis e propagação de falhas. Teste real novo verifica isolamento de tenant/empresa/owner e arquivados.
- `npm run test:db` tentado: replica set temporário bloqueado por connect EACCES no loopback. `npm run test:e2e -- --config playwright.local.config.ts` tentado: ficou aguardando preview HTTP e foi interrompido sem casos executados. Integração e E2E completos permanecem pendentes.
- Builds API/PWA aprovados separadamente. Metadados declarados validados: 247 nós, 301 arestas; não Graphify AST. Nenhum push/deploy, mudança no ERP/.env ou acesso de teste ao banco da aplicação.

## Histórico identificado, serviços por hora e execução técnica — 2026-10-29

- Qualificação e oportunidades agora resolvem nome atual do autor após autorizar o pai, consultando apenas Memberships do tenant. Nome + “você” para o ator atual, usuários suspensos preservados e fallback seguro para indisponíveis. Timeline separa ação, pessoa, data/hora e justificativa. Campos do catálogo reorganizados por tipo: serviço oferece hora/valor fechado e precisão; campos físicos ficam em produtos. Troca explícita com dados físicos pede confirmação.
- Cadastro de usuários inclui supervisor, regiões e perfil Técnico. Validação transacional de tenant/empresas/regiões ativas, cobertura do supervisor, equipe inversa, controle de licença e auditoria com vínculos. Técnico não recebe carteira, preços/crédito, aprovações ou grants offline comerciais. Sem alteração/migração em massa de clientes.
- Agenda/rota técnica separada com agendamento manual de cliente aprovado + serviço + técnico, períodos sem sobreposição, check-in/out online, resultado, cancelamento/interrupção justificados e histórico. Supervisor consulta subordinados em regiões atuais; técnico vê o atribuído. Posições são pontuais/autorizadas, não localização em tempo real ou prova física. Venda/pedido, faturamento e execução técnica offline seguem nas etapas próprias.
- Modelos/índices e transações protegem um atendimento por executor e disputas com visitas comerciais/importações offline, além de bloqueio de arquivar Party durante serviço ativo. Instantes de execução vêm do servidor; interrupção não fabrica checkout.
- `npm run check`: 4 nativos, 5 fronteiras, TypeScript e 123 unitários aprovados; 31 HTTP falharam por `connect EACCES 127.0.0.1`, 55 casos MongoDB ignorados sem URI. Primeiro typecheck encontrou erros apenas nas tipagens dos novos testes de atribuição; corrigidos antes da execução aprovada de tipos/unitários. Não há aprovação integral do check.
- `npm run test:layout`: 21/21 aprovados em Chrome real, três tamanhos. Novo caso verifica serviço em horas sem peso/NCM e histórico com nomes/motivo; captura sintética conferida. Não substitui E2E das gravações.
- `npm run test:e2e -- --config playwright.local.config.ts` tentado: aguardou preview HTTP e foi interrompido sem casos executados. Coleta aprovada: 78 casos, incluindo atribuição supervisor/região e check-in/out técnico com API/GPS simulados. `npm run test:db` tentado com MongoDB temporário isolado; bloqueado por EACCES no loopback. Seis casos reais técnicos e a resolução real de nomes permanecem sem execução neste ambiente.
- Builds API/PWA aprovados separadamente; TypeScript também em comando separado. Metadados declarados: 261 nós e 322 arestas; não Graphify AST. Sem push/deploy ou acesso de testes ao banco da aplicação, .env e ERP. Documentação: `technical-work.md`, `catalog-pricing.md`, `user-administration.md`. Homologar integralmente antes da produção.

### Vigência e preparação de tabelas — 2026-10-29
TypeScript e build passaram. Catálogo: 8 testes passaram, incluindo markup versus margem, arredondamento, vigência inclusiva, datas inválidas. Check completo: 126 passaram, 31 HTTP falharam com connect EACCES 127.0.0.1, 55 Mongo ignorados. E2E iniciado com configuração local, sem executar casos ao aguardar servidor; interrompido. Fórmulas em lote preparam valores fixos; regras automáticas persistidas e custos integrados continuam pendentes.

## Etapa 1 — padronização transversal (29/10/2026)

- Implementação: estilos compartilhados, modal Master unificado, foco no título e aria-busy, recuperação compacta, menu móvel com contenção de teclado/Escape/retorno, atalho para conteúdo, ações do catálogo e remoção de paginação vazia técnica.
- TypeScript passou em npm run check; build API/web/PWA passou separadamente, após as alterações de interface.
- Check completo: 4 testes nativos e 5 limites estáticos passaram; 126 testes Vitest passaram, 31 testes HTTP falharam com connect EACCES 127.0.0.1, 55 testes MongoDB ignorados por falta da configuração isolada. Não é aprovação de isolamento real.
- Layout: execução ampliada teve 93 aprovados, 2 ignorados (drawer móvel em desktop) e uma falha no teste de teclado. Causa: a página sintética desse teste estava sem meta viewport. Corrigido o fixture; reexecução dirigida do teste móvel passou, com os 2 desktop ignorados. Total de cenários distintos validados: 94. Os 69 cenários anteriores também haviam passado antes da ampliação.
- A suíte nova monta os componentes React reais em Chrome usando esbuild e API sintética, sem HTTP local. Inclui abertura e fechamento de editores, foco e retorno, dois temas, 1366x768, 1280x600 e 393x851. Não verifica gravação/autorização real nem todas as variantes de edição.
- Inspeção de capturas sintéticas: cadastro de produto claro no desktop e agendamento técnico escuro no celular. Nenhum dado real utilizado.
- npm run test:e2e -- --config playwright.local.config.ts iniciado: aguardou o preview sem executar casos e foi interrompido. Não declarado aprovado.
- esbuild 0.28.2, já instalado, declarado diretamente para a suíte. Tentativa de atualizar lock pelo npm offline encontrou ENOTCACHED no registry; manifesto e raiz do lock foram alinhados à versão existente sem baixar pacotes. npm ls esbuild --depth=0 confirmou a instalação válida.
- Metadados declarados do grafo atualizados; não equivalem à extração AST Graphify. git diff --check sem erros.
- Checklist e sequência: docs/implementation-checklist.md. Homologação humana/dispositivos e integrações de teste continuam pendentes; próxima etapa 2: perfis e permissões. Nenhuma publicação ou alteração no ERP.

### Refinamento: botões próximos aos containers (29/10/2026)
Aumentados padding de barras/cards/seções e conteúdo de modal, gap de ações e margem acima/abaixo de botões soltos. Test:layout: 94 passaram, 2 ignorados por se aplicarem apenas a menu móvel. TypeScript, build API/web/PWA, graph:metadata (263 nós/325 arestas declarados) e diff --check passaram. Check geral: 126 Vitest passaram, 31 HTTP falharam com connect EACCES 127.0.0.1, 55 Mongo ignorados; nativos 4 e limites estáticos 5 passaram. E2E aguardou preview sem executar casos e foi interrompido. Próxima etapa permanece perfis/permissões; homologação visual humana pendente.
