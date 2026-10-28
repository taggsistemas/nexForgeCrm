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