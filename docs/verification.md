# Verificação inicial
Data: 2026-10-28.

## Executado com sucesso
- Cinco verificações de fronteira tenant/empresa no Node 24, sem dependências.
- Validação JSON dos manifests e configurações.
- Metadados: cinco nós, quatro relações, fontes existentes e hashes.
- Inicialização Git com branch main e origin taggsistema/nexForgeCrm.

## Bloqueios observados
- Registry npm: ENOTFOUND (DNS).
- Instalação offline: ENOTCACHED para @playwright/test.
- Graphify não instalado; extração AST não executada.
- Git add: permission denied ao criar .git/index.lock.
- Nenhum commit ou push realizado; existência remota não confirmada.
- Acesso GitHub ainda não conectado.

## Não executado
Typecheck, build, Vitest, Supertest, Playwright, validação visual em navegador,
instalação PWA em dispositivo, MongoDB de teste e testes de integração ERP.
A configuração de CI existe, mas não foi executada no GitHub.

## Repetir sem dependências
node tools/graph/check-access.mjs
node tools/graph/build-metadata.mjs

## Retomar com rede e permissões
npm install
npm run check
npx playwright install chromium
npm run test:e2e
Selecionar versão Graphify, fixar dependência e validar extração.
Conectar GitHub com acesso a taggsistema, criar repositório privado se necessário,
preparar commit e enviar main.