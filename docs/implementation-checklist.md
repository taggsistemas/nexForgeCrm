# Plano de programação e checklist — NexForge CRM

Atualização: 29/10/2026. Referência: requisitos funcionais v1.0 recebidos do cliente, identificados como NexForge Agro; produto permanece NexForge CRM. Execução inicial com entrada manual de dados. Importações e integrações externas ficam para evolução posterior, sem declarar o RF-CAD-006 original atendido.

## Etapas

| Etapa | Situação | Entregas |
| --- | --- | --- |
| 1. Padronizar telas e modais | Implementada; homologação de uso pendente | Padrão visual compartilhado, navegação, formulários, listas, feedback e responsividade |
| 2. Completar perfis e permissões | Implementada; homologação de uso pendente | Direção (aprovações), Coordenação Técnica, Auditoria e matriz de ações/escopos |
| 3. Evoluir clientes e contatos | Implementada; homologação de uso pendente | Documento único no grupo, listas configuráveis, próxima ação, responsável técnico, papéis/consentimento e ficha com histórico |
| 4. Propriedades/locais | Implementada; homologação de uso pendente | Vários locais por cliente e vínculos autorizados |
| 5. Parque instalado | Implementada; homologação de uso pendente | Equipamentos, série, instalação, garantia e histórico |
| 6. Oportunidades e propostas | Implementada; homologação de uso pendente | Vínculos com local/equipamento e proposta versionada com itens/validade/status |
| 7. Agenda e visitas | Implementada; homologação de uso pendente | Adaptar ao local/equipamento e uniformizar filtros |
| 8. Chamados e triagem | Implementada; homologação de uso pendente | Criticidade, primeiro retorno, prazo pactuado, distribuição e escalonamento |
| 9. OS básica | Implementada; homologação de uso pendente | Diagnóstico, execução, horas apontadas, deslocamento, solução e reincidência |
| 10. Peças utilizadas | Implementada; homologação de uso pendente | Consumo/devolução documentados na OS, inicialmente sem baixa automática |
| 11. Dashboards | Próxima | Visões por perfil e indicadores territoriais comerciais/técnicos |
| 12. Homologação e piloto | Pendente | Aceites, testes integrados, dispositivos, exportação e restauração demonstrada |

## Etapa 1 — checklist de implementação

- [x] Consolidar aparência de botões, inputs, selects, textareas, seções e filtros no estilo compartilhado.
- [x] Aplicar temas claro/escuro e feedback de erro/sucesso com texto, sem depender apenas de cor.
- [x] Uniformizar listas e tabelas, preservando rolagem horizontal local em tabelas extensas no celular.
- [x] Compartilhar o mesmo modal também no cadastro de empresa do painel Master.
- [x] Preservar cabeçalho do modal e uma área principal de rolagem interna; bloquear fundo.
- [x] Iniciar foco no título do diálogo; manter contenção nativa, Escape quando permitido e retorno ao disparador.
- [x] Oferecer largura compacta para recuperação de acesso; manter largura ampla para cadastros.
- [x] Acrescentar acesso direto por teclado ao conteúdo principal.
- [x] Melhorar menu móvel: ícone legível, fundo de fechamento, Escape, ciclo de foco e retorno ao botão.
- [x] Ajustar checkboxes para não herdarem dimensões de inputs de texto.
- [x] Retirar paginação vazia dos seletores de atendimento técnico.
- [x] Padronizar ações de cancelar/salvar no catálogo.
- [x] Acrescentar testes com componentes React montados, API sintética, dois temas e três tamanhos de tela.
- [ ] Homologar visual e uso com Giovanni e usuários do piloto em aparelhos físicos.
- [ ] Executar integralmente os testes HTTP/MongoDB/E2E em ambiente com conexão local disponível.

### Cobertura e limites

Estilos compartilhados alcançam dashboard/pipeline, relacionamento/qualificação, oportunidades, agenda, carteiras, catálogo/preços, campo, técnico, offline, segurança, usuários e Master. A suíte nova monta telas reais de relacionamento, oportunidades, agenda, catálogo, técnico, campo, carteiras, usuários, entrada offline, login e Master público/autenticado. Abre os editores iniciais de leads, oportunidades, agenda, catálogo, agendamento técnico, usuários e empresa. Não simula todas as variações de edição, dados volumosos ou operações financeiras. Os testes existentes cobrem geometria de qualificação extensa, histórico, serviços por hora, dashboard e diálogo aninhado.

