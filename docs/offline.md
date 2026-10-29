# Operação offline — carteira protegida e sincronização

## Como usar
1. Entre online com sua conta, acesse **Operação offline** e escolha **Preparar carteira offline**. Selecione empresa/responsável e defina uma senha local de 12 a 256 caracteres, diferente da senha de login. O aplicativo precisa ter sido aberto online para instalar seu shell/service worker.
2. Durante a desconexão, consulte a carteira, registre atividades e inicie/encerre visitas neste módulo. Na abertura sem rede, use **Acessar carteira offline** no login e desbloqueie com a senha local; isso não cria uma sessão autenticada fictícia nas outras telas.
3. Ao reconectar, a carteira é revalidada/atualizada. Clique **Sincronizar pendências**. Resultados ficam como sincronizado, conflito ou recusado. Resposta perdida mantém a operação pendente para reenvio do mesmo ID.
4. Em conflito confirmado, confira a carteira atual e o relato, então use **Revisar conflito** para uma nova tentativa com as versões atuais. Visita já encerrada, cancelada ou em atendimento não é sobrescrita. Recusas de acesso/prazo não são convertidas em nova tentativa automaticamente.

## Entregue neste incremento
- Carteira mínima de leads/clientes, contatos autorizados e atividades diretas da agenda, incluindo visitas de planos publicados.
- Criação de atividades diretas (ligação, e-mail, reunião, tarefa), sem recorrência offline.
- Visita local agendada ou espontânea para cadastro do próprio vendedor. Entrada e saída pedem autorização pontual de GPS; um rascunho local aberto é preservado com criptografia até encerramento/descarte explícito.
- Visita não agendada cria sua própria ocorrência concluída na agenda ao sincronizar, atomicamente com relatório/recibo/auditoria.
- Atividades locais mostram origem offline na agenda. Visitas recebidas aparecem no registro em campo como relato offline, com horários informados e recebimento separados.
- Consulta offline não expõe dados fiscais, crédito, condições financeiras, permissões administrativas, senhas ou tokens de sessão no banco local. Campos de nomes/contato/endereço/relatos ainda são dados pessoais e exigem aparelho protegido.

## Limites explícitos
Uma carteira por navegador/aparelho, usuário, tenant e empresa por vez. Até 500 cadastros, 1.000 contatos e 1.000 atividades diretas entre 30 dias anteriores/próximos; a API recusa excesso, sem truncamento silencioso. Escolha outro responsável autorizado para reduzir o escopo. Até 100 pendências locais, mais histórico limitado de registros aplicados/substituídos. Para trocar de empresa/identidade, sincronize e apague a carteira anterior explicitamente.

Validade local de até 8 horas, limitada pela expiração da sessão e fim do trial. Renovação requer conexão e a mesma identidade autorizada. Registros já capturados têm janela máxima de envio de 7 dias após a preparação original; o novo login não altera essa janela nem os horários da autorização original.

Um check-in feito na tela online não é concluído automaticamente por um relato offline. Visitas que serão registradas sem rede devem ser iniciadas e encerradas no módulo offline. Não há conversão retroativa para comprovação online. Rascunho sem saída não é enviado como visita completa; expiração pode exigir descarte explícito/regularização operacional pela gestão, sem inventar horário/localização de saída.

Não inclui edição offline de cadastro, qualificação/aprovações, crédito, preços, pedidos, metas, planejamento, atividades de oportunidades, anexos ou rastreamento contínuo. Não há otimização viária/mapas offline ou sincronização automática em background com aplicativo fechado. Sincronização é explícita enquanto aberto/desbloqueado. Instalação nativa APK/IPA não é criada.

## Criptografia e proteção local
IndexedDB armazena apenas envelope AES-GCM 256, IV aleatório de 96 bits por gravação e salt de 128 bits. Chave derivada por PBKDF2/SHA-256 (600.000 iterações nos novos envelopes; leitura de envelopes de desenvolvimento sem esse metadado preserva os 310.000 originais, sem perder pendências), não extraível, mantida somente em memória. A senha local não é persistida e não tem recuperação. O envelope expõe somente versão, revisão, contador de pendências e marcador de bloqueio, sem nomes ou conteúdo da carteira.

Service worker mantém apenas assets/shell público; nenhuma resposta HTTP autenticada é cacheada. Chave/carteira são bloqueadas ao ocultar app, após 5 minutos sem uso ou ao expirar a autorização (checagem periódica de 15s e antes de gravar). Exclusão e logout solicitam confirmação quando houver trabalho local pendente. Logout confirmado apaga o envelope; erro de conexão ao logout mantém o aviso de sessão remota não encerrada, sem afirmar revogação no servidor. Bloquear apenas a carteira conserva o envelope criptografado.

