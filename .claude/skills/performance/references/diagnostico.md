# Diagnóstico (fase 3)

Responde: **onde está o gargalo de verdade?** Achar o **maior** gargalo, não o mais óbvio. A intuição sobre "o que deve estar lento" erra com frequência; o perfil decide.

## 1. Mapear o caminho quente

Despache o `leitor-codigo` (em paralelo, um por pergunta), com o cenário de `performance.md`:

1. **Caminho:** da entrada (rota, tela, comando, job) até a resposta: funções, serviços, consultas, chamadas externas, filas, com `arquivo:linha`.
2. **Suspeitos no código:** consulta dentro de laço (N+1), consulta sem filtro ou sem limite, carga de lista inteira para usar um item, laço aninhado sobre muitos dados, serialização de objeto grande, trabalho síncrono que bloqueia (arquivo, rede, CPU) num servidor assíncrono, chamada externa sem tempo limite, cache que nunca acerta, log excessivo no caminho.
3. **Configuração:** pool de conexões, número de workers ou threads, limites de memória, timeouts, índices declarados nas migrações.

O mapa diz **onde olhar**; não é a evidência. Suspeito sem medição continua suspeito.

## 2. Medir onde vai o tempo (roteiro de perfil)

Rode o cenário da linha de base com instrumentação, no mesmo ambiente (ferramentas em `medicao.md`):

| Recurso | Pergunta | Como ver |
|---|---|---|
| **Tempo por parte** | quanto da resposta é aplicação, banco, rede, terceiro, fila? | trace (OpenTelemetry, APM) se houver; senão cronômetro por trecho no log, temporário e fora do commit |
| **CPU** | que funções consomem a CPU? | perfil de CPU, gráfico de chamas; procure a "torre" mais larga, não a mais alta |
| **Memória** | cresce sem parar? coleta de lixo frequente? | perfil de memória, uso ao longo da carga; pausas do coletor |
| **Banco** | quais consultas, quantas por requisição, quanto cada uma? | contagem de consultas por requisição; `pg_stat_statements` ou log de consulta lenta; `EXPLAIN (ANALYZE)` das piores (varredura completa, ordenação em disco, estimativa muito errada de linhas) |
| **Rede e terceiros** | quanto se espera por chamadas externas? em série ou em paralelo? | trace, log com duração; tamanho das respostas |
| **I/O e disco** | leitura ou escrita de arquivo no caminho? | perfil, `iostat`, tempo do trecho |
| **Concorrência** | a vazão para de subir antes de a CPU encher? | fila no pool de conexões ou de threads, bloqueio (lock) no banco, espera por recurso compartilhado |
| **Front (web)** | é carregamento, interação ou layout? | `web.md` |

Para **capacidade** ("aguenta 500 usuários?"), suba a carga em degraus até o ponto em que o p95 dispara ou o erro aparece: o primeiro recurso a saturar (CPU, memória, conexões do banco, threads) é o gargalo, e esse ponto é o **limite atual**.

## 3. Ranquear e estimar o ganho máximo

Monte a tabela de onde vai o tempo (ou o recurso) no cenário e ordene pela fração. **O ganho máximo de uma correção é limitado pela fração do que ela toca:** se o banco é 60% do tempo, zerá-lo deixa a resposta 2,5 vezes mais rápida, nunca mais que isso. Se nenhuma parte sozinha leva à meta, várias mudanças ou uma mudança de arquitetura serão necessárias: diga isso agora.

## 4. Causa confirmada

A causa está **confirmada** quando há evidência direta (perfil, plano de consulta, trace, contagem) e, quando der, um **experimento de bancada**: desligar ou contornar o trecho num ambiente descartável e ver o tempo cair na proporção esperada. Hipótese sem evidência fica marcada como hipótese.

**Saída de emergência:** se o gargalo é do desenho (um banco só para tudo, processamento síncrono do que deveria ser fila, modelo de dados que obriga a varrer tudo, limite do serviço contratado), pare e apresente ao usuário com a evidência (`SKILL.md`, Saídas).

## Modelo de `diagnostico.md`

```markdown
# Diagnóstico: <slug>

## Rodada <N> — <AAAA-MM-DD>
- **Commit**: <hash> · **Ambiente**: <...> · **Roteiro**: `carga/<arquivo>`

### Caminho quente
<entrada> → <serviço> (`arquivo:linha`) → <consulta ou chamada> (`arquivo:linha`) → ...

### Onde vai o tempo
| Parte | Fração do tempo ou do recurso | Evidência |
|---|---|---|
| <consulta de pedidos por cliente> | <62%> | <`EXPLAIN`: varredura completa em 1 milhão de linhas; arquivo em `evidencias/`> |
| <serialização> | <15%> | <perfil de CPU> |

### Gargalo
- **Causa**: <uma frase> · **Confirmada por**: <perfil | plano | trace | experimento de bancada>
- **Ganho máximo estimado**: <se zerar a parte: p95 de X para Y>
- **Chega à meta sozinha?** <sim | não: <o que mais seria preciso>>
- **Limite atual** (capacidade): <N req/s ou usuários antes de o p95 passar de X; primeiro recurso a saturar>

### Hipóteses descartadas
- <suspeito que parecia óbvio> — <por que não é: número>
```

Saídas brutas grandes (perfil, trace, relatório) ficam em `evidencias/`, fora do git se tiverem dado de produção. Na rodada seguinte, acrescente uma seção nova; não apague a anterior.