Testes visuais utilizam dados sintéticos e API simulada. Não comprovam autorização, persistência ou integridade MongoDB. Rolagem em formulários longos é preservada para não esconder conteúdo. A proteção de rascunhos contra fechamento acidental não foi generalizada nesta etapa; manter como refinamento de UX com critérios próprios.

## Etapa 2 — perfis e permissões

Decisões de Giovanni (29/10/2026): somente a Coordenação Técnica distribui atendimentos; a Direção consulta dados financeiros e aprova; um perfil por usuário; CPF/CNPJ único no grupo (tenant), com várias propriedades por documento; território pertence à propriedade (etapas 3 e 4).

- [x] Inventariar permissões efetivas atuais por endpoint e domínio (user-administration.md).
- [x] Especificar matriz para Administrador, Direção, Gerencial, Administrativo de vendas, Supervisor, Vendedor, Coordenação Técnica, Técnico e Auditoria.
- [x] Separar gestão técnica de atribuições comerciais; Gerencial e Administrativo de vendas não distribuem atendimentos.
- [x] Direção aprova qualificação/propostas/pedidos e lê condições financeiras, sem criar ou editar registros operacionais.
- [x] Perfil Auditoria somente leitura, sem comissões/metas/forecast e sem pacote offline.
- [x] Nova permissão `qualification:read` para abrir a ficha sem editar; auditoria de qualificação não depende de edição.
- [x] Pacote offline exige `activity:write` no backend e no menu.
- [x] Aplicar empresa/território/equipe/atribuição no backend sem confiar em filtros enviados pelo navegador.
- [x] Preservar qualificação, crédito, carteira comercial e atribuições técnicas existentes.
- [x] Adaptar cadastro de usuário e navegação aos perfis (perfis e descrições vêm do backend; botões de qualificação/atalhos respeitam leitura × edição).
- [x] Testar acesso cruzado, mudança de vínculo e usuários suspensos (técnico/coordenação, relacionamento com Direção/Auditoria).
- [x] Corrigir falhas encontradas na primeira execução real MongoDB: contagem de perfis no teste de plataforma; default literal em campo imutável e `__v` em subdocumentos de posição/auditoria quebravam recarga e rollback de atendimentos técnicos.
- [ ] Financeiro e Estoque: definir com os respectivos módulos.
- [ ] Homologar perfis com usuários reais do piloto.

## Etapa 3 — clientes e contatos

Decisão de Giovanni (29/10/2026): cada cliente pertence a uma única empresa do grupo; o CPF/CNPJ ativo é único no grupo inteiro.

- [x] CPF/CNPJ único no grupo (tenant): verificação no serviço antes de gravar e índice `tenant_tax_id_unique`; resposta 409 sem revelar o cadastro existente; arquivar libera o documento.
- [x] Comando `npm run db:tax-ids` lista duplicados existentes só por ID interno; `-- --apply` cria o índice por grupo e remove o antigo apenas sem duplicados. A API inicia com aviso se houver pendência.
- [x] Origem, segmento, classificação e potencial em listas configuráveis por empresa, com valores iniciais, renomear/desativar e preservação de opções inativas já usadas.
- [x] Permissão `list:manage` para Administrador, Gerencial e Administrativo de vendas.
- [x] Próxima ação (data e descrição) em leads e clientes; cadastro inicial de lead continua mínimo.
- [x] Responsável técnico em clientes, restrito a Técnico/Coordenação Técnica ativos da empresa, sem conceder acesso comercial.
- [x] Papéis, canal preferido e autorização de comunicação dos contatos, com data e autor gravados pelo servidor.
- [x] Histórico com antes/depois de nome, documento, IE, responsáveis, classificação e tipo; inclui contatos e qualificação, com nomes resolvidos no tenant.
- [x] Ficha do cliente em abas (Resumo, Contatos, Histórico), preservando qualificação/aprovação e edição nos modais existentes.
- [x] Testes: 5 cenários MongoDB novos, 4 unitários novos e cenário de layout da ficha em três tamanhos.
- [x] Verificação completa: check (168 Vitest), MongoDB 63/63, layout 106 aprovados e 2 ignorados, E2E 78/78.
- [ ] Executar `npm run db:tax-ids` no banco real antes de publicar.
- [ ] Homologar listas iniciais e ficha com usuários do piloto.

## Etapa 4 — propriedades e locais de atendimento

