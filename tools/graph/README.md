# Graphify e metadados
Referência: https://github.com/Graphify-Labs/graphify (pacote PyPI oficial `graphifyy`).

## Graphify (grafo de código para consultas dos agentes)
Instalado em 30/10/2026: `graphifyy==0.9.97` (fixado em `requirements.txt`) numa venv do projeto, `tools/graph/.venv/` (ignorada pelo git). A extração usa só AST local (tree-sitter, `--code-only`): nenhum código é enviado a serviço externo, e as comunidades não são nomeadas por LLM (`--no-label`).

- `npm run graph:install` — cria a venv e instala a versão fixada (uma vez por computador).
- `npm run graph:build` — extração completa + agrupamento; gera `graphify-out/` (graph.json, GRAPH_REPORT.md, graph.html), ignorado pelo git.
- `npm run graph:update` — reextrai só o código alterado (rodar depois de mudanças).
- Consultas: `node tools/graph/graphify.mjs query "orderService moveStock"`, `... explain "moveStock"`, `... path "orderService" "moveStock"`, `... affected "moveStock"`, `... god-nodes`. Os nós são identificadores do código, então busque pelos nomes usados nele.

`tools/graph/graphify.mjs` chama a CLI da venv sem depender do PATH. A skill e as instruções para o Claude Code ficam no projeto (`graphify install --project`): `.claude/skills/graphify/`, `CLAUDE.md` e hooks `PreToolUse` em `.claude/settings.json` que lembram de consultar o grafo antes de buscas e leituras. Sem a venv instalada, os hooks saem sem efeito. Nada foi instalado no perfil global.

`.graphifyignore` exclui dependências, builds, artefatos de teste, a venv, `.env`, imagens, PDFs e planilhas.

## Metadados declarados
`npm run graph:metadata` valida `manifest.json`: existência de arquivos, símbolos declarados, IDs e testes relacionados, com SHA-256 da origem, commit e proveniência DECLARED. É complementar ao Graphify, não substituído por ele: continue atualizando o manifesto a cada módulo.

## Pendências
- Automatizar `graph:build` no CI depois de validar tempo, esquema e licenciamento (Apache-2.0).
- Extração semântica de documentos (`docs/`) usa um modelo de IA; exige decisão sobre envio de conteúdo antes de habilitar.

## Federação
federation.json reserva namespaces separados para CRM e ERP.
Grafo do ERP desabilitado até autorização e exportação próprias.
Links futuros usam contrato, versão, produtor e consumidor; nunca caminho local
de outro repositório como identidade estável.
