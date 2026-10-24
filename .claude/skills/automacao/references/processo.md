# Processo, retorno e escopo (fases 1 a 3)

Responde: **o que se faz hoje, vale automatizar e o que entra?** Uma conversa curta, um arquivo, uma aprovação. Também define o modelo de `processo.md`, que guarda o estado da automação inteira.

## Como conduzir

- Uma pergunta por vez, via `AskUserQuestion`, com sugestão plausível e "Ainda não sei" (vira `[A ESCLARECER]`; passos, frequência ou tempo `[A ESCLARECER]` não passam da fase 1).
- **Não cite ferramentas nestas fases.** Se o usuário já tem uma em mente, anote em **Ferramenta** como `declarada: <nome>` e siga.
- Leia antes, se existirem: `.specs/projeto/inventario.md` (scripts, agendamentos e integrações que o projeto já tem), `.specs/STATE.md` (decisões `AD-NNN`).

## Fase 1: processo atual

1. **O que é o processo**, numa frase, e o resultado que ele entrega ("conciliar o extrato do banco com as notas do mês e marcar as divergências").
2. **Uma execução real anotada**: peça para o usuário fazer (ou ter feito há pouco) e anotar cada passo, com a ferramenta usada. Se for no computador e ele quiser, ele narra e a sessão escreve. Descrição de memória fica `PREMISSA` até uma execução real.
3. **Entradas e saídas** de cada passo: de onde vem (arquivo, e-mail, sistema, pessoa), para onde vai, formato.
4. **Decisões**: onde a pessoa julga algo ("se o valor não bate, olho a nota"). Cada decisão vira regra explícita ou fica humana.
5. **Exceções**: o que sai do normal, com que frequência, e o que se faz.
6. **Quem participa**: quem faz, quem recebe, quem aprova.
7. **Tempo e frequência**: minutos por execução (medidos na execução anotada) e quantas vezes por mês; erros que acontecem hoje e o custo de cada um.

## Fase 2: vale automatizar?

Escreva a conta, com os números da fase 1 (estimativa sem medida fica `PREMISSA`):

| Item | Valor |
|---|---|
| Horas economizadas por mês | minutos por execução × execuções por mês ÷ 60 (menos o tempo que continua humano: exceções, conferência) |
| Horas para construir | estimativa da sessão pela ferramenta provável, com faixa (mínimo–máximo) |
| Horas de manutenção por mês | sugestão: 10% a 20% do tempo de construir por ano, dividido por 12, mais o tempo de olhar relatórios e alertas |
| Meses para empatar | horas para construir ÷ (economizadas − manutenção) |
| Horizonte | por quanto tempo o processo deve continuar existindo (do usuário) |
| Erros evitados | quantos por mês e o custo de cada um (dinheiro, retrabalho, cliente) |
| Risco da automação | o pior que ela pode fazer se errar (ex.: apagar, enviar em massa, pagar em dobro) |

- **Veredito** (a sessão recomenda, o usuário decide): `automatizar` (empata bem antes do horizonte, ou evita erro caro); `automatizar parte` (só os passos com retorno); `não automatizar` (não empata no horizonte, ou o risco supera o ganho); `padronizar primeiro` (o processo não é repetível).
- Ganho que não é tempo (erro evitado, prazo cumprido, tédio que causa erro) conta, mas escrito com o motivo, nunca para salvar uma conta negativa sem dizer.
- Com `não automatizar` ou `padronizar primeiro`: preencha **Resultado** e peça a aprovação já aqui, sem fazer a fase 3.

## Fase 3: escopo

- **Caminho comum**: os passos e casos que a automação cobre, com a parcela dos casos (ex.: "85% dos lançamentos").
- **Exceções com o humano**: cada exceção conhecida e o **aviso** que a pessoa recebe quando ela ocorre (o quê, por onde, com que informação para agir).
- **Fora**: o que não será feito, explicitamente.
- **Primeiro passo**: o menor pedaço automatizado que já traz valor e confiança. Os demais esperam a execução assistida do primeiro.

## Modelo de `processo.md`

```markdown
# Automação: <processo>

- **Slug**: <slug> · **Início**: <AAAA-MM-DD> · **Dono**: <pessoa ou papel>
- **Ferramenta**: <a escolher | declarada: <nome> | <degrau>: <nome> (ADR <caminho> | motivo)>
- **Onde mora**: <— | repositório e pasta | serviço e conta (sem credencial)>
- **Como se testa**: <— | suíte do repositório (comando) | casos de teste executados no modo de teste do serviço>
- **Construção**: <— | .specs/features/automacao-<slug>/ (feature | legado) | spec no repositório da automação>
- **Resultado**: <pendente | concluída (AAAA-MM-DD) | não automatizar — <motivo> | parada — <motivo> | movida para <caminho>>

## Processo atual

- **Resultado entregue**: <...> · **Execução anotada em**: <AAAA-MM-DD>
- **Quem participa**: <faz · recebe · aprova>

| # | Passo | Entrada | Saída | Ferramenta | Decisão humana? |
|---|---|---|---|---|---|

- **Exceções**: <exceção — frequência — o que se faz>
- **Tempo e frequência**: <N min por execução, N vezes por mês> · **Erros hoje**: <...>

## Conta de retorno

| Item | Valor |
|---|---|

- **Veredito**: <automatizar | automatizar parte | não automatizar | padronizar primeiro> — <motivo em uma linha>

## Escopo

- **Caminho comum**: <passos e parcela dos casos>
- **Exceções com o humano**: <exceção → aviso (canal, conteúdo)>
- **Fora**: <...>
- **Primeiro passo**: <...>

## Fases

| # | Fase | Situação |
|---|---|---|
| 1 | Processo atual | pendente |
| 2 | Vale automatizar? | pendente |
| 3 | Escopo | pendente |
| 4 | Ferramenta | pendente |
| 5 | Desenho seguro | pendente |
| 6 | Implementação | pendente |
| 7 | Execução assistida | pendente |
| 8 | Operação | pendente |
| 9 | Manutenção | pendente |

## A esclarecer

- [A ESCLARECER: <...>]
```

Situação: `pendente`, `feita (AAAA-MM-DD)` ou `dispensada — <motivo>`. Grave `processo.md` assim que o processo tiver nome; as fases 1 a 3 viram `feita` juntas, só com a aprovação.
