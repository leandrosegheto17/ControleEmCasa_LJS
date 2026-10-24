# Retorno, decisão e reteste (fases 9 e 10)

## Fase 9: retorno

O autor precisa saber **o que fazer**, **por quê** e **o que já está bom**.

- **Específico e acionável:** local, o que acontece, por que importa, caminho sugerido. "Isto está errado" não é retorno; "com lista vazia, `total()` divide por zero em `pedido.py:42`; sugiro devolver 0 antes do laço e um teste com lista vazia" é.
- **Sobre o código, não sobre a pessoa.** Pergunta genuína quando não se sabe a intenção.
- **Bloqueio separado de sugestão**, sempre marcado. Sugestão diz "não bloqueia".
- **Reconhecer o que está bom**, com local (sem elogio genérico).
- **Sem pedir "já que está aí"**: melhoria fora do pedido vira sugestão para outra mudança, nunca condição.
- Autor é IA: o mesmo texto serve de entrada para a correção (fluxo de origem ou `implementador`), com os `REV-NNN` como tarefas.
- Checagens vermelhas (atalho da fase 3) ou divisão pedida (fase 2): retorno curto só com isso.

### Entrega

Pergunte via `AskUserQuestion`:

- **Entregar localmente (Recomendado):** `retorno.md` na pasta da revisão e o texto pronto para colar, mostrado na conversa.
- **Comentar no PR:** ação externa. Mostre o **texto exato** e o comando (`gh pr review <n> --comment --body-file .specs/revisoes/<slug>/retorno.md`) e peça confirmação específica para essa publicação. Comentários por linha: skill `code-review` com `--comment`, também com confirmação. Aprovar ou pedir mudanças **pelo GitHub** (`--approve`, `--request-changes`) é outra ação externa, só na fase 10 e com nova confirmação.
- **Entregar a correção à IA:** o retorno vira entrada do fluxo de origem ou do `implementador`/`implementador-dominio`.

Preencha **Retorno entregue** com a forma e a data (e o link, se publicado).

### Modelo de `retorno.md`

```markdown
# Retorno da revisão: <título> (rodada N)

**Resumo:** <o que foi revisado, contra qual pedido, e o veredito proposto: aprovar | pedir mudanças | recusar>
<Se aplicável: "Diff grande revisado assim mesmo: a confiança é menor." | "Checagens vermelhas: a análise espera a correção.">

## O que está bom
- <ponto, local>

## Bloqueantes (precisam mudar para entrar)
1. **REV-001** `<arquivo:linha>`: <o que acontece>. <Por que importa>. Sugestão: <caminho>.

## Sugestões (não bloqueiam)
1. **REV-00N** `<arquivo:linha>`: <melhoria e porquê>.

## Perguntas
1. **REV-00N**: <o que precisamos saber e o que muda com a resposta>.

## Como foi revisado
Checagens: <resumo>. Exercitado: <critérios>. Testes: <sensor N/N>. Segurança: <feita | dispensada — motivo>.

**Retorno entregue**: <pendente | local (<data>) | comentário no PR (<link>, <data>) | entrada da correção (<fluxo>)>
```

## Fase 10: decisão e reteste

### Decisão

Pergunte via `AskUserQuestion`, com a recomendação primeiro:

- **Aprovar:** recomendado só sem bloqueante aberto. Com bloqueante aberto, a opção existe, mas exige motivo registrado por bloqueante ("aceito pelo usuário — <motivo>"); teste apagado ou enfraquecido sem motivo aceito nunca é aprovado assim. Ao aprovar, confira que a **descrição do PR e a documentação** refletem o que de fato entrou (o que mudou depois das rodadas); divergência vira pedido ao autor ou ajuste com confirmação.
- **Pedir mudanças:** os bloqueantes ficam abertos; a revisão espera o autor.
- **Recusar:** motivo em uma frase (fora do pedido, abordagem errada, não divide, risco), registrado e comunicado no retorno.

Aprovar ou pedir mudanças **no GitHub** é ação externa com confirmação específica. Integrar não faz parte da revisão: se o usuário pedir o merge, checagem final (`python .claude/scripts/trava-testes.py --rodar` na branch, com tudo commitado), `finishing-a-development-branch` e confirmação de cada ação externa.

Ao encerrar (aprovado, recusado ou parado), remova o worktree temporário e a branch `rev/<slug>`, com confirmação.

### Reteste (nova rodada)

Quando o autor avisar que atualizou:

1. Nova ponta: anote o commit. Diff **só do que mudou** desde a ponta revisada: `git diff <ponta-anterior>..<ponta-nova>` (se o autor reescreveu o histórico, `git range-diff`).
2. Fase 3 de novo (suíte inteira, não só o trecho).
3. Para cada bloqueante aberto: resolvido (com teste, quando era comportamento) ou ainda aberto.
4. Fases 4 a 8 em **modo curto sobre o delta**: a correção pode ter quebrado outra coisa, e teste mexido na correção é lido linha a linha de novo.
5. Atualize `achados.md` (estados e rodada) e gere `retorno.md` da nova rodada (o anterior fica com sufixo `-rodada-N`).
6. Três rodadas sem fechar os bloqueantes: escale ao usuário (conversar com o autor, dividir, recusar).

### Modelo de `decisao.md`

```markdown
# Decisão: <título>

- **Decisão**: <mudanças pedidas | aprovado | recusado — motivo | parado — motivo | devolvido — <chamador>> (<data>)

## Rodadas
| Rodada | Ponta revisada | Bloqueantes abertos | Resultado |
|---|---|---|---|
| 1 | <commit> | <N> | mudanças pedidas |

## Aceitos pelo usuário
- REV-00N — <motivo>

## Ao aprovar
- Descrição e documentação conferidas: <sim | ajustes pedidos>
- Integração: <não faz parte | pedida pelo usuário: <forma>, checagem final <resultado>>
```
