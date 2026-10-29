# Catálogo e tabelas de preços

Implementação inicial em `Catálogo e preços`, com manutenção em modais e consultas em página. A validação completa com MongoDB e navegador continua necessária antes da produção; consultar `verification.md`.

## Produtos e serviços
- Código `P000001` gerado no backend por sequência atômica por tenant/empresa. Código não é aceito do navegador; rollback de auditoria desfaz a gravação e a sequência.
- SKU do fabricante, descrição, unidade de venda (pc, kg, g, l, ml, m, m2, kit, cx, serv), precisão de quantidade de zero a três casas, NCM/CEST e prazo de entrega em dias.
- Unidade simples, caixa homogênea (um componente) ou caixa/kit misto (dois a cinquenta componentes distintos). Quantidades são decimais em texto, até três casas, respeitando a precisão do componente.
- Componentes precisam ser produtos simples ativos da mesma empresa/tenant. Não há caixas aninhadas. Mudar unidade/precisão, desativar ou transformar um componente usado por caixa ativa é bloqueado.
- Peso fixo ou estimado em gramas; sinalização de peso variável exige estimativa. Peso aferido, recálculo, entrega efetiva, estoque, tributação e faturamento pertencem à etapa de pedidos. NCM/CEST são cadastro, não validação tributária.

## Preços
- Abrangências global por empresa, cliente aprovado, tipo de cliente, vendedor, região e equipe (identificada pelo supervisor).
- Prioridade por produto: **cliente → vendedor → equipe → região → tipo de cliente → global**. Item ausente usa o próximo nível. Preço zero é explícito; ausência de preço não vira zero.
- Uma tabela ativa por abrangência/destino, garantida por índice único parcial. Duas equipes com preço aplicável no mesmo nível geram `AMBIGUOUS_PRICE`, sem escolha silenciosa.
- Moeda BRL, valores inteiros em centavos. Até 500 preços por tabela. Sem descontos percentuais, datas de vigência, importação, estoque ou pedidos nesta entrega.
- Consulta de preço recebe apenas cliente/produto. O servidor autoriza o Party atual e deriva vendedor, tipo, carteira/região e supervisores ativos. Não aceita região/equipe/owner como autoridade do frontend.
- Consulta não reserva preço, saldo ou crédito; os futuros pedidos deverão revalidar tudo atomicamente no fechamento. Aprovação/regularização do cliente continua obrigatória.

## Acesso e consistência
Vendedor/supervisor consultam catálogo da empresa e preço para cliente do seu escopo atual. Administração do sistema, gerencial e administrativo de vendas mantêm catálogo e tabelas; o backend exige `catalog:manage` e visibilidade de empresa. Manutenção de tabelas não é liberada por autoridade regional inferida.

Todas as rotas usam sessão atual, bloqueios de primeiro acesso/privacidade/trial, empresa autorizada, `no-store`, Origin nas mutações, DTO estrito, versão otimista e auditoria transacional. Sequência serializa alterações do catálogo na empresa. Tabelas de outro cliente não são listadas para vendedores; a consulta retorna somente o preço escolhido para o produto autorizado.

Base `/api/v1/companies/:companyId/catalog`:
- GET/POST `/products`, GET/PATCH `/products/:id`.
- GET/POST `/tables`, PATCH `/tables/:id`.
- GET `/targets?search=&page=`: destinos administrativos autorizados, busca paginada.
- GET `/resolve?customerId=&productId=`: consulta de preço do cliente aprovado.

Testes: `tests/unit/catalog.test.ts`, `tests/integration/catalog-mongo.test.ts` e `tests/e2e/catalog-dashboard.spec.ts`. Dados sintéticos em banco temporário; não usar `.env` nem dados de clientes para testes.

Serviços também aceitam **Hora (h)**, com quantidades fracionadas conforme a precisão escolhida. Serviço exige unidade h/serv e não aceita peso, NCM/CEST ou composição física. Formulário separa identificação, cobrança/prazo e campos exclusivos de produto. Consultar technical-work.md.

## Vigência e preparação de preços
Tabelas possuem início/fim opcionais, inclusivos no calendário America/Sao_Paulo. A consulta usa o dia do servidor e ignora tabelas fora da vigência antes da prioridade/fallback. Legados sem datas continuam válidos. A restrição de uma tabela ativa por destino permanece; promoções simultâneas no mesmo destino ainda não são permitidas.
O modal oferece aplicação em lote de markup, desconto ou margem sobre os valores digitados, com arredondamento de centavos. É uma preparação explícita de valores: não uma regra persistida de custo. Margem de 25% usa base / 0,75; markup de 25% usa base * 1,25.
Evolução solicitada: custos restritos e versionados (produto/hora), regras persistidas por base/categoria/marca/fornecedor, vigências concorrentes com prioridade explícita, condições de pagamento autorizadas, simulação explicável e pisos/descontos aplicados no futuro backend de pedidos. Custo médio contábil exige integração; não é calculado pelo CRM. Não existe recalculação automática de custos nem bloqueio de desconto em pedidos neste incremento.
