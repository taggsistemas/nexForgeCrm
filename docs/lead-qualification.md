# Qualificação comercial revisada

## Entregue
Lead inicial: nome, contato principal, telefone/e-mail (ao menos um canal válido), observações e endereço opcional. DTO próprio recusa documentos, etapa qualificado, aprovação e condições comerciais neste cadastro. Campos fiscais existentes não são apagados por editar dados iniciais.

Qualificação em modal separado: dados completos, CPF/CNPJ, IE contribuinte/isento/não aplicável, endereço, tipo de cliente, limite em centavos, métodos de pagamento e prazos ordenados (0 somente para à vista; demais entre 1 e 730 dias). Limite zero não significa ilimitado. O rascunho permite pagamento ainda não selecionado; envio exige completude no servidor.

Estados: none → draft → submitted → revision OU approved. Revisão pode ser corrigida e reenviada, gerando nova submissão. Lead descartado precisa ser reativado antes do envio. A etapa do pipeline não concede aprovação.

## Acesso e análise
Permissões qualification:edit/submit nos perfis comerciais; qualification:approve em administrativo de vendas, gerencial e administrador do tenant. Vendedor e supervisor não aprovam. Todos os endpoints revalidam tenant/empresa, onboarding e Party/equipe atual. O mesmo ator que submeteu não pode aprovar, inclusive se tiver perfil administrativo. Outro usuário autorizado deve analisar.

Backend valida dados completos persistidos, situação da IE, crédito inteiro e condições de pagamento. Aprovação fixa as condições enviadas e transforma o mesmo Party em cliente atomicamente, preservando contatos e relações por ID. Crédito e pagamento não podem ser alterados pelo formulário comum de cliente. O motor de pedidos/exposição financeira ainda não existe; não presumir que o limite representa saldo conhecido do ERP.

Após envio, os formulários comuns e a qualificação ficam bloqueados, inclusive arquivamento. Devolução exige motivo de pelo menos 10 caracteres, habilita revisão e registra auditoria. Transferências reais de carteira continuam autorizadas; alteram versão e tornam a submissão antiga inválida para aprovação. Analista deve devolver e o novo responsável reenviar. Aprovação usa a versão exata da submissão e a atual enviada na ação; concorrência retorna 409.

Submissões guardam snapshot imutável montado pelo servidor, revisão e autor. CrmQualificationAudit registra rascunho/envio/devolução/aprovação. Falha de auditoria aborta a transação. Histórico mostrado no modal é limitado aos 20 últimos eventos; nomes de atores não são consultados fora do acesso.

## API
Base /api/v1/companies/:companyId/crm:
- GET /parties/:id/qualification — cadastro, última submissão e histórico, sempre no escopo atual.
- PATCH /parties/:id/qualification — versão + campos de rascunho estritamente permitidos.
- POST /parties/:id/qualification/submit — versão.
- POST /parties/:id/qualification/return — versão + reason.
- POST /parties/:id/qualification/approve — versão, nunca identidade/status fornecidos pelo cliente.

POST /customers e POST /leads/:id/convert agora recusam com QUALIFICATION_WORKFLOW_REQUIRED; não há criação direta ou conversão livre como atalho. Quem chega à lista de clientes cadastra o novo relacionamento pela aba Leads.

GET /leads e /customers aceita qualificationState, junto aos filtros existentes, com escopo antes da paginação. Tela permite filtrar rascunho, análise, revisão e aprovada. Pipeline conserva a antiga coluna qualificado como legado; novas aprovações aparecem em Clientes.

## Cadastros existentes
Sem migração em massa, sem consultar/alterar o banco real nesta entrega. Clientes antigos continuam clientes, com dados e vínculos preservados; ausência de aprovação é exibida como Legado — revisão pendente. A ação Revisar cliente legado usa o mesmo fluxo, mantendo kind customer durante regularização e o mesmo ID ao aprovar.

Nenhum dado legado recebe aprovação fictícia. Futuro módulo de pedidos deverá exigir aprovação comercial explícita e definir exceção contratual, se houver, antes de liberar venda a legado pendente. Mudança posterior de crédito/prazo de cliente já aprovado exige fluxo específico futuro; atualmente os campos financeiros aprovados ficam bloqueados.

## Limites e próximos passos
Não cria catálogo, tabela de preços, pedidos, metas ou sincronização offline. Tabelas operacionais serão vinculadas depois da entrega do motor de preços, evitando IDs ou preços fictícios. A operação offline foi entregue separadamente em offline.md, com idempotência, expiração, isolamento local e revalidação de permissões; aprovações continuam online.

