# Usuários, perfis e sessão única

## Operação no CRM

O administrador do cliente entra pelo login normal (e-mail e senha).
Em Configurações > Usuários e equipes pode:
- cadastrar usuário com nome, e-mail, senha inicial, perfil e empresas autorizadas;
- vincular vendedores ativos a um supervisor;
- alterar perfil, suspender e reativar o acesso;
- consultar os perfis disponíveis e os usuários do próprio tenant.

Não há exclusão física. Não há recuperação de senha neste incremento.
O usuário atual e o administrador principal do tenant são protegidos contra
alteração por esta tela. Operações administrativas são auditadas na mesma transação.
A lista inicial é limitada a 500 vínculos do tenant e ao escopo de empresas do ator.
Os endpoints repetem a autorização no servidor; esconder o menu não concede segurança.

## Matriz padrão

| Perfil | Dados comerciais | Ações principais |
|---|---|---|
| Administrador do sistema | Empresas autorizadas do tenant | Usuários, perfis e todas as permissões comerciais |
| Gerencial | Empresas autorizadas | Acompanhamento, metas, comissões e aprovações comerciais; não administra identidades |
| Administrativo de vendas | Empresas autorizadas | Cadastros e operação comercial; não aprova propostas/pedidos nem administra identidades |
| Supervisor | Próprios e de vendedores vinculados | Operação e acompanhamento da equipe; não aprova nem administra identidades |
| Vendedor | Registros próprios | Carteira e operação individual; não aprova nem administra identidades |

As permissões de módulos comerciais ainda não implementados são contratos para
esses módulos. Cada repositório comercial deverá usar commercialFilter com ownerId.
Não há liberação de endpoints comerciais fictícios nesta etapa.
As empresas autorizadas sempre limitam todos os perfis, inclusive gerencial.
Um perfil nunca concede acesso a outro tenant.

Role.key seleciona a política definida no backend. O cliente envia somente
profileKey de uma enumeração fechada; permissions, roleIds, tenantId e userId
não são campos de criação aceitos.
Perfis padrão são criados em novos tenants e sincronizados idempotentemente
quando o administrador cadastra/configura usuários de um tenant antigo.
O proprietário primaryAdminId, validado no banco e com vínculo válido, mantém
administração integral do próprio tenant, inclusive nos cadastros anteriores.
As contas master TAGG são identidades globais separadas, não são um perfil de cliente.

A equipe do supervisor é formada por Memberships do mesmo tenant, ativos,
vinculados ao perfil vendedor. Referências de outro tenant são recusadas.
Suspensão ou promoção de vendedor remove vínculos de supervisão na mesma transação.
A sessão do supervisor revalida os vendedores no banco a cada autenticação.

## Sessão única

Política: novo login válido substitui o anterior, para clientes e Tagg Master.
Cada conta usa um documento de sessão com _id igual ao ID do usuário/principal.
A unicidade nativa de _id e um upsert atômico serializam logins concorrentes.
Só o digest do token atual é aceito. O logout com token antigo não apaga o novo.

A restrição funciona entre PC, celular e instâncias diferentes da API porque
o estado está no MongoDB, não apenas na memória do Node ou no navegador.
Abas do mesmo navegador compartilham o cookie de uma sessão.
A autorização de novas requisições falha assim que o token é substituído.
Requisições já autorizadas/em execução não são retroativamente canceladas.

A interface verifica a sessão a cada 15 segundos quando visível e online, e ao
voltar à aba/foco/conexão. Receber 401 limpa a conta da memória e volta ao login.
Sem conexão, o navegador só pode descobrir a revogação ao se reconectar.
GET /session não renova a duração absoluta (cliente 8h; master 2h).
Contas suspensas e alterações de perfil/equipe têm sessões anteriores revogadas.

Compatibilidade: sessões antigas com _id aleatório deixam de autenticar após a
atualização. É esperado entrar novamente uma vez; não é necessário novo bootstrap,
troca de senha ou recriar clientes. O banco do CRM existente não foi usado nos testes.

## Teste com MongoDB real isolado

Executar na raiz:
```sh
npm run test:db
```

O comando inicia um replica set local temporário em 127.0.0.1 e porta aleatória.
Não carrega .env e substitui MONGODB_TEST_URI no processo de testes; nunca usa
MONGODB_URI da aplicação. Os testes criam bancos aleatórios nexforge_crm_test_*,
apagam somente esses bancos e encerram o processo local.
Binário oficial MongoDB 8.0.17, baixado e verificado pelo mongodb-memory-server-core
11.3.0, fica no cache ignorado artifacts/mongodb-binaries. O primeiro download
pode ser grande no Windows. Dados temporários ficam em artifacts e são removidos
somente após verificar que o caminho está dentro do diretório de testes.

No ambiente de automação, o CI também executa a suíte com replica set Docker.
A execução local de npm run check continua sem exigir MongoDB externo; quando
MONGODB_TEST_URI está ausente, as suítes reais são executadas por npm run test:db.

## Senha temporária e modais
Criação/configuração usa modal. A senha cadastrada pelo administrador é temporária e a API bloqueia os módulos até troca no primeiro acesso. Alterar perfil não revela nem recupera senha. Recuperação pelo usuário exige serviço SMTP configurado; o TAGG Master tem autenticação e processo de recuperação separados.

## Perfis, regiões e técnicos
Cadastros de vendedor/técnico permitem escolher supervisor e regiões; supervisor define suas regiões e vendedores. Vínculos são validados por empresa/tenant e mantidos atomicamente com auditoria/capacidade. Técnico possui perfil separado e consome licença. Ver [technical-work.md](technical-work.md).
