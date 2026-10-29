# TAGG Master: trial, licenças e valores

## Regras entregues
- Novos clientes podem ser Contratado ou Trial. Padrão contratado para preservar cadastros/integrações anteriores; o Master escolhe trial ao cadastrar.
- Trial começa no cadastro ou na primeira ativação explícita pelo Master, pelo relógio do servidor, e termina exatamente 30 × 24 horas depois. Não é contado a partir do primeiro login nem das datas livres do contrato.
- Login verifica expiração depois de validar a senha; credenciais inválidas não revelam situação do tenant. Sessões existentes também revalidam o trial em cada autenticação. Expirou: acesso de negócio recusado. Sem exclusão de dados ou cobrança automática.
- Suspender/reativar e alterar licenças não reinicia trial. É possível iniciar o primeiro trial de um cliente já existente que nunca o utilizou. Cliente que já teve trial não pode reiniciá-lo ao voltar de contratado para trial. TAGG Master pode converter trial em contratado, preservando as datas históricas do teste.
- Cadastros anteriores sem plano passam a ser interpretados como contratados, com limite padrão de 25; não recebem trial retroativo nem são suspensos automaticamente.

## Contagem
Licenças são por tenant, compartilhadas entre suas empresas. Cada Membership ativa reserva uma licença; administrador conta, TAGG Master não. Membership é única por tenant/user, então um usuário com várias empresas conta uma vez. Suspensão do vínculo libera licença e reativação consome novamente. Uma suspensão global de usuário fora deste fluxo não libera a licença reservada automaticamente.

Base contratual de 25, mínimo 25, máximo técnico configurável nesta entrega de 10.000. Limite considera licenças contratadas, não número de sessões simultâneas. Sessão única por usuário continua independente.

Criação e reativação são recusadas com LICENSE_LIMIT_REACHED ao atingir o limite. Tenant.licenseRevision é atualizado dentro da transação antes de contar: sincroniza disputa pela última licença com mudanças do plano. Não pode reduzir limite para menos que o uso atual; suspender usuários ou contratar capacidade antes. Perfil/empresa não altera esse limite. Legado que já ultrapasse 25 mantém seus usuários existentes, mas não cria/reativa mais até regularizar o plano/uso.

## Valores
Valores configuráveis em centavos: mensalidade base e adicional por licença/mês. Branco significa a definir, diferente de zero explícito. Adicionais contratados = max(0, limite - 25). Adicional mensal = adicionais × valor unitário; estimativa mensal = base + adicional. Sem preço unitário/base definidos, o resultado dependente fica a definir. Não inventar preço nem misturar uso ativo com capacidade contratada na cobrança.

A projeção do trial indica a condição contratual planejada; não cria débito durante o teste. Esta entrega não emite fatura, nota fiscal, cobrança em cartão/Pix, boleto, pró-rata ou reajuste automático. Alterações de plano guardam antes/depois em auditoria do Master e usam subscriptionVersion para conflito de edição.

## Interface/API
Novo cadastro em modal inclui modalidade, licenças e valores. Lista mostra trial/vencimento, uso/limite, adicionais e estimativa. Botão Plano e licenças abre modal para alteração e conversão em contratado.

PATCH /api/v1/taggmaster/clients/:id/subscription recebe version, mode, licenseLimit, baseMonthlyCents e extraSeatMonthlyCents. A interface sempre envia a configuração inteira. Não aceitar trialStartedAt/trialEndsAt, activeUsers, tenantId ou totais calculados pelo frontend. Somente cookie de sessão master e Origin configurado passam; cookie tenant não permite editar assinatura.

As datas do contrato continuam metadados distintos do trial; não foi introduzido bloqueio retroativo por fim do contrato pago nesta entrega.

## Senhas
PasswordInput reutilizado nos logins cliente/master, senha inicial de cliente/usuário, troca obrigatória e recuperação. Inicia oculto; botão de olho independente por campo, acessível e type=button, não submete o formulário. Reset do formulário volta a ocultar. Não escreve senhas em armazenamento/logs nem altera criptografia de senha ou regras de recuperação.

## Próxima etapa: offline
Leitura e fila de atividades/visitas deverão respeitar tenant, empresa, usuário, trial e sessões. Nunca usar cache HTTP autenticado como banco. Licença/grant offline não poderá ignorar vencimento do trial; sincronização sempre reautoriza no servidor, inclusive sessão substituída e carteira transferida. Aprovações/crédito/planos permanecem online. A operação offline está descrita em offline.md e respeita esses limites na preparação/sincronização.


