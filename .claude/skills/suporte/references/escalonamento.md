# Escalonamento (fase 8)

Passar adiante não é se livrar do caso: a pessoa continua sendo atendida, e quem recebe consegue agir **sem perguntar nada de novo a ela**.

## Quando escalar

| Situação | Para quem | O que a sessão não faz |
|---|---|---|
| cobrança, reembolso, crédito, desconto, mudança de plano fora do padrão | quem decide sobre dinheiro (dono do produto, financeiro) | prometer valor, prazo de estorno ou exceção |
| contrato, termos, questão legal, ameaça de processo, órgão de defesa do consumidor | quem responde pelo contrato ou o jurídico | interpretar a lei ou o contrato para a pessoa (não é parecer jurídico) |
| pedido do titular pela LGPD (ver, corrigir, apagar os dados, revogar consentimento) | quem responde pelos dados (controlador, encarregado) | negar ou atender sem essa pessoa; prazos e base legal ficam `PREMISSA` até o `pesquisador` conferir |
| acesso de terceiro à conta (familiar, empresa, herdeiro), troca de titular | quem responde pelos dados | dar acesso ou dados sem verificação definida por quem decide |
| segurança | skill `incidente`, `bug` P0/P1 ou `auditoria-seguranca` (saída do `SKILL.md`) | investigar exposto à pessoa |
| defeito | skill `bug` (fase 5) | corrigir aqui |
| capacidade: três voltas na fase 7 sem resolver, causa não achada, área que o usuário não conhece | quem conhece a parte (pergunte ao usuário) | continuar tentando no escuro |

As alçadas (quem decide cada tipo, por qual canal, em quanto tempo responde) ficam nos **combinados** de `.specs/demandas/base-conhecimento.md`, sem nomes nem contatos pessoais: papel e canal. Sem combinado para o tipo, pergunte ao usuário via `AskUserQuestion` e ofereça registrar.

## Pacote de passagem

Escrito para quem recebe ler em um minuto e agir. Vai em `suporte.md`, seção Escalonamento (sem dado pessoal), e é enviado a quem decide pelo canal combinado (ação externa: confirmação específica). Dado da conta que a pessoa precisa ver vai por esse canal, nunca pelo git.

```markdown
## Escalonamento

- **Para**: <papel> · **Canal**: <...> · **Enviado em**: <data, confirmado pelo usuário> · **Retorno esperado em**: <data>
- **Pedido da pessoa**: <em uma frase, nas palavras dela> · **Prioridade**: P_ · **Prazo dito à pessoa**: <...>

### Situação agora
- <o que a pessoa está vivendo: bloqueada? cobrada? esperando o quê?>

### O que sabemos
1. <fato, com a fonte: relato, reprodução, acesso A-N>
2. <...>

### O que já foi feito
- <ações, mensagens enviadas (tipo e data), contorno dado>

### O que precisa ser decidido
1. <a decisão exata, com as opções que existem e a recomendada, se houver>
2. <...>

### Quem é quem
- **Pessoa atendida**: PES-NNN (<papel>) · contato pelo canal do caso (fora do git)
- **Conduz o caso**: <usuário>

### Retorno
- <data> — <decisão de quem decide, em uma frase> · **Aplicado**: <como, com confirmação>
```

## Depois de passar

1. **Avise a pessoa** (modelo "escalonamento" de [mensagens.md](mensagens.md)): quem cuida (área ou papel), que ela não precisa repetir nada, e quando terá retorno.
2. Fase 8 `em andamento` até o retorno; **Retorno esperado em** preenchido. Vencido: cobre uma vez e avise a pessoa do novo prazo.
3. Com a decisão: registre o **Retorno**, aplique (correção na conta, mensagem de decisão) com confirmação, e siga para a fase 6 e a 7. A decisão é de quem decide; a sessão não a reescreve ao comunicar.
4. Escalonamento para outra skill (`bug`, `incidente`, `auditoria-seguranca`) não usa este pacote: usa a entrada daquela skill, e a fase 8 fica `dispensada — encaminhado à skill <nome>`.
