# Classificação, verificação, diagnóstico e resolução (fases 2 a 5)

Escrito para atender rápido: o que decide primeiro, o resto depois. O usuário (quem conduz a sessão) responde o que souber, uma pergunta por vez, via `AskUserQuestion`, com sugestão plausível e "Ainda não sei" (vira `[A ESCLARECER]`). O que só a pessoa atendida sabe vai numa mensagem (fase 4).

## Fase 2: classificação

### Tipo

| Tipo | Quando | Caminho |
|---|---|---|
| **dúvida de uso** | o produto faz, a pessoa não achou ou não entendeu | 3 → 5 (passo a passo); na 9, dúvida repetida é problema de clareza |
| **bug** | algo não se comporta como definido (spec, documentação, comportamento anterior) | 3 → 4 → 5 (skill `bug`) |
| **pedido de feature** | nada quebrado; a pessoa quer algo que o produto não faz | saída do `SKILL.md` (sugestão ou solicitação) |
| **cobrança** | valor, fatura, reembolso, plano, pagamento | fase 8 a quem decide; a sessão só junta os fatos |
| **conta** | acesso, cadastro, configuração, permissão, dados da pessoa (inclui pedido do titular pela LGPD: ver, corrigir, apagar) | 3 → 4 → 5; pedido do titular ou acesso de terceiro à conta: fase 8 |
| **segurança** | alguém vê dado de outro, conta invadida, dado exposto, comportamento suspeito | saída do `SKILL.md`, antes de tudo |

Reclamação não é tipo: é o tom. Classifique pelo que está por trás e trate o tom na comunicação (fase 6). Na dúvida entre dois tipos, o mais grave vale até o diagnóstico.

### Prioridade

Mesma escala P0–P3 da skill `bug` (`bug/references/relato.md`), vista pelo lado de quem usa:

| Prioridade | Quando |
|---|---|
| **P0** | vazamento ou acesso indevido, perda ou corrupção de dado, todos bloqueados |
| **P1** | a pessoa (ou um grupo) totalmente bloqueada na função principal, sem contorno; dinheiro cobrado errado |
| **P2** | função prejudicada, com contorno razoável |
| **P3** | dúvida, cosmético, caso raro |

Justifique por impacto (quantas pessoas, dado, dinheiro, prazo dela) e pela existência de contorno, nunca pela insistência ou pelo tom. O prazo da próxima notícia vem dos **combinados** em `.specs/demandas/base-conhecimento.md`; sem combinados, pergunte ao usuário na primeira vez, com a sugestão de [base-conhecimento.md](base-conhecimento.md).

```markdown
## Classificação

- **Tipo**: <...> — <por quê, em uma frase> · **Prioridade**: P_ — <impacto e contorno>
- **Próxima notícia até**: <data e hora> (combinado: <P_ = N horas úteis | PREMISSA>)
- **Saída acionada**: <— | segurança → <skill> | cobrança → fase 8 | pedido de feature → <skill>>
```

## Fase 3: verificação rápida

Em ordem, parando quando a resposta ficar clara:

1. **Base de conhecimento** (`.specs/demandas/base-conhecimento.md`): pelo sintoma nas palavras da pessoa e pelos sinônimos. Entrada encontrada: confira se ainda vale (versão do produto, **Revisada em**).
2. **Casos anteriores**: skill `demandas`, **Procurar**, só a camada do registro (tipo `suporte`, inclusive fechados): mesmo sintoma, como foi resolvido.
3. **Problemas conhecidos**: `.specs/bugs/` sem `fechamento.md` (há contorno no relato?) e `.specs/runbook.md`, se houver.
4. **Falha em andamento**: `.specs/incidentes/` sem `Encerrado: sim`; e o registro: **3 ou mais casos com o mesmo sintoma nas últimas horas** (padrão sugerido, `PREMISSA`), ou uma liberação recente (`.specs/liberacao.md`) que toca a função. Sinal de falha em andamento leva à saída do `SKILL.md` antes de diagnosticar a pessoa.

| Veredito | O que fazer |
|---|---|
| **resposta conhecida** (`BC-NNN`) | fase 4 dispensada; fase 5 adapta a resposta ao caso (a base é ponto de partida, não texto pronto) |
| **problema conhecido** (bug aberto) | Ligação ao bug, contorno dele à pessoa, aviso quando sair a correção |
| **falha em andamento** | Ligação ao incidente, mensagem "falha conhecida" |
| **caso parecido** | segue para a 4 com a pista anotada |
| **novo** | segue para a 4 |

```markdown
## Verificação

- **Veredito**: <...> · **Consultado**: base (<N entradas>) · registro (<N casos>) · `.specs/bugs/` · `.specs/incidentes/`
- **Encontrado**: <BC-NNN | DEM-NNN | bug <slug> | incidente <id> | nada>
```

## Fase 4: diagnóstico

