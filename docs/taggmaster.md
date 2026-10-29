# Tagg Master — administração dos clientes do CRM
Página: http://localhost:5173/taggmaster (ajustar ao WEB_ORIGIN existente).
API: /api/v1/taggmaster. O .env existente é preservado e não é versionado.

## Primeiro acesso
1. npm install
2. npm run master:bootstrap
3. Informar nome, e-mail e senha master no terminal; senha oculta, mínimo 12 caracteres.
4. npm run dev
5. Abrir /taggmaster e entrar com essas credenciais.

O comando lê o .env da raiz e conecta ao banco do CRM já configurado.
Não cria nem redefine automaticamente credenciais a cada inicialização.
Não há conta/senha padrão nem provisionamento público por HTTP.
Automação opcional: TAGGMASTER_NAME, TAGGMASTER_EMAIL, TAGGMASTER_PASSWORD.
Não salvar a senha no código, no histórico de comandos ou em documentos.
O comando recusa criar outra conta se já existir master; não sobrescreve dados.

## Cadastrar cliente
Informar nome, identificador único da organização, nome da empresa inicial,
nome e e-mail do administrador, senha inicial e confirmação.
Uma transação cria User, Tenant, Company, Role, Membership e PlatformAudit.
O banco precisa suportar transações (MongoDB Atlas ou replica set).
E-mail/slug duplicados retornam 409 e não deixam cadastro parcial.
Identidades existentes não são sobrescritas nem recebem nova senha por esse fluxo.

Login do cliente: página /, organização = identificador informado, e-mail e senha
do administrador definidos no cadastro. Não usar essas credenciais em /taggmaster.
A listagem permite busca, paginação, suspensão e reativação do cliente.
Suspender o tenant revoga suas sessões e recusa novos logins até a reativação.
Não remove registros nem altera a conta global do usuário.

## Endpoints
POST /api/v1/taggmaster/login
GET /api/v1/taggmaster/session
POST /api/v1/taggmaster/logout
GET /api/v1/taggmaster/clients?page=1&search=
POST /api/v1/taggmaster/clients
PATCH /api/v1/taggmaster/clients/:id/status

Cadastro recebe name, slug, companyName, adminName, adminEmail, adminPassword.
Alteração de status recebe somente active (boolean).
Todos os endpoints de clientes exigem sessão de PlatformAdmin ativa.
PlatformAdmin/PlatformSession são separados de User/Session; perfil administrador
de um tenant não concede acesso master, nem headers enviados pelo cliente.
Sessão master dura duas horas, expiração checada no servidor, cookie HttpOnly,
SameSite Strict e Secure em produção. Respostas no-store; nada de dados master
em IndexedDB, localStorage ou cache do service worker.
Mutações exigem Origin igual a WEB_ORIGIN. Login tem limite local por IP.
Audit registra criação e alteração de status sem senha ou token.

## Verificação
npm run check
npx playwright install chromium
npm run test:e2e
MONGODB_TEST_URI habilita testes reais em banco temporário e replica set isolados.
A UI E2E usa respostas simuladas, separada dos testes de persistência.
Não foram copiados arquivos ou acessos do ERP. A equivalência é do fluxo:
Tagg administra clientes; cada cliente acessa seu próprio CRM.

## Diagnosticar uma falha no cadastro master
Execute npm run master:check. Esse modo só conecta e consulta a existência da conta:
não pede senha, não cria coleções/índices e não cadastra usuários.
O bootstrap agora verifica o banco antes de pedir credenciais e inicializa somente
a coleção PlatformAdmin; não depende dos índices dos clientes.
Já existe master: o comando informa isso e preserva a conta.

Erros exibem código e etapa, sem URL, senha, stack ou mensagem bruta do driver.
- PASSWORD_CONFIRMATION: senha e confirmação divergentes.
- PASSWORD_POLICY: menos de 12 caracteres ou mais de 1024 bytes.
- CONFIG_DB_URI/DB_INVALID_URI: configuração MONGODB_URI inválida.
- DB_AUTH_FAILED: autenticação MongoDB recusada (credenciais do banco).
- DB_DNS_FAILED/DB_NETWORK_FAILED: DNS, rede, firewall ou IP não liberado no Atlas.
- DB_FORBIDDEN: falta de permissão no banco.
- DB_INDEX_CONFLICT: conflito de índice, sem remoção automática.
Compartilhe apenas a mensagem segura, sem enviar o .env.

