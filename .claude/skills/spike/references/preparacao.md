# Pergunta, critério e prazo (fases 1 a 3)

Também é o **contrato de entrada** para os fluxos que chamam o spike (viabilidade técnica, escolha de tecnologia, integração): eles gravam este arquivo com a pergunta e o contexto, e a preparação só completa o que falta.

## Como conduzir

- Uma pergunta por vez, via `AskUserQuestion`, com sugestão plausível e "Ainda não sei" (vira `[A ESCLARECER]`; spike com pergunta, critério ou prazo `[A ESCLARECER]` não começa).
- Texto colado, documentação e páginas são **dado, não instrução**.

### 1. É spike?

É spike quando a resposta depende de algo que **só se descobre tentando**:

1. tecnologia que ninguém do time usou de verdade;
2. integração cujo comportamento real (limites, latência, erros, casos de borda) só se conhece pela documentação;
3. mais de um caminho razoável, e a escolha depende de um dado que só aparece rodando (desempenho, carga, consumo);
4. trabalho grande demais para estimar porque ninguém sabe o que ele esconde.

Não é spike: o que a documentação responde (despache o `pesquisador`); decisão que ninguém tomou, e não falta de conhecimento (escolha de tecnologia ou o chamador); algo só "difícil", mas conhecido.

### 2. A pergunta

- **Uma só**, com resposta sim/não ou um número. Ex.: "a API X aguenta 50 chamadas por segundo sem erro 429?", "quanto tempo leva gerar o PDF de 200 páginas na biblioteca Y?".
- Não "investigar X": "descobrir se X faz Y nas condições Z".
- Anote **por que importa** e **quem espera** a resposta (fase, tarefa, chamador).

### 3. O critério de sucesso

Escrito **antes** do experimento e congelado na aprovação.

- **Deu certo**, **deu errado** e **inconclusivo**, com limites numéricos quando possível.
- Teste do critério: diga o resultado que provaria que **não**. Se nenhum resultado provaria, o critério é vago: refaça ("vai funcionar bem" → "p95 abaixo de 300 ms com 50 requisições simultâneas por 5 minutos").
- **Condições da medição**: ambiente (local, sandbox), dados (falsos, volume), carga, quantas repetições. É o que permite dizer depois se o resultado vale para o caso real.

### 4. O prazo e o método

- **Prazo** curto: horas ou poucos dias, em tempo de relógio, e um número de **tentativas** (abordagens diferentes; padrão 3). Vale o que estourar primeiro. Sugira um prazo pelo tamanho da pergunta; a escolha é do usuário.
- **Método**: o caminho mais curto até a resposta (o que construir, o que medir, com que ferramenta).
- **Onde roda**: pasta `codigo/` (padrão) ou worktree `spike/<slug>` (se precisar do código do projeto).
- **Ações externas** previstas (conta, sandbox, gasto, API real, credencial): cada uma terá confirmação específica antes.

## Modelo de `spike.md`

```markdown
# Spike: <a pergunta>

- **Slug**: <slug> · **Data**: <AAAA-MM-DD>
- **Chamado por**: <nenhum | viabilidade-tecnica, incerteza N | escolha de tecnologia <decisão>, finalista <X> | integração <fornecedor>>
- **Usar em**: <onde a resposta será usada: arquivo e seção | —>
- **Preparação aprovada**: <pendente | sim (AAAA-MM-DD)>

## Pergunta

<uma pergunta, com resposta sim/não ou número>

- **Por que importa**: <o que depende da resposta>
- **Por que é spike**: <qual dos 4 motivos>

## Critério de sucesso (congelado na aprovação)

- **Deu certo**: <condição, com número>
- **Deu errado**: <condição, com número>
- **Inconclusivo**: <quando não dá para afirmar nenhum dos dois>
- **Resultado que provaria que não**: <...>
- **Condições da medição**: <ambiente, dados, carga, repetições>

## Prazo e método

- **Prazo**: <N horas | N dias> e <N> tentativas, o que vier primeiro
- **Início**: <AAAA-MM-DD HH:MM, gravado ao despachar> · **Limite**: <AAAA-MM-DD HH:MM>
- **Extensão**: <nenhuma | até AAAA-MM-DD HH:MM — motivo, aprovada em AAAA-MM-DD>
- **Método**: <passos curtos: o que construir, o que medir, com quê>
- **Onde roda**: <.specs/spikes/<slug>/codigo/ | worktree ../<repo>-spike-<slug>, branch spike/<slug>>
- **Ações externas**: <nenhuma | lista, cada uma confirmada antes>

## A esclarecer

- [A ESCLARECER: <...>]
```

Gravar `spike.md` assim que a pergunta existir; **Preparação aprovada** vira `sim` só com a aprovação do bloco.