Objetivo: entender o que acontece **com essa pessoa**, sem interrogatório.

1. **Comece pelo que já se sabe**: relato, evidências, casos parecidos. Não pergunte nada que já esteja no registro.
2. **Reproduza** com dados de exemplo, em local ou staging, seguindo os passos dela (`leitor-codigo` para achar onde está o comportamento). Nunca reproduza com a conta real de outra pessoa.
3. **Conta e dados da pessoa**, só se a reprodução não bastar:
   - **mínimo**: só os campos e registros deste caso, em **modo leitura**, pelo meio previsto do projeto (painel administrativo, consulta só de leitura); nada de cópia da base nem consulta ampla;
   - **confirmado**: pergunte via `AskUserQuestion` antes de cada acesso: o quê, onde, por quê, como (leitura) e quem autoriza; acesso a produção é ação externa;
   - **registrado** na seção Acessos (sem o dado visto: escreva "plano ativo, último pagamento recusado", não o número do cartão);
   - **fora do git**: o que precisar ser guardado (print, exportação) vai para `evidencias/`; saídas com dado real nunca entram em `.specs/` versionado.
4. **Pergunte à pessoa só o que falta**, numa mensagem (modelo "perguntas" de [mensagens.md](mensagens.md)): até 4 perguntas, cada uma com exemplo de resposta e o porquê quando não for óbvio; situação `aguardando autor`. Nunca peça senha, código de verificação ou dado de cartão.
5. **Causa identificada?** Diga qual (uso, configuração da conta, dado da pessoa, defeito, terceiro, desempenho) com a evidência. Sem causa depois do que há: pergunte ao usuário entre **instrumentar** (pela skill `bug`, se apontar para defeito), **escalar** (fase 8) ou **encerrar** com a pessoa avisada.

```markdown
## Diagnóstico

- **Reprodução**: <sim, em <ambiente>, passos: ... | não reproduzido — <o que foi tentado>>
- **Perguntas à pessoa**: <— | enviadas em <data>; respostas em "Palavras do autor">
- **Causa**: <categoria — uma frase> · **Evidência**: <reprodução | `arquivo:linha` | conta (acesso A-N)>

## Acessos

| # | Data | O quê (sem o dado) | Onde | Por quê | Como | Autorizado por |
|---|---|---|---|---|---|---|
| A-1 | <data> | <plano e situação da assinatura> | <painel admin> | <ver se a cobrança foi feita> | leitura | <usuário> |
```

## Fase 5: resolução

| Causa | Resolução | Cuidado |
|---|---|---|
| uso | instrução passo a passo, no caminho que a pessoa usa | testada antes de enviar; se foi difícil achar, anote para a fase 9 |
| configuração ou dado da conta | correção na conta | **ação externa**: confirmação específica com o que muda, o valor antes (sem dado sensível), como desfazer; registrada em Acessos (como: escrita). Correção em massa ou por script é mudança de comportamento: skill `bug` ou `feature`, com teste |
| defeito | contorno temporário, se houver, e a skill `bug` | abaixo |
| terceiro (pagamento, e-mail, integração) | contorno e aviso; `.specs/runbook.md` do fornecedor | sem culpar o fornecedor para a pessoa; falha ampla dele é incidente |
| desempenho | contorno; skill `performance` pela `demandas`, se for crônico | — |

**Bug (encaminhamento à skill `bug`)**, pela `demandas`, **Encaminhar**:

1. Grave `.specs/bugs/<slug>/relato.md` no formato de `bug/references/relato.md`, com o Relato (passos da reprodução da fase 4, esperado × obtido, ambiente, evidência sem dado pessoal, impacto e contorno) **e a Triagem** feita aqui (veredito, severidade = prioridade da fase 2, urgência), **Relatado por** `PES-NNN (suporte)`, **Chamado por** `suporte DEM-NNN`, **Devolver após** `liberação`. A skill `bug` começa na reprodução; ao liberar, devolve com `fechamento.md` curto ("aviso a cargo de suporte").
2. `encaminhamento.md` curto (problema, critérios do relato, origem) e **Ligação**; situação `encaminhada`.
3. **Expectativa honesta** à pessoa (fase 6): o que acontece agora, o contorno, e **sem data** se a data não existe ("vamos avisar assim que a correção estiver disponível"). P0/P1 com usuários afetados agora: a `bug` oferece o `incidente`.
4. Mais casos com o mesmo bug enquanto ele está aberto: Ligação ao mesmo bug; cada pessoa vira **Interessado** e recebe o aviso da correção.

```markdown
## Resolução

- **Como**: <instrução | correção na conta (A-N) | contorno | encaminhado à skill `<nome>` em `<pasta>`>
- **Passo a passo enviado**: <resumo ou "ver Comunicações">
- **Expectativa dada**: <o que foi dito sobre o que acontece a seguir e quando>
```
