# Opções, plano e otimização (fases 4 e 6)

## Fase 4: opções

Liste as alternativas que atacam o gargalo de `diagnostico.md`, **começando pelas mais baratas**. Escalar a infraestrutura vem por último: corrigir o gargalo costuma custar menos que acrescentar servidores, e servidor a mais não resolve consulta sem índice.

| Categoria | Exemplos | Cuidado |
|---|---|---|
| consulta | tirar consulta de dentro do laço (carregar em lote), selecionar só as colunas usadas, filtrar e limitar no banco | mesmo resultado e mesma ordem |
| índice | índice para o filtro ou a ordenação da consulta lenta | custo na escrita e no espaço; criação em tabela grande de produção pode travar (criar sem bloqueio, quando o banco permitir) |
| algoritmo e dados | estrutura certa (mapa em vez de busca em lista), evitar trabalho repetido, processar em fluxo em vez de carregar tudo | — |
| cache | memória do processo, Redis, HTTP (`Cache-Control`), resultado pré-calculado | **muda comportamento**: dado velho por quanto tempo? invalidação; cache por usuário com dado pessoal (`auditor-seguranca`) |
| concorrência | chamadas externas em paralelo, trabalho pesado para fila ou processo em segundo plano, pool de conexões do tamanho certo | ordem dos efeitos; erro parcial; resposta antes do fim muda o contrato |
| volume | paginação, compressão, resposta menor | paginação **muda o contrato** de quem consome |
| front (web) | `web.md` | — |
| infraestrutura | máquina maior, mais instâncias, banco gerenciado maior, réplica de leitura, CDN | custo mensal; réplica traz atraso de leitura; trocar componente vai para `escolha-tecnologia` |
| arquitetura | separar leitura e escrita, mover para fila, mudar o modelo de dados | saída arquitetural: `refatoracao` (modo grande) ou desenho novo |

Para cada opção registre:

- **Ganho esperado**, com conta a partir da fração do diagnóstico (nunca maior que o ganho máximo);
- **Esforço** (horas, dias) e **risco** (o que pode quebrar);
- **Muda comportamento?** O que alguém de fora veria de diferente. Se sim, o usuário decide e a tarefa ganha **critério de aceite e teste nascido dele** (ex.: "pedido alterado aparece na listagem em até 60 s");
- **Reversível?** Como voltar (revert, flag, apagar índice).

**Opção incerta** (o ganho só se sabe testando, ou a técnica é nova no projeto): skill `spike`, gravando `.specs/spikes/<slug>/spike.md` com **Chamado por** `performance <slug>`, **Usar em** `.specs/performance/<slug>/opcoes.md`, pergunta com número ("o índice X leva a consulta abaixo de 50 ms com 1 milhão de linhas?").

**Opção é trocar componente ou infraestrutura** (banco, cache, fila, servidor de aplicação, biblioteca, hospedagem): skill `escolha-tecnologia`, gravando `.specs/escolhas/<slug>/escolha.md` com **Chamado por** `performance <slug>` e **Usar em** `opcoes.md`; o critério de desempenho entra como eliminatório com o número da meta.

Recomende a de **melhor custo-benefício** que leva à meta (a mais simples e reversível, no empate) e pergunte via `AskUserQuestion` quais entram e em que ordem.

## Plano em tarefas

Acione o `tlc-spec-driven`, fase **Tasks**, passando `performance.md` (meta e guardas) e `opcoes.md` como "spec". O `tasks.md` fica em `.specs/performance/<slug>/`; rode `validate_tasks.py` nesse caminho. Na rodada 2 em diante, acrescente uma fase nova ao `tasks.md` (rodada N).

- **Uma tarefa = uma mudança**, na ordem de custo-benefício. Duas otimizações na mesma tarefa escondem qual funcionou (e qual piorou).
- **Tests**: a caracterização de `protecao.md` que cobre o trecho; se a opção muda comportamento aprovado, o teste do critério de aceite. Proxy determinístico do ganho, quando existir (ex.: "a listagem faz no máximo 2 consultas"), entra na tarefa como teste: ele falharia sem a mudança.
- **Gate**: suíte inteira de `.specs/projeto/testes.json` verde e nenhum teste existente alterado.
- **Medir**: o comando de `medicoes.md`, mesmas condições, e o resultado esperado.
- **Reverter**: `git revert <commit>` (ou apagar o índice, desligar a flag).
- **Commit**: `perf(<escopo>): <mudança> (<slug>)`.

Grave `opcoes.md` e marque **Plano aprovado** com a aprovação.

### Modelo de `opcoes.md`

```markdown
# Opções: <slug>

## Rodada <N>
| # | Opção | Ganho esperado | Esforço | Risco | Muda comportamento? | Reversível? | Decisão |
|---|---|---|---|---|---|---|---|
| O1 | <índice em pedidos(cliente_id)> | <p95 −60%: consulta é 62% do tempo> | <1 h> | <escrita +5%> | não | apagar índice | tarefa T1 |
| O2 | <cache de 60 s na listagem> | <...> | <...> | <dado velho> | sim: até 60 s de atraso (aprovado em <data>) | flag | depois, se T1 não bastar |
| O3 | <dobrar a máquina> | <...> | <...> | <custo +R$ N/mês> | não | sim | última opção |

- **Spike**: <nenhum | `.specs/spikes/<slug>/registro.md` — veredito>
- **Escolha de tecnologia**: <nenhuma | `.specs/escolhas/<slug>/escolha.md` — decisão>
- **Por que esta ordem**: <...>
```

## Fase 6: otimização

`tlc-spec-driven`, fase **Execute**, na branch `performance/<slug>`, **uma tarefa por vez** (sem lotes paralelos: duas mudanças juntas tornam a medição inútil). `implementador` para a mudança mecânica (índice, consulta em lote); `implementador-dominio` quando há regra difícil (cache com invalidação, concorrência). Passe ao trabalhador `performance.md`, a tarefa, `protecao.md` e a regra: não otimizar nada fora da tarefa.

**Ciclo de cada mudança:**

1. Suíte verde antes (nenhuma falha além das preexistentes de `protecao.md`).
2. O trabalhador faz **só** a mudança da tarefa, roda a suíte inteira e, verde, commita.
3. **A sessão mede** com o comando e as condições de `medicoes.md` (repetições, mediana e faixa) e registra a linha em **Mudanças**. Quem mudou não dá o veredito da própria mudança.
4. **Ganho confirmado** (critério de `medicao.md`, seção Ruído e ganho confirmado) e guardas sem piora: **mantida**.
5. **Não confirmado**, ou guarda piorou: `git revert <commit>` (commit de reversão, não reescrever o histórico), suíte verde de novo, linha marcada **revertida** com o motivo. Uma mudança que "devia ajudar" e não ajudou sai mesmo assim.
6. Meta atingida com as mudanças mantidas: pare, pergunte via `AskUserQuestion` se encerra a rodada; as tarefas restantes ficam marcadas `não feita — meta atingida` no `tasks.md` e viram oportunidade em `dividas.md`.

**Nunca:** juntar duas mudanças num commit; deixar no código instrumentação temporária de diagnóstico; enfraquecer, pular ou apagar teste; mudar comportamento além do aprovado na fase 4 (vai para **Achados fora do escopo**).

Nenhuma mudança confirmada na rodada: não há o que verificar. Marque **Meta atingida** `não — rodada <N+1>`, abra a rodada seguinte (`SKILL.md`, seção 2) e volte ao diagnóstico antes de tentar mais do mesmo.
