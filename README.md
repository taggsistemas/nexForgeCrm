# NexForge CRM

CRM independente do NexForge ERP. Fundação em TypeScript, React/Vite, Express e MongoDB.

## Estado atual
- Interface responsiva com roadmap; não contém indicadores comerciais fictícios.
- Configuração PWA para cache do shell público. Instalação e offline precisam de validação E2E.
- API com liveness/readiness, validação de configuração e encerramento controlado.
- Política de escopo tenant/empresa e contratos iniciais.
- Testes unitários, HTTP e E2E escritos.
- Autenticação, persistência de domínios, sincronização offline e módulos comerciais ainda não implementados.
- Cores e símbolo são provisórios; falta conferir os tokens oficiais NexForge no ERP.

## Executar
Requisitos: Node 24, npm 11 e MongoDB próprio do CRM, preferencialmente replica set.
1. npm install
2. Copiar .env.example para .env e ajustar MONGODB_URI.
3. npm run dev
Frontend: http://localhost:5173. API: http://localhost:3001.
A API só inicia após conectar ao banco. Nunca usar a URI do ERP.

## Verificação
npm run check
npx playwright install chromium
npm run test:e2e

Não foi possível instalar dependências inicialmente por falha DNS no registry npm.
Não existe lockfile validado. Gerar package-lock.json com npm install, revisar e
versionar antes de trocar o CI para npm ci. Builds e testes não são considerados
aprovados até sua execução.

## Graphify
Ver tools/graph/README.md. npm run graph:metadata valida metadados declarados;
isso não substitui a extração real do Graphify.

## GitHub
Origin pretendido: https://github.com/taggsistema/nexForgeCrm.git.
A configuração local não confirma existência, propriedade ou envio remoto.
A criação privada e o push dependem de autenticação com acesso a taggsistema.

## Arquitetura
Ver docs/architecture.md, docs/roadmap.md e docs/integrations.md.