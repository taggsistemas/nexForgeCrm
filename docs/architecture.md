# Arquitetura aprovada — fundação
Monorepo com monólito modular. API e futuro worker em processos separados.
Frontend e backend independentes do ERP. MongoDB e credenciais exclusivos.

## Multiempresa
Tenant é a organização contratante; Company é empresa/filial.
User possui Membership em cada tenant, com empresas, perfis e escopos autorizados.
O servidor produz AccessContext após verificar sessão e vínculo.
Toda entidade de negócio possui tenantId; entidades de empresa possuem companyId.
Índices únicos incluem o escopo. Referências e agregações devem validar o tenant.
O helper de escopo é uma base, não prova de isolamento de um banco ainda inexistente.

## Domínios e fontes de verdade
Identidade: usuários, sessões, vínculos, perfis e permissões.
Organizações: tenants, empresas, configurações.
Relacionamento: leads, clientes, contatos e endereços.
Estrutura comercial: vendedores, supervisores, regiões e carteiras.
Oportunidades: pipeline, etapas e histórico.
Agenda: atividades, recorrências e lembretes.
Planejamento: planos semanais, mensais, trimestrais e semestrais.
Rotas: paradas, restrições, tempos e provedor substituível.
Visitas: check-in/out, precisão, autorização, registro e anexos.
Catálogo: produtos e serviços; autoridade configurável quando integrado.
Comercial: propostas versionadas, pedidos comerciais e aprovações.
Desempenho: metas, comissão e forecast.
Gestão: projeções derivadas, sem duplicar autoridade de dados.
Integrações: mapeamentos externos, inbox/outbox e reconciliação.
Privacidade: retenção, solicitações e auditoria.

## Offline
IndexedDB por conta e tenant, fila idempotente, versão e conflitos explícitos.
Revalidar permissões e condições comerciais no servidor.
Aprovações exigem conexão. Logout limpa dados da conta.
O service worker só pode armazenar assets públicos. Dados comerciais ficam
sob política própria. Sincronização comercial ainda não implementada.

## Segurança e privacidade
Hash robusto de senhas, sessões revogáveis, autorização no servidor.
Não registrar tokens nem localização em logs gerais.
Localização limitada à finalidade; permissão do navegador não define base legal.
Retenção, exportação e eliminação precisam considerar obrigações aplicáveis.
Não prometer revogação instantânea de dados de dispositivo que permanece offline.

## Decisões pendentes
Validar identidade visual oficial; provedor de mapas e custos; canais de deploy;
base legal e retenção por finalidade; versão Graphify e provedor semântico;
lockfile e resultados de testes quando houver conectividade.
## Domínio de oportunidades
O cadastro de relacionamento é a fonte da carteira. CrmOpportunity referencia Party e deriva o responsável atual; CrmOpportunityActivity referencia oportunidade e herda o mesmo escopo. CrmOpportunityHistory guarda eventos internos de auditoria e ator. Nenhuma dessas coleções envia eventos externos ao ERP neste incremento. Moeda BRL e centavos inteiros são contratos próprios do CRM. A camada de aplicação verifica autorização pelo pai em leituras e escritas; contadores internos serializam mutações relacionadas dentro de transações MongoDB.

## Domínio da agenda
CrmAgendaActivity registra compromissos diretos de Party; CrmOpportunityActivity continua sendo a única fonte das atividades comerciais já cadastradas. A agenda unifica consultas por agregação, filtra o pai autorizado antes de contar/paginar e não migra dados. CrmAgendaSeries materializa ocorrências limitadas numa transação; CrmAgendaAudit registra mutações próprias. Data/hora local e fuso são convertidos no backend por regras IANA. A carteira continua pertencendo ao cadastro de relacionamento.

## Regiões, carteiras e planejamento
Party.ownerId permanece autoridade de acesso; Party.portfolioId agrupa os cadastros e a região deriva de CrmPortfolio.regionId. CrmVisitPlan guarda vendedor/período originais; CrmVisitPlanItem é o rascunho de horário e objetivo. Após publicar, AgendaActivity é a fonte dos horários/status e referencia o item único. O acesso de cada item segue o Party atual, independentemente do proprietário histórico do plano. Não há evento enviado ao ERP neste incremento.
