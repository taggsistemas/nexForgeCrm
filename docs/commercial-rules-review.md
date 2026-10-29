# Regras comerciais revisadas — antes da operação offline

Esta revisão registra os requisitos solicitados em 29/10/2026 e a auditoria anterior às correções. A qualificação direta já foi substituída pelo fluxo revisado descrito em lead-qualification.md; catálogo, metas e offline seguem especificações futuras. Nenhuma migração de clientes existentes é autorizada por esta revisão.

## Auditoria do código antes das correções
| Tema | Situação encontrada | Ajuste necessário |
| --- | --- | --- |
| Novo lead | A tela inicial oculta fiscal e torna endereço opcional; backend permite nome sem telefone/e-mail. Selecionar Qualificado exibe dados completos no mesmo formulário. | Separar cadastro inicial da qualificação; remover seleção direta de Qualificado pelo vendedor. |
| Qualificação | Exige documento válido, contato e endereço ao salvar qualificado. Conversão é ação separada e disponível a quem possui lead/customer:write. | Estados próprios, submissão, análise administrativa, revisão com motivo e aprovação transacional com conversão automática. |
| Crédito e pagamento | Não há campos, aprovação ou controle de exposição. | Condições propostas versus aprovadas; autorização financeira no servidor. |
| Perfis | sales_admin não tem permissão específica de aprovar qualificação nem gerenciar metas globais; supervisor não possui escopo de região nas metas. | Permissões específicas e vínculos de região/equipe; não conceder poder administrativo por permissão genérica de cadastro. |
| Produtos/preços/pedidos/metas | Escopo declarado, sem motores operacionais desses domínios. | Implementar por etapas e testes; não tratá-los como entregues. |
| Offline | PWA mantém shell público; dados comerciais e visitas ainda dependem de conexão. | Armazenamento local explícito e isolado, fila idempotente, autorização na sincronização e conflitos. |
| Instalação móvel | Manifest standalone e service worker existem, com ícone SVG único. Não existe build APK/IPA nem instalador próprio. | Ícones móveis dedicados, ajuda de instalação e homologação HTTPS Android/iPhone. |

## Lead: somente primeiro contato
- Nome da empresa/pessoa, nome do contato quando se tratar de empresa, telefone, e-mail e observações. Endereço opcional e expansível.
- Documento, IE, crédito, pagamento, tabela de preços e dados fiscais não aparecem nem são exigidos neste cadastro inicial.
- Regra proposta de obrigatoriedade: nome e ao menos um canal válido (telefone ou e-mail). O outro canal fica opcional para não bloquear a prospecção. Não exigir os dois sem nova definição do produto.
- Todas as criações/edições em modais. Máscaras ajudam a digitação; validação e normalização reais são do backend.
- Observações são texto, com limite; não aceitar HTML executável, operadores MongoDB ou campos administrativos no DTO.
- Lead ainda pode receber agenda, visitas e oportunidades de prospecção; não pode gerar pedido comercial.

## Qualificação e aprovação
Fluxo de destino: lead → qualificação em rascunho → enviada para análise → em revisão OU aprovada → cliente.

