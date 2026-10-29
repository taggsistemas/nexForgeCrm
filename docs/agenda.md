# Agenda comercial

## Uso
No menu Agenda e visitas, o calendário oferece dia, semana (segunda a domingo) e mês (grade de 42 dias). Há navegação de períodos, Hoje, filtros por responsável, tipo, status e pendências atrasadas no período. O fuso é explícito, com America/Sao_Paulo como padrão e opções brasileiras.

A agenda reúne atividades novas ligadas diretamente a leads/clientes e as atividades de oportunidades já existentes. Não duplica nem migra os registros antigos. Novos compromissos podem se vincular a oportunidade aberta, ou a lead mesmo antes da qualificação. Tipos atuais: ligação, e-mail, reunião e tarefa. Responsável acompanha a carteira atual do vínculo; não há designação independente por atividade.

Cadastro, edição e cancelamento de série usam modais. O formulário registra título, vínculo, tipo, data/hora, fuso, anotações e recorrência opcional. Alterar uma atividade afeta apenas aquela ocorrência, inclusive quando aberta pelo módulo de oportunidades. Datas de conclusão são geradas pelo servidor; cancelamento não elimina registros.

## Calendário e limites de consulta
API exige intervalo entre 1 e 42 dias, datas de calendário e fuso permitidos. O fim é exclusivo. A lista tem 50 atividades por página; os totais de cada dia consideram todo o resultado autorizado/filtrado, não apenas a página atual. O calendário exibe títulos da página e permite abrir um dia para detalhar suas atividades. No celular, a grade semanal/mensal tem rolagem horizontal interna; a lista permanece responsiva.

Atraso significa status pendente e prazo anterior ao instante atual, dentro do intervalo selecionado. Para consultar pendências antigas é preciso selecionar o período correspondente. Status combinado com Somente pendentes atrasadas aplica ambos os filtros.

## Recorrência
Diária, semanal e mensal, com intervalo entre 1 e 12 e quantidade explícita incluindo a primeira ocorrência. Limite de 52 ocorrências por criação e horizonte máximo de 366 dias. Todas são materializadas numa única transação, sem depender de agendador de tarefas. A série registra regra e fuso originais.

Recorrências conservam o horário local conforme as regras IANA, inclusive mudanças históricas de horário de verão. Horários inexistentes são recusados, sem deslocamento silencioso. No mês que não tem o dia original, usa-se o último dia; meses seguintes voltam a usar a âncora original (31/jan → 28/fev → 31/mar).

Não há edição global da regra nesta entrega. Para mudar a recorrência, cancele as próximas e crie outra série. Cancelar próximas afeta apenas ocorrências pendentes com prazo igual ou posterior à confirmação no servidor. Passadas e concluídas são preservadas; cada ocorrência cancelada recebe nova versão. A série fica cancelada e não pode ser cancelada novamente. Uma ocorrência pode ser reagendada/reativada individualmente após recarregar sua versão; isso não reativa a série.

## Fontes e autorização
CrmAgendaActivity contém atividades ligadas diretamente a Party. CrmOpportunityActivity permanece como fonte única das atividades de oportunidade e recebe somente metadados opcionais de série. CrmAgendaSeries guarda a recorrência; CrmAgendaAudit registra ações de criação/edição/cancelamento. Alterações em atividades de oportunidade continuam auditadas também no histórico comercial existente.

Toda operação exige sessão validada, tenant, empresa, activity:read/write, leitura do tipo de cadastro e carteira/equipe atual. Oportunidades exigem também pipeline:read. Listagens juntam as duas fontes e filtram pelo cadastro pai autorizado antes de contar, agrupar ou paginar. O filtro de responsável só restringe o acesso já concedido. Transferência/arquivamento do pai afeta ambas as fontes imediatamente.

Criação/edição/cancelamento são transacionais. Escritas tocam o cadastro pai para serializar com mudança de carteira/arquivamento. Criação em oportunidade toca também sua revisão interna, evitando atividades novas após encerramento concorrente. Versão otimista impede sobrescrita silenciosa. Novas atividades em oportunidades fechadas são recusadas; existentes podem ser concluídas/canceladas.

## API
Base /api/v1/companies/:companyId/agenda:
- GET /owners e GET /references?source=party|opportunity&search=...;
- GET /activities?startDate=YYYY-MM-DD&endDate=YYYY-MM-DD&timeZone=...&page=...;
- POST /activities: link {source,id}, title, type, startLocal (YYYY-MM-DDTHH:mm), timeZone, notes e recurrence {frequency,interval,count};
- GET /activities/:source/:id: ocorrência atual e metadados da série;
- PATCH /activities/:source/:id: version e campos permitidos; startLocal e timeZone são enviados juntos;
- POST /series/:id/cancel: version da série.

Consultas também aceitam status, type, ownerId e overdue=true|false. Nenhum DTO aceita tenantId, companyId, ownerId de gravação, seriesId ou datas de conclusão. Erros não retornam conteúdo interno. Origin exata é exigida nas alterações.

## Próxima etapa
Planejamento de visitas por carteira, equipe e região, nos períodos semanal/mensal/trimestral/semestral. Visitas, rotas, check-in/out, notificações, calendários externos e sincronização offline permanecem fora desta entrega. A atividade do tipo e-mail é um registro de tarefa e não envia mensagem automaticamente.
