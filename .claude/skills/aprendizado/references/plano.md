# Objetivo, ponto de partida, fontes e veículo (fases 1 a 4)

Conversa com uma pergunta por vez, via `AskUserQuestion` (postura inspirada no `brainstorming` do superpowers, que não é acionado). Prefira opções; pergunta aberta oferece uma sugestão plausível e **Ainda não sei** (vira `[A ESCLARECER]`).

## Fase 1: objetivos e prazo

1. **Tema e motivo:** que tecnologia, e para quê (um trabalho, curiosidade, um projeto futuro). O motivo ajuda a escolher o veículo.
2. **Objetivos (1 a 3):** "Ao final, ser capaz de <verbo observável> <o quê>". Verbos que se observam: montar, escrever, explicar, depurar, configurar, testar, comparar. Evite "entender" e "conhecer" sozinhos.
3. **Como vou provar**, por objetivo: o que o usuário fará na verificação sem consulta (ex.: "escrever do zero um endpoint protegido por token e explicar o fluxo do token").
4. **Prazo:** data, curta (dias ou poucas semanas). Sugira pelo tamanho dos objetivos; sem data, o estudo não começa.
5. **O que fica de fora:** testes, segurança e deploy entram só se forem objetivo. Se "escrever testes" for objetivo, ele é um `O-N` como os outros.

## Fase 2: ponto de partida

Por objetivo: o que já conhece (linguagens, conceitos vizinhos), o que é novo, e **o maior risco de não entender** (o conceito que mais assusta ou que já travou antes). O risco define a ordem das fatias: ele vem cedo, não no fim.

Aprovação do bloco 1-2: grave **Objetivos aprovados**: sim.

## Fase 3: pedido ao `pesquisador`

```
Pesquisa de fontes para estudar <tecnologia> (versão atual estável: confirmar).
Objetivos: <O-1..O-3>. Ponto de partida: <resumo>. Idioma preferido: <pt, en>.
Encontre, com URL, data da consulta e versão da tecnologia que cobrem:
1. A documentação oficial e as seções que cobrem cada objetivo.
2. Um tutorial ou curso bom e atual (de preferência gratuito), com o que cobre e o que falta.
3. Um projeto de referência pequeno e mantido (último commit, licença), que faça algo parecido com os objetivos.
Aponte fontes desatualizadas para a versão atual. Poucas fontes: no máximo 2 por item.
```

A sessão escolhe com o usuário **no máximo 4 fontes no total**, cada uma ligada a um objetivo. Fonte sem data ou de versão antiga fica marcada.

## Fase 4: projeto-veículo

1. **Proponha 2 ou 3 veículos** pequenos que exercitem todos os objetivos, ligados ao motivo e ao gosto do usuário (algo que ele usaria, um jogo, um problema do dia a dia). Recomende o menor.
2. **Escopo fechado:** o que o veículo faz, em 3 a 5 linhas. Tudo além disso vai para "Depois" (YAGNI).
3. **Fatias:** 3 a 6, cada uma pequena (uma sessão), com o objetivo que exercita. O maior risco da fase 2 cedo. Se testes forem objetivo, cada fatia começa pelo teste.
4. **Fora do objetivo (pode vir pronto):** configuração e código repetitivo que não ensinam nada do objetivo. Só o que está nesta lista pode ser escrito pela sessão como andaime.
5. **Onde mora o código:** pergunte via `AskUserQuestion`: **pasta de estudos fora de qualquer projeto, ex.: `<pasta-mãe>/estudos/<slug>/` (Recomendado)**, outra pasta à escolha do usuário. Nunca dentro do repositório de um produto. Criar a pasta e o `git init` são ações do usuário ou da sessão com confirmação.

Aprovação do bloco 3-4: grave **Plano aprovado**: sim.

## Modelo de `plano.md`

```markdown
# Estudo: <tema>

- **Slug**: <slug> · **Início**: <AAAA-MM-DD> · **Prazo**: <AAAA-MM-DD> · **Extensão**: <nenhuma | nova data — motivo>
- **Objetivos aprovados**: <pendente | sim (AAAA-MM-DD)>
- **Plano aprovado**: <pendente | sim (AAAA-MM-DD)>
- **Onde mora o código**: <caminho absoluto> (git próprio: <sim | não>)

## Motivo

<para que o usuário quer aprender isto>

## Objetivos

| ID | Ser capaz de | Como vou provar (sem consulta) |
|---|---|---|
| O-1 | <...> | <...> |

## Ponto de partida

| Objetivo | Já sei | É novo | Maior risco de não entender |
|---|---|---|---|
| O-1 | <...> | <...> | <...> |

## Fontes

| Fonte | Tipo | Cobre | Versão | Consultada em |
|---|---|---|---|---|
| <título e URL> | oficial · tutorial · referência | O-1 | <...> | <AAAA-MM-DD> |

## Projeto-veículo

<o que faz, em 3 a 5 linhas>

| Fatia | O que entrega | Objetivos |
|---|---|---|
| 1 | <...> | O-1 |

**Fora do objetivo (pode vir pronto como andaime):** <lista ou "nada">

## Fora do escopo e depois

- <testes, segurança ou deploy, se não forem objetivo; ideias que surgiram>
```
