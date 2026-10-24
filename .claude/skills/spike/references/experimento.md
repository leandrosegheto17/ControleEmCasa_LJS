# Experimento e observação (fases 4 e 5)

## Antes de despachar

1. `spike.md` com **Preparação aprovada**: sim. Sem isso, volte à preparação.
2. Isolamento pronto: pasta `.specs/spikes/<slug>/codigo/` com a linha `.specs/spikes/*/codigo/` no `.gitignore`, ou a worktree `spike/<slug>` criada fora do repositório.
3. Ações externas previstas: confirmação específica de cada uma, agora (o que, onde, quanto custa, como desfazer).
4. Rode `date`, grave **Início** e **Limite** em `spike.md`.

## Pedido ao `implementador` (modo spike)

```
Spike <slug>. Modo spike.
Pergunta: <pergunta>
Critério (não muda): deu certo <...>; deu errado <...>; inconclusivo <...>
Condições da medição: <ambiente, dados, carga, repetições>
Método sugerido: <passos>
Pasta de trabalho: <.specs/spikes/<slug>/codigo/ | ../<repo>-spike-<slug>>
Limite: <AAAA-MM-DD HH:MM> e <N> tentativas, o que vier primeiro.
Ações externas já confirmadas: <lista | nenhuma>. Qualquer outra: pare e pergunte.
Devolva também os comandos exatos que produziram cada medição.
```

Despache um spike por vez. Pergunta nova que o agente trouxer vira candidato a outro spike, não entra neste.

## Na volta

- **Confira a medição principal você mesmo**: rode de novo o comando que produziu o número e compare. Quem fez o experimento não é quem dá o veredito. Se não reproduz, registre e trate como inconclusivo ou repita dentro do prazo.
- **Prazo**: compare a hora atual com o **Limite**. Estourado, a **Situação** é `prazo estourado`, mesmo que falte "só um pouco".
- **Bloqueio** (acesso, conta, credencial): **Situação** `bloqueado`; pergunte via `AskUserQuestion`: resolver o acesso, mudar o método sem mudar o critério (nos dois casos a **Situação** volta a `em andamento` e o limite não muda), ou concluir como inconclusivo.
- Grave `resultado.md`.

## Modelo de `resultado.md`

```markdown
# Resultado: <slug>

- **Situação**: <em andamento | concluído | prazo estourado | bloqueado — <o quê>>
- **Tempo gasto**: <relógio> · **Tentativas**: <N de M>

## O que foi feito

<método real em 3 a 6 passos; diferença em relação ao método planejado, e por quê>

## Medições

| Medição | Valor | Condições | Comando | Conferida pela sessão |
|---|---|---|---|---|
| <ex.: p95 de latência> | <valor e unidade> | <ambiente, dados, carga, repetições> | `<comando>` | sim / não reproduziu |

## Observações

- **Surpresas**: <o que não se esperava>
- **Obstáculos**: <o que travou, quanto tempo custou>
- **Comportamentos inesperados**: <erros, limites não documentados>
- **Esforço real**: <comparado com o que se imaginava>
- **Perguntas novas**: <viram outros spikes, se valerem a pena>
```
