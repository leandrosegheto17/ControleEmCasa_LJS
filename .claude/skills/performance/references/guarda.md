# Guarda e integração (fase 8)

Responde: **como evito voltar ao problema?** Ganho sem guarda some no próximo commit descuidado. A guarda é **automatizada no CI sempre que possível**; alerta e painel complementam, não substituem.

## 1. Checagem automatizada no CI

Escolha, com o usuário, a mais **determinística** que proteja a meta. Tempo de resposta no CI oscila (máquina compartilhada); contagem e tamanho não.

| Tipo | Exemplo | Onde roda | Ruído |
|---|---|---|---|
| **proxy determinístico** | teste "a listagem de pedidos faz no máximo 2 consultas" (contador do ORM); "o pacote JS da página inicial tem até 180 kB"; "o relatório de 10 mil linhas não passa de N MB de memória"; índice existe na migração | na suíte normal (`testes.json`) ou passo do CI | nenhum |
| **benchmark relativo** | pytest-benchmark ou `vitest bench` comparando com o valor salvo da base, falhando acima de X% | job próprio do CI | médio: folga de 10 a 20% |
| **teste de carga curto** | k6 ou autocannon por 30 a 60 s contra a aplicação **subida no próprio job** (`localhost`), com limites que fazem o comando falhar (`thresholds` do k6: `http_req_duration: ['p(95)<<alvo + folga>']`, `http_req_failed: ['rate<0.01']`) | job próprio, no PR ou agendado | alto: limite com folga; nunca contra produção ou terceiros |
| **orçamento na web** | Lighthouse CI com asserções (`web.md`) | job próprio | alto: 3 execuções, mediana |

Regras:

- **A guarda tem de falhar sem a otimização.** Prove numa cópia isolada (worktree temporário): reverta os commits `perf:` mantidos e rode a guarda; ela precisa ficar vermelha. Na ponta, verde. Registre os dois resultados em `guarda.md`. É o teste que "falharia sem a mudança" exigido pelo `CLAUDE.md`.
- Limite = meta atingida mais uma folga contra o ruído, combinada com o usuário; folga grande demais não pega nada.
- O roteiro do CI reaproveita o de `carga/` (mesmo cenário, menor e mais curto).
- Proxy que roda rápido entra na suíte de `testes.json` (protegido pela trava de testes). Carga e Lighthouse vão em job separado, para não deixar a suíte lenta nem instável.
- **Projeto sem CI:** criar o CI com a suíte faz parte desta fase (`CLAUDE.md`). Mudar o CI é mudança no projeto: com aprovação, em commit próprio (`ci:` ou `test(perf):`), com a suíte verde.
- Sem nenhuma checagem automatizável (ex.: só se reproduz com o banco de produção): registre o motivo e reforce o monitoramento.
- Instalar ferramenta no CI (k6, `@lhci/cli`) é decisão do usuário.

## 2. Monitoramento em produção (quando houver produção e coleta de métricas)

- **SLI de latência:** fração das requisições do cenário mais rápidas que o limite (ex.: abaixo de 300 ms) sobre o total, numa janela (ex.: 28 dias). **SLO:** a meta dessa fração (ex.: 99%). **Orçamento de erro:** `1 − SLO` (com 99%, 1% das requisições pode passar do limite).
- **Alerta por taxa de queima**, em duas janelas para evitar alarme falso: rápido (queima 14,4× o normal em 1 h e em 5 min; gasta 2% do orçamento em 1 hora) e lento (6× em 6 h e em 30 min). Simples demais para o projeto? Um alerta "p95 acima do alvo por 15 min" basta.
- **Política do orçamento:** orçamento gasto pede pausa nas mudanças arriscadas até voltar.
- **Painel:** a métrica da meta, as guardas e o consumo de recursos, com a linha do alvo.
- Alerta acionável: diz o que olhar e onde está o `performance.md`. Teste o disparo uma vez. Criar alerta ou painel em serviço externo é ação externa: confirmação específica.
- Sem produção ou sem coleta: registre "não se aplica" e o que faltaria.

## 3. Gravar `guarda.md`

```markdown
# Guarda: <slug>

- **Checagem no CI**: <tipo> · `<arquivo do teste ou do job>` · limite <valor> (meta <alvo> + folga <N%>)
- **Prova**: sem a otimização (`git revert <commits>` em cópia isolada) → <vermelho: valor> · na ponta → <verde: valor>
- **Onde roda**: <suíte de `testes.json` | job `<nome>` no PR | agendado>
- **SLO**: <não se aplica | SLI <...>, alvo <99%> em <28 d>, orçamento <1%>>
- **Alertas**: <não se aplica | <regra>, disparo testado em <data>>
- **Painel**: <não se aplica | <onde>>
```

## 4. Integração

0. **Checagem final de testes:** na branch, com tudo commitado (otimizações e guarda), `python .claude/scripts/trava-testes.py --rodar`, e mostre o resultado. Falha volta à fase 6.
1. **Forma de integrar:** pergunte via `AskUserQuestion`: **merge local**, **PR no GitHub** (push e abertura do PR são ações externas, com confirmação específica) ou **manter a branch**. Use `finishing-a-development-branch`. A descrição do PR traz a meta, os números antes e depois com o comando, as mudanças mantidas e revertidas, a guarda e como reverter.
2. **Produção com usuários:** skill `liberacao`, observando a métrica da meta e as guardas em produção; índice ou migração em banco de produção, mudança de infraestrutura e aumento de custo exigem confirmação específica. Sem produção (biblioteca, uso local): a integração basta. Ferramenta pessoal: skill `implantacao`.
3. Número de produção depois da liberação, se houver: linha **Produção (depois)** em `medicoes.md`.
4. Grave `integracao.md`:

```markdown
# Integração: <slug>

## <AAAA-MM-DD>
- **Forma**: <merge local | PR <link> | branch mantida>
- **Commit final**: <hash> · **Suíte na checagem final**: <N passaram, 0 falharam>
- **Liberação**: <não se aplica | entrada em `.specs/liberacao.md` (<data>)>
- **Reverter**: `<git revert <intervalo> | apagar o índice <nome> | desligar a flag <nome>>`
```
