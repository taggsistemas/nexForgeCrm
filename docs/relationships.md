# Relacionamento, acesso inicial e recuperação

## Usar o CRM
Entrar como usuário do cliente e abrir Relacionamento > Leads, clientes e contatos.
Selecionar uma empresa autorizada. Leads e clientes possuem listas com busca e
paginação, criação/edição por modal, arquivamento e responsável.
Ações de contato partem de um lead/cliente ou da aba Contatos com vínculo selecionado.
A conversão preserva a identidade e os contatos. Arquivar oculta registros ativos
e os contatos vinculados; não é exclusão física nem eliminação LGPD.

Atualizações exigem a versão lida: conflito retorna 409. PATCH preserva campos
omitidos e valida endereço completo após combinar o patch com o endereço atual.
Valores de tenant, empresa, versão interna, kind, archived e permissões não são
campos editáveis. ownerId é um seletor validado no escopo de visibilidade e da empresa.
Trocar o responsável acompanha os contatos na mesma transação.
CPF/CNPJ (inclusive alfanumérico), telefone, CEP e IE usam máscaras/normalização;
e-mails são validados, não recebem máscara artificial. Só o CEP é enviado ao ViaCEP.
IE tem formatação conforme os formatos previstos; não há consulta à SEFAZ nesta etapa.

## Primeiro acesso e privacidade
Novas contas criadas pelo administrador do cliente ou pelo Tagg Master recebem
senha temporária, com troca obrigatória antes do acesso administrativo/comercial.
Contas anteriores mantêm a senha existente. A troca confirma a senha atual,
incrementa passwordVersion e revoga sessões e recuperações antigas.
É necessário entrar novamente com a senha pessoal.
A versão atual dos termos/aviso deve ser aceita por cada vínculo usuário/tenant.
O aceite é ciência e concordância com regras de uso; não é consentimento geral
para tratar dados para qualquer finalidade.
A interface e a API bloqueiam a operação pendente. Alterar o frontend não remove
essa restrição. O aceite registra versão, hash, usuário, tenant e horário.
Ver a minuta em data-processing-agreement.md e preencher dados contratuais antes da produção.

## Recuperação por e-mail
O login do cliente possui Esqueci a senha. O backend mantém uma fila persistente
com resposta genérica para contas existentes/inexistentes. O worker seleciona
a conta registrada, gera token aleatório e armazena somente seu hash com validade
de 20 minutos. O link usa a origem WEB_ORIGIN confiável e o token no fragmento
da URL, removido da barra pelo formulário; não vem de Host ou URL do navegador.
O reset é de uso único, não autentica automaticamente e revoga as sessões.
A fila usa lease para múltiplas instâncias, retentativa e logs sem links/credenciais.
Mudança/reset cancelam recuperações pendentes. O SMTP não participa do tempo
de resposta da requisição pública. Os limites atuais são locais ao processo;
antes de escalar instâncias, usar limitação compartilhada e proxy confiável.

Configurar apenas no backend:
```dotenv
SMTP_HOST=smtp.seu-provedor.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=usuario-do-provedor
SMTP_PASSWORD=segredo-do-provedor
SMTP_FROM=acesso@seudominio.com
PRIVACY_CONTACT_EMAIL=privacidade@seudominio.com
```
Usar 465 com SMTP_SECURE=true para TLS implícito, ou 587/STARTTLS com false.
A validação de certificados não é desativada. Não colocar esses valores em variáveis VITE_.
O .env real não foi alterado. Sem configuração de e-mail, a recuperação retorna
indisponibilidade; não simula envio nem imprime o link no console.
Neste incremento, recuperação e senha temporária atendem os usuários dos clientes.
O Tagg Master mantém sua autenticação independente; recuperação do master é escopo separado.

## Limites do incremento
Pedidos, motor de preços, catálogo, regiões e equipes comerciais completas seguem
o escopo registrado em commercial-scope.md, não foram apresentados como operacionais.
Recuperação de senha do master, MFA, gestão completa de solicitações LGPD e
eliminação/exportação contratual ainda exigem seus próprios incrementos.
Documentos legais são base técnica/minuta e precisam da revisão e identificação
das partes antes de publicação em produção.

## Cadastro progressivo de leads
Ver lead-qualification.md. PartyView inclui contactName (contato principal resumido). GET /leads aceita stage com enum estrito; filtro mantém tenant/empresa/carteira. LEAD_QUALIFICATION_REQUIRED (400) recusa etapa qualificada incompleta ou conversão antes da qualificação. PATCH valida a combinação persistida + alterações. Dados omitidos permanecem. Auditoria lead.stage_changed registra etapa anterior/próxima.

## Ficha do cliente e classificação (etapa 3 — 29/10/2026)

- **Documento único no grupo.** CPF/CNPJ ativo é único no tenant (todas as empresas do grupo), não apenas na empresa. Cada cliente pertence a uma única empresa. O serviço verifica a disponibilidade antes de gravar (cadastro ou qualificação) e responde 409 `DOCUMENT_ALREADY_REGISTERED` sem revelar o cadastro ou a empresa existente. O índice `tenant_tax_id_unique` garante a regra no banco. Arquivar libera o documento.
- **Bancos existentes.** Antes de publicar, executar `npm run db:tax-ids`: lista apenas IDs internos dos cadastros duplicados por grupo. Corrigir ou arquivar os duplicados e executar `npm run db:tax-ids -- --apply`, que cria o índice por grupo e remove o antigo por empresa. Enquanto houver duplicados, a API inicia com o aviso `TAX_ID_DUPLICATES_PENDING` e a verificação do serviço continua valendo para novos cadastros.
- **Listas configuráveis por empresa.** Origem, segmento, classificação e potencial são opções com ID; renomear não reescreve clientes. Valores iniciais são criados na primeira leitura. Perfis com `list:manage` (Administrador, Gerencial, Administrativo de vendas) incluem, renomeiam e desativam opções. Desativar impede novos usos e preserva cadastros existentes. Opções de outra empresa ou de outro tipo são recusadas.
- **Próxima ação.** Data de calendário (sem horário) e descrição curta, no lead e no cliente. O cadastro inicial de lead continua mínimo: classificação e próxima ação são opcionais.
- **Responsável técnico.** Somente clientes; apenas usuários ativos da empresa com perfil Técnico ou Coordenação Técnica. É informativo: não concede ao técnico acesso à carteira comercial.
- **Contatos.** Papéis (decisor, compras, financeiro, técnico, proprietário, operação, outro), canal preferido e autorização de comunicação comercial. Data e autor da autorização ou retirada são gravados pelo servidor; o navegador só informa concedido ou não.
- **Histórico.** Alterações de nome, razão social, documento, IE, responsáveis, classificação e tipo gravam antes/depois. A ficha (Resumo, Contatos, Histórico) mostra eventos do cadastro, dos contatos e da qualificação com nomes atuais; IDs de usuários e opções são resolvidos apenas dentro do tenant. Transferências de carteira continuam registradas no histórico de Carteiras.
