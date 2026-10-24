# Medição (fase 2, e regras para as fases 6 e 7)

Responde: **como o sistema se comporta hoje, de um jeito que dê para repetir?** A mesma medição, com o mesmo comando e as mesmas condições, volta depois de cada mudança (fase 6) e na verificação (fase 7).

## 1. Segurança antes de medir

- **Teste de carga nunca contra produção** nem contra serviço de terceiro (pagamento, e-mail, mapa, API externa) sem **confirmação específica** via `AskUserQuestion`, dizendo alvo, taxa, duração e como parar. Carga pode derrubar o sistema, gerar custo, bloquear a conta ou ser negação de serviço contra quem não autorizou.
- Padrão: aplicação local ou staging, com as chamadas a terceiros apontadas para sandbox ou dublê. Se o caminho quente passa por terceiro, meça o resto sem ele e registre isso.
- `EXPLAIN ANALYZE` **executa** a consulta: só `SELECT`, e em banco de produção só com confirmação. Comando de escrita, nunca.
- Perfil em produção (py-spy num processo, APM com amostragem maior) também pede confirmação: custa CPU de quem está usando.
- Ler métricas de produção que já existem (painel, APM, logs, consulta lenta registrada) é bem-vindo e não pede confirmação, salvo acesso novo.
- Dados: volume parecido com o de produção. Cópia de produção com dado pessoal só anonimizada (LGPD) e fora do git.

## 2. Ferramenta: a que já está instalada

Confira o que existe antes de propor (`<ferramenta> --version`, `npx --no-install <pacote> --version`, dependências de desenvolvimento do projeto, `inventario.md`). **Instalar é decisão do usuário**: pergunte via `AskUserQuestion` com a sugestão, ou use um **script mínimo** na linguagem do projeto (laço com relógio monotônico, N repetições, percentis calculados), guardado em `carga/`.

| Para quê | Opções comuns (use a que houver) |
|---|---|
| carga HTTP | k6, autocannon, wrk, hey, oha, ab, Artillery, Locust, Gatling, JMeter, vegeta |
| comando ou script inteiro | hyperfine, `time` repetido |
| microbenchmark | pytest-benchmark, `timeit`; tinybench, `vitest bench`; JMH; BenchmarkDotNet; `go test -bench`; criterion |
| perfil de CPU | py-spy, cProfile, pyinstrument, scalene; `node --cpu-prof`, clinic, 0x; async-profiler, JFR; dotnet-trace; pprof; rbspy, stackprof; SPX, Xdebug |
| memória | tracemalloc, memray; `node --heap-prof`, heap snapshot; JFR, dotnet-counters; pprof heap |
| banco | `EXPLAIN (ANALYZE, BUFFERS)` e `pg_stat_statements` (PostgreSQL); `EXPLAIN ANALYZE` e log de consulta lenta (MySQL); `EXPLAIN QUERY PLAN` (SQLite); log ou contagem de consultas do ORM |
| sistema | `docker stats`, `top`, `/usr/bin/time -v`; no Windows, Gerenciador de Tarefas ou `Get-Counter` |
| web | Lighthouse, painel Performance do navegador, servidor MCP de DevTools se já configurado (ver `web.md`) |

Prefira a ferramenta que também servirá à guarda no CI (fase 8): k6 e autocannon têm limites que fazem o comando falhar; pytest-benchmark e `vitest bench` comparam com um valor salvo.

## 3. Como medir

1. **Cenário de `performance.md`** transformado em roteiro executável em `.specs/performance/<slug>/carga/` (script k6, comando autocannon, benchmark, consulta). Versionado, sem segredo: credencial só por variável de ambiente.
2. **Carga por taxa de chegada** quando a meta é de latência sob carga (ex.: k6 `constant-arrival-rate`): com número fixo de usuários em laço, uma resposta lenta segura as próximas requisições e o p99 sai menor do que o real.
3. **Aquecimento** antes de valer (JIT, cache, conexões), descartado da conta. Diga se a medida é de cache frio ou quente.
4. **Repetições:** pelo menos 3 rodadas de carga (5 para microbenchmark). Registre a **mediana** e a **dispersão** (mínimo e máximo, ou desvio).
5. **Percentis** p50, p95, p99, vazão, taxa de erro, e os recursos (CPU, memória) no mesmo intervalo. Erro acima da guarda invalida a rodada.
6. **Condições anotadas:** máquina ou ambiente, versão (commit), dados (volume), configuração (pool, workers), o que mais rodava.
7. **Métricas de produção**, se existirem, ao lado do laboratório: elas dizem se o cenário representa a realidade.

## 4. Ruído e ganho confirmado

- **Ruído:** se as repetições discordam muito (máximo maior que 1,2 × o mínimo, como referência), estabilize antes de seguir: feche outros programas, fixe a frequência da CPU se der, use a mesma máquina, mais repetições, dados fixos.
- **Ganho confirmado** (fases 6 e 7): a mediana nova está do lado certo e **as faixas não se sobrepõem** (o pior valor depois é melhor que o melhor valor antes), sem piorar as guardas. Faixas sobrepostas = **não confirmado**, mesmo que a mediana tenha melhorado.
- Comparação só vale com o mesmo roteiro, ambiente e dados. Mudou o ambiente? Meça de novo a linha de base nele.

## Modelo de `medicoes.md`

```markdown
# Medições: <slug>

## Linha de base
- **Data**: <AAAA-MM-DD> · **Commit**: <hash> · **Ambiente**: <staging | local (`PREMISSA`)> · **Dados**: <volume>
- **Ferramenta**: <k6 0.x | script `carga/medir.py`> · **Comando**: `<comando exato>`
- **Carga**: <taxa ou usuários, duração, aquecimento> · **Cache**: <frio | quente>

| Rodada | p50 | p95 | p99 | Vazão | Erro | CPU | Memória |
|---|---|---|---|---|---|---|---|
| 1 | | | | | | | |
| **Mediana (faixa)** | | | | | | | |

- **Produção** (se houver): <métrica, período, fonte>
- **Observações**: <ruído, limitações>

## Mudanças (fase 6)
| Data | Tarefa | Commit | Métrica da meta (mediana e faixa) | Guardas | Veredito |
|---|---|---|---|---|---|
| <...> | T1 <índice em pedidos.cliente_id> | <hash> | p95 820 → 310 ms (300–330) | erro 0%, CPU 40% | mantida · revertida (`<hash do revert>`) — não confirmado |

## Verificação (fase 7)
- Ver `validation-rodada-<N>.md`.
```
