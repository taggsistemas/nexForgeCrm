# Identidade e multiempresa — primeiro incremento
## Implementação
Modelos User, Tenant, Company, Role, Membership e Session, com índices e vínculo
de empresas e perfis ao tenant. Sessões opacas de 256 bits; só o SHA-256 do token
é persistido. Cookie HttpOnly, SameSite Strict, Secure em produção. Senha com
scrypt (N=32768, r=8, p=1), salt aleatório e comparação de tempo constante.

Login recebe apenas email e password. Após verificar a senha, o servidor identifica o tenant ativo pelos vínculos persistidos do usuário. Sem organização ativa ou com mais de uma organização ativa, o acesso é recusado, sem escolher um tenant arbitrariamente. Empresas e perfis continuam limitados ao tenant verificado. /session revalida esses vínculos a cada chamada.
Expiração absoluta: oito horas, conferida na consulta, independente do TTL.
Logout remove a sessão no banco. Não há JWT, token em localStorage ou senha padrão.

POST /api/v1/auth/login — autenticação, resposta pública mínima e cookie.
GET /api/v1/auth/session — usuário, tenant, empresas e permissões vigentes.
POST /api/v1/auth/logout — revogação e limpeza do cookie.
Todas as respostas de identidade usam Cache-Control: no-store.
Mutações exigem Origin igual a WEB_ORIGIN, inclusive via proxy.
Endpoints comerciais permanecem fechados.

## Provisionar o primeiro administrador
MongoDB dedicado ao CRM, com replica set (necessário para transação).
Copiar .env.example para .env e configurar a URI exclusiva do CRM.
No PowerShell, preparar as variáveis desta sessão:
```powershell
$env:CRM_BOOTSTRAP_EMAIL = "seu-email@dominio.com"
$env:CRM_BOOTSTRAP_NAME = "Administrador"
$env:CRM_BOOTSTRAP_TENANT = "Minha organização"
$env:CRM_BOOTSTRAP_SLUG = "minha-organizacao"
$env:CRM_BOOTSTRAP_COMPANY = "Minha empresa"
$secret = Read-Host "Senha inicial (mínimo 12 caracteres)" -AsSecureString
$env:CRM_BOOTSTRAP_PASSWORD = [System.Net.NetworkCredential]::new("", $secret).Password
try { npm run bootstrap -w @nexforge/api }
finally { Remove-Item Env:CRM_BOOTSTRAP_PASSWORD; $secret.Dispose() }
```
Não salvar a senha em comandos literais, documentos ou código.
O bootstrap cria usuário, tenant, empresa, perfil e vínculo em uma transação.
Não altera usuário existente; falha em duplicidades e não revela credenciais.
Reutilizar um usuário em outro tenant exige fluxo futuro de convite autorizado.

## Executar
npm install
npm run dev
Acessar http://localhost:5173, usando o e-mail e a senha definidos no cadastro.
WEB_ORIGIN deve corresponder exatamente à origem aberta no navegador.
Produção exige HTTPS, NODE_ENV=production e proxy com /api no mesmo domínio.

## Limitações e próximos incrementos
Limiter local por IP: dez tentativas por quinze minutos. Não habilitar trust proxy
sem configurar a topologia e o tratamento seguro de endereços.
Antes de múltiplas instâncias, substituir por limitador compartilhado.
MFA, recuperação de senha, convites, troca de tenant, gestão de perfis, auditoria
persistente e encerramento de todas as sessões ainda não implementados.
Escopos próprio/equipe/região serão adicionados aos domínios comerciais.
IndexedDB comercial e sincronização ainda não implementados.
Testes HTTP usam stub do serviço; não comprovam persistência nem isolamento MongoDB.
A liberação desta implementação depende de build e testes completos.

## Teste de persistência
MONGODB_TEST_URI habilita tests/integration/identity-mongo.test.ts.
O teste aloca um banco aleatório exclusivo e remove somente esse banco ao terminar.
O CI possui serviço MongoDB para esse teste; não valida o bootstrap transacional.
Sem a variável, esse teste é explicitamente pulado.

## Provisionamento pelo Tagg Master
O fluxo recomendado agora é npm run master:bootstrap e /taggmaster.
A Tagg cadastra cada cliente e seu administrador pela página; consulte docs/taggmaster.md.
O bootstrap de tenant anterior permanece como alternativa operacional, sem conceder acesso master.

## Sessão única e perfis
Cada novo login substitui a sessão anterior da conta no MongoDB, incluindo acessos em PC e celular. Sessões antigas de antes desta versão exigem novo login uma vez. O cliente verifica validade a cada 15 segundos online/visível e ao recuperar foco. Ver docs/user-administration.md para perfis, matriz e administração de usuários.

## Primeiro acesso e recuperação
Usuários criados por administrador ou pelo TAGG Master recebem mustChangePassword=true. Após autenticar, /auth/session informa security; endpoints comerciais recusam acesso até troca e aceite da versão atual do aviso. Contas legadas não são forçadas a trocar senha retroativamente, mas precisam aceitar o aviso vigente.
POST /api/v1/auth/password/change exige senha atual e nova; encerra sessões e requer novo login. POST /password/forgot enfileira envio genérico; /password/reset consome token de uso único e encerra sessões. Os dois últimos caminhos pertencem também a /api/v1/auth. Configuração e limites: relationships.md. SMTP real não foi exercitado neste ambiente.
