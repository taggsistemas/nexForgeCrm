# Rotas diárias e visitas em campo

## Entrega
Menu **Rotas e visitas em campo**: roteiro diário por data/fuso/responsável, paginação de 50, em ordem de horário agendado. Consulta AgendaActivity de tipo visita, incluindo publicação dos planos; não cria cópias da agenda. Visitas de OpportunityActivity permanecem na agenda e não entram neste incremento da execução de campo.

Check-in e check-out ocorrem em modais, pedem localização pontual autorizada e exigem conexão. Check-out exige resultado e relato, permite próximos passos e conclui a ocorrência na agenda. Uma visita encerrada com contato ausente ou cliente fechado é uma ocorrência atendida; o resultado distingue venda/visita realizada de tentativa. Nenhum pedido ou venda é gerado.

## API
Base `/api/v1/companies/:companyId/field-visits`:
- GET `/daily?date=YYYY-MM-DD&timeZone=America/Sao_Paulo&ownerId=...&page=1`
- GET `/activities/:id`
- POST `/activities/:id/check-in` `{version, locationAuthorized:true, position:{latitude,longitude,accuracy}}` (versão da atividade).
- POST `/activities/:id/check-out` `{version, locationAuthorized:true, position, outcome, notes, nextSteps}` (versão da execução).
- POST `/activities/:id/interrupt` `{version,reason}` (versão da execução; justificativa mínima de 10 caracteres).

`visit:read/write` e, nas mutações, `activity:write`. Tenant/company vêm exclusivamente do contexto autenticado. Toda leitura e escrita revalida Party ativa e propriedade/equipe atual, antes da paginação/contagem. Roteiro retorna capacidades de ação calculadas pelo servidor. Só o responsável atual pode iniciar; só o mesmo executor ainda responsável pode fazer check-out. Supervisores e gestores acompanham apenas seu escopo. Transferência revoga imediatamente o acesso do vendedor anterior. Um gestor autorizado da nova carteira pode interromper com justificativa, sem criar posição de saída fictícia.

## Consistência
CrmFieldExecution é canônico para a execução; AgendaActivity para o compromisso. Índice único scope/activity impede segunda execução da mesma ocorrência. Índice parcial único actorId em `in_progress` impede duas visitas simultâneas inclusive entre empresas. Após interrupção, reagende criando outra ocorrência se necessário.

Transações com auditoria obrigatória, controle de versão e toque em Party/VisitPlan serializam check-in/out, transferência e cancelamento. Todos os horários de execução são do servidor; DTO estrito rejeita horários, ator, tenant e estado enviados pelo cliente. Coordenadas numéricas limitadas, precisão entre 0 e 10.000 m. Agenda comum não pode reescrever ocorrência com execução iniciada/encerrada/interrompida. Cancelamento de plano/série não cancela atendimento aberto. Arquivamento de Party com atendimento aberto é bloqueado. É necessário encerrar/interromper antes.

## Localização e privacidade
HTTPS em produção; navegador solicita permissão apenas ao confirmar cada operação (`getCurrentPosition`, maximumAge 0). Sem rastreamento contínuo, cache autenticado, fila offline ou envio automático a mapas. A execução registra a versão 1.0 do aviso de localização apresentado no modal. O checkbox exprime autorização pontual da interface, não prova base legal ou integridade do GPS. A posição vem de dispositivo não confiável: limites de formato não comprovam presença física. Sem geofencing ou proteção antifraude GPS neste incremento. Gestores com acesso à carteira podem ver coordenadas, precisão, horários e relatos. Prazos de retenção, eliminação, base legal e comunicação trabalhista devem ser definidos pelo cliente no contrato/aviso; não há expurgo automático implementado. Não exportar coordenadas ao grafo ou logs.

Interrupção mantém a entrada, registra horário/ator/motivo, libera o bloqueio de atendimento e cancela a ocorrência. Não é check-out com GPS e não prova realização.

## Próximos incrementos
Geocodificação de endereços, escolha/configuração do provedor, cálculo de distância/tempo e otimização com janelas/restrições. Roteiro atual não calcula trajeto viário, trânsito nem sugere menor distância. Depois: offline com criptografia/expiração local, idempotência e resolução de conflitos, autorização revalidada ao sincronizar. Não considerar a PWA atual apta a gravação offline.

Etapa 7: o roteiro diário aceita filtro por território (Região da propriedade da visita) e mostra propriedade, território, equipamento e objetivo; o endereço exibido passa a ser o da propriedade quando vinculada.
