# Oportunidades comerciais e atividades vinculadas

## Escopo entregue
O menu Oportunidades permite cadastrar, pesquisar, filtrar por etapa, editar negociações abertas e encerrar como ganha ou perdida. Cadastros, edição e encerramento são modais. Cada oportunidade registra título, lead qualificado ou cliente vinculado, valor estimado em centavos (BRL), fechamento previsto como data de calendário e anotações.

Etapas abertas: descoberta, proposta e negociação. Ganho/perda são terminais neste incremento, com data de encerramento atribuída pelo servidor. Perda exige motivo. Não há reabertura nem exclusão. Ganho não cria pedido, receita, comissão ou integração ERP automaticamente. Valores estimados não substituem catálogo, tabelas de preços ou propostas formais.

## Propriedade e segurança
O lead/cliente é dono da carteira. Oportunidades não aceitam ownerId e acompanham o responsável atual do vínculo, inclusive depois de transferência. Não existe cópia de ownerId que possa manter acesso do vendedor anterior.

Cada operação verifica sessão, tenant, empresa, permissão e vínculo ativo acessível. Leituras exigem pipeline:read; alterações pipeline:write. Atividades exigem activity:read/write e leitura do pipeline. Também é necessária leitura de lead/customer conforme o tipo do vínculo. O lookup de listagem usa filtro autorizado do cadastro pai, com ObjectIds convertidos pela camada Mongoose antes da agregação. Contagem, paginação e pesquisa são aplicadas após a autorização do vínculo. Texto de pesquisa é escapado como literal.

Criar oportunidade em lead exige qualificação completa no backend. Clientes são aceitos conforme seu cadastro existente. Cadastro pai arquivado deixa de aparecer e retira acesso às oportunidades, atividades e histórico associados, preservando a persistência. Os contratos aceitam campos explícitos; tenant, empresa, moeda, responsável, timestamps e campos internos não vêm do formulário.

Escritas usam transações e versão otimista. Um contador interno no cadastro pai provoca conflito com transferência/arquivamento simultâneo; a transação repetida revalida o acesso. Novo registro de atividade também toca o contador interno da oportunidade para serializar com seu encerramento. A aplicação precisa de MongoDB replica set, como os outros módulos transacionais.

## Atividades e histórico
O modal Atividades e histórico permite criar ligação, e-mail, reunião ou tarefa com título, prazo e anotações. Prazo é informado no horário local do navegador, transportado como ISO com fuso e armazenado em UTC. Status: pendente, concluída ou cancelada; a data de conclusão é definida pelo servidor. Atividades existentes podem ser finalizadas ou canceladas após fechamento; novas atividades são recusadas em oportunidades encerradas. O cancelamento não elimina o registro. Pendências vencidas recebem indicação de atraso.

Atividades seguem a carteira atual da oportunidade. Não há designação independente neste incremento. Cada lista tem paginação de 20 itens. Histórico registra criação, edição, mudança de etapa e alterações de atividades, com ator e data. Transições incluem etapa anterior e nova. A interface identifica o próprio ator como Você e outros como Usuário autorizado; actorId permanece na auditoria interna, sem expor cadastros de usuários sem autorização.

## API
Base: /api/v1/companies/:companyId/opportunities
- GET / e POST /: listar/criar.
- GET /references: até 30 vínculos qualificados/clientes pesquisados por nome.
- GET /:id e PATCH /:id: detalhes/alterar ou encerrar.
- GET /:id/history: histórico paginado.
- GET /:id/activities e POST /:id/activities: listar/criar atividades.
- PATCH /:id/activities/:activityId: alterar atividade com versão.
- GET /settings e PUT /settings: funil da empresa (leitura com pipeline:read; alteração com list:manage e versão).
- GET/POST /:id/proposals, PATCH /:id/proposals/:proposalId, GET /:id/proposals/:proposalId/revisions e POST /:id/proposals/:proposalId/{send,revise,accept,refuse,cancel}: propostas (proposal:read/proposal:write).

GET / aceita page, search e stage. Alterações exigem Origin exata, cookie de sessão e DTO estrito. Erros de versão retornam 409; referência fora do acesso retorna 404; regra de encerramento retorna OPPORTUNITY_RULE_REJECTED (400). Leads incompletos retornam LEAD_QUALIFICATION_REQUIRED (400). Sem campos internos ou tokens nos erros.

## Limites e próximos incrementos
Agenda geral com calendário, recorrências, notificações, planejamento de visitas e operação comercial offline permanecem pendentes. Não há envio automático de e-mails de atividade. Pipeline de leads permanece no menu Pipeline comercial; negociações ficam em Oportunidades. Metas e forecast consolidado ainda não são calculados.

## Vínculos, funil e propostas (etapa 6 — 29/10/2026)

- **Vínculos.** Oportunidade pode indicar propriedade e equipamento do mesmo cliente (o equipamento precisa estar na propriedade; informar só o equipamento preenche a propriedade) e origem da lista configurável. Vínculos novos exigem registros ativos; os já gravados permanecem se arquivados depois e aparecem marcados. Erros retornam INVALID_REFERENCE (400).
- **Funil configurável.** As fases continuam fixas (Descoberta, Proposta, Negociação, Ganha, Perdida) porque agenda, histórico e regras de encerramento dependem delas. Cada empresa configura o nome exibido e a probabilidade padrão das três fases abertas. Criar fases adicionais fica para evolução futura.
- **Probabilidade e previsão.** Inteiro de 0 a 100. Sem valor informado, vale o padrão da fase ao criar ou ao mudar de fase; Ganha grava 100 e Perdida 0 no servidor, ignorando o enviado. A previsão ponderada (valor × probabilidade) é apenas previsão, nunca receita. Oportunidades antigas assumem 10% até serem editadas.
- **Propostas.** Numeração PR-000001 por empresa (sequência atômica). Itens apenas do catálogo ativo, com quantidade respeitando as casas decimais do produto, preço unitário e desconto em centavos; código, descrição e unidade ficam congelados no item. O servidor calcula linhas e total e registra o preço de referência das tabelas de preço quando o cliente é aprovado; o navegador nunca envia totais, número, situação ou preço de referência.
- **Revisões e situação.** Rascunho editável → Enviada (revisão congelada, data do servidor) → Aceita, Recusada (motivo obrigatório) ou Cancelada. Enviada ou Recusada pode gerar nova revisão. Aceite exige validade vigente e só uma proposta aceita por oportunidade. Validade vencida aparece como "vencida" sem alterar a situação gravada.
- **Regras de acesso.** Propostas seguem a oportunidade e o cliente atual (transferência muda quem pode alterar). Escrita só com oportunidade aberta; ganha ou perdida torna as propostas somente leitura. Cada escrita serializa na oportunidade, então envio/aceite concorrentes ou encerramento simultâneo geram conflito. Eventos de proposta entram no histórico comercial.
- **Fora do escopo.** Aceite não gera pedido, faturamento ou receita e não altera o valor da oportunidade; marcar Ganha continua explícito. PDF, alçadas de desconto e aprovação interna (proposal:approve) ficam para a fase P1.