- [x] Vários locais por cliente ou lead, com nome único entre os ativos do cliente, endereço/município, território, contatos e coordenadas opcionais.
- [x] Território como Região da própria propriedade (Castro/Carambeí), independente da carteira; região ativa da mesma empresa para novas atribuições.
- [x] Autorização sempre pelo cliente atual (sem responsável copiado); transferência e arquivamento do cliente refletem nas propriedades.
- [x] Contatos vinculados restritos aos contatos ativos do mesmo cliente.
- [x] Coordenadas digitadas, limitadas e arredondadas; não usam o GPS do aparelho nem comprovam presença.
- [x] Versão otimista, auditoria e eventos no histórico da ficha com nome do território.
- [x] Aba Propriedades na ficha e modal de edição aninhado; corrigido Esc em modais aninhados (fechava também a ficha).
- [x] Testes: 3 cenários MongoDB, 3 unitários e cenário de layout em três tamanhos.
- [x] Verificação completa: check (171 Vitest), MongoDB 66/66, layout 109 aprovados e 2 ignorados, E2E 78/78.
- [ ] Usar o território da propriedade na fila da Coordenação Técnica (etapa 8, chamados).
- [ ] Homologar com usuários do piloto.

## Etapa 5 — parque instalado

- [x] Equipamento por propriedade ativa do mesmo cliente: marca, modelo, categoria configurável, série, situação, instalação, garantia, fornecedor/assistência e observações.
- [x] Série única por empresa entre equipamentos ativos, sem diferenciar maiúsculas, espaços e separadores; índice `company_serial_unique`; 409 sem revelar o cliente.
- [x] Autorização pelo cliente atual; mover entre propriedades com versão; propriedade com equipamento ativo não pode ser arquivada; arquivar cliente arquiva equipamentos.
- [x] Linha do tempo do equipamento com nomes resolvidos; eventos também no histórico da ficha.
- [x] Aba Equipamentos na ficha com filtro por propriedade, modal de cadastro e modal de linha do tempo.
- [x] Listas configuráveis passam a ser semeadas por tipo (empresas existentes recebem a nova lista).
- [x] Testes: 3 cenários MongoDB, 3 unitários e cenário de layout em três tamanhos.
- [x] Verificação completa: check (174 Vitest), MongoDB 69/69, layout 112 aprovados e 2 ignorados, E2E 78/78.
- [ ] Anexos, alertas de garantia e manutenção prevista (RF-EQP-004/005, fase P1).
- [ ] Homologar com usuários do piloto.

## Etapa 6 — oportunidades e propostas

- [x] Oportunidade vinculada a propriedade e equipamento do mesmo cliente (equipamento na propriedade escolhida) e à origem configurável.
- [x] Funil configurável: nomes e probabilidades padrão das fases abertas por empresa (`list:manage`); fases continuam fixas.
- [x] Probabilidade 0–100 com padrão da fase; Ganha = 100% e Perdida = 0% definidos pelo servidor; previsão ponderada apenas como previsão.
- [x] Propostas numeradas por empresa, itens do catálogo com quantidade decimal, preço e desconto; totais calculados no servidor; preço de referência das tabelas.
- [x] Revisões congeladas no envio; aceite, recusa com motivo e cancelamento com datas do servidor; uma proposta aceita por oportunidade; vencimento sinalizado.
- [x] Propostas seguem a oportunidade e o cliente atual; somente leitura após encerramento; histórico comercial com eventos de proposta.
- [x] Proposta não gera pedido nem receita; ganho continua explícito.
- [x] Itens da proposta viram cartões empilhados no celular.
- [x] Testes: 4 cenários MongoDB (incluindo envio concorrente e transferência), 4 unitários, E2E de proposta em desktop e celular.
- [x] Verificação completa: check (178 Vitest), MongoDB 73/73, layout 112 aprovados e 2 ignorados, E2E 80/80.
- [ ] PDF, alçadas de desconto e aprovação interna (RF-CRM-006/007, fase P1).
- [ ] Homologar com usuários do piloto.

## Etapa 7 — agenda e visitas

- [x] Propriedade e equipamento do mesmo cliente nas atividades diretas; atividades de oportunidade usam o local da oportunidade.
- [x] Objetivo nas atividades (e nos planos publicados); resultado e próxima ação ao atualizar; visitas em campo mantêm resultado no checkout.
- [x] Filtro por território (Região da propriedade) na agenda e no roteiro diário, junto de responsável e período.
- [x] Histórico de atendimentos por cliente, propriedade e equipamento, com resultado da visita: aba Atendimentos na ficha e seção na linha do tempo do equipamento.
- [x] Testes: 3 cenários MongoDB, 3 unitários e cenário de layout em três tamanhos; E2E de agenda/campo mantidos.
- [x] Verificação completa: check (181 Vitest), MongoDB 76/76, layout 115 aprovados e 2 ignorados, E2E 80/80.
- [ ] Mapa e sugestão de rotas (RF-VIS-004/005, fases P1/P2).
- [ ] Homologar com usuários do piloto.