1. Vendedor responsável completa CPF/CNPJ válido, razão social/nome completo, nome fantasia quando aplicável, contato(s), telefone/e-mail e endereço completo. IE quando houver, distinguindo contribuinte, isento e não aplicável; não exigir IE de pessoa física indiscriminadamente.
2. Cadastra tipo de cliente (atacado/varejo/outro) e propõe condições comerciais: limite de crédito em centavos, formas de pagamento permitidas, condição de pagamento (à vista, parcelas/prazos e vencimentos) e tabela pretendida. Forma (PIX/boleto/cartão etc.) não se confunde com prazo/parcelamento.
3. Submete uma revisão imutável dos dados para análise. O administrativo de vendas pode aprovar ou devolver para revisão com motivo obrigatório. Registrar ator, horário do servidor, revisão e alterações.
4. Aprovação autoriza as condições finais e converte o mesmo Party em cliente na mesma transação; preservar contatos, carteira, visitas, oportunidades e histórico. Não manter uma segunda ação de conversão livre pelo vendedor.
5. Devolução mantém como lead; vendedor corrige e reenvia nova revisão. Edição de dados submetidos invalida a submissão ou exige retorno explícito a rascunho; impedir aprovação de snapshot antigo por versão.
6. Autoaprovação pelo mesmo ator que submeteu fica bloqueada como padrão. Eventual exceção administrativa precisa de regra/permissão própria e justificativa; não existe no incremento atual.
7. Cliente aprovado pode receber pedidos conforme permissão, tabela vigente e análise de crédito. Cadastro direto de cliente deve passar pelo mesmo controle comercial ou por um fluxo administrativo explícito e auditado; não pode servir de atalho para contornar a aprovação.
8. Mudança posterior de limite, prazo ou tabela exige permissão específica e histórico; vendedor não altera limites aprovados. Limite zero não significa ilimitado. Pedido a prazo precisa respeitar exposição conhecida, reservas e bloqueios calculados no servidor; sem ERP conectado, não alegar conhecer recebíveis externos.

Não alterar kind/stage de clientes já cadastrados automaticamente. Antes da migração, inventariar clientes legados e definir política de revisão/regularização que preserve histórico e permita piloto controlado.

Permissões futuras distintas: cadastrar lead, editar qualificação, submeter, analisar/aprovar, devolver, gerenciar crédito e condições. Administrativo de vendas aprova/devolve; vendedor prepara/submete; supervisor acompanha apenas sua equipe/região; gerencial acompanha e administra conforme concessão explícita. O frontend nunca concede aprovação por enviar status ou actorId.

## Catálogo: produtos, serviços e embalagens
- Código interno automático, atômico, não reutilizado, único no tenant/empresa. Não calculado no navegador nem por count+1. Pode haver lacunas após cancelamento de operação.
- SKU/referência do fabricante é campo separado. Associar fabricante/marca e política de unicidade por empresa/fabricante; não supor SKU universalmente único entre fabricantes.
- Descrição curta/detalhada, tipo produto/serviço, situação ativo/inativo e unidade de medida cadastrada (PC, KG, KIT, CX, L etc.), com precisão e regra de fracionamento por unidade.
- Unidade de estoque/comercialização e conversões de embalagem são explícitas. Caixa comercial é embalagem, não unidade genérica de contagem sem conteúdo.
- Caixa homogênea: produto, quantidade por caixa, unidade-base e conversão fixa quando aplicável. Kit/caixa mista: composição de vários itens, quantidades/unidades e revisão; impedir ciclos de composição.
- Peso fixo ou variável por produto/embalagem. Guardar tara, peso bruto/líquido quando aplicável e unidade de peso; diferenciar peso estimado do efetivamente aferido.
- Peso variável não usa fator fixo fictício: proposta/orçamento pode ter estimativa; separação/expedição registra peso real e recalcula valores conforme regra contratada, com reaprovação se exceder tolerância. Não encerrar faturamento antes de resolver diferenças.
- Quantidade, peso e conversões usam precisão decimal definida (Decimal128 ou inteiros escalonados); valores finais monetários com regra de arredondamento explícita, nunca ponto flutuante sem controle.
- Classificação fiscal por tipo: NCM e CEST quando aplicáveis a produto; código de serviço quando aplicável. Origem fiscal, fabricante e demais atributos devem ser compatíveis com o contrato de integração. Validação fiscal final será definida no módulo próprio; este documento não define tributação.
- Prazo de entrega com quantidade de dias, indicação úteis/corridos, início da contagem e possibilidade de revisão por pedido. Não prometer disponibilidade de estoque que o CRM independente não conhece.
- Catálogo do CRM é próprio. Integração opcional identifica produto externo por mapeamento e versão; não compartilhar coleção ou escrever no banco do ERP.

## Tabelas de preços
Escopos: global do tenant/empresas autorizadas, cliente, tipo de cliente (atacado/varejo), vendedor, região e equipe. Global nunca atravessa tenant.

