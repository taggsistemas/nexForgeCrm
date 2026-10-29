# Pipeline de leads e cadastro progressivo

No cadastro inicial, o formulário mostra nome da empresa, nome do contato principal, telefone e e-mail. Somente a empresa é obrigatória para registrar um prospect ainda incompleto. Endereço fica em uma seção expansível opcional. Responsável, etapa e anotações são controles operacionais; o servidor determina o escopo permitido.

O pipeline de leads tem Novo, Em contato, Qualificado e Descartado. A visão usa consultas paginadas independentes por etapa, com totais do backend, pesquisa e o mesmo isolamento de tenant, empresa e carteira/equipe da lista. Alterar etapa é feito no modal de edição; Qualificar abre o modal já na etapa de qualificação. Não há arrastar e soltar.

Para salvar como Qualificado são exigidos contato principal, telefone, e-mail, razão social/nome completo, CPF/CNPJ válido e endereço (rua, número, bairro, cidade, estado, país e CEP brasileiro). IE é opcional. Tipo de cliente permite atacado, varejo e outro. A regra é aplicada ao registro completo resultante na API, inclusive em alterações parciais e criação direta como qualificado. Erro não altera o cadastro. Conversão exige etapa Qualificado e cadastro completo; preserva ID, responsável e contatos vinculados.

O contato principal é um resumo do prospect no cadastro da empresa; contatos adicionais continuam no módulo Contatos. Esses dois campos não são espelhados automaticamente. Cadastros legados preservam seus dados; um lead antigo marcado como qualificado precisa completar os dados ao editar/converter. Clientes já existentes não são bloqueados retroativamente por esta regra.

Mudanças de etapa geram auditoria com etapa anterior e seguinte na mesma transação, além da auditoria de edição. Versões otimistas impedem sobrescrita concorrente. O frontend não envia campos fiscais ocultos ao editar um lead não qualificado, preservando dados legados.

Este incremento entrega o pipeline de captação/qualificação de leads. Oportunidades com valores, previsão de fechamento, ganho/perda e tarefas comerciais são a próxima parte do pipeline; catálogo, preços, propostas e pedidos permanecem no escopo comercial futuro. Não há gravação comercial offline neste incremento.
