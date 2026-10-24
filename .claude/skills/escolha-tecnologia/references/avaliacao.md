# Opções, eliminação, avaliação e teste prático (fases 3 a 6)

Pré-requisito: `escolha.md` com **Critérios aprovados**: sim. Sem isso, volte às fases 1-2.

## Data da consulta

Antes de despachar qualquer pesquisa, rode `date` e passe a data no pedido. Toda evidência em `avaliacao.md` leva fonte e **consultado em AAAA-MM-DD**: preço, limite de plano gratuito e versão mudam, e quem reler precisa saber quando valia.

## 3. Opções

Um `pesquisador` levanta o panorama:

```
Pesquisa: alternativas para <o que se escolhe>. Data da consulta: <AAAA-MM-DD>.
Contexto e restrições: <de escolha.md>
Levante <3 a 5 | 2 a 3> alternativas reais, priorizando fontes primárias (documentação oficial, repositórios, páginas do fornecedor) e relatos de uso em produção; agregadores e listas de "as melhores" só como pista.
Inclua o que é maduro e amplamente usado, não só o que está em alta. Diga, para cada uma, por que entrou na lista.
Não avalie nem recomende.
```

Acrescente, quando couberem: **não fazer nada** (manter o que existe) e **construir** (só se o que se escolhe diferencia o produto). Opção comprada é nomeada (produto ou serviço concreto), nunca "uma solução pronta". Confirme a lista curta via `AskUserQuestion` antes de seguir (incluir, retirar ou seguir).

## 4 e 5. Eliminação e avaliação

**Rigoroso:** um `pesquisador` por opção, todos na mesma mensagem (em paralelo). **Enxuto:** um só, para todas. Pedido:

```
Pesquisa: <opção> para <o que se escolhe>. Data da consulta: <AAAA-MM-DD>.
Contexto: <decisão e restrições de escolha.md>
1. Eliminatórios, primeiro: para cada um, passa ou falha, com fonte. Se falhar em algum, pare e devolva só isso.
2. Desejáveis: para cada critério, evidência com fonte (sem nota).
3. Dimensões: maturidade e tendência (consolidando ou em mudança); integração com <o que o projeto usa>; uso real em escala parecida e o que os relatos de 6 a 12 meses de uso contam; esforço de aprender e operar; saúde do projeto ao longo do tempo (releases, mantenedores, quem financia), não num instante só.
4. Custo total: entrada, mensal no volume <X>, limites do plano gratuito, custo de sair. Número sem fonte vai como PREMISSA.
5. Vulnerabilidades conhecidas recentes e tempo de correção.
Cuidados: confira se uma reclamação antiga ainda vale na versão atual; número de desempenho e afirmação de que algo "falhou" precisam de duas fontes; versões com até 1 mês, sinais do ecossistema com até 6 meses.
Inclua evidências contra a opção. Não recomende.
```

Na volta, a **sessão** dá as notas (1 a 5) contra os critérios congelados; o `pesquisador` não pontua. Eliminada leva o eliminatório e a fonte. Ficam **2 ou 3 finalistas**; se sobrarem mais, os de menor total saem com o motivo. Liste os **pontos incertos**: o que a pesquisa não respondeu e só testando se sabe.

## 6. Teste prático (só no modo rigoroso)

Spike nos **pontos de maior incerteza** dos finalistas, não em tudo. Sem ponto incerto relevante, ofereça via `AskUserQuestion` dispensar (**Teste prático**: `dispensado — <motivo>`).

1. Combine com o usuário, **uma vez para todos os finalistas**: a pergunta (sim/não ou número), o critério (deu certo, deu errado, inconclusivo, condições da medição) e o prazo (relógio e tentativas). Um finalista não ganha critério nem prazo diferente.
2. Para cada finalista, grave `.specs/spikes/<pergunta>-<finalista>/spike.md` no formato da skill `spike` (`spike/references/preparacao.md`), com pergunta, critério e prazo **copiados sem alteração**, **Chamado por**: `escolha de tecnologia <slug>, finalista <X>` e **Usar em**: `.specs/escolhas/<slug>/avaliacao.md`, seção Teste prático.
3. Acione a skill `spike` para um finalista de cada vez. Ela confirma a preparação, roda o experimento descartável e devolve veredito e confiança.
4. Leve cada resultado à tabela de Teste prático. Prazo estourado ou inconclusivo é dado da comparação ("mais difícil do que parecia"), não motivo para estender só aquele.

## Modelo de `avaliacao.md`

```markdown
# Avaliação: <o que se escolhe>

- **Escolha**: `escolha.md` · **Modo**: <rigoroso | enxuto>
- **Finalistas**: <pendente | A, B, C (AAAA-MM-DD)>
- **Teste prático**: <pendente | feito (AAAA-MM-DD) | dispensado — <modo enxuto | motivo>>

## Opções levantadas (consultado em AAAA-MM-DD)

| Opção | Por que entrou | Fonte |
|---|---|---|
| <...> | <...> | <url> |

## Eliminação

| Opção | Eliminatório que falhou | Evidência (fonte, consultado em) |
|---|---|---|
| <...> | E<n> | <...> |

## Comparativo dos finalistas

| Critério (peso) | <A> | <B> | <C> |
|---|---|---|---|
| D1 <nome> (<peso>) | <nota> — <evidência, fonte, consultado em> | ... | ... |
| **Total ponderado** | <n> | <n> | <n> |

- **Custo total**: <por finalista: entrada, mensal no volume esperado, sair; real ou PREMISSA>
- **Pontos incertos**: <o que só testando se sabe>

## Teste prático

| Finalista | Spike | Veredito | Confiança |
|---|---|---|---|
| <A> | `.specs/spikes/<pergunta>-<a>/registro.md` | <...> | <alta/média/baixa> |

## Riscos e saída

<preenchido na fase 7: ver decisao.md>

## Decisão

<preenchido na fase 8: ver decisao.md>
```
