# Publicação do NexForge CRM

Frontend e backend já estão separados: apps/web (React/Vite) e apps/api (Express).
A raiz organiza os npm workspaces e packages/contracts. Um repositório não exige
um único serviço ou servidor. Não mover as pastas isoladamente, pois o build usa
os contratos compartilhados e o package-lock da raiz.

## Render: dois serviços no mesmo repositório

Conectar taggsistemas/nexForgeCrm. Usar a branch que contém estas alterações.
Em ambos, deixar Root Directory vazio (raiz do repositório).

| Configuração | Backend: Web Service | Frontend: Static Site |
|---|---|---|
| Runtime | Node 24 | Build Node 24 |
| Build Command | npm ci --include=dev && npm run build -w @nexforge/api | npm ci --include=dev && npm run build -w @nexforge/web |
| Start Command | npm run start -w @nexforge/api | não se aplica |
| Publish Directory | não se aplica | apps/web/dist |
| Health Check | /api/v1/health/ready | não se aplica |

Backend: NODE_ENV=production; NODE_VERSION=24; MONGODB_URI como segredo do
serviço; WEB_ORIGIN igual à URL HTTPS exata do frontend, sem barra final.
Render define PORT. Não publicar o .env nem colocar MONGODB_URI em variável VITE_.
O MongoDB deve permitir a rede de saída do backend e ter replica set para transações.

O navegador usa /api na mesma origem da página. No frontend, configurar nesta ordem:

| Source | Destination | Action |
|---|---|---|
| /api/* | https://SEU-BACKEND.onrender.com/api/* | Rewrite |
| /* | /index.html | Rewrite |

Usar Rewrite, não Redirect. A primeira regra deve preceder o fallback da SPA.
Assim /taggmaster abre diretamente e a autenticação preserva o fluxo de mesma
origem com cookies HttpOnly. Não é necessário VITE_API_URL no formato atual.
Definir Cache-Control: no-store em /api/* e no-cache para /index.html e /sw.js.

O arquivo deploy/render.yaml.example é um modelo: substituir URLs e nomes antes
de usar como Blueprint. O modelo não publica nada automaticamente neste projeto.
Validar em homologação POST login + GET session + logout tanto do master quanto
do cliente, incluindo cookies, Origin e cabeçalhos do proxy. Esta configuração não
foi publicada nem testada contra a infraestrutura do Render neste trabalho.

Documentação oficial:
- https://render.com/docs/monorepo-support
- https://render.com/docs/redirects-rewrites
- https://render.com/docs/deploy-node-express-app

## Servidor próprio: Nginx + Node

No servidor Linux, clonar o repositório completo, usar Node 24 e executar na raiz:

```sh
npm ci --include=dev
npm run build
NODE_ENV=production WEB_ORIGIN=https://crm.seudominio.com npm run start -w @nexforge/api
```

Injetar MONGODB_URI pelo gerenciador do processo (systemd, Docker ou equivalente),
sem incluí-la no comando/histórico. Manter a API supervisionada por esse gerenciador.
Publicar apps/web/dist pelo Nginx e encaminhar /api/ para a API na porta 3001.
O exemplo deploy/nginx.conf.example contém os blocos de roteamento para um virtual
host HTTPS já configurado. Substituir domínio e caminho absoluto da instalação.
O mesmo domínio público atende arquivos estáticos e /api; os processos continuam separados.
Vite preview serve apenas para conferir o build, não como servidor definitivo.

## Verificação após publicação

1. /api/v1/health/ready responde ready.
2. /taggmaster e / abrem ao acessar diretamente ou atualizar a página.
3. Login, restauração de sessão e logout funcionam com cookies seguros.
4. Nenhuma resposta /api é cacheada pelo CDN ou pelo service worker.
5. Cadastro de um cliente de homologação grava empresa e administrador.
6. Consulta de CEP funciona no navegador com HTTPS.
7. Bancos criados antes da etapa 3: executar npm run db:tax-ids com a MONGODB_URI do CRM. Havendo duplicados, revisar os IDs listados; sem duplicados, executar npm run db:tax-ids -- --apply. Ver relationships.md.

O cadastro master já existente permanece se a URI apontar para o mesmo banco do
CRM. Não executar bootstrap novamente sem necessidade. ERP permanece separado.