Vínculo específico do cliente pode definir qual tabela utilizar, sujeito a autorização e vigência. Precedência candidata na ausência de vínculo explícito: cliente > tipo de cliente > vendedor > equipe > região > global. Essa prioridade ainda deve ser confirmada antes do motor de preços; não tratá-la como decisão já aprovada.

Cada tabela precisa de moeda, vigência, revisão, unidades/embalagens de venda, itens, permissões e descontos máximos. Não misturar tabelas ou escolher empate pela ordem do MongoDB. Definir ausência de preço e possibilidade de herança explicitamente. Preço por KG versus por CX deve ser inequívoco. Pedido guarda snapshot do preço, versão, unidade, conversão, regra aplicada e autorizações; servidor recalcula tudo.

Na qualificação, vincular tabela operacional somente se catálogo/tabelas já existirem; antes disso, registrar a condição comercial proposta sem gerar vínculo fictício ou liberar pedido sem preço validado.

## Propostas e pedidos
Somente cliente comercialmente aprovado gera pedido; propostas de prospecção podem existir sem virar pedido, sujeitas ao desenho do módulo.

Status: orçamento → aprovado → produção/separação → expedição → despachado; cancelado com motivo e permissão. Aprovação inclui tabela, descontos, prazo, crédito e total recalculados no servidor. Alteração material após aprovação cria nova revisão e demanda aprovação novamente. Vendedor cria orçamento, não define aprovação por payload.

CRM acompanha status comerciais/logísticos; não presume implementar estoque, fiscal, produção industrial ou financeiro completo do ERP. Transições operacionais são manuais com permissão ou eventos autenticados, versionados e idempotentes. Depois de despachado, correção requer devolução/reversão própria, sem apagar histórico ou simplesmente cancelar.

## Metas e gestão
- Administrativo de vendas cadastra metas globais por empresa e período, com métrica definida: faturamento/venda aprovada, quantidade, margem ou visitas etc. Não misturar receita de pedidos com valor de oportunidades.
- Supervisor cadastra/desdobra a meta da sua região e distribui aos vendedores de sua equipe, por carteira/tipo de carteira e dimensões previstas, respeitando teto global/regional e sem duplicar contagem.
- Antes da implementação, cadastrar vínculo explícito supervisor–região/equipe; a região atual é apenas classificador de carteiras e não prova autorização de gestão.
- Desdobramento preserva orçamento de meta: soma das parcelas não supera o pai por padrão, com saldo não distribuído visível. Sobreposição de vendedor/carteira/tipo exige regra para não duplicar o mesmo resultado.
- Versões, vigência, histórico, concorrência transacional e permissões distintas para meta global, regional e individual. Vendedor consulta sua meta/resultados.
- Transferência de carteira/equipe exige regra de corte temporal: preservar resultados atribuídos no período, sem reatribuir retroativamente vendas antigas de forma silenciosa.
- Comissões precisam de base, evento de aquisição, estornos e regras aprovadas. Forecast usa oportunidades/probabilidades e não se confunde com venda realizada.

## Offline: contrato de segurança e sincronização
Só iniciar após fixar o workflow de qualificação e suas migrações. Nenhuma aprovação comercial, alteração de limite, tabela ou meta é autorizada offline.

