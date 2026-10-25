# ADR-007: Dinheiro em centavos inteiros e datas de calendário em São Paulo

- **Status:** Aceito em 2026-10-24 (etapa 5)
- **Data:** 2026-10-24
- **Decisores:** Leandro (stakeholder)
- **Detalha:** RT-04, RT-05, RN-14, RN-15, RN-16, RN-18 do `PRD-TECNICO.md`; GUARDRAILS G-23 e G-24; SDD §10 (`dominio/datas.ts`, `dominio/centavos.ts`)
- **Herda (no legado):** ADR-004 do MyMoney (`app.hoje()` em America/Sao_Paulo) e o uso de `bigint` em centavos

## Contexto

- O Worker e o Neon rodam em UTC. O casal vive em São Paulo: "hoje", "mês corrente", "mês fechado", vencimento atrasado e a janela de ±12 meses precisam da data civil de lá (RT-04). Às 23h30 de 31/10 em São Paulo já é 01/11 em UTC (CA-T4.1).
- No legado essas regras viviam em SQL (`app.hoje`, `app.inicio_mes`, `app.dia_no_mes`, `app.mes_fechado`). Agora elas vão para o `backend/dominio`, em TypeScript, sem I/O e sem relógio global (ADR-003, SDD 2.1).
- Ponto flutuante não serve para dinheiro: `0,1 + 0,2 ≠ 0,3`, e percentuais calculados em `number` podem errar o arredondamento perto de ,5 com valores grandes.
- O legado arredonda com `round(numeric)` do Postgres, que leva a metade para longe do zero. Uma troca silenciosa por outro arredondamento mudaria percentuais na tela.

## Decisão

1. **Dinheiro:** todo valor monetário é inteiro em centavos (`bigint` no banco, `number` inteiro seguro no TypeScript, tipo `Centavos` do contrato). O domínio recusa qualquer valor que não seja `Number.isSafeInteger`.
   - Lançamento: 1 a 10^11 centavos (`validarValorLancamento`). Previsto, alvo, orçamento, movimento de meta e pagamento de cartão: > 0. Saldo inicial: −10^11 a 10^11. Saldo real informado: qualquer inteiro.
   - **Divisões em inteiros exatos** (`BigInt`): `percentualArredondado(parte, total)` = round(100 × parte ÷ total) com a metade para longe do zero, igual ao Postgres; total 0 → `null` (o `nullif` do legado). `divisaoParaCima(a, b)` = ⌈a ÷ b⌉ (mensal da meta).
   - Percentuais são só exibição. Decisões usam a razão exata: a situação do orçamento compara `realizado × 100 < orçado × 80` em inteiros (CA-T5.3).
2. **Datas de negócio são datas de calendário**, sem hora, no texto `AAAA-MM-DD` (o mesmo do `date` do Postgres e do JSON), anos 0001 a 9999. Instantes (`criado_em`, sessão) continuam `timestamptz`.
   - A aritmética de datas (somar meses e dias, último dia do mês, ano bissexto) é feita em inteiros, sem `Date` local, para não depender do fuso do processo.
   - **"Hoje"** = `hojeEmSaoPaulo(instante)`: a data civil em America/Sao_Paulo do instante recebido, por `Intl.DateTimeFormat` com `timeZone`. Usa a base de fusos do runtime, que conhece o horário de verão histórico (até 2019); nunca um deslocamento fixo de −3 h. O instante vem do relógio injetado da API (`infraestrutura/relogio`).
   - Mês é sempre normalizado para o dia 1 (`inicioMes`). "Dia X do mês" que não existe vira o último dia (`diaNoMes`). "Mês fechado" = o dia 1 do mês seguinte é hoje ou já passou. A janela de geração e escrita é de hoje − 12 a hoje + 12 meses, inclusive (`mesNaJanela`).
3. **Textos** passam por `trim` (o de JavaScript, igual ao `z.string().trim()` do contrato); vazio vira `null` no opcional e é recusado no obrigatório. O tamanho conta caracteres (pontos de código), como o `char_length` do Postgres.
4. As regras do domínio devolvem `Resultado` (`{ ok, valor }` ou `{ ok: false, erro }`) com o código de erro do contrato (`valor_invalido` etc.); a API decide a ordem das recusas (RT-02) e o status.

## Divergências intencionais do legado

| Ponto | Legado | Aqui | Motivo |
|---|---|---|---|
| `trim` | `btrim` do Postgres: remove só o espaço U+0020 | `String.prototype.trim`: remove todo espaço em branco Unicode (tab, quebra de linha, NBSP) | Mesmo comportamento do Zod do contrato; uma descrição só com tab vira nula em vez de gravar um tab |
| Faixa de datas | `date` aceita anos acima de 9999 | Datas de 0001-01-01 a 9999-12-31; parcela que cairia depois disso → `valor_invalido` | Mantém o formato fixo `AAAA-MM-DD`; caso só alcançável com compra em novembro de 9999 |
| Início da fixa | `fixa_gera_no_mes` compara o mês com o `inicio` cru | O `inicio` é normalizado para o dia 1 antes da comparação | O modelo grava sempre o dia 1; se um dia viesse outro dia, a fixa deixaria de gerar o próprio mês de início |
| Fonte do fuso | `at time zone` com a tzdata do Postgres | `Intl` com a tzdata do runtime (Node e workerd) | Mesmo resultado; o risco é a tzdata do runtime ficar desatualizada se o Brasil voltar a ter horário de verão |
| Ordem por nome | Colação do banco | `Intl.Collator('pt-BR')` nas poucas ordenações do domínio (destaques do orçamento, ocorrências) | Ordem natural em português; as listas ordenadas no SQL continuam usando a colação do banco |

## Consequências

**Positivas**
- O mesmo instante dá o mesmo "hoje" no Worker, no CI e no teste, em qualquer fuso de processo.
- Nenhum centavo se perde em soma, divisão ou percentual; o arredondamento é o mesmo do legado.
- Datas como texto `AAAA-MM-DD` atravessam banco, API e front sem conversão de fuso.

**Negativas**
- `Intl` com `timeZone` custa mais CPU que uma soma fixa; o formatador é criado uma vez por isolate e chamado uma vez por requisição.
- O contrato (etapa 7) precisa contar o tamanho dos textos em pontos de código, não com o `.max()` do Zod (que conta unidades UTF-16), para não divergir do domínio e do `CHECK` do banco.

## Alternativas consideradas

| Alternativa | Por que não |
|---|---|
| Deslocamento fixo de −3 h | Errado para datas antigas com horário de verão e frágil se o horário de verão voltar |
| `Date` local e `toISOString()` | Depende do fuso do processo; `toISOString` é UTC e erra a virada do dia |
| Biblioteca de datas (date-fns-tz, Temporal polyfill) | Dependência a mais para poucas funções; `Intl` já está no runtime |
| Valores em reais com `number` decimal | Erro de ponto flutuante; contraria G-23 |
| `Math.round` em ponto flutuante para percentuais | Pode errar perto de ,5 com valores grandes; o `BigInt` é exato e barato |
