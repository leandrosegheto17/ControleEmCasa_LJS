# Etapa 3: Solução e valor

Dar forma a **opções de solução em nível de conceito**: o que o usuário vive, quanto vale investir e o que se ganha e perde em cada uma. Não é especificação nem arquitetura: nada de modelo de dados, API, tecnologia ou tarefas.

Exige `problema.md`. Se não existir, volte à etapa 2.

## O que fazer

1. **Duas ou três opções** que cubram o espaço de escolhas. Sempre inclua:
   - a **menor coisa que funcionaria**;
   - quando fizer sentido, **não fazer nada** ou **usar algo pronto** (comprar, assinar, adaptar open source).

   Para cada opção:
   - **Esboço**: um parágrafo sobre o que muda para o usuário, não como se constrói.
   - **Investimento aceitável**: `pequeno` (dias) | `médio` (semanas) | `grande` (meses). É um teto, não uma estimativa.
   - **Ganhos e perdas**: o que ganha, o que sacrifica, riscos e incertezas.
   - **Armadilhas**: partes com maior chance de explodir o escopo.
2. **Recomende uma opção**, ligada aos objetivos e métricas do problema, **ou recomende não seguir** se nenhuma valer a pena. Não fabrique um vencedor.
3. **Delimite**: o que fica fora da opção recomendada.
4. **Premissas**: do que a recomendação depende, para validar nas fases seguintes.

Se ajudar a conversa, descreva em palavras um esboço de tela ou do fluxo principal. Sem código.

## Modelo de `.specs/produto/solucao.md`

```markdown
# Solução: <título curto>

- **Data**: <AAAA-MM-DD>
- **Opção recomendada**: <nome> | nenhuma

## Opções

### Opção A — <nome>
- **Esboço**: <...>
- **Investimento aceitável**: pequeno | médio | grande
- **Ganhos e perdas**: <...>
- **Armadilhas**: <...>

### Opção B — <nome>
...

## Recomendação

<qual e por quê, ligada aos objetivos e métricas; ou por que não seguir>

## Fora do escopo da opção recomendada

- <...>

## Premissas a validar

- <...>
```
