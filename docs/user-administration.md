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

## Matriz padrão de perfis (etapa 2 — 29/10/2026)

Fonte única: `packages/contracts/src/profiles.ts`. Cada usuário tem um único perfil.
Escopo "empresa" = empresas autorizadas no vínculo; "equipe" = vínculos atuais
validados no banco a cada autenticação; "próprio" = ownerId/atribuição do usuário.

| Perfil | Escopo | Consulta | Cria/edita | Aprova/encerra | Não pode |
|---|---|---|---|---|---|
| Administrador do sistema | Empresa | Tudo | Tudo, inclusive usuários e perfis | Tudo, inclusive distribuição técnica | Outro tenant |
| Direção | Empresa | Comercial, financeiro do cliente (crédito/pagamento), técnico, relatórios | Nada operacional | Qualificação com crédito, propostas e pedidos | Criar/editar leads, clientes, agenda; distribuir atendimentos; pacote offline |
| Gerencial | Empresa | Comercial, técnico (consulta), relatórios, custos e margem | Operação comercial, regiões, carteiras, equipes, catálogo, custos, listas do cadastro | Qualificação, propostas, pedidos fora da regra | Distribuir atendimentos técnicos; administrar identidades |
| Administrativo de vendas | Empresa | Comercial; somente pedidos de venda | Operação comercial, carteiras, catálogo, listas do cadastro, pedidos de venda | Qualificação | Comissões; atendimentos técnicos; aprovar pedidos; custos |
| Supervisor | Equipe comercial | Própria carteira e vendedores vinculados; técnicos vinculados nas regiões | Operação da equipe, carteiras | — | Aprovar; distribuir atendimentos |
| Vendedor | Próprio | Própria carteira | Leads, clientes, contatos, oportunidades, agenda, visitas, offline | Enviar qualificação | Aprovar; ver outras carteiras |
| Coordenação Técnica | Equipe técnica + regiões | Atendimentos dos técnicos vinculados; clientes aprovados das regiões; chamados do território; pedidos de serviço das OS do seu escopo | Agendar atendimentos; abrir chamados no território | Cancelar/interromper atendimentos da equipe; triar, designar, escalonar e encerrar chamados | Carteira comercial, crédito, catálogo, executar atendimento |
| Técnico | Próprio | Atendimentos e chamados designados | Check-in/out dos próprios atendimentos | — | Carteira comercial, preços, aprovações |
| Financeiro | Empresa | Clientes, qualificação, oportunidades, propostas, pedidos, custos e margem, relatórios | Lançar notas fiscais emitidas no sistema financeiro | — | Criar/aprovar pedidos; operação comercial; editar custos |
| Auditoria | Empresa | Comercial, financeiro do cliente, técnico, pedidos, relatórios | Nada | Nada | Comissões, metas, forecast, pacote offline |

Somente a Coordenação Técnica (e o Administrador) distribui atendimentos técnicos.
A Direção aprova sob as mesmas regras dos demais revisores: snapshot enviado,
versão atual e revisor diferente de quem enviou. O perfil Financeiro (etapa 12)
lança notas e vê custos; Estoque será definido com o módulo próprio. Pedidos: [orders.md](orders.md).

`qualification:read` permite abrir a ficha de qualificação (inclui condições de crédito
e pagamento); editar exige `qualification:edit`, aprovar exige `qualification:approve`.
O pacote offline exige `activity:write`: perfis só de consulta não baixam a carteira.

### Inventário de rotas por permissão

| Módulo | Permissões exigidas na rota (quantidade de rotas) |
|---|---|
| Relacionamento | lead/customer read/write (8), contact read/write (5), qualification read/edit/submit/approve (5), company:read (2) |
| Oportunidades | pipeline:read (3), pipeline:write (3), activity:read (1), activity:write (2) |
| Agenda | activity:read (3), activity:write (4) |
| Carteiras e planos | region read/manage (3), portfolio read/manage (5), visit read/write (7), company:read (1) |
| Visitas em campo | visit:read (2), visit:write (3) |
| Offline | activity:write (2) |
| Catálogo | catalog:read (3), catalog:manage (2) |
| Técnico | technical:read (2 + check-in/out com technical:write no serviço), technical:manage (2) |
| Usuários | user:manage (sessão autenticada, sem :companyId) |

A interface esconde ações sem permissão, mas a decisão é sempre repetida no backend.

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
