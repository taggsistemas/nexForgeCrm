# Equipes, regiões e execução técnica

## Cadastro dos profissionais
Em **Usuários e equipes**, criar/configurar usuário por modal:
- Perfil Vendedor, Supervisor ou Técnico, com empresas autorizadas.
- Regiões de atuação, selecionadas entre regiões ativas das empresas do tenant.
- Supervisor do vendedor/técnico. Deve ser supervisor ativo, com todas as empresas do subordinado e regiões que cubram as selecionadas.
- No supervisor, a seleção de vendedores mantém o vínculo inverso do vendedor. Transferir vendedor retira o vínculo do supervisor anterior na mesma transação. Técnicos são vinculados pelo próprio cadastro, sem integrar automaticamente o escopo comercial `supervisedUserIds`.

Campos são referências validadas pelo backend, não prova de autoridade enviada pelo frontend. A alteração não transfere clientes/carteiras nem aprova cadastros. Relações antigas de equipe são preservadas quando inequívocas; múltiplos supervisores legados exigem escolha explícita. UI usa versão da configuração para detectar atualização concorrente, quando disponível. Alterações continuam serializadas no Tenant junto ao controle de licenças/auditoria, e encerram as sessões do usuário alterado. Técnico consome licença ativa como os demais.

O técnico recebe apenas acesso à empresa e aos atendimentos técnicos atribuídos, sem ler carteiras inteiras, preços, crédito, qualificações ou dados administrativos. Ao entrar, abre sua rota técnica. Supervisor consulta os técnicos vinculados e dentro de suas regiões atuais; administrador, gerencial e administrativo de vendas organizam os atendimentos nas empresas autorizadas.

## Agenda e rota técnica
Menu **Agenda e rota técnica**. Agendamento manual por modal: cliente aprovado, serviço ativo do catálogo, técnico ativo, horário São Paulo, duração planejada (15 a 480 minutos) e orientações. Cliente com região de carteira exige técnico autorizado nessa região. Referências são verificadas no tenant/empresa e na carteira atual; carteira inválida não remove silenciosamente a restrição regional.

Agendar manualmente não prova que um serviço foi vendido. A criação automática a partir de pedido aprovado depende da próxima etapa de propostas/pedidos; não existe orderId livre aceito do navegador. Preços, faturamento, horas faturáveis, estoque e aprovação de crédito não são gerados por agendamento ou GPS.

Roteiro diário ordenado por horário, incluindo atendimentos abertos fora do dia selecionado. Agendamentos não podem se sobrepor para o técnico; não há otimização viária/trânsito. Listagem e contagens filtram cliente e vínculos atuais antes de paginar. Técnico vê somente tarefas atribuídas; supervisor exige vínculo atual e região derivada da carteira atual, sem aceitar regionId como autoridade. A resposta para o técnico contém apenas dados mínimos do atendimento/cliente, sem a ficha fiscal/comercial completa.

## Execução online
- Check-in/check-out exigem perfil/permissão técnica, atribuição, empresa, técnico ativo, versão e consentimento pontual de localização com coordenadas limitadas.
- Técnico pode iniciar/concluir o próprio atendimento; gerência pode cancelar pendentes ou interromper em andamento com justificativa. Estados encerrados não são reabertos.
- Início, fim, interrupção e cancelamento usam relógio do servidor. Interrupção não inventa checkout geolocalizado.
- Apenas um atendimento aberto por executor. Índice parcial técnico, travas de User.fieldRevision/Membership/Party e verificações cruzadas protegem atendimento técnico, visitas de vendedor e importações offline concorrentes. Agenda/visita comercial não ganha autorização técnica implicitamente.
- Arquivar Party com serviço técnico em andamento é bloqueado. Alteração de região impede novos check-ins fora do acesso; conclusão do atendimento já aberto mantém a atribuição explícita e pode ocorrer com a região alterada, evitando inventar saída. Se a conta/permissão for removida, gerência precisa interromper justificadamente.
- Resultado e histórico auditado na mesma transação. Falha da auditoria desfaz os efeitos.

A localização é a posição informada pelo dispositivo naquela operação, com link de mapa ao clicar. Não é comprovação de presença nem rastreamento em tempo real. Não há captura contínua ou background. HTTPS e permissão do aparelho são necessários. Operação técnica offline não está implementada; não reutiliza grants comerciais ou credenciais forjadas.

## Históricos e catálogo
Qualificação e oportunidades mostram nome atual do autor, ação, data/hora São Paulo e motivo quando houver. Nomes são resolvidos somente entre Memberships do tenant após autorizar o pai; suspensão preserva identificação. Conta removida/sem vínculo legível aparece como “Usuário indisponível”. Nome não é snapshot histórico imutável: renomear usuário muda o rótulo exibido, sem alterar IDs/eventos.

Produtos/serviços usam um cadastro com campos adequados a cada tipo. Serviço oferece **Hora (h)** ou **Serviço fechado**, precisão decimal e prazo de execução. 1,5 h representa uma hora e meia, sem iniciar cobrança automática. NCM/CEST, peso e caixa ficam em produtos. Trocar explicitamente um produto para serviço pede confirmação se houver dados físicos a remover; não há migração silenciosa de registros existentes.

API base `/api/v1/companies/:companyId/technical`: GET/POST `/`, GET `/options`, GET `/:id`, POST `/:id/check-in`, `check-out`, `cancel`, `interrupt`. Autenticação canônica, primeiro acesso, privacidade, trial, empresa e permissões continuam obrigatórios. A homologação integral ainda depende dos testes de integração e de aparelhos físicos; consultar `verification.md`.
