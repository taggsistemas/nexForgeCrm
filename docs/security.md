# Segurança e isolamento dos tenants

## Regra de arquitetura

O frontend é uma entrada não confiável. Nenhum campo, botão escondido, máscara,
ID enviado em header, papel ou tenantId do navegador concede autorização.
O tenant é obtido da sessão opaca, validada contra o banco e os vínculos vigentes.
Empresa solicitada é apenas um seletor: precisa pertencer ao tenant e ao usuário.
Toda operação deve validar também a permissão, incluindo leitura, busca, contagem,
edição, exclusão, relatórios, arquivos e exportações.

O modelo atual usa isolamento lógico em um MongoDB compartilhado do CRM.
Isso não equivale a um banco físico por cliente nem a uma política nativa de
segurança por linha. A aplicação deve aplicar o escopo em cada operação.
ERP e CRM continuam com identidades, dados e implantação separados.

Dados comerciais futuros: tenantId obrigatório e companyId quando aplicável.
Índices e unicidades comerciais devem incluir tenantId (e companyId quando necessário).
O Tagg Master administra clientes da plataforma com sua sessão própria; o cookie
master não concede entrada automática nos endpoints comerciais de um tenant.

## Proteções conferidas e reforçadas

- Hash scrypt, token aleatório, apenas hash do token no banco.
- Cookies HttpOnly, SameSite Strict, Secure em produção; expiração explícita.
- Tenant, usuário, vínculo, empresa e papel ativos/revalidados no servidor.
- DTOs Zod estritos: tipos, limites e lista explícita de campos aceitos.
- Credenciais validadas novamente no serviço, antes de montar a consulta.
- Chaves de operadores Mongo, caminhos com ponto/colchetes e chaves de protótipo
  recusadas na entrada HTTP. Limites de profundidade/complexidade e tamanho de JSON.
- Strings que parecem HTML ou SQL não são removidas cegamente: texto permanece
  texto e o React faz escape na saída. Não há eval ou dangerouslySetInnerHTML nos
  componentes revisados. Isso não substitui segurança para futuros arquivos/HTML.
- Não repassar req.body, req.query ou objetos externos diretamente para find,
  findOne, update, aggregate, sort, populate ou projeções.
- Pesquisa master constrói regex literal escapada; não recebe regex do navegador.
- Origin exato nas mutações; respostas /api sempre no-store.
- Helmet na API. Modelo de CSP para o frontend no Render; validar os headers reais
  após publicar (o Helmet da API não protege o HTML servido pelo Static Site).
- authorizeCompany exige cookie de cliente, contexto validado e permissão;
  fornece escopo congelado em res.locals.authorizedCompany.
- scopedFilter combina escopo e filtro construído no servidor com $and.
  O parâmetro filter é interno: nunca passar um filtro bruto do navegador.
- Endpoints comerciais ainda não implementados permanecem fechados.

## Padrão para o próximo módulo

1. DTO estrito para body/query/params. Tenant e privilégios não são campos editáveis.
2. authorizeCompany(identityService, 'lead:read' ou 'lead:write') antes do controller.
3. Contexto em res.locals.authorizedCompany, obtido exclusivamente pelo middleware.
4. Repositório aplica tenantId + companyId na própria consulta, inclusive por _id.
5. Updates com $set de campos explicitamente permitidos; chaves de escopo imutáveis.
6. Referências (contato, vendedor, região etc.) devem ser verificadas no mesmo escopo.
7. Resposta com DTO público explícito, sem senha, hash, token ou objeto bruto do banco.
8. Testes A/B: o cliente A nunca lê, altera, apaga ou referencia registros de B.
9. Agregações: escopo no primeiro $match e nos pipelines de $lookup. Cache,
   filas, eventos e sincronização offline também carregam contexto verificado.
10. Grafo declara o endpoint, permissão, repositório, modelo e testes de isolamento.

## Evidência desta revisão

npm run check: 98 testes Vitest aprovados; 3 testes MongoDB não executados sem
MONGODB_TEST_URI. O teste adicional MongoDB usa duas sessões e documentos
isolados para verificar leitura, atualização e exclusão; a execução real continua
pendente, não foi usado o banco que contém o cliente de teste do usuário.

Testes HTTP com serviços simulados cobrem NoSQL, mass assignment, headers forjados,
cookie master, empresa de outro tenant, IDs de outro tenant sob a empresa correta,
permissão ausente, sessão revogada, Origin e corpo excessivo. A rota de prova existe
somente no teste, não foi adicionada uma API de negócio fictícia em produção.

Auditoria npm: dependências de produção sem alertas conhecidos nesta consulta.
Auditoria completa: 4 alertas baixos na cadeia de build da PWA (deepmerge,
@rollup/plugin-node-resolve, workbox-build, vite-plugin-pwa). Não são quatro falhas
independentes da aplicação. A correção automática proposta envolve downgrade
incompatível da PWA; não foi aplicada. Reavaliar com atualização suportada.

## Pendências antes de expor a operação real

- Executar a matriz de isolamento com MongoDB separado de testes e replica set
  (já previsto no CI), incluindo os novos repositórios de cada módulo.
