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