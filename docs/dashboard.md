# Dashboard inicial

A tela inicial prioriza leitura e próxima ação, com números autorizados pelo backend da empresa selecionada.

1. **Precisa de atenção:** análises enviadas, devoluções para corrigir e clientes legados a regularizar. A orientação muda conforme a permissão de aprovação. O realce sinaliza contagens positivas, com texto explicativo além da cor.
2. **Seu acompanhamento comercial:** novos leads, em contato e clientes aprovados. Cada indicador informa o que conta e abre lista/busca em modal. São situações atuais, sem recorte de período; pendências e etapas podem se sobrepor, portanto não há soma nem taxa de conversão inventada.
3. **Acessos rápidos:** leads/contatos, agenda, negociações e catálogo, conforme as permissões. Levam aos módulos existentes; não presumem autorização nem criam registros.

Empresa e horário da última atualização ficam visíveis. Atualização a cada 15 segundos e ao retornar à janela. Falha de consulta informa que os números estão desatualizados ou indisponíveis, em vez de mostrar zero como se fosse um resultado confirmado. Trocar empresa limpa os indicadores anteriores e fecha o detalhe selecionado. “Sem pendências” aparece apenas depois de consulta bem-sucedida e refere-se às pendências de qualificação deste painel.

Textos de ajuda ficam recolhidos. Desktop usa duas fileiras de três indicadores; no celular os cartões se reorganizam sem rolagem horizontal. Nenhum gráfico ou número de vendas, tendência ou meta fictício foi adicionado.

Testes: cenário do componente Dashboard real em `tests/layout/compact.spec.ts`, além do fluxo com API simulada em `tests/e2e/catalog-dashboard.spec.ts`. O teste de layout usa renderização inicial e verifica hierarquia/atalhos/limites de tela; não executa a busca no backend.

## Gráficos e cards conforme referência visual

A tela inicial combina cards compactos, um destaque escuro para clientes aprovados, cor roxa nos indicadores e gráficos, barras mensais e um gráfico semicircular. Os temas claro e escuro continuam disponíveis. Pendências ficam na coluna lateral no desktop e os painéis se reorganizam no celular.

- `GET /api/v1/companies/:companyId/crm/dashboard`: sessão atual e `company:read`; o serviço inclui somente kinds permitidos por `lead:read`/`customer:read`, tenant, empresa autorizada, registros ativos e owner/equipe atual. Filtros são aplicados antes de todos os facets de agregação. Query estrita vazia: não aceita owner, tenant ou intervalo arbitrário do navegador. Resposta `no-store`.
- Barras: seis meses do calendário de São Paulo, incluindo o atual. “Cadastros criados” usa `createdAt` dos registros atualmente visíveis, incluindo leads convertidos em clientes; “Clientes aprovados” usa `approvedAt` de clientes atualmente aprovados. Não é uma reconstrução histórica de carteiras ou um relatório de conversão por coorte. Arquivamento e transferência alteram a visão atual também nos meses anteriores.
- Semicircular: distribuição exclusiva dos estados de qualificação (não iniciada, rascunho, enviada, revisão, aprovada). Percentual central = aprovados / todos os cadastros visíveis; não é taxa de conversão histórica. Sem cadastros, mostra ausência de dados, sem NaN ou preenchimento fictício.
- Valores exatos das barras disponíveis em tabela expansível; legendas textuais e títulos acessíveis para os gráficos. Cores não são o único meio de identificar informações. Sem valores de receita, metas ou crescimento inventados.
- Atualização automática e botão “Atualizar painel”. Falha de consulta do gráfico tem estado próprio; não gera série zero como se fosse confirmada.

Contratos: `packages/contracts/src/dashboard.ts`. Serviço: `apps/api/src/modules/relationships/dashboard.ts`. Componente: `DashboardCharts.tsx`. Testes de entradas/escopo/datas e layout, mais cenário MongoDB de isolamento, são registrados em `verification.md`.
