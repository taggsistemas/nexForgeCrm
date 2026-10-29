# Regiões, carteiras e planejamento de visitas

## Uso
Menu Carteiras e planejamento: abas Regiões, Carteiras e Planejamento. Todos os cadastros, edições, transferências e confirmações usam modais. Listas são paginadas em 20 registros; seletores pesquisam até 30 opções por consulta.

Regiões são classificações manuais por nome, UF e cidades, sem geocodificação ou desenho de polígonos. Carteiras têm nome, vendedor responsável, região opcional e anotações. Nomes são únicos dentro de cada tenant/empresa, inclusive após inativação. UF e cidades não atribuem clientes automaticamente.

## Propriedade dos dados
Party.ownerId continua sendo a fonte do responsável e do acesso. Party.portfolioId é o vínculo de agrupamento; região é derivada da carteira, sem copiar dados regionais para todos os clientes. Cadastros legados permanecem sem carteira e conservam o vendedor.

Mover cadastros para uma carteira atribui o vendedor dessa carteira. Transferência aceita até 50 IDs com versões explícitas, numa transação. Se qualquer item estiver fora do acesso ou desatualizado, nenhum é transferido. Contatos acompanham o novo responsável com incremento de versão; oportunidades e agenda usam o cadastro pai atual e mudam de acesso automaticamente. Remover da carteira mantém o vendedor atual.

Para evitar divergência, não é permitido trocar o responsável no formulário de relacionamento quando o cadastro pertence a uma carteira. Use a transferência de carteira. Carteiras ocupadas ou com planos em rascunho/publicados não podem trocar de vendedor ou ser inativadas. Crie uma carteira de destino e mova os cadastros. Carteira vazia pode ser inativada mesmo depois da suspensão do vendedor. Região com carteiras ativas não pode ser inativada. Não há exclusão física de regiões/carteiras.

Vendedor da carteira deve ter usuário e vínculo ativos, perfil seller e acesso à empresa. Referências de região/vendedor são verificadas no servidor; contadores internos serializam mudanças de perfil, inativação e atribuições concorrentes.

## Perfis
- Administrador e gerencial: gestão de regiões/carteiras nas empresas autorizadas.
- Administrativo de vendas: gestão de carteiras, sem gestão de regiões.
- Supervisor: gestão de carteiras apenas da sua equipe validada.
- Vendedor: consulta da própria carteira; planejamento apenas nas carteiras do seu acesso.
Permissões region:read e portfolio:read foram adicionadas aos perfis comerciais. portfolio:manage não é concedida ao vendedor. Visit:read/write e activity:read/write continuam separadas.

## Planos
Um plano pertence a uma carteira e deriva seu vendedor no servidor. Título e anotações podem ser editados no rascunho; carteira, vendedor, fuso e período permanecem fixos. Períodos canônicos:
- semanal: segunda-feira até a segunda seguinte;
- mensal: primeiro dia do mês até o primeiro do seguinte;
- trimestral: jan–mar, abr–jun, jul–set ou out–dez;
- semestral: jan–jun ou jul–dez.
A API guarda fim exclusivo; a interface mostra o último dia incluído.

Cada visita do rascunho tem cliente/lead da carteira, data/hora no fuso do plano, duração entre 15 e 480 minutos e objetivo. Até 50 itens por plano. O servidor recusa datas fora do período e sobreposição entre itens do mesmo plano, inclusive em gravações concorrentes. Não há verificação global de conflitos com outros planos ou compromissos, cálculo de deslocamento, feriados ou distribuição automática dos clientes.

Itens de rascunho podem ser editados/removidos com versão; cada alteração também muda a versão do plano. Uma alteração simultânea impede publicação com versão antiga.

## Publicação e acompanhamento
Publicar revalida vendedor ativo, carteira e todos os clientes. Gera, atomicamente, uma AgendaActivity do tipo visita por item, com referência única ao item. Publicação concorrente/repetida não duplica atividades; falha de auditoria reverte toda a publicação. O plano muda de draft para published. Atividades de rascunhos não aparecem na agenda.

O plano publicado lê horário/status das atividades originais, sem duplicar a fonte da agenda. Reagendamento pela agenda deve permanecer no período do plano. Complete a atividade pela agenda; isso representa um registro de atividade, não comprova visita presencial nem substitui check-in/check-out.

Cancelar plano publicado cancela somente atividades futuras pendentes. Passadas e concluídas são preservadas. Encerrar plano exige que todas as atividades estejam concluídas/canceladas; um plano encerrado não permite reabrir pendências pela agenda. Ocorrência de plano cancelado pode ser reativada explicitamente pela agenda, com sua versão atual e dentro do período; isso não reativa o plano.

Se um cliente for transferido depois da publicação, sua atividade acompanha a carteira atual. O plano conserva o vendedor originalmente planejado. O vendedor anterior deixa de ver os dados desse cliente no detalhe; não pode cancelar suas atividades. Um gestor deve revisar/cancelar o plano quando a mudança ultrapassar o acesso do autor. O gestor verá o item sinalizado com carteira alterada. Clientes arquivados também deixam de ser exibidos; esta etapa não permite que um usuário recupere dados arquivados pelo planejamento.

## Segurança e persistência
Novos models: CrmRegion, CrmPortfolio, CrmVisitPlan, CrmVisitPlanItem e CrmTerritoryAudit. Todo dado tem tenantId/companyId próprios. Leituras e alterações aplicam sessão, empresa, permissão e visibilidade atual; IDs e filtros enviados pelo frontend não concedem acesso.

Plano tem proprietário original para autorização do cabeçalho; seus itens são filtrados novamente pelo Party atual antes de contar/paginar. Status do item publicado vem da agenda autorizada. Timestamps internos, vendedor derivado, estado e período final não são aceitos como autoridade do formulário.

Transferências, alterações de itens, publicação e cancelamento usam transações, versões e auditoria. Escritas tocam os documentos pai/carteira/plano para serializar concorrência. Mongoose exige ordered:true para criação em lote numa sessão. MongoDB precisa de replica set, como os demais módulos transacionais.

## API
Base /api/v1/companies/:companyId/territories:
- GET /options?kind=regions|sellers|portfolios|parties&search=...;
- GET/POST /regions e PATCH /regions/:id;
- GET/POST /portfolios e PATCH /portfolios/:id;
- GET /parties e POST /assignments;
- GET/POST /plans e GET/PATCH /plans/:id;
- POST /plans/:id/items, PATCH /plans/:id/items/:itemId e POST /plans/:id/items/:itemId/remove;
- POST /plans/:id/publish, /cancel e /complete, com version.

Rotas de escrita exigem Origin exata e DTOs estritos. Nomes/versões conflitantes retornam 409; referências fora do acesso retornam 404; regras comerciais retornam TERRITORY_RULE_REJECTED (400). Alterar responsável diretamente em um cadastro vinculado retorna PORTFOLIO_TRANSFER_REQUIRED (400).

## Próximo incremento
Rotas e operação em campo: geocodificação autorizada, geração/otimização de percurso, check-in/out, registro de resultados e sincronização offline. O planejamento atual não calcula distância nem registra localização.
