# Interface compacta e verificações de layout

## Comportamento
- Menu agrupado por seção, sem repetir cabeçalhos para cada função. Barra lateral, cabeçalho, títulos, painéis e linhas de tabelas ocupam menos espaço. Em telas baixas, o menu continua rolável para não ocultar funções.
- Dashboard com indicadores em duas linhas no desktop comum e uma linha em telas largas. Ajuda complementar recolhida por padrão, acessível por “Como usar o comercial”. Dados e alertas permanecem visíveis.
- Modais mais largos, com até três colunas para campos em desktop. Título e botão Fechar ficam fora da área de conteúdo que rola. Página ao fundo bloqueada enquanto houver diálogo aberto; política de privacidade usa a mesma rolagem do modal. Editor aninhado bloqueia a rolagem do conteúdo do modal anterior até fechar.
- Controles compactos no desktop; altura mínima de 44px e texto de entrada de 16px no celular. Campos voltam para uma coluna nas telas estreitas. Não limitar a altura dos dados nem esconder conteúdo para simular ausência de rolagem.
- Agenda abre no dia em celulares, evitando calendário semanal largo logo na entrada. Semana e mês continuam selecionáveis; semana usa rolagem horizontal local quando necessário. Mês estreito mostra data e contagem, com acesso ao dia para ler/agendar os detalhes. Não comprimir sete colunas de compromissos em texto ilegível.
- Tabelas comuns ajustam colunas no desktop e quebram textos longos. Tabelas extensas podem manter rolagem horizontal local no celular; a página não deve ganhar rolagem lateral.
- O cadastro longo ainda pode exigir rolagem: o objetivo é eliminar áreas concorrentes e espaços desperdiçados, preservando conteúdo, foco e legibilidade.

## Testes automatizados
- `npm run check`: tipos, testes nativos, unitários/HTTP, build e grafo. Integrações reais exigem MongoDB separado.
- `npm run test:db`: replica set temporário isolado para os fluxos de autorização e negócio.
- `npm run test:e2e`: fluxos da aplicação em desktop e celular com API simulada; exige preview HTTP local.
- `npm run test:layout`: geometria em Chrome real, sem servidor HTTP. Usa o componente Modal renderizado, CSS real e conteúdo sintético para testar dashboard, menu, modais longos/aninhados, bloqueio do fundo, ausência de overflow horizontal e áreas de toque. Não é teste de integração das APIs nem substitui E2E.

Configurações de layout: 1366×768, 1280×600 e 393×851. São quatro cenários por tamanho. Capturas sintéticas em `artifacts/ux/` para inspeção. Local usa Chrome instalado; CI usa Chromium instalado pelo Playwright. A rotina de CI inclui a suíte de layout e coleta artefatos em caso de falha. Nenhum teste usa clientes ou localizações reais.

Resultados e limitações por execução em `verification.md`. Alterações visuais não mudam permissões ou validações do backend.

## Padronização transversal — etapa 1 (29/10/2026)

A base visual compartilhada agora uniformiza campos, botões, filtros, tabelas, seções, feedback e foco nos dois temas. Checkboxes têm dimensão própria; controles de texto no celular mantêm 16px e 44px de altura. Tabelas extensas usam rolagem local, não da página inteira. Formulários longos continuam roláveis.

Modal oferece tamanho compacto/amplo, foco inicial no título e aria-busy. O cadastro de empresa do Master passou a usá-lo, removendo o diálogo separado. Recuperação de acesso usa largura compacta. Menu móvel possui fundo de fechamento, contenção de teclado, Escape e restauração do foco; atalho permite ir ao conteúdo principal.

`tests/layout/workspaces.spec.ts` compila os componentes reais com esbuild e monta React no Chrome sem servidor HTTP, usando fetch sintético. Exercita abertura/fechamento dos editores, geometria, retorno de foco e os temas claro/escuro. Não executa escritas reais nem substitui testes de autorização/banco ou homologação em dispositivos. Capturas sintéticas ficam em artifacts/ux para inspeção interna.

Plano vigente de entrada manual e progresso por etapa: implementation-checklist.md.

### Refinamento de espaçamento
Botões e ações receberam afastamento maior das bordas e dos campos: barras com 16px (14px no celular), conteúdo de modal com 18px (16px no celular), seções/cards com 16px e grupos de ações com gap de 10px. Rodapés de formulário têm separação de 16px; ações soltas não encostam nos containers seguintes.
