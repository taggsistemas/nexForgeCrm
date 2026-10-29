# Ajustes da homologação comercial

- Visão geral e Pipeline mostram indicadores numéricos autorizados: novos leads, em contato, aguardando aprovação, devolvidos para revisão e clientes aprovados/legados. Clicar abre lista e busca em modal. O cliente aprovado é consultado na coleção lógica de clientes, preservando sua identidade; não permanece artificialmente como lead.
- Listas usam escopo e totais do backend, sem contar uma única página como total. Indicadores atualizam a cada 15 segundos e ao retornar à janela. Nenhuma resposta autenticada entra no service worker.
- Qualificação aberta atualiza decisões remotas a cada 10 segundos e ao retornar à janela, somente sem alterações locais e fora de gravação. Devolução habilita a edição do vendedor sem nova submissão pelo administrativo. Não sobrescreve rascunho local alterado; concorrência continua sujeita à versão otimista no backend.
- São Paulo (`America/Sao_Paulo`) é o padrão da interface. Seletores de fuso foram removidos. Datas de atividades offline/oportunidades são interpretadas nesse fuso mesmo se o aparelho estiver em outro. UTC é usado para armazenar instantes; São Paulo não é UTC zero. Regras de fusos de séries antigas são preservadas no backend.
- Oportunidade é uma negociação com valor, previsão e resultado. Explicação aparece no módulo e no dashboard. Ganho não cria pedido.
- Vendedor agenda pelo modal da Agenda, tipo Visita e cliente da carteira. Administrativo agenda manualmente ou publica plano para a carteira. “Gerar roteiro do dia” consulta automaticamente as visitas existentes e ordena por horário; não cria duplicatas nem calcula trânsito/distância. Otimização viária exige provedor de mapas e continua pendente.
- Ao perder rede, a interface abre o espaço offline automaticamente; se a carteira já está aberta nele, permanece montada. A tela de login não tem mais o botão de acesso offline. Falha de transporte ao verificar a sessão também direciona ao espaço offline, sem criar conta online fictícia.
- Carteira continua exigindo preparo prévio e senha local para desbloquear, respeitando prazo/sessão/trial. Sem chave persistida, não é possível eliminar esse desbloqueio com segurança.
- Reconexão com carteira aberta ou desbloqueio online inicia sincronização. Permissões/identidade/carteira são revalidadas; conflito exige revisão explícita. Falha incerta conserva ID e pendência; botão manual permanece para repetir após erro. Não há sincronização em background com a PWA fechada ou bloqueada.

Catálogo e preços: ver `catalog-pricing.md`. Validação desta execução: ver `verification.md`.