Troca/expiração de sessão detectada online bloqueia a carteira; reabertura exige a mesma identidade online e senha local. Comunicação entre abas sinaliza bloqueio, sem transmitir dados. Escritas IndexedDB usam transação e comparação de revisão para impedir que uma aba sobrescreva outra silenciosamente.

Criptografia em navegador não protege contra XSS enquanto desbloqueado, malware, aparelho desbloqueado ou cópia feita por quem conhece a senha local. O relógio do dispositivo não é uma fonte inviolável: há verificação de retrocesso/desvio, mas revogação/tempo remoto não podem ser garantidos imediatamente durante desconexão. Por isso o servidor nunca usa o envelope/chave local como credencial, nem aceita suas permissões ou datas como autorização.

## Autorização e API
Base `/api/v1/companies/:companyId/offline`:
- POST `/prepare` `{ownerId?}`: exige sessão canônica válida, conta liberada, tenant/empresa/Party/equipe atual. Cria OfflineGrant no servidor e snapshot minimizado; capacidades de escrita são apenas auxílio visual.
- POST `/sync` `{grantId,operation}`: sessão atual e permissões são revalidadas em cada operação. Grant deve pertencer ao mesmo usuário/tenant/empresa, ainda dentro da janela de envio; jamais autentica por si só. Troca de usuário, suspensão, trial vencido ou retirada de carteira não é contornada pelo cache.

DTO estrito aceita apenas activity/visit. IDs de tenant, ator, aprovação ou recebimento não vêm do navegador. Relógio capturado precisa caber na autorização original (tolerância de 1 minuto para início/desvio) e não ultrapassar o prazo final. Isso é uma verificação de coerência, não prova do momento ou da posição física.

## Transações, idempotência e conflitos
OfflineReceipt possui índice único tenant/company/user/operationId e hash canônico do payload validado. Recibo e efeito de negócio são gravados na mesma transação com OfflineAudit/AgendaAudit. Reenvio da mesma operação devolve o mesmo resultado; payload diferente para o mesmo ID é recusado. Falha de auditoria aborta recibo e efeito.

Party.version e AgendaActivity.version são bases otimistas; carteira/atividade atual são verificadas antes de escrever. Acesso perdido gera recusa, sem revelar dados atuais do antigo cliente. Operação confirmada com conflito não teve efeito; o usuário pode criar nova tentativa explícita. Falha de rede, timeout ou resposta 5xx mantém ID/pendência para tentar novamente, sem gerar outra operação.

Atendimento simultâneo online e intervalos reportados sobrepostos geram conflito. Um toque no documento do executor serializa disputa entre importação e check-in online, inclusive entre empresas. Offline em dois dispositivos ainda pode produzir rascunhos concorrentes; não há duas visitas aprovadas automaticamente só porque foram anotadas localmente.

Para visitas, OfflineVisitReport guarda observedInAt/observedOutAt, posições/precisão, origem offline e receivedAt do servidor. AgendaActivity fica completed_offline/concluida e completedAt usa o recebimento do servidor. Não criar FieldExecution com check-in/out falso. Proteções da agenda/planejamento continuam: não reabrir execução encerrada ou cancelar atendimento em andamento. Supervisor/gestão veem apenas a carteira atual autorizada.

Grants/recibos técnicos têm expurgo TTL após a janela de envio + 30 dias; operação antiga já não é aceita quando expurgados. Relatos de visita e auditoria não são apagados por esse TTL. Retenção/eliminação LGPD desses dados segue definição contratual e fluxo próprio, não implementado como expurgo automático neste incremento.

## Homologação
Exige HTTPS em produção, Web Crypto, IndexedDB, service worker e GPS autorizado para visitas. Testes automatizados usam navegador real com rede offline simulada, criptografia/IndexedDB reais, APIs/GPS simulados; a integração MongoDB é testada separadamente. Homologar também em Android/iPhone físicos, incluindo bloqueio de tela, falta de GPS, armazenamento cheio, encerramento pelo sistema e atualização da PWA sem perder pendências.


Referências técnicas de implementação: https://developer.mozilla.org/en-US/docs/Web/API/SubtleCrypto/deriveKey , https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html e https://developer.chrome.com/docs/modern-web-guidance/guides/security/client-side-encryption . São referências para os parâmetros e APIs, não certificação de conformidade do produto.
