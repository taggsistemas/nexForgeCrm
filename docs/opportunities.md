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

GET / aceita page, search e stage. Alterações exigem Origin exata, cookie de sessão e DTO estrito. Erros de versão retornam 409; referência fora do acesso retorna 404; regra de encerramento retorna OPPORTUNITY_RULE_REJECTED (400). Leads incompletos retornam LEAD_QUALIFICATION_REQUIRED (400). Sem campos internos ou tokens nos erros.

## Limites e próximos incrementos
Agenda geral com calendário, recorrências, notificações, planejamento de visitas e operação comercial offline permanecem pendentes. Não há envio automático de e-mails de atividade. Pipeline de leads permanece no menu Pipeline comercial; negociações ficam em Oportunidades. Metas e forecast consolidado ainda não são calculados.