- Limite de login atual é local ao processo e por IP. Definir armazenamento
  compartilhado para múltiplas instâncias e confiar apenas em proxies conhecidos.
  Não ativar trust proxy=true indiscriminadamente.
- MFA, recuperação de conta, rotação de senha e auditoria de acessos do master.
- Validar CSP/HTTPS/cookies/proxy no ambiente de homologação; não publicado aqui.
- Política de retenção, backup e teste de restauração; tratamento de dados LGPD.
- Offline autenticado, anexos, integrações e eventos terão revisão própria.
- Graphify AST permanece separado dos metadados declarados; a revisão não é
  certificação de segurança nem um pentest completo.

Referências: https://cheatsheetseries.owasp.org/cheatsheets/Multi_Tenant_Security_Cheat_Sheet.html
e https://mongoosejs.com/docs/8.x/docs/guide.html.

E2E da revisão: 18 casos aprovados no Chrome instalado, em desktop e celular (inclui tentativa de XSS em nomes recebidos da API). APIs e CEP simulados nos testes de navegador; o runner concluiu com exit 0 usando preview separado. O banco real e a infraestrutura de produção permanecem fora deste aceite.

## Atualização: testes reais, perfis e sessão única
A pendência local de MongoDB desta revisão foi resolvida: npm run test:db executa 6 casos com replica set temporário, incluindo concorrência de login, acesso entre tenants, permissões, equipes e administração. Tokens são substituídos em slot único por usuário. Métodos de administração validam papel e empresas no servidor e registram auditoria. Ver docs/user-administration.md. As evidências anteriores neste documento são históricas; novos módulos comerciais continuam exigindo testes próprios.

## Relacionamento e recuperação de acesso
DTOs estritos recusam campos de escopo e permissões enviados pelo cliente. Consultas de leads/clientes/contatos aplicam tenant/empresa e carteira/equipe; contatos herdam o responsável do registro pai. Escritas usam transações, auditoria e versão otimista. Conversão conserva IDs e contatos; arquivamento é lógico.
Novos usuários têm senha temporária. Bloqueios de troca e aceite são verificados no servidor. Rotação incrementa passwordVersion e encerra sessões; tokens de recuperação são armazenados como hash, expiram e são consumidos uma única vez. Resposta de solicitação é uniforme para e-mails conhecidos/desconhecidos quando SMTP está disponível. Fila persistida entrega por SMTP com TLS e origem fixa; nunca retorna o link na API. Limite HTTP atual é por instância; antes de múltiplas réplicas, adotar limite compartilhado no gateway/Redis. Recuperação do TAGG Master permanece processo separado.
A minuta LGPD requer identificação das partes, contatos, retenção, fornecedores e revisão antes de produção. Aceite do usuário não substitui assinatura do contrato entre controlador e operador.

## Oportunidades e atividades
Oportunidades herdam autorização do cadastro pai atual; listagem agrega somente vínculos autorizados antes de paginar/contar. Atualização de carteira ou arquivamento retira acesso de todos os registros associados. Escritas tocam o pai na transação para serializar com transferência e arquivamento. Criação de atividade toca também a oportunidade para serializar com encerramento. DTOs estritos impedem ownerId, moeda, escopo e datas internas; dinheiro usa centavos inteiros, fechamento usa data de calendário válida e prazo usa ISO com fuso. Histórico e atividades nunca são consultados sem revalidar o vínculo. Ganho/perda são terminais; perda exige motivo; novas atividades em registros fechados são recusadas. Banco real isolado e E2E simulados verificam estes limites; não substitui revisão da infraestrutura de produção.

## Agenda e recorrências
A agenda aplica filtro autorizado do pai nas duas fontes antes de contagem, paginação e agrupamento diário. Filtro de responsável não amplia acesso. Operações de oportunidade reusam authorizeOpportunity e as regras de encerramento. Criações em lote exigem ordered:true na transação Mongoose; falha de auditoria foi testada para provar rollback de série e ocorrências. Recorrência limita quantidade/horizonte e datas são calculadas no servidor. Cancelamento de série revalida carteira, empresa, versão e estado, preservando ocorrências passadas/concluídas. Leituras de atividades e série não usam IDs como prova de autorização.

## Carteiras e planos
Transferência exige portfolio:manage, escrita do domínio lead/customer, origem/destino no escopo e vendedor seller ativo na empresa. Operação até 50 itens é atômica e versionada; contatos são atualizados, e oportunidades/agenda revalidam o pai atual. Atualização direta de ownerId fica bloqueada para Party vinculado. Supervisores só gerenciam vendedores da equipe validada. Suspensão de vendedor não impede o gestor de encerrar uma carteira vazia.
Publicação revalida cada cliente e usa referência única de item na agenda, com rollback inclusive se a auditoria falhar. Alterações de rascunho serializam contra publicação. Cancelar plano publicado revalida todos os clientes; o vendedor anterior não pode alterar a agenda de um cliente transferido. Consulta de itens filtra o pai atual antes da contagem. Reagendamento de visitas publicadas é limitado ao período; planos encerrados não permitem reabrir pendências.
