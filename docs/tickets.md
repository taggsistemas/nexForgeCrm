# Chamados e triagem (etapa 8 — 29/10/2026)

## Escopo
- Abertura manual por cliente, **propriedade (obrigatória)** e equipamento opcional, com origem (telefone, WhatsApp, e-mail, visita, interno, outro), criticidade, título e descrição. A propriedade é obrigatória para o chamado sempre cair na fila do território.
- Criticidade em três níveis fixos (crítico, alto, programado) que ordenam a fila; os nomes exibidos são configurados por empresa (`list:manage`).
- Numeração CH-000001 por empresa (sequência atômica).
- Situações: aberto, em atendimento, aguardando cliente, resolvido e cancelado. Resolver exige descrição da solução; cancelar exige motivo; encerrados são somente leitura.
- Reincidência: o chamado pode apontar um chamado anterior **resolvido** do mesmo cliente ("retorno pela mesma falha").

## Tempos (servidor)
- Abertura, primeiro retorno, resolução e cancelamento são registrados pelo servidor. O único horário digitado é o **prazo pactuado** com o cliente, caso a caso; não há SLA automático.
- Tempo de resposta = primeiro retorno − abertura; tempo de solução = resolução − abertura. Resolver sem primeiro retorno grava o primeiro retorno no mesmo instante.
- "Prazo vencido" quando o prazo pactuado passou antes da resolução (ou ainda em aberto).

## Triagem e histórico
- Ações: primeiro retorno (uma vez), designar responsável, definir prazo, escalonar (com motivo e novo responsável opcional), alterar situação, resolver e cancelar. Todas exigem versão; ações concorrentes geram conflito.
- Cada ação grava um evento imutável com autor, data do servidor, observação e responsável anterior/novo (histórico de designações).
- Responsáveis possíveis: técnicos e coordenações ativos da empresa; a Coordenação Técnica só designa seus técnicos vinculados ou a si mesma.

## Quem vê e quem age
| Perfil | Vê | Abre | Tria |
|---|---|---|---|
| Administrador | Todos da empresa | Sim | Sim |
| Gerencial, Administrativo de vendas | Todos da empresa | Sim | Não |
| Direção, Auditoria | Todos da empresa | Não | Não |
| Supervisor, Vendedor | Chamados dos clientes da carteira atual | Sim (clientes da carteira) | Não |
| Coordenação Técnica | Territórios atuais (região da propriedade) e chamados de seus técnicos, inclusive de clientes sem carteira | Sim (propriedades do território) | Sim, no território |
| Técnico | Somente chamados designados a ele | Não | Não |

O escopo é aplicado antes de contagens e paginação. Cliente com chamado aberto não pode ser arquivado.

## API
Base: /api/v1/companies/:companyId/tickets
- GET / (fila: status open/closed/all, criticality, regionId, assigneeId, partyId, equipmentId, overdue, search) e POST /.
- GET /:id (registro e histórico), POST /:id/{first-response,assign,deadline,escalate,status,resolve,cancel}.
- GET /options (clientes, propriedades e equipamentos que o ator pode usar na abertura), GET /assignees, GET/PUT /settings.

## Fora do escopo
Alertas automáticos (RF-CHA-005) e indicadores consolidados (etapa 11). OS vinculadas: ver technical-work.md (etapa 9).
