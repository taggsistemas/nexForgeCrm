# Integração futura CRM / ERP
Integração opcional por HTTP e eventos versionados. Nunca compartilhar banco,
models internos, sessões ou segredos.

CRM governa leads, contatos, oportunidades, visitas, propostas e pedido comercial.
ERP governa aceite operacional, faturamento, estoque e situação financeira.
Catálogo e clientes sincronizados exigem autoridade explícita por campo.
Pedidos não são faturados nem baixam estoque dentro do CRM.

Envelope inicial: IntegrationEvent em packages/contracts.
Tipos planejados: customer.created.v1, proposal.approved.v1, order.submitted.v1,
product.updated.v1, price.updated.v1, order.accepted.v1, order.rejected.v1,
order.invoiced.v1. São rascunhos, não endpoints ou eventos implementados.

Outbox transacional, inbox idempotente, tentativas com atraso, quarentena,
assinatura de webhook, validade temporal e reconciliação.
tenantRef/companyRef são mapeamentos externos, não autorização.
Contratos HTTP OpenAPI e eventos AsyncAPI/JSON Schema serão publicados após
definição dos payloads e testes de compatibilidade, sem modificar o ERP nesta fase.