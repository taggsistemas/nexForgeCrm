# Etapas — ordem revisada

Regras detalhadas e auditoria do que existe: [commercial-rules-review.md](commercial-rules-review.md). Esta ordem substitui a numeração inicial; os registros de incrementos abaixo são históricos.

0. Fundação e plataforma independente, segurança, tenants e sessões.
1. Relacionamento, pipeline e oportunidades.
2. Agenda, carteiras, regiões, planejamento e execução online de visitas.

**Pré-requisito antes do offline:** lead mínimo, qualificação completa submetida à análise administrativa, revisão com motivo, aprovação/conversão atômica, crédito/pagamento e política explícita de clientes existentes. Implementado; sem migração automática, com regularização por revisão. Ver lead-qualification.md.

3. Operação offline: carteira criptografada, atividades/visitas agendadas e espontâneas, idempotência e revisão de conflitos implementadas. Ver offline.md. Homologação em aparelhos reais e finalização da instalação PWA seguem pendentes.
4. Catálogo e tabelas de preços: primeira implementação de produtos/serviços, unidades, composição de caixas/kits, peso, fiscal, prazos e seis abrangências. Ver catalog-pricing.md. Validação MongoDB/E2E e homologação pendentes; pedidos e peso aferido continuam futuros.
5. Propostas/pedidos, aprovação comercial e status operacionais. Ainda pendente.
6. Metas globais/regionais/individuais, comissões, forecast e central gerencial. Ainda pendente.
7. Integração opcional ERP, contratos e visão federada dos grafos. Ainda pendente.
8. Piloto e homologação: implantação HTTPS, Android/iPhone reais, backup/restauração, acessibilidade e monitoramento.

## Aceite da fundação
- Build e typecheck aprovados.
- Testes unitários e HTTP aprovados.
- E2E desktop/móvel e shell offline aprovados.
- Graphify instalado em versão fixa e extração TypeScript/React validada.
- Grafo com metadados e proveniência.
- Repositório privado na conta taggsistema e primeiro push confirmado.
Itens dependentes de rede permanecem pendentes, não concluídos.

## Próxima etapa
User, Tenant, Company, Membership, Role, Session e serviços de autenticação.
Começar por testes de acesso cruzado entre tenants e empresas usando MongoDB real
de teste, antes de liberar endpoints de negócio.
## Incremento de identidade (2026-10-28)
Modelos, sessões, bootstrap e formulário implementados; aguardam validação completa.
CI do commit inicial 8e29a6b aprovado; não representa aprovação deste incremento.

## Prioridade após a fundação visual e o cadastro master
1. Segurança: executar os testes MongoDB A/B, concluir políticas e aplicar o escopo obrigatório em cada novo repositório.
2. Administração do tenant: empresas, usuários, perfis e permissões; auditoria e ciclo de vida de contas.
3. Primeiro módulo comercial: leads, clientes e contatos, com testes completos de acesso cruzado.
4. Pipeline e atividades; depois planejamento de visitas, rotas e operação offline.
5. Propostas, catálogo, pedidos e aprovações; metas e central gerencial.
6. Homologação da implantação, backups e monitoramento; piloto controlado.
Cada módulo só é liberado depois de provar isolamento no backend, independentemente da interface. Ver docs/security.md.

## Incremento concluído: usuários, perfis e sessão única
Administração do tenant agora permite cadastrar usuários, atribuir perfis padrão/empresas, configurar equipe do supervisor e suspender/reativar contas com auditoria. Sessão única é persistida no MongoDB. Suítes MongoDB reais foram executadas localmente com dados temporários. Próximo domínio comercial: leads, clientes e contatos, usando commercialFilter e a política de propriedade/equipe. Cadastro de empresas adicionais, recuperação de senha e MFA continuam em etapas próprias.

