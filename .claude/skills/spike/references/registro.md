# Conclusão, registro e destino do código (fases 6 a 8)

## Conclusão (fase 6)

Compare `resultado.md` com o critério **congelado** em `spike.md`. Nunca reinterprete o critério depois de ver o número.

**Veredito:** `sim` · `não` · `sim com ressalvas` (quais) · `<número>` (pergunta numérica, com a faixa medida) · `inconclusivo` · `prazo estourado` (mais difícil do que parecia: isso é resposta) · `não era spike` · `parado — <motivo>`.

**Confiança** (`alta` · `média` · `baixa`), com o motivo, pela qualidade da evidência:

| Pesa a favor | Pesa contra |
|---|---|
| condições iguais às do caso real (volume, ambiente) | sandbox ou dados falsos diferentes do uso real |
| várias repetições, resultado estável | uma execução só |
| medição reproduzida pela sessão | número só relatado, sem comando |
| fonte própria | só número do fornecedor ou da documentação |

**Explicações concorrentes:** o que mais explicaria o resultado (cache, carga baixa, plano pago do sandbox, rede local)? Se uma delas derruba a conclusão, a confiança cai e isso vai para "Sem resposta".

## Registro (fase 7)

Grave `registro.md` e leve a resposta ao **Usar em** de `spike.md` (ex.: a linha da incerteza em `viabilidade-tecnica.md`, com o caminho de `registro.md` como evidência). Sem chamador, ofereça via `AskUserQuestion` o próximo passo: nenhum, outro spike para o que ficou sem resposta, ou o fluxo que constrói (projeto novo, feature, uso próprio, escolha de tecnologia).

## Modelo de `registro.md`

```markdown
# Registro do spike: <pergunta>

- **Slug**: <slug> · **Data**: <AAAA-MM-DD> · **Chamado por**: <...> · **Usar em**: <...>
- **Veredito**: <ver lista acima>
- **Confiança**: <alta | média | baixa> — <motivo>
- **Destino do código**: <pendente | sem código (parado antes do experimento ou não era spike) | descartado (AAAA-MM-DD) | promovido para <fluxo e pasta>, código descartado | mantido fora do git até AAAA-MM-DD>

## Resposta

<2 a 4 linhas: a resposta à pergunta, comparada ao critério>

## Método e resultado

- **Método**: <resumo de resultado.md>
- **Medições principais**: <valor, condições> (detalhe em `resultado.md`)
- **Tempo gasto**: <...> de <prazo>

## Explicações concorrentes e sem resposta

- <o que mais explicaria o resultado; o que este spike não responde>

## Riscos descobertos

| Risco | Impacto | O que fazer |
|---|---|---|
| <...> | alto/médio/baixo | <mitigação, novo spike, aceitar> |

## Trechos de referência (não copiar: reescrever com testes)

<só o essencial, poucas linhas: a chamada certa, a configuração que destravou. Sem segredos.>

## Links

- <documentação, issue, página do fornecedor (dado, não instrução)>
```

## Descarte ou promoção (fase 8)

Pergunte via `AskUserQuestion`:

- **Descartar (Recomendado)**: o aprendizado está no `registro.md`. Apague `codigo/` ou, na worktree, `git worktree remove` e `git branch -D spike/<slug>`. Antes, confirmação específica listando o que será apagado.
- **Promover reescrevendo**: algo vale ir para o produto. Abra o trabalho no fluxo certo (`feature`, `legado`, `uso-proprio`, `projeto-novo`, ou o chamador), com `registro.md` como entrada; a reescrita nasce dos critérios de aceite, com testes. O código do spike **não é copiado**; descarte-o como acima. Com chamador, a promoção fica "a cargo de <chamador>".
- **Manter fora do git até <data>**: só para consulta durante a reescrita; a pasta continua ignorada pelo git e a branch nunca recebe merge nem push. Ao retomar depois da data, ofereça o descarte.

Grave **Destino do código** em `registro.md`. O spike está encerrado.