## Diagnóstico detalhado de rede
Use npm run db:diagnose para separar DNS SRV, DNS de endereços, TCP e TLS,
comparando IPv4/IPv6 quando disponíveis. Não autentica, não cria contas e não envia
credenciais. Relatório usa nós numerados, sem URI, host, IP, banco, usuário ou senha.
Os códigos técnicos também acompanham as falhas do master:check.
network-ok não valida autenticação nem permissões MongoDB.

## URL sem SRV com vários servidores
O diagnóstico usa o parser do driver MongoDB para reconhecer listas de servidores.
O banco fica no caminho, antes de ?: /nexforgeCrm?ssl=true&replicaSet=...&authSource=admin.
Não anexar o nome do banco ao valor authSource.

O diagnóstico master também percorre AggregateError e originalError, distinguindo
falhas agrupadas de IPv4/IPv6 e handshake/certificados TLS. Após mudar de SRV para
URL padrão, repetir db:diagnose para obter o novo relatório por servidor.

## Falhas TLS após DNS e TCP aprovados
O diagnóstico e o bootstrap compartilham a classificação de códigos.
Códigos nativos ERR_SSL_*, ERR_TLS_* e ERR_OSSL_* e causas de certificados
são preservados sem mensagens brutas, host, IP, URI ou credenciais.
As causas internas de erros agrupados também são percorridas.
A validação rejectUnauthorized continua habilitada; não há bypass de certificados.
DNS/TCP aprovados com TLS falho indicam falha de handshake, mas não identificam
sozinhos se é certificado, protocolo, rejeição pelo Atlas ou intermediário de rede.

## Conexão aprovada, falha em lookup
lookup consulta a existência de PlatformAdmin. Falha não equivale a conta inexistente.
O Atlas pode recusar find com código 8000: mensagens de autorização são classificadas
como DB_FORBIDDEN; mensagens de autenticação continuam distintas.
Verificar Database Users, usuário da URI, Specific Privileges e readWrite no banco
nexforgeCrm. Preferir usuário dedicado ao CRM e preservar permissões do ERP.

## Interface alinhada ao ERP
Painel escuro com acento azul, tabela de empresas e cadastro em dialogo pelo botao Nova empresa. O codigo da organizacao continua sendo usado no login do cliente. Login master permanece separado em /taggmaster. Contratos, trial, licencas e backups do ERP ainda nao estao implementados no CRM; nao sao exibidos como funcionalidades prontas.


## Login simplificado
Cliente informa apenas e-mail e senha. O código da organização é interno. A organização é descoberta no servidor após validar a senha e os vínculos ativos. Identidade visual usa as marcas TAGG do ERP, com login em duas colunas e menu lateral no painel. O ERP permanece sem alterações.

## Cadastro completo de empresas clientes
Novos cadastros exigem CPF/CNPJ com dígitos verificadores, contato, e-mail, telefone com DDD, endereço e início/fim do contrato. A IE admite ISENTO ou vazio; máscaras por UF nos formatos previstos, sem consulta de situação fiscal nem validação de DV da IE. E-mails são normalizados e validados; não recebem máscara de pontuação.
Dados comerciais ficam em Tenant.registration, pertencentes à administração da plataforma; a conta do administrador permanece em User, com senha protegida. Registros anteriores continuam legíveis sem migração destrutiva. Datas do contrato são datas civis ISO; não bloqueiam automaticamente a organização.
Consulta automática de CEP brasileiro via HTTPS ao ViaCEP (https://viacep.com.br/), com debounce, cancelamento e limite de espera. Só o CEP é enviado, sem credenciais. Endereço sempre editável; país estrangeiro usa preenchimento manual. Não há consulta externa de CPF/CNPJ, IE ou e-mail.

## Sessão única do master
Novo login master invalida o token anterior no MongoDB. O painel verifica validade periodicamente e retorna ao login quando a sessão perde validade. Sessões anteriores à atualização exigem entrar novamente; não recriar o master nem executar bootstrap para isso.
