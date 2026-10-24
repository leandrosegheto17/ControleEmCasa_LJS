# Contexto para IA (fase 8)

Responde: **o que um agente precisa saber ao abrir o projeto?** Um arquivo curto, verificado, carregado em toda sessão. Cada linha é paga em toda sessão: entra o que evita o erro, não o que é interessante.

Este é também o **modelo do contexto do projeto** que as skills `feature`, `legado`, `bug`, `refatoracao` e `performance` atualizam na integração e no registro: mesmo arquivo, mesmas seções.

## 1. Qual arquivo

Procure: `CLAUDE.md` (raiz e subpastas), `.claude.local.md`, `AGENTS.md`, `.cursorrules`, `.github/copilot-instructions.md`. **Fora da busca:** `.claude/CLAUDE.md` é o conjunto de fluxos instalado (instalado e atualizado pelo `instalar.py`), não o contexto do projeto: nunca grave nele.

- Existe um: é ele. Existem vários com o mesmo assunto: um é o principal e os outros apontam para ele (no `CLAUDE.md`, a linha `@AGENTS.md` importa o outro); nenhuma instrução em dois arquivos carregados.
- Não existe: `CLAUDE.md` na raiz. Se o time usa outras ferramentas de IA, recomende `AGENTS.md` como principal e um `CLAUDE.md` com `@AGENTS.md`; pergunte via `AskUserQuestion`.
- Arquivo em subpasta só quando as regras valem só ali, são muitas e o carregamento foi **conferido** (abra uma sessão nova nessa pasta e veja se a regra aparece). Senão, linha com o caminho na raiz ("em `src/importador/`: ...").
- Preferência pessoal, não do time: `.claude.local.md` (no `.gitignore`) ou a configuração global do usuário.

## 2. Avaliar o que existe (antes de mudar)

Mostre ao usuário a nota de cada arquivo, cruzando com o código e com `execucao.md`:

| Critério | Pontos | Pergunta |
|---|---|---|
| Comandos | 20 | Instalar, rodar, testar, publicar estão lá, e funcionam? |
| Onde fica cada coisa | 20 | Pontos de entrada e regras entre partes estão claros? |
| Armadilhas | 15 | O não óbvio, com evidência, está registrado? |
| Concisão | 15 | Cada linha muda o comportamento de um agente? |
| Atualidade | 15 | Comandos, caminhos e versões batem com o código de hoje? |
| Executável | 15 | Comandos copiáveis, passos concretos, caminhos reais? |

Nota: A 90+, B 70-89, C 50-69, D 30-49, F abaixo de 30. Liste os problemas (comando que falha, caminho que não existe, versão velha, conselho genérico, instrução duplicada ou contraditória) e dê a cada instrução existente um **destino** (tabela de `escrita.md`: manter, reescrever, mover, automatizar, apagar com motivo).

## 3. O que entra

- **Regra que o código não expressa**: o que não mexer (pasta congelada, arquivo gerado e o comando que o gera), política de branch e commit, segredos, conformidade. Vinda de pessoa ou de configuração que a impõe, nunca deduzida.
- **O que o manifesto não diz sobre rodar**: o comando certo quando o óbvio está errado, serviço que precisa estar no ar, suíte lenta (rode um arquivo enquanto itera), checagem que o CI faz e o teste local não. Os tropeços de `execucao.md` são a fonte principal.
- **Convenções que fogem do padrão do ecossistema** (de `convencoes.md`): só as divergências.
- **Armadilhas com evidência observada**: tropeço, erro que um agente cometeu nesta sessão, a mesma correção repetida no histórico, relato do usuário. Achado curioso da leitura não é armadilha: vira pergunta.
- **Regras entre partes**: o que precisa continuar verdadeiro em outro lugar quando se mexe aqui ("toda escrita passa por `X`; escrever direto pula a transação").
- **Versões exigidas**, lidas dos arquivos que as declaram, nunca do ambiente desta sessão.

Prefira proibição com a alternativa na mesma linha ("Nunca edite `src/gerado/`; rode `npm run codegen`").

## 4. O que não entra

Visão geral longa, árvore de pastas, lista de stack; lista de comandos que o manifesto já mostra certo; regra de estilo que um formatador pode garantir (proponha a checagem); conselho genérico; código colado, histórico, o que "deveria" ser. **Se uma checagem (hook, lint, CI) garante melhor, proponha a checagem**; a linha fica até ela existir.

## 5. Modelo

Seções nesta ordem; seção sem conteúdo que passe pelas regras acima não é escrita. Linhas curtas no imperativo. Alvo: até ~80 linhas. Arquivo existente maior: primeiro mover (para `docs/`, subpasta, checagem); apagar só com motivo de `escrita.md`; se ainda passar, o usuário decide.

```markdown
# <Projeto>

<!-- Verificado em <AAAA-MM-DD> contra <commit>. Atualize na mesma mudança que tornar uma linha falsa. -->

<Orientação: 2 a 4 frases — o que é, stack, onde está a documentação (`docs/`) e os artefatos (`.specs/`).>

## Regras
- Nunca <...>; <alternativa>.

## Onde fica cada coisa
- <ponto de entrada ou assunto>: `<caminho>`

## Rodar e verificar
- <comando certo e ressalva que o manifesto não diz>

## Convenções que fogem do padrão
- <convenção> — `<exemplo>`

## Armadilhas conhecidas
- <armadilha e o que fazer>

## Documentação
- Ao mudar comportamento descrito em `docs/` ou neste arquivo, atualize na mesma mudança.
```

Quem atualiza depois (skills `feature`, `legado` e outras): comando novo vai em **Rodar e verificar**; padrão novo em **Convenções que fogem do padrão**; costura ou ponto de integração em **Onde fica cada coisa**; armadilha em **Armadilhas conhecidas**. Atualize a linha de verificação com a data e o commit.

## 6. Verificar e gravar

- Todo comando do arquivo foi executado (fase 3 ou agora) e está igual ao que rodou; todo caminho existe.
- Nenhuma instrução existente sumiu sem destino; apagar sem motivo 1 a 3 de `escrita.md` exige aprovação daquela linha.
- Mostre o arquivo inteiro (ou o diff) **e** a lista de destinos; grave na branch só depois da aprovação.
- Quando um agente errar algo no projeto mais tarde, a correção vira linha em **Armadilhas conhecidas** (ou o comando exato em **Rodar e verificar**): uma ocorrência se anota, a repetida entra.

## Modelo de `contexto.md`

```markdown
# Contexto para IA: <slug>

- **Data**: <AAAA-MM-DD> · **Commit**: <hash curto> · **Arquivo**: `<CLAUDE.md | AGENTS.md>` (<criado | atualizado>)
- **Nota antes**: <X/100 (letra) | não existia> · **Nota depois**: <X/100> · **Linhas**: <antes> → <depois>

## Problemas encontrados
- <problema> — <evidência>

## Destino de cada instrução existente
| Instrução | Destino | Motivo e evidência | Aprovado |
|---|---|---|---|

## Checagens propostas no lugar de linhas
- <regra> → <hook, lint, CI> — <aceita | recusada (linha mantida)>
```
