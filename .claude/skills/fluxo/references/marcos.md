# Marcos de troca de sessão

A sessão principal só orquestra, mas acumula a conversa, os resumos dos agentes e os relatórios de cada fase. Em trabalho longo, ela fica cara (cada mensagem reenvia o histórico) e chega perto do limite. Os fluxos descobrem a fase pelos arquivos em `.specs/`, então trocar de sessão não perde nada, desde que o que foi combinado esteja escrito.

## Quando oferecer

Ao fechar uma fase aprovada, nestes marcos:

| Marco | Exemplo |
|---|---|
| A próxima fase pede **outro modelo** | planejamento em Opus → construção em Sonnet |
| **Antes da construção** (Execute do `tlc-spec-driven`, ou a fase que escreve o código) | é a fase que mais enche a sessão principal |
| **A cada 2 ou 3 lotes** dentro da construção | o tlc grava o `## Handoff` do `STATE.md` e os commits ficam no git |
| **Antes da verificação** e **antes da integração ou liberação** | o verificador é independente; a integração só precisa dos arquivos |
| A conversa já passou por **3 fases ou mais** | em qualquer fluxo |

Fora dos marcos, não ofereça: trocar de sessão a cada pergunta custa a releitura dos artefatos.

## Como oferecer

Na pergunta de fim de fase (via `AskUserQuestion`), as opções passam a ser:

- **Seguir numa sessão nova (Recomendado)**: grava a retomada e orienta a troca;
- **Seguir nesta sessão**;
- **Ajustar**;
- **Parar**.

## Ao escolher "sessão nova"

1. Confira que toda decisão da fase está num artefato (aprovação com data, escolhas, dispensas). O que só foi dito na conversa e não cabe em nenhum artefato vai para a retomada.
2. Grave a seção `## Retomada` de `.specs/STATE.md` (crie o arquivo se faltar; edição parcial: troque só essa seção):

   ```markdown
   ## Retomada

   - **Fluxo**: <número e nome> — skill `<nome>`
   - **Item**: `<pasta do trabalho>` (ex.: `.specs/features/importar-extrato/`)
   - **Fase aprovada**: <N, nome> em <AAAA-MM-DD>
   - **Próxima fase**: <N, nome> — modelo indicado: <opus | sonnet>
   - **Construção** (se no meio): lote <x> de <y> concluído; o tlc retoma pelo `## Handoff`
   - **Combinado na conversa e não registrado em artefato**: <itens | nenhum>
   - **Gravada em**: <AAAA-MM-DD HH:MM>
   ```

3. Responda só: "Retomada gravada. Digite `/clear`, depois `/model <modelo>` (se a próxima fase pedir outro) e `/fluxo`."

## Ao retomar

O `/fluxo` sem argumento lê `## Retomada` antes do menu (seção "Retomada" do `SKILL.md` dele). Se o item ainda estiver em andamento, a primeira pergunta é retomá-lo. Antes de qualquer trabalho, vale a trava de modelo do `CLAUDE.md`: se a sessão nova não está no modelo indicado (o usuário esqueceu o `/model`), pergunte. A skill do fluxo descobre a fase pelos arquivos, como sempre; a retomada só confirma o ponto e traz o que estava combinado. Se a retomada e os arquivos discordarem, valem os arquivos: avise a diferença.
