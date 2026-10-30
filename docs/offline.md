# Operação offline — automática, sem senha local (etapa 13 — 29/10/2026)

## Como funciona para o usuário
1. Basta entrar conectado no CRM pelo aparelho (celular, tablet ou computador). A carteira do usuário é baixada e protegida no aparelho automaticamente: ao entrar, ao reconectar e a cada 5 minutos com o app aberto. Não há senha local nem passo de "preparar carteira".
2. Sem internet, o app abre direto em **Operação offline** (também ao abrir o app já sem rede, desde que o aparelho tenha entrado conectado antes). Em cada cliente/lead: **Atividade**, **Iniciar visita** (com localização autorizada na entrada e na saída), **Pedido** e **Chamado**. Tudo é salvo primeiro no aparelho.
3. Quando a conexão volta, os registros são enviados automaticamente, na ordem em que foram feitos. O indicador de conexão no topo mostra quantos registros ainda estão no aparelho. **Sincronizar agora** força o envio.
4. Cada registro mostra a situação: aguardando envio, sincronizado (pedidos e chamados exibem o número gerado pelo servidor e o pedido mostra se ficou confirmado ou aguardando aprovação), conflito ou recusado com o motivo. Conflito confirmado permite **Nova tentativa** com as versões atuais; qualquer pendência pode ser descartada explicitamente.
5. Ao **Encerrar sessão** com registros ainda não enviados, o app avisa quantos serão perdidos; cancelar mantém tudo, confirmar apaga os dados do aparelho.

## O que fica no aparelho
Carteira atual do usuário (até 500 cadastros, 1.000 contatos e 1.000 atividades de 30 dias antes/depois), propriedades e equipamentos dos clientes (para chamados) e, para quem emite pedidos de venda, o catálogo ativo com o preço da tabela geral da empresa como sugestão. Perfis com visibilidade da empresa que ultrapassam o limite recebem automaticamente a própria carteira. Não ficam no aparelho: dados fiscais, crédito, condições de pagamento, custos, permissões, senhas ou tokens.

## Proteção sem senha
Um único cofre IndexedDB por aparelho, criptografado com AES-GCM 256 (IV aleatório por gravação). A chave é gerada no próprio aparelho como `CryptoKey` **não exportável** e guardada apenas no IndexedDB, vinculada ao usuário (marcador SHA-256 de tenant+usuário, sem nomes). Nada vai para localStorage; o service worker continua sem cachear respostas autenticadas. O envelope expõe só versão, marcador do dono, revisão, contador de pendências e bloqueio.

Limite conhecido e aceito na decisão de remover a senha: quem usar o mesmo perfil de navegador desbloqueado consegue ver os dados offline daquele usuário. Por isso o aparelho deve ter bloqueio de tela, e a orientação de uso inclui encerrar a sessão em aparelhos compartilhados. A criptografia protege contra cópia dos arquivos do navegador e leitura por outro usuário do CRM, não contra quem tem o aparelho desbloqueado, malware ou XSS.

Se outro usuário entrar no mesmo aparelho enquanto há registros pendentes do anterior, nada é sobrescrito: o app avisa para entrar com o usuário anterior e sincronizar, ou apagar explicitamente. Sem pendências, o cofre anterior é substituído. O cofre com senha da versão anterior é apagado quando vazio; se ainda tiver pendências, o app avisa e não o apaga.

## Autorização e regras no servidor
Base `/api/v1/companies/:companyId/offline`:
- POST `/prepare` `{ownerId?}`: sessão canônica válida e conta liberada. Gera OfflineGrant com validade limitada pela sessão (até 8 h) e pelo fim do trial; janela de envio de 7 dias. É chamado automaticamente pelo app.
- POST `/sync` `{grantId,operation}`: sessão, permissões, carteira atual e prazos são revalidados em cada operação; o grant nunca autentica sozinho. Operações: `activity`, `visit`, `order`, `ticket` (DTO estrito; tenant, dono, totais, número, status e instantes não vêm do aparelho).
- **Pedido offline**: exige `order:write`; é criado como lançamento direto pelas mesmas regras online (cliente aprovado na carteira viva, catálogo ativo, casas decimais, totais calculados no servidor). Se marcado para envio, passa pela mesma avaliação de tabela do cliente, condições de pagamento e crédito: dentro da regra é confirmado; fora, aguarda aprovação. Recusas voltam como `ORDER_<motivo>`.
- **Chamado offline**: exige `ticket:write`; propriedade/equipamento precisam pertencer ao cliente vivo; origem "visita"; a abertura é o instante do servidor.
- O app valida a identidade da sessão antes de enviar; sessão expirada ou de outro usuário bloqueia o envio até entrar novamente com o mesmo usuário (os registros ficam guardados).

## Transações, idempotência e conflitos
OfflineReceipt (índice único tenant/empresa/usuário/operationId + hash do payload) é gravado na mesma transação do efeito e da auditoria (OfflineAudit e, para agenda, AgendaAudit). Reenvio do mesmo ID devolve o mesmo resultado (inclusive número do pedido/chamado); payload diferente com o mesmo ID é recusado. Falha de rede, timeout ou 5xx mantêm a pendência com o mesmo ID; só conflito confirmado (409) permite nova tentativa com novo ID, após o app baixar a carteira atual.

A versão do cadastro protege atividades e visitas. Pedidos e chamados não dependem dela porque o servidor reavalia todas as regras no envio. As regras de visitas offline continuam: relato com horários/posições do aparelho guardados como não confiáveis e recebimento do servidor separado, sem criar check-in/out online falso; conflito com atendimento online, técnico ou relato sobreposto; serialização pelo executor.

## Limites
Uma empresa por aparelho (a primeira da conta ou a já usada no aparelho). Até 100 registros aguardando envio. Registros só são aceitos dentro da validade da autorização (até 8 h após a última atualização online, limitada pela sessão e trial); depois disso o app pede para conectar e entrar novamente. Não há sincronização com o app fechado (sem background sync), mapas offline ou instalação nativa APK/IPA — a instalação é PWA. Técnicos não usam a carteira comercial offline.

## Homologação
Exige HTTPS, Web Crypto, IndexedDB, service worker e GPS autorizado para visitas. Os testes automatizados usam navegador real com rede desligada, criptografia/IndexedDB reais e APIs simuladas; a integração MongoDB cobre pedidos e chamados offline, idempotência, regras e recusas. Homologar em Android/iPhone físicos: bloqueio de tela, falta de GPS, armazenamento cheio, app encerrado pelo sistema e atualização da PWA sem perder registros.