## Incremento entregue: relacionamento e acesso
Leads, clientes, contatos, conversão preservando vínculos, carteira por perfil, auditoria, conflitos de edição e formulários em modais implementados. Senha temporária com troca obrigatória, recuperação por e-mail e aceite versionado implementados. Configurar SMTP para entrega real. Operações comerciais offline e sincronização permanecem futuras; a PWA atual não grava esses cadastros offline.
Pedidos e tabelas de preços constam em commercial-scope.md e nos contratos planejados. Ainda não possuem telas, persistência nem motor de cálculo.

## Incremento entregue: pipeline de leads e qualificação progressiva
Cadastro inicial reduzido e endereço opcional expansível. Dados fiscais e endereço completo são exigidos ao qualificar e antes da conversão, no backend. Pipeline por etapa com paginação, pesquisa e auditoria de transições. Ver lead-qualification.md.
Próximo incremento: oportunidades comerciais (valor, fechamento esperado, ganho/perda e histórico) e atividades vinculadas. Não confundir o pipeline de leads entregue com o ciclo completo de negociação.

## Incremento entregue: oportunidades e atividades vinculadas
Oportunidades com valores em BRL, fechamento previsto, descoberta/proposta/negociação e encerramento por ganho/perda com motivo. Histórico transacional e atividades vinculadas (ligação, e-mail, reunião, tarefa) com prazo/status, tudo por modais. Carteira deriva do vínculo atual. Ver opportunities.md.
Próximo incremento: agenda comercial geral e calendário, atividades/recorrências e planejamento de visitas. Pedidos, preços, forecast e integrações continuam nas etapas próprias.

## Incremento entregue: agenda comercial
Calendário dia/semana/mês; filtros; atividades diretas de leads/clientes e atividades de oportunidades existentes; recorrência diária/semanal/mensal; edição por ocorrência e cancelamento das próximas pendentes. Fuso explícito, totais completos por dia e autorização pelo vínculo atual. Ver agenda.md.
Próximo incremento: planejamento semanal/mensal/trimestral/semestral de visitas, regiões e carteiras. Rotas, geolocalização e operação offline permanecem depois desse planejamento.

## Incremento entregue: regiões, carteiras e planos de visitas
Regiões por UF/cidades; carteiras de vendedor com transferências transacionais; planos semanais/mensais/trimestrais/semestrais em rascunho e publicação de visitas na agenda. Permissões por empresa/carteira/equipe, prevenção de sobreposição dentro do plano, versões e auditoria. Ver territories.md.
Próxima etapa: rotas diárias e operação em campo (check-in/out e resultados); depois sincronização offline. Geocodificação e otimização ainda precisam de definição de provedor/contrato.

## Incremento entregue: roteiro diário e execução em campo
Roteiro cronológico de visitas diretas da agenda/planos publicados, localização pontual autorizada no check-in/out, resultado/relato/próximos passos, atendimento único por usuário e interrupção justificada. Acompanhamento por carteira/equipe atual. Ver field-visits.md. Otimização viária, geocodificação, execução de atividades vinculadas a oportunidades e sincronização offline continuam futuras.

## Plataforma: trial e licenças
Trial opcional de 30 dias no cadastro, plano padrão de 25 licenças, adicionais e projeção de valores configuráveis, controle concorrente no backend e olho de senha nos formulários. Ver subscriptions.md. Offline continua como próxima etapa, condicionado a expiração, sessão única e autorização atual na sincronização.


Execução técnica adicionada como domínio separado: perfil Técnico, supervisor/regiões, agendamento manual de serviços e roteiro/check-in/out online. Automação a partir de serviço vendido depende de propostas/pedidos; não considera agendamento como venda. Ver technical-work.md. Validação integral pendente.

## Plano vigente do piloto com entrada manual (29/10/2026)
A sequência de programação acordada após análise dos requisitos do cliente está em [implementation-checklist.md](implementation-checklist.md). Ela prioriza propriedades, parque instalado, propostas, chamados e OS básica antes das evoluções P1/P2, aproveitando o comercial e a execução já existentes. Importação/integração fica posterior por decisão explícita; não representa cumprimento do requisito original de importação. Etapa 1 de padronização visual implementada, com homologação de uso ainda pendente; próxima etapa: perfis e permissões. As seções anteriores deste arquivo permanecem como histórico.