## Etapa 8 — chamados e triagem

- [x] Abertura manual por cliente, propriedade (obrigatória) e equipamento, com origem, criticidade, título e descrição; numeração CH por empresa.
- [x] Criticidade crítico/alto/programado ordenando a fila, nomes configuráveis por empresa.
- [x] Primeiro retorno, prazo pactuado (caso a caso, sem SLA automático), responsável, designação e escalonamento com histórico imutável de designações.
- [x] Resolver exige solução; cancelar exige motivo; encerrados somente leitura; reincidência ligada a chamado resolvido do mesmo cliente.
- [x] Tempos de resposta e solução e prazo vencido calculados com instantes do servidor.
- [x] Fila por perfil: empresa, território da Coordenação (região da propriedade), carteira comercial ou técnico designado; só Coordenação/Administrador triam.
- [x] Cliente com chamado aberto não pode ser arquivado; chamados na linha do tempo do equipamento.
- [x] Módulo Chamados com contadores por criticidade, filtros, modais de abertura, triagem e configuração.
- [x] Testes: 4 cenários MongoDB, 4 unitários, E2E em desktop e celular.
- [x] Verificação completa: check (185 Vitest), MongoDB 80/80, layout 115 aprovados e 2 ignorados, E2E 82/82.
- [ ] Alertas de chamados sem retorno/atrasados (RF-CHA-005, fase P1).
- [ ] Homologar com usuários do piloto.

## Etapa 9 — OS básica

- [x] OS numerada a partir de chamado (local herdado) ou de manutenção programada (propriedade obrigatória, equipamento opcional).
- [x] Território da OS pela região da propriedade; técnico e coordenação limitados ao território e à equipe.
- [x] Quatro registros separados: atendimento (servidor), horas trabalhadas, deslocamento (min/km) e horas faturáveis autorizadas no encerramento.
- [x] Conclusão pelo técnico atribuído com diagnóstico, solução e horas; encerramento só pela Coordenação/Administrador.
- [x] Retorno pela mesma falha ligado à OS original; chamado não é resolvido com OS aberta; OS no detalhe do chamado e na linha do tempo do equipamento.
- [x] Tela técnica reescrita (legível) com Nova OS, conclusão e encerramento.
- [x] Testes: 3 cenários MongoDB novos e suíte técnica adaptada, 3 unitários novos, E2E técnico e de layout ajustados.
- [x] Verificação completa: check (188 Vitest), MongoDB 83/83, layout 115 aprovados e 2 ignorados, E2E 82/82.
- [ ] Evidências, fotos, checklist, assinatura e PDF da OS (RF-OS-005/006, fase P1).
- [ ] Homologar com usuários do piloto.

## Etapa 10 — peças utilizadas

- [x] Lançamentos imutáveis de consumo e devolução de produtos ativos do catálogo, nas casas decimais do produto; saldo por peça sem ponto flutuante.
- [x] Devolução limitada ao saldo; lançamentos concorrentes serializados por OS.
- [x] Técnico atribuído (durante/após execução) e coordenação lançam até o encerramento; depois, somente leitura.
- [x] Preço de referência congelado no servidor e exibido só a quem tem `catalog:read`; sem baixa de estoque nem cobrança.
- [x] Peças no detalhe da OS (resumo e lançamentos), no chamado e na linha do tempo do equipamento.
- [x] Testes: 3 cenários MongoDB, 2 unitários e E2E em desktop e celular.
- [x] Verificação completa: check (190 Vitest), MongoDB 86/86, layout 115 aprovados e 2 ignorados, E2E 84/84.
- [ ] Estoque, reservas e custos (RF-EST, fase P1).
- [ ] Homologar com usuários do piloto.

## Próxima etapa — 11. Dashboards

- [ ] Visões comercial, técnica e gerencial com filtros padronizados (território, responsável, período).
- [ ] Indicadores: carteira, próximas ações, visitas, oportunidades, propostas, chamados críticos, tempo de resposta, OS e reincidência, com definições documentadas.
- [ ] Respeitar o escopo de cada perfil antes dos totais; exportação CSV.

### Ajuste após revisão da etapa 1
- [x] Aumentar o respiro dos botões em barras, cards, seções e rodapés de modais, mantendo tamanhos de toque e rolagem organizada.
- Próxima etapa permanece: 2. Perfis e permissões.
