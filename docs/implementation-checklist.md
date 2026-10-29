# Plano de programação e checklist — NexForge CRM

Atualização: 29/10/2026. Referência: requisitos funcionais v1.0 recebidos do cliente, identificados como NexForge Agro; produto permanece NexForge CRM. Execução inicial com entrada manual de dados. Importações e integrações externas ficam para evolução posterior, sem declarar o RF-CAD-006 original atendido.

## Etapas

| Etapa | Situação | Entregas |
| --- | --- | --- |
| 1. Padronizar telas e modais | Implementada; homologação de uso pendente | Padrão visual compartilhado, navegação, formulários, listas, feedback e responsividade |
| 2. Completar perfis e permissões | Próxima | Direção, Coordenação Técnica e matriz de ações/escopos; adequação dos perfis existentes |
| 3. Evoluir clientes e contatos | Pendente | Origem, segmento, potencial, próxima ação, papéis e preferências |
| 4. Propriedades/locais | Pendente | Vários locais por cliente e vínculos autorizados |
| 5. Parque instalado | Pendente | Equipamentos, série, instalação, garantia e histórico |
| 6. Oportunidades e propostas | Pendente | Vínculos com local/equipamento e proposta versionada com itens/validade/status |
| 7. Agenda e visitas | Pendente | Adaptar ao local/equipamento e uniformizar filtros |
| 8. Chamados e triagem | Pendente | Criticidade, primeiro retorno, prazo pactuado, distribuição e escalonamento |
| 9. OS básica | Pendente | Diagnóstico, execução, horas apontadas, deslocamento, solução e reincidência |
| 10. Peças utilizadas | Pendente | Consumo/devolução documentados na OS, inicialmente sem baixa automática |
| 11. Dashboards | Pendente | Visões por perfil e indicadores territoriais comerciais/técnicos |
| 12. Homologação e piloto | Pendente | Aceites, testes integrados, dispositivos, exportação e restauração demonstrada |

## Etapa 1 — checklist de implementação

- [x] Consolidar aparência de botões, inputs, selects, textareas, seções e filtros no estilo compartilhado.
- [x] Aplicar temas claro/escuro e feedback de erro/sucesso com texto, sem depender apenas de cor.
- [x] Uniformizar listas e tabelas, preservando rolagem horizontal local em tabelas extensas no celular.
- [x] Compartilhar o mesmo modal também no cadastro de empresa do painel Master.
- [x] Preservar cabeçalho do modal e uma área principal de rolagem interna; bloquear fundo.
- [x] Iniciar foco no título do diálogo; manter contenção nativa, Escape quando permitido e retorno ao disparador.
- [x] Oferecer largura compacta para recuperação de acesso; manter largura ampla para cadastros.
- [x] Acrescentar acesso direto por teclado ao conteúdo principal.
- [x] Melhorar menu móvel: ícone legível, fundo de fechamento, Escape, ciclo de foco e retorno ao botão.
- [x] Ajustar checkboxes para não herdarem dimensões de inputs de texto.
- [x] Retirar paginação vazia dos seletores de atendimento técnico.
- [x] Padronizar ações de cancelar/salvar no catálogo.
- [x] Acrescentar testes com componentes React montados, API sintética, dois temas e três tamanhos de tela.
- [ ] Homologar visual e uso com Giovanni e usuários do piloto em aparelhos físicos.
- [ ] Executar integralmente os testes HTTP/MongoDB/E2E em ambiente com conexão local disponível.

### Cobertura e limites

Estilos compartilhados alcançam dashboard/pipeline, relacionamento/qualificação, oportunidades, agenda, carteiras, catálogo/preços, campo, técnico, offline, segurança, usuários e Master. A suíte nova monta telas reais de relacionamento, oportunidades, agenda, catálogo, técnico, campo, carteiras, usuários, entrada offline, login e Master público/autenticado. Abre os editores iniciais de leads, oportunidades, agenda, catálogo, agendamento técnico, usuários e empresa. Não simula todas as variações de edição, dados volumosos ou operações financeiras. Os testes existentes cobrem geometria de qualificação extensa, histórico, serviços por hora, dashboard e diálogo aninhado.

Testes visuais utilizam dados sintéticos e API simulada. Não comprovam autorização, persistência ou integridade MongoDB. Rolagem em formulários longos é preservada para não esconder conteúdo. A proteção de rascunhos contra fechamento acidental não foi generalizada nesta etapa; manter como refinamento de UX com critérios próprios.

## Próxima etapa — 2. Completar perfis e permissões

- [ ] Inventariar permissões efetivas atuais por endpoint e domínio.
- [ ] Especificar matriz para Administrador, Direção, Gestão Comercial, Vendedor, Coordenação Técnica e Técnico.
- [ ] Separar gestão técnica de atribuições comerciais; preparar Financeiro, Estoque e Auditoria conforme seus módulos.
- [ ] Aplicar empresa/território/equipe/atribuição no backend sem confiar em filtros enviados pelo navegador.
- [ ] Preservar qualificação, crédito, carteira comercial e atribuições técnicas existentes.
- [ ] Adaptar cadastro de usuário e navegação aos perfis.
- [ ] Testar tentativas de acesso cruzado, mudanças de vínculo e usuários suspensos.
- [ ] Atualizar este checklist e informar a próxima etapa ao concluir.

### Ajuste após revisão da etapa 1
- [x] Aumentar o respiro dos botões em barras, cards, seções e rodapés de modais, mantendo tamanhos de toque e rolagem organizada.
- Próxima etapa permanece: 2. Perfis e permissões.
