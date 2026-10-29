# Escopo comercial incorporado — CRM

Estado atual: catálogo e tabelas de preços têm implementação própria em [catalog-pricing.md](catalog-pricing.md), com validação completa ainda pendente. Pedidos de venda e serviço operacionais desde a etapa 12 ([orders.md](orders.md)); produção, separação e expedição continuam futuras. Ajustes de dashboard, qualificação e offline: [usability-review.md](usability-review.md). As seções abaixo incluem registros históricos.

## Padrão obrigatório de interface
- Cadastros e edições em modais: usuários, leads, clientes, contatos e novos domínios.
- Listas, filtros e busca podem ficar na página; formulários de criação/edição não.
- O modal mantém foco, título acessível, cancelamento e bloqueio de fechamento durante gravação.
- Login continua em tela própria; troca de senha, recuperação e aceite usam modais.

## Incremento atual: relacionamento e ciclo da conta
- Leads e clientes compartilham identidade comercial, preservada na conversão de lead.
- Contatos pertencem a um lead ou cliente, na mesma empresa, tenant e responsável.
- Busca paginada, responsável, telefone, e-mail, CPF/CNPJ, IE, endereço por CEP, tipo de cliente e anotações.
- Tipos de cliente: atacado, varejo e outro. Essa classificação servirá às futuras tabelas.
- Supervisor vê registros próprios e de vendedores ativos da equipe; vendedor vê os próprios;
  gerencial e administrativo de vendas respeitam as empresas autorizadas.
- Mudança de responsável é validada no servidor e acompanha os contatos na mesma transação.
- Edição usa versão para recusar gravações antigas; arquivamento não é eliminação LGPD.
- Senha definida por administrador é temporária. A troca é obrigatória antes de APIs de negócio.
- Redefinição por e-mail com token aleatório de uso único e expiração, hash no banco,
  resposta genérica, fila persistente com tentativas e revogação de sessões.
- Aceite versionado dos termos/aviso registra usuário, tenant, horário e hash do documento.

## Pedidos — próxima etapa comercial
Status: orçamento, aprovado, cancelado, produção/separação, expedição e despachado.
Os identificadores estão em packages/contracts/src/commercial-roadmap.ts.

Fluxo proposto:
orçamento → aprovado → produção/separação → expedição → despachado.
Cancelamento deve exigir permissão e motivo. Após aprovação/baixa/reserva,
eventuais efeitos de estoque, financeiro e ERP exigem compensação e auditoria.
Pedido despachado não deve ser simplesmente reclassificado como cancelado:
será necessário um fluxo de devolução/reversão próprio.

O backend valida transições, escopo, permissões, preços, descontos e totais.
Aprovações seguem permissões gerenciais; o frontend não fornece status válido por si só.
Após aprovação, valores e regras aplicadas devem ser preservados como snapshot/versionados.
ERP é integração opcional por contrato/eventos, sem escrita direta no banco do ERP.
Estes fluxos de produção/expedição continuam no escopo futuro; o pedido operacional da etapa 12 usa as situações rascunho, aguardando aprovação, confirmado, entregue, faturado e cancelado.

## Tabelas de preços — próxima etapa comercial
Abrangências requeridas: global do tenant, por cliente, por tipo de cliente
(atacado/varejo), por vendedor, por região e por equipe.
“Global” nunca significa compartilhar preços entre tenants.

Cada tabela deverá definir empresas abrangidas, moeda, vigência, revisão,
itens de produto/serviço, regras de desconto e permissões de manutenção.
Vínculos devem pertencer ao mesmo tenant e ser válidos na empresa da operação.
O servidor resolve a tabela aplicável e recalcula todos os valores do pedido.

Proposta inicial de precedência, a confirmar antes de implementar:
cliente > tipo de cliente > vendedor > equipe > região > global.
Não misturar preços de várias tabelas silenciosamente. Empates e ausência de
preço precisam de regra explícita, sem escolher documento pela ordem do MongoDB.
Valores monetários serão representados em centavos (ou precisão decimal definida),
com arredondamento controlado; não confiar em totais enviados pelo navegador.

A aplicação desta tabela depende dos cadastros de catálogo, regiões, equipes e
aprovação comercial. Neste incremento só a classificação do cliente e os contratos
de escopo foram preparados; não há cálculo de preços fictício nem pedido operacional.

## Revisão que substitui o fluxo comercial inicial
Consulte [commercial-rules-review.md](commercial-rules-review.md). Qualificação direta pelo vendedor e conversão manual descritas nos incrementos iniciais não atendem ao novo requisito de análise administrativa. Antes do offline, implementar submissão, devolução para revisão e aprovação/conversão atômica, com crédito e condições de pagamento. Catálogo também deve cobrir código automático, SKU do fabricante, unidades, caixas/kits e peso variável. Metas globais serão mantidas pelo administrativo de vendas, com desdobramento regional/equipe pelo supervisor. Essas regras novas estão especificadas, ainda não implementadas.

## Correções implementadas: qualificação revisada
O fluxo direto anterior foi substituído por rascunho, envio à análise, devolução e aprovação por outro usuário autorizado, com conversão automática. Crédito/pagamento e situação da IE entram na qualificação. Clientes existentes não são migrados nem aprovados automaticamente; podem ser regularizados pelo mesmo fluxo. Ver lead-qualification.md. Offline e os demais domínios continuam futuros.
