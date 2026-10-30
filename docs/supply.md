# Almoxarifado, compras, fornecedores e documentos (30/10/2026)

## Decisões
Um almoxarifado por empresa. Peças da OS movimentam o estoque no lançamento (consumo sai, devolução volta). A entrega do pedido de venda baixa os produtos. Saídas manuais nunca deixam o saldo negativo; saídas automáticas (entrega e peças da OS) podem, com alerta para regularizar. Pedido de compra só precisa de aprovação acima do limite configurado nos dados da empresa (com 0, todos precisam). O recebimento da compra atualiza o custo médio do produto. Serviços não têm estoque.

## Dados da empresa
`Configurações → Dados da empresa` (`company:manage`, Administrador): razão social, nome fantasia, CNPJ (CPF recusado), inscrições estadual e municipal, endereço, telefone, e-mail, site, logotipo, texto de rodapé dos documentos e limite de aprovação de compras. O logotipo é convertido no navegador para JPEG com fundo branco (até 600×240, ~300 KB) para entrar direto nos PDFs. Leitura para qualquer membro da empresa (os PDFs usam esses dados). Versão otimista e auditoria.

API: `GET/PUT /api/v1/companies/:companyId/supply/company-profile`.

## Fornecedores
`Suprimentos → Fornecedores` (`supplier:read`/`supplier:write`): razão social, fantasia, CPF/CNPJ válido e único na empresa, IE, contato, telefone, e-mail, endereço, condições de pagamento e observações. Inativos não recebem novos pedidos de compra. API `/supply/suppliers`.

## Almoxarifado
`Suprimentos → Almoxarifado` (`stock:read`; `stock:write` para lançamentos manuais).
- **Saldos**: por produto (serviços não entram), com filtro de negativos e, para quem vê custo (`cost:read`), custo médio e valor em estoque. Alerta no topo quando há itens negativos.
- **Movimentações**: razão imutável com data, produto, entrada/saída, quantidade, saldo após, origem (manual, compra, pedido de venda, OS) e referência (PC/PV/OS), motivo, observação e responsável.
- **Entrada/saída manual**: motivo (inventário, devolução, perda/avaria, uso interno, outro) e observação obrigatória; a saída é recusada se faltar saldo.
- **Automáticas**: entrega do pedido (cada produto sai), peça da OS (consumo sai, devolução entra) e recebimento de compra (entra pelo custo do pedido). Cada movimento automático tem chave única de origem, então uma repetição nunca baixa duas vezes. Tudo na mesma transação do evento de origem.

API: `GET /supply/stock?filter=all|stocked|negative&search`, `GET /supply/stock/movements?productId&source`, `POST /supply/stock/movements`.

## Compras
`Suprimentos → Compras` (`purchase:read`/`purchase:write`; `purchase:approve` para aprovar).
`rascunho → aguardando aprovação → aprovado → enviado → recebido parcial → recebido`, ou `cancelado` antes de qualquer recebimento.
- Itens do catálogo (produtos e serviços); totais e número PC-000001 calculados no servidor; custo do catálogo sugerido na tela para quem vê custo.
- Envio: até o limite da empresa é aprovado na hora; acima, Gerencial ou Direção aprovam (quem enviou não aprova). Devolução e cancelamento com motivo.
- "Marcar como enviado" registra o envio do PDF ao fornecedor.
- Recebimento total ou parcial por item, sem passar do pendente; produtos entram no almoxarifado e atualizam o custo médio ponderado (versionado e auditado no catálogo como `product.cost_updated`).

API: `/supply/purchases`, `/supply/purchases/:id`, `POST /supply/purchases/:id/{submit|approve|reject|send|cancel|receive}`.

## PDFs
Botão **Baixar PDF** no pedido de venda/serviço, no pedido de compra e na OS. O arquivo é gerado no navegador (`packages/contracts/src/pdf.ts`, sem dependência externa: A4, Helvetica com acentos, JPEG) com os mesmos dados da tela, e cada página traz o cabeçalho com logotipo, razão social, CNPJ/IE, endereço e contatos da empresa, número e situação do documento, e o rodapé com o texto da empresa e "Página X de Y".
- **Pedido de venda**: cliente (nome, razão social, CPF/CNPJ, IE, endereço, contatos), itens, total, parcelas, notas fiscais lançadas e observações. Custo e margem nunca são impressos.
- **Pedido de compra**: fornecedor e local de entrega (empresa), itens, total, condição de pagamento e aprovação.
- **OS**: cliente, propriedade e equipamento, técnico, horários de check-in/out, horas trabalhadas, deslocamento e faturáveis, descrição, diagnóstico, solução e peças líquidas.

## Perfis
Novo perfil **Almoxarifado e compras** (estoque, compras e fornecedores; lê catálogo, custo e pedidos). Gerencial: tudo, inclusive aprovar compras. Direção: consulta e aprova compras. Financeiro e Auditoria: consulta. Vendedores, supervisores, administrativo de vendas, coordenação e técnicos: consultam saldos.

Fora do escopo: vários locais/transferências, lotes e números de série, reservas por pedido, inventário cíclico, emissão fiscal, contas a pagar e explosão de kits em componentes (o kit é estocado como item próprio).

### Ajuste de 30/10/2026
No pedido de compra, o campo **Incluir item** aceita digitar código, descrição ou SKU e mostra a lista filtrada do catálogo para escolher com o mouse ou com as setas + Enter (Enter sozinho escolhe o primeiro resultado).
