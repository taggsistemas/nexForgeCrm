# Pedidos de venda e serviço (etapa 12 — 29/10/2026)

O CRM registra e acompanha o pedido fechado. As notas fiscais são emitidas pelo Financeiro no sistema próprio e lançadas no CRM para que comercial e gerência vejam o que foi faturado e o que falta faturar. O CRM não emite nota, não baixa estoque e não registra recebimentos.

## Origens

| Origem | Quem gera | Itens |
|---|---|---|
| Proposta aceita | `order:write` com acesso à oportunidade | Copiados da revisão aceita (produto, quantidade, preço, desconto). Uma proposta gera no máximo um pedido. |
| Lançamento direto | `order:write` na carteira do cliente | Itens do catálogo ativos; total de cada linha calculado no servidor. |
| OS encerrada | `order:write` na carteira do cliente | Serviço da OS com as horas faturáveis autorizadas no encerramento, ao preço de referência do serviço, mais as peças líquidas (consumo − devolução) ao preço de referência congelado. Uma OS gera no máximo um pedido; sem horas nem peças, a geração é recusada. |

O pedido é sempre de cliente com qualificação **aprovada** e respeita a carteira viva (`commercialFilter`). Pedido só com serviços é do tipo "Serviço"; os demais são "Venda". Número `PV-000001` sequencial por empresa, gerado no servidor. Itens de pedidos de proposta ou OS não podem ser editados no rascunho; condições (entrega, pagamento, prazos, observações) podem.

## Situações e aprovação

`rascunho → aguardando_aprovacao → confirmado → entregue → faturado`, com `cancelado` a partir de rascunho, aguardando ou confirmado sem nota lançada.

Ao enviar, o servidor avalia o pedido e só exige aprovação quando foge da regra:

- **Desconto**: alguma linha abaixo do preço de tabela aplicável ao cliente.
- **Pagamento**: forma ou prazo fora das condições aprovadas na qualificação do cliente.
- **Crédito**: há prazo maior que zero e o saldo em aberto do cliente (pedidos aguardando, confirmados e entregues não faturados) mais este pedido ultrapassa o limite de crédito.

Sem exceções, o pedido é confirmado no envio. Aprovação ou devolução exigem `order:approve` (Gerencial, Direção) e pessoa diferente de quem enviou; devolução e cancelamento exigem motivo. Confirmar um pedido de proposta marca a oportunidade como ganha (probabilidade 100). Todos os instantes (envio, confirmação, entrega, faturamento, cancelamento) vêm do servidor. Cada mudança grava histórico imutável com autor.

## Notas fiscais (Financeiro)

`billing:write` lança número, data de emissão e valor em pedidos confirmados ou entregues. Número de nota não se repete no pedido, a data não pode estar no futuro e a soma não pode ultrapassar o total. Quando as notas cobrem o total, o pedido passa a **faturado**. Notas lançadas impedem o cancelamento.

## Previsão de faturamento, custo e margem

- Parcelas: total dividido pelos prazos (dias corridos) contados da primeira nota ou, sem nota, da entrega prevista; a última parcela absorve o arredondamento.
- Previsão: parcelas ainda não faturadas (o valor faturado consome as primeiras parcelas).
- Custo unitário no catálogo (`cost:manage` para editar, versionado e auditado; `cost:read` para ver). O custo é congelado em cada linha no envio. A margem só aparece com `cost:read` e quando todas as linhas têm custo; sem custo completo mostra "sem custo completo", nunca uma margem inventada.

## Indicadores

A seção **Pedidos e faturamento** da Central gerencial (`order:read`) aplica a carteira do perfil, a região da propriedade ativa do cliente e o responsável da carteira: pedidos e valor confirmados no período, faturado no período (data de emissão), carteira a faturar, aguardando aprovação e entrega, previsão vencida/30/60/90/após 90 dias e, com `cost:read`, margem bruta.

## Perfis

| Perfil | Pedidos |
|---|---|
| Vendedor, Supervisor, Administrativo de vendas | Criar, editar rascunho, enviar, registrar entrega, cancelar (na carteira) |
| Gerencial | Os anteriores e aprovar/devolver; ver e editar custo |
| Direção | Consultar, aprovar/devolver; ver custo |
| Financeiro | Consultar pedidos da empresa, lançar notas, ver custo e margem |
| Auditoria | Consultar |

## API

`/api/v1/companies/:companyId/orders`: `GET /`, `POST /`, `POST /from-proposal`, `POST /from-work-order`, `GET /:id`, `PATCH /:id`, `POST /:id/{submit|approve|reject|deliver|cancel}`, `POST /:id/invoices`. Custo: `PUT /catalog/products/:id/cost`. Totais, status, número e instantes enviados pelo cliente são recusados (`strict`).

Fora do escopo: emissão fiscal, estoque/expedição, contas a receber e comissões. O fluxo de produção/separação/expedição de `commercial-roadmap.ts` continua planejado.
