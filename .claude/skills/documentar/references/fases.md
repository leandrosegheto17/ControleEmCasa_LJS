# As 9 fases da documentação

Princípio: **documentar o que o código faz de fato, verificado no código e em execução.** Desenho original: `.rascunho/FLUXO-DOCUMENTAR.md`. Artefatos de trabalho em `.specs/documentacao/<slug>/`; a documentação em si fica onde a fase 1 decidiu (README, `docs/`, `CLAUDE.md`/`AGENTS.md`).

| # | Fase | Pergunta | Saída | Critério de passagem | Modelo |
|---|---|---|---|---|---|
| 1 | Objetivo e público | Para quem e para quê? | `documentacao.md` (público, usos, profundidade, fases, documentos e destino) | Leitores e usos definidos; cada documento com público e lugar no repositório; fases fora do escopo `dispensada` com motivo | Opus |
| 2 | Inventário | O que existe? | `.specs/projeto/inventario.md` (skill `inventario`), `levantamento.md` | Estrutura, linguagens, dependências, scripts, CI, ambientes e configuração mapeados com caminho; cada documento existente com estado | Sonnet (leitura em Haiku) |
| 3 | Execução | Roda? Como? | `execucao.md`; seção "Como rodar" no destino; branch `docs/<slug>` | Instalado do zero num worktree limpo; suíte e aplicação rodaram (ou o bloqueio está registrado); cada tropeço virou instrução; comandos da doc executados de verdade | Sonnet |
| 4 | Arquitetura | Como as partes se encaixam? | `arquitetura.md`; documento de arquitetura com diagrama Mermaid | Contexto e contêiner (componente só onde ajuda); cada caixa e seta com evidência; conferido por um segundo leitor contra o código | Opus (leitura em Haiku) |
| 5 | Comportamento | O que o sistema faz para o usuário? | `comportamento.md`; documento de fluxos | Fluxos principais de ponta a ponta confirmados rodando; regras, estados e erros com fonte; o lido e não executado marcado | Sonnet |
| 6 | Convenções | Como o código é escrito aqui? | `convencoes.md`; documento de convenções | Padrões com exemplo `arquivo:linha`; inconsistências com qual seguir; o que o linter garante só apontado | Sonnet (leitura em Haiku) |
| 7 | Riscos e dívidas | Onde está o perigo? | `riscos.md`, `.specs/projeto/dividas.md`, `evidencias/` (fora do git) | Fragilidade, falta de teste, segredos, dependências, código morto e armadilhas levantados com evidência; segredo sem valor copiado; dívidas pontuadas | Sonnet |
| 8 | Contexto para IA | O que um agente precisa saber ao abrir o projeto? | `CLAUDE.md` ou `AGENTS.md` do projeto; `contexto.md` (avaliação e destino de cada instrução) | Seções do modelo, curto; cada comando executado, cada caminho conferido; nenhuma instrução existente sumiu sem motivo aprovado | Sonnet |
| 9 | Validação e manutenção | Está correto e vai continuar? | `validacao.md` (uma seção por rodada), entrada de manutenção e **Resultado** em `documentacao.md` | Agente sem contexto instalou, rodou e testou só pela documentação; falhas corrigidas e revalidadas; amostra de afirmações conferida; gatilhos de revisão definidos; suíte verde na checagem final; integrada | Sonnet |

## Aprovações

Uma por fase (seguir / ajustar / parar). Cada fase que escreve documentação mostra o texto (ou o diff, se o documento já existia) antes de gravar no destino. A fase 9 pode ter várias rodadas de validação; a aprovação vem quando uma rodada passa.

## Público define as fases

A fase 1 marca como `dispensada` o que o público não precisa (tabela em `objetivo.md`). Inventário (2) e execução (3) nunca são dispensadas, salvo em revisão sem mudança no que cobrem: sem elas não há fonte para o resto. Execução impossível não dispensa a fase: ela fica `feita` com o bloqueio registrado.

## Revisão

Modo `revisão` (há um trabalho anterior concluído): cada fase parte do artefato anterior e do `git diff --stat <commit anterior>..HEAD`; refaz só o que mudou e o que a validação anterior apontou. A fase 9 roda inteira sempre.

## Laços comuns

- Execução falhou num passo que a documentação existente prometia → o tropeço vira instrução corrigida; o que não se resolve fica `[A ESCLARECER]` e entra nas saídas da skill.
- Diagrama conferido e uma seta sem evidência → sai do diagrama ou vira `não verificado`, nunca fica como certo.
- Validação falhou → corrigir o documento na branch, novo commit `docs:`, nova rodada da fase 9 num worktree novo.
- Comportamento estranho visto rodando → documentar como é; se for defeito, anotar em **Achados fora do escopo** e oferecer `bug`.
