# Riscos, decisão e registro (fases 7 a 9)

## 7. Riscos e saída

Para cada finalista, em `avaliacao.md`, seção Riscos e saída:

| Pergunta | O que registrar |
|---|---|
| Dependência do fornecedor | padrão aberto ou proprietário; exportação de dados; alternativas compatíveis |
| Custo de migrar depois | o que teria de ser refeito (dados, código, contratos) e uma ordem de grandeza: horas, semanas ou meses |
| E se o projeto morrer ou o preço mudar | quem mantém, licença que pode mudar, histórico de mudanças de preço ou de licença |
| Plano B | qual finalista assume, e o que fazer desde já para a troca ficar barata (ex.: isolar atrás de uma interface) |

Pré-mortem, em uma linha por finalista: "daqui a um ano esta escolha deu errado. Por quê?". Resposta que aparece com evidência vira risco na tabela.

Pergunta da fase: **o risco de reverter é aceitável?** Finalista com risco inaceitável sai da disputa, com o motivo.

## 8. Decisão

- A sessão **recomenda** com o total ponderado, o teste prático e os riscos, e diz o **fator decisivo** (o que de fato decidiu: custo, reversibilidade, equipe, desempenho), sem apresentar a tabela como neutra quando um fator domina.
- Empate ou diferença pequena: a mais simples e a mais reversível; depois, a mais madura e conhecida.
- **O usuário escolhe**, via `AskUserQuestion`: um finalista por opção (o recomendado primeiro, com "(Recomendado)"), e **parar**.
- Grave em `avaliacao.md`, seção Decisão, a justificativa em 3 a 5 linhas e a **condição em que a escolha mudaria** (ex.: "se o volume passar de 1 milhão de registros por mês, rever"). Grave **Decisão** em `escolha.md`.

## 9. Registro (ADR)

### Onde fica

1. O projeto já tem pasta de decisões (`docs/adr/`, `doc/adr/`, `docs/decisions/`, `adr/` ou outra encontrada pelo `leitor-codigo`): use-a, com a numeração e o formato dela. A convenção do projeto vence.
2. Senão: `.specs/decisoes/ADR-NNN-<slug>.md`, ao lado dos outros artefatos dos fluxos.

Número: o maior existente na pasta mais um (`ADR-001` na primeira). Os `.md` são versionados com o projeto.

### Compatível com o `tlc-spec-driven`, sem duplicar

O tlc registra decisões de projeto como entradas `AD-NNN` em `.specs/STATE.md`, seção de decisões (`tlc-spec-driven/references/memory.md`), só quando são difíceis de reverter, surpreendentes sem contexto e fruto de escolha real entre alternativas. O ADR é o **registro completo**; o `AD-NNN` é a **restrição curta** que o Design do tlc lê em toda feature.

- **Modo rigoroso** (passa nos três testes do tlc): acrescente uma entrada `AD-NNN` no formato e com os valores de situação do `memory.md` do tlc (texto em português), com a decisão em uma frase, o motivo e a troca em uma linha cada, o escopo, a data e o caminho do ADR. Não copie contexto, opções nem consequências: estão no ADR. Edite só a seção de decisões do `STATE.md`; se o arquivo não existir, crie-o com as duas seções do tlc.
- **Modo enxuto**: só o ADR leve. Escolha local de uma feature chamada pelo Design vai também na tabela de decisões técnicas do `design.md`, apontando para o ADR.
- Numerações independentes: o ADR leva `AD-NNN` no cabeçalho (ou "não registrado no STATE"), e o `AD-NNN` leva o caminho do ADR.

### Imutável

ADR aceito não se edita. Trocar de escolha é um ADR novo com **Substitui**: ADR-NNN; no antigo muda só a linha **Situação** para `substituído por ADR-MMM`. No `STATE.md`, `AD-NNN` novo, e o antigo passa a `superseded by AD-NNN` (valor que o tlc lê), como manda o `memory.md` dele.

### Modelo completo (modo rigoroso; MADR adaptado)

```markdown
# ADR-NNN: <decisão como frase afirmativa, ex.: "Usar PostgreSQL como banco principal">

- **Situação**: aceito · **Data**: <AAAA-MM-DD> · **Decidido por**: <usuário>
- **Registro no STATE**: <AD-NNN | não registrado>
- **Substitui**: <— | ADR-NNN>
- **Revisar quando**: <data ou gatilho: volume, preço, fim de suporte, release que falta>
- **Escolha completa**: `.specs/escolhas/<slug>/` (critérios, comparativo com fontes, spikes)

## Contexto

<o problema e as forças em jogo: requisitos, restrições, equipe, prazo; não só o que se decidiu>

## Critérios que decidiram

- <eliminatórios principais e desejáveis de maior peso>

## Opções consideradas

- **<A>**: prós <...>; contras <...>
- **<B>**: prós <...>; contras <...>
- **Eliminadas**: <opção — motivo>

## Decisão

<o que se escolheu, em tom definitivo ("vamos usar"), e o fator decisivo>

## Consequências

- **Boas**: <...>
- **Ruins**: <sempre ao menos uma: o que se perde ou passa a custar>
- **Riscos e saída**: <risco principal, plano B, o que fazer agora para a troca ficar barata>
```

### Modelo leve (modo enxuto)

```markdown
# ADR-NNN: <decisão como frase afirmativa>

- **Situação**: aceito · **Data**: <AAAA-MM-DD> · **Registro no STATE**: não registrado (fácil de reverter)
- **Revisar quando**: <gatilho>

No contexto de <problema>, diante de <critério que pesou>, escolhemos <opção> e não <outras>, para obter <ganho>, aceitando <custo>.

Escolha completa: `.specs/escolhas/<slug>/`.
```

### Ao gravar

- Mostre o ADR e o diff do `STATE.md` (quando houver) antes de fechar a fase.
- Grave **Registro** em `escolha.md` com o caminho do ADR.
- **Usar em**: leve a escolha ao artefato do chamador (ex.: linha da tabela de decisões técnicas do `design.md` com o `AD-NNN`), com o caminho do ADR como referência. Sem chamador, ofereça via `AskUserQuestion` o próximo passo: nenhum, o fluxo que constrói (projeto novo, feature, uso próprio) ou outra escolha que dependia desta.
