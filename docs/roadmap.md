# Etapas
0. Fundação: monorepo, GitHub, CI, documentação, Graphify e builds verificados.
1. Plataforma: autenticação, tenants, empresas, vínculos, perfis, permissões.
2. CRM: leads, clientes, contatos, carteiras e oportunidades.
3. Agenda: atividades, recorrências e planejamento em todos os períodos.
4. Campo: rotas, visitas, check-in/out, localização e sincronização offline.
5. Comercial: catálogo, propostas, pedidos e aprovações.
6. Gestão: metas, comissões, forecast e central gerencial.
7. ERP opcional: contratos, adaptadores e reconciliação.
8. Piloto: acessibilidade, desempenho, backup/restauração e validação móvel.

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
