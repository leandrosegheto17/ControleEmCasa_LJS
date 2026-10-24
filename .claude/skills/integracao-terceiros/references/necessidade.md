# Necessidade (fase 1)

Responde: **por que integrar e o que se espera obter?** Também define o modelo de `terceiro.md`, que guarda o estado da integração inteira.

## Como conduzir

- Uma pergunta por vez, via `AskUserQuestion`, com sugestão plausível e "Ainda não sei" (vira `[A ESCLARECER]`; caso de uso, dados ou criticidade `[A ESCLARECER]` não passam da fase 1).
- Leia antes: `.specs/projeto/inventario.md` (integrações que o projeto já tem, bibliotecas de HTTP e de resiliência instaladas), `.specs/STATE.md` (decisões `AD-NNN`), a spec ou o pedido que motivou a integração.
- **Não cite fornecedores nesta fase**: se o usuário já tem um, anote em **Fornecedor** como `declarado: <nome>` e siga (a fase 2 decide se há escolha a fazer).

## Perguntas, na ordem

1. **Caso de uso**: o que o sistema precisa que o terceiro faça (uma frase: "cobrar assinaturas mensais por cartão e Pix", não "integrar pagamento") e para quem.
2. **Resultado esperado**: como se saberá que funcionou (ex.: "90% das cobranças confirmadas sem intervenção").
3. **Direção e gatilho**: nós chamamos o terceiro, ele nos chama (webhook), ou os dois; síncrono (o usuário espera a resposta) ou pode ser em segundo plano.
4. **Dados trocados**: o que sai, o que volta, se há dado pessoal ou sensível (detalhe na fase 4).
5. **Volume**: chamadas por dia e no pico, crescimento esperado em 12 meses (número ou faixa). Define limites e custo.
6. **Criticidade**: o que acontece se o serviço cair por 5 minutos, 1 hora, 1 dia? O usuário fica bloqueado, a operação espera, ou nada percebe? Define o desenho de falha (fase 5).
7. **Orçamento**: quanto pode custar por mês no volume esperado; quem paga.
8. **Integrar é o caminho certo?** Alternativas a considerar antes: o projeto já tem algo que resolve (inventário); construir é pequeno e não é o núcleo do produto (comprar o que é comum, construir o que diferencia); a necessidade cabe num processo manual por ora. Se não for integração: saída da `SKILL.md`.

Ao fim, proponha as fases que se dispensam (ex.: fase 2 com fornecedor imposto; fase 4 nunca é dispensada se sai dado pessoal) e o caminho da fase 5 (`feature` ou `legado`).

## Modelo de `terceiro.md`

```markdown
# Integração: <capacidade>

- **Slug**: <slug> · **Início**: <AAAA-MM-DD>
- **Fornecedor**: <a escolher | declarado: <nome> | <nome> (ADR <caminho>) | imposto: <nome> — <por quem e por quê>>
- **Rota de saída**: <como trocar de fornecedor: dados exportáveis?, alternativas compatíveis, esforço estimado — com fonte>
- **Feature**: <— | .specs/features/integracao-<slug>/ (feature | legado)>
- **Resultado**: <pendente | concluída (AAAA-MM-DD) | não integrar — <motivo> | parada — <motivo>>

## Necessidade

- **Caso de uso**: <...> · **Para quem**: <...>
- **Resultado esperado**: <...>
- **Direção**: <nós chamamos | ele chama (webhook) | os dois> · **Modo**: <síncrono | segundo plano | misto>
- **Dados trocados**: <sai: ... · volta: ...> · **Dado pessoal**: <sim | não>
- **Volume**: <N/dia, pico N/min, em 12 meses N>
- **Criticidade**: <5 min: ... · 1 h: ... · 1 dia: ...>
- **Orçamento**: <R$ N/mês no volume esperado | [A ESCLARECER]> · **Quem paga**: <...>
- **Por que integrar**: <alternativas consideradas e por que não>

## Fases

| # | Fase | Situação |
|---|---|---|
| 1 | Necessidade | pendente |
| 2 | Escolha do serviço | pendente |
| 3 | Contrato | pendente |
| 4 | Segurança e legal | pendente |
| 5 | Desenho | pendente |
| 6 | Implementação | pendente |
| 7 | Verificação | pendente |
| 8 | Liberação | pendente |
| 9 | Monitoramento | pendente |

## Voltas à escolha

<nenhuma | AAAA-MM-DD: fase N → 2, motivo>

## A esclarecer

- [A ESCLARECER: <...>]
```

Situação: `pendente`, `feita (AAAA-MM-DD)` ou `dispensada — <motivo>`. Grave `terceiro.md` assim que o caso de uso existir; a fase 1 vira `feita` só com a aprovação.
