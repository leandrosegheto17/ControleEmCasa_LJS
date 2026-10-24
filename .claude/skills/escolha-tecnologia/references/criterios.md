# Decisão e critérios (fases 1 e 2)

Também é o **contrato de entrada** para os fluxos que chamam a escolha (projeto novo, integração, automação): eles gravam `escolha.md` com a decisão e as restrições, e estas fases só completam o que falta.

## Como conduzir

- Uma pergunta por vez, via `AskUserQuestion`, com sugestão plausível e "Ainda não sei" (vira `[A ESCLARECER]`; escolha com decisão ou eliminatório `[A ESCLARECER]` não passa da fase 2).
- Leia antes o que já existe: `viabilidade-tecnica.md` (stack candidata, custos), a spec da feature, `.specs/projeto/inventario.md` (o que o projeto já usa), `.specs/STATE.md` (decisões `AD-NNN` ativas, que valem como restrição).
- **Não cite opções nestas fases.** Se o usuário já tem uma favorita, anote em **Favorita declarada** e siga sem ela.

## 1. A decisão a tomar

- **O que se escolhe**, numa frase: "banco de dados principal do sistema X", não "tecnologia do backend".
- **Problema e o que a escolha afeta**: o que depende dela (outras escolhas, equipe, custo mensal, dados).
- **Restrições já dadas**: o que o projeto já usa, decisões `AD-NNN` ativas, orçamento, prazo, onde roda, quem vai manter.
- **Construir versus comprar** cabe aqui? Construir só o que diferencia o produto; o que é comum se compra ou se adota.
- **Reversibilidade**: quanto custaria trocar daqui a um ano (dados a migrar, código a reescrever, contrato)? Difícil → modo **rigoroso**; fácil → **enxuto** (tabela na `SKILL.md`). Sugira com o motivo; o usuário confirma.

## 2. Os critérios

Escritos **antes** de olhar opções e congelados na aprovação.

**Eliminatórios** (falhou, está fora): cada um verificável com uma fonte. Exemplos: licença compatível com uso comercial; projeto ativo (release no último ano); dentro do orçamento mensal; roda onde o projeto roda; atende o requisito X da spec; trata dado pessoal conforme a LGPD (onde ficam os dados).

**Desejáveis** (com peso 1 a 3), escolhidos entre:

| Critério | O que olhar |
|---|---|
| Custo total | entrada, operação mensal no volume esperado, aprendizado, manutenção, custo de sair |
| Curva de aprendizado | a equipe já usa? quanto tempo até produzir? |
| Desempenho | só se houver requisito com número |
| Maturidade | anos em produção, estabilidade da API, versões |
| Comunidade e ecossistema | atividade ao longo do tempo, quem mantém, bibliotecas, respostas a problemas |
| Segurança | vulnerabilidades conhecidas e tempo de correção |
| Hospedagem e operação | o que exige para rodar, backup, plano gratuito e seus limites |
| Integração | encaixe com o que o projeto já tem (linguagem, autenticação, formatos) |
| Dependência do fornecedor | padrão aberto, exportação de dados, alternativas compatíveis |

- Cada desejável liga-se a um **requisito que o motiva** (da spec, da viabilidade, do usuário). "A equipe conhece" é critério válido, declarado ao lado do requisito técnico, nunca sozinho.
- Modo enxuto: eliminatórios e até 3 desejáveis.
- Teste do critério: diga o que faria uma opção ir mal nele. Se nada faria, o critério é vago: refaça.

## Modelo de `escolha.md`

```markdown
# Escolha de tecnologia: <o que se escolhe>

- **Slug**: <slug> · **Data**: <AAAA-MM-DD>
- **Chamado por**: <nenhum | projeto-novo fase 7 (<feature>) | integração <capacidade> | automação <processo> | avaliacao-terceiros <slug>>
- **Usar em**: <arquivo e seção onde a escolha será usada | —>
- **Reversibilidade**: <difícil | fácil> — <o que custaria trocar daqui a um ano>
- **Modo**: <rigoroso | enxuto>
- **Critérios aprovados**: <pendente | sim (AAAA-MM-DD)>
- **Decisão**: <pendente | <opção escolhida> (AAAA-MM-DD) | parado — <motivo>>
- **Registro**: <pendente | <caminho do ADR> | sem ADR — <motivo>>

## Decisão a tomar

<o que se escolhe, o problema, o que a escolha afeta, o que fica fora>

- **Restrições já dadas**: <o que o projeto usa, AD-NNN ativos, orçamento, prazo, onde roda, quem mantém>
- **Construir versus comprar**: <não se aplica | em jogo: o que diferencia o produto>
- **Favorita declarada**: <nenhuma | <opção>, anotada antes dos critérios>

## Critérios (congelados na aprovação)

### Eliminatórios

| # | Requisito | Como se verifica |
|---|---|---|
| E1 | <...> | <fonte ou teste> |

### Desejáveis

| # | Critério | Peso (1-3) | Requisito que motiva | O que é bom |
|---|---|---|---|---|
| D1 | <...> | <n> | <...> | <...> |

### Mudanças de critério

<nenhuma | AAAA-MM-DD: <o que mudou>, motivo, aprovada pelo usuário>

## A esclarecer

- [A ESCLARECER: <...>]
```

Gravar `escolha.md` assim que a decisão existir; **Critérios aprovados** vira `sim` só com a aprovação do bloco.
