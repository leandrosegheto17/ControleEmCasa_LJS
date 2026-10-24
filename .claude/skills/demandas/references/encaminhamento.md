# Encaminhamento ao fluxo que faz

A demanda aprovada vira uma **solicitação para o fluxo certo**, no formato de entrada que ele já aceita. O fluxo de destino conduz o trabalho com as aprovações dele; a demanda só guarda a **Ligação** e espera o artefato de fim.

## Mapa de destinos

Escolha pelo que a demanda **pede de fato** (o problema), não pela palavra que o autor usou. Na dúvida entre dois, pergunte via `AskUserQuestion` com o mais provável primeiro.

| O problema pede | Skill | Entrada (o que gravar antes de acionar) | Artefato de fim (para conferir a ligação) |
|---|---|---|---|
| comportamento novo, em projeto recente feito com IA | `feature` | pasta `.specs/features/<slug>/`; o Specify parte de `encaminhamento.md`, com **Origem** no topo do `spec.md` | `integracao.md` |
| comportamento novo, em código legado | `legado` | igual à `feature` | `integracao.md` |
| algo não se comporta como deveria | `bug` | `.specs/bugs/<slug>/relato.md` (formato `bug/references/relato.md`) com o Relato preenchido e **sem** a Triagem; **Chamado por** `demanda DEM-NNN` · **Devolver após** `fechamento` | `fechamento.md` |
| algo funciona, mas está lento | `performance` | `.specs/performance/<slug>/performance.md` (formato `performance/references/meta.md`) com **Chamado por** `fluxo N .specs/demandas/DEM-NNN-<slug>`, **Usar em** `demanda.md` e o **Sintoma** | **Resultado** diferente de `pendente` |
| aparência, clareza ou acessibilidade de várias telas, sem mudar regra | `redesign` | nada: a fase 1 dele parte de `encaminhamento.md`; `redesign.md` ganha **Origem** no topo | **Resultado** diferente de `pendente` |
| ajuste visual pequeno numa tela | `feature` | como acima | `integracao.md` |
| passar a depender de um serviço externo (pagamento, mensagens, outro sistema) | `integracao-terceiros` | nada: a fase 1 dele parte de `encaminhamento.md`; `terceiro.md` ganha **Origem** no topo | **Resultado** diferente de `pendente` |
| uma tarefa repetitiva interna que já funciona à mão (pedido da equipe) | `automacao` | nada: a fase 1 dele parte de `encaminhamento.md` (a execução anotada continua obrigatória); `processo.md` ganha **Origem** | **Resultado** diferente de `pendente` |
| documentação do projeto (instalar, integrar, contribuir) | `documentar` | `.specs/documentacao/<slug>/documentacao.md` (formato `documentar/references/objetivo.md`) com **Chamado por** `fluxo N .specs/demandas/DEM-NNN-<slug>` e o público | **Resultado** diferente de `pendente` |
| falha de segurança relatada | `bug` (P0 ou P1), ou `incidente` se há exploração ou vazamento agora | `bug`: como acima, marcando no Relato que é segurança; `incidente`: acione já com as palavras do autor | `fechamento.md` · `incidente.md` com `Encerrado: sim` |
| produto ou público novo, fora do propósito deste produto | `projeto-novo` (outro repositório) ou recusar por coerência | a ideia vai para a descoberta de outro projeto, com `encaminhamento.md` como ponto de partida | `decisao.md` do outro projeto |
| pedido de quem decide e cobra, com prazo | skill `solicitacao` (fluxo 11) | troque o **Tipo** para `solicitação` (linha no **Histórico**); ela começa na fase 2 com o que já foi registrado | conforme o destino |

**Do suporte (skill `suporte`, fluxo 32)**, o `bug` recebe o `relato.md` **com** a Triagem (o suporte já reproduziu com a pessoa), **Chamado por** `suporte DEM-NNN` e **Devolver após** `liberação`: o bug começa na reprodução e devolve com um `fechamento.md` curto, deixando o aviso à pessoa a cargo do suporte (contrato em `bug/references/fases.md`). O artefato de fim é o mesmo `fechamento.md`. Caso de suporte ligado a um `incidente` passa a `entregue` com `Estável: sim` no `incidente.md`, sem esperar o `Encerrado: sim`.

Ajuda na tela, texto, e-mail do produto e configuração são comportamento do produto: `feature`. Refatoração (`refatoracao`) raramente vem de demanda externa; quando a demanda revela estrutura que impede a mudança, é a `feature` ou o `legado` que chamam a refatoração.

**Feature ou legado?** Siga o que o projeto já registrou (`inventario.md`, contexto do projeto, demandas anteriores). Sem registro, pergunte via `AskUserQuestion`.

## Modelo de `encaminhamento.md`

Vai no repositório: **sem dado pessoal**. O autor aparece só como `PES-NNN` e, no destino, só o `DEM-NNN`.

```markdown
# Encaminhamento: DEM-NNN — <título>

- **Data**: <AAAA-MM-DD> · **Destino**: skill `<nome>` · **Pasta**: `<pasta do trabalho>`
- **Origem**: demanda DEM-NNN (<tipo>), <N> pessoas com o mesmo problema
- **Decisão**: <fazer agora | planejada para <quando>> — aprovada em <data> (`<arquivo do fluxo dono>`)

## Problema

<a dor, em uma ou duas frases, separada da solução sugerida>

- **Quem sofre**: <papel e quantos> · **Frequência**: <...> · **Contorno hoje**: <...>
- **Solução sugerida pelo autor**: <a literal, como ponto de partida, não como especificação>

## Critérios de aceite

1. Dado <situação do autor>, quando <ação>, então <resultado que resolve o problema>.
2. <...>

- **Como saber se resolveu depois de entregue**: <evento ou métrica de uso, ou "perguntar ao autor">

## Fora de escopo

- <partes da sugestão que não entram, e por quê>

## Evidência e restrições

- **Evidência**: <demandas, casos de suporte, números com fonte>
- **Riscos já levantados**: <técnicos, legais, segurança, manutenção — do arquivo do fluxo dono>
- **Menor versão que resolve**: <fatia combinada, se houver>
```

Critérios de aceite são o **ponto de partida** do destino: a `feature` e o `legado` os reescrevem em EARS no Specify; o `bug`, nos critérios de correção do relato. Mudança de escopo durante o trabalho é decisão no destino, registrada lá; na **solicitação**, os critérios levam o ID `CA-NN` confirmado pelo solicitante, e mudança de escopo vira demanda nova (skill `solicitacao`).

## Depois de acionar

- **Ligação** em `demanda.md` com a pasta e a skill; situação `encaminhada`.
- O destino devolveu sem fazer (o `bug` concluiu "não é bug", o `redesign` virou feature, a `integracao-terceiros` concluiu "não integrar"): a demanda volta a `em análise` no fluxo dono, com o motivo no **Histórico**; o destino novo, se houver, é um novo encaminhamento.
- Terminou (artefato de fim existe): situação `entregue`, e o fluxo dono faz o fechamento com o autor.