- Carteira/agenda sincronizadas explicitamente para IndexedDB com minimização, separação por tenant/empresa/usuário e expiração; não usar cache HTTP autenticado do service worker como banco.
- Criptografia local e gestão de chaves devem ser desenhadas antes da liberação. Criptografia com chave acessível no mesmo navegador não protege contra todo XSS ou acesso ao dispositivo desbloqueado; não prometer sigilo absoluto.
- Atividades/visitas locais têm identificador idempotente, revisão-base, payload estrito e estado pendente/sincronizando/sincronizado/conflito/rejeitado. Não mostrar sucesso no servidor antes da confirmação.
- Distinguir horário capturado no dispositivo (não confiável) de recebido no servidor. Check-in offline não pode ser retroativamente rotulado como check-in online validado. Posição com autorização pontual, precisão e limites; sem rastreamento contínuo.
- Servidor revalida sessão, tenant, empresa, carteira, perfil, versão, estado e integridade por operação. Transferência/suspensão/perda de acesso rejeita sincronização sem vazar dados.
- Conflitos não usam last-write-wins para visitas, qualificações, crédito, pedidos ou metas. Expor conflito e revisão em modal, preservar ambos os relatos quando necessário, impedir efeitos duplicados.
- Sessão única permanece: offline não é possível detectar imediatamente um novo login remoto. Definir licença offline temporária e prazo de expiração; ao reconectar, sessão substituída bloqueia sincronização e exige reautenticação do mesmo usuário, com nova autorização. Não sobrescrever sessão ou prolongá-la pelo relógio do cliente.
- Sair, mudar de usuário/tenant ou expirar acesso bloqueia a visão local e elimina dados conforme política; avisar sobre rascunhos pendentes antes de descarte voluntário. Não sincronizar automaticamente pendências de outra identidade.
- Regras de uma visita aberta por usuário continuam globais no servidor; dois dispositivos offline podem conflitar. A interface deve mostrar visita local pendente, e o servidor resolver sem fabricar execução simultânea aprovada.
- Prever idempotência transacional, retries com backoff, ordem de dependências, expiração de lotes locais, limites de armazenamento e testes de reenvio, relógio adulterado, dispositivo compartilhado e troca de carteira.

## Aplicativo instalável no celular
A escolha atual é PWA responsiva, com ícone na tela inicial e janela standalone, usando a mesma base do frontend. Não há geração atual de APK/IPA. Instalação será por opção do navegador no Android e Adicionar à Tela de Início no iPhone, conforme suporte.

Pendências verificadas no projeto: manifest só declara SVG; preparar PNG 192/512, maskable com área segura e apple-touch-icon, conferir identidade visual, manifest e escopo; ajuda/ação de instalar com detecção de suporte, atualização segura sem perder fila e homologação HTTPS em dispositivos reais. Não garantir banner automático ou instalar sem ação do usuário. APK/AAB/lojas exigem empacotamento e distribuição separados, fora do build PWA atual.

Referências técnicas: https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps/Guides/Making_PWAs_installable e https://web.dev/learn/pwa/installation .

## Ordem revisada e critérios de aceite
Antes da etapa 3: corrigir lead/qualificação, permissões de análise, conversão por aprovação, condições comerciais, clientes legados e testes de bypass/concorrência. Manter catálogo/tabelas/pedidos não operacionais até seus incrementos.

3. Offline e instalação móvel: carteira/atividades/visitas, isolamento local, idempotência, conflitos, expiração e reautenticação. Aprovação e crédito continuam online.
4. Catálogo e tabelas: produtos/serviços, embalagens/caixas/kits/peso variável, unidades, fiscal/prazos e motor de preço.
5. Propostas e pedidos: cliente aprovado, snapshots, crédito, aprovação e transições logísticas.
6. Gestão: metas globais pelo administrativo, desdobramento regional pelo supervisor, comissões, forecast e central.
7. ERP opcional: APIs/eventos versionados, reconciliação, mapeamento de identidade e visão federada Graphify CRM/ERP/contratos; sem compartilhamento de autenticação/banco.

Cada entrega exige testes unitários, integração MongoDB A/B e E2E desktop/móvel conforme alteração, auditoria, modais e metadados do grafo atualizados. Metadados declarados não equivalem a extração Graphify AST.

## Atualização após implementação das correções
A auditoria acima descreve o estado anterior à correção. O fluxo de lead mínimo, qualificação revisada pelo administrativo, devolução com motivo, autoaprovação bloqueada, aprovação/conversão transacional e regularização de legado foi implementado; detalhes em lead-qualification.md. Cadastro direto de cliente e conversão livre agora recusam. Financeiro da qualificação registra condições aprovadas, não representa motor de crédito/recebíveis. Catálogo, tabelas, pedidos, metas, offline e finalização da instalação móvel continuam nas etapas seguintes. Prioridade de tabelas permanece candidata, sem motor implementado.

