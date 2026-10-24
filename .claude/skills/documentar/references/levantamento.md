# Inventário e levantamento (fase 2)

Responde: **o que existe?** A skill `inventario` já mapeia peças de interface, serviços e regras, API, dados, utilitários, bibliotecas, integrações e testes, e grava `.specs/projeto/testes.json`. Rode-a primeiro (cria ou atualiza por diff). Este levantamento **só acrescenta** o que a documentação precisa e o inventário não cobre.

## Pedido ao `leitor-codigo`

Despache em paralelo, um por pergunta (somente leitura, `arquivo:linha` em tudo):

1. **Estrutura e linguagens:** pastas de primeiro e segundo nível e o papel de cada uma; linguagens e versões declaradas (`.nvmrc`, `engines`, `python_requires`, `go.mod`, `Dockerfile`, `.tool-versions`); pontos de entrada (main, servidor, CLI, workers, tarefas agendadas).
2. **Scripts, CI e ambientes:** scripts do manifesto, `Makefile`, `docker-compose`, pipelines (`.github/workflows`, `.gitlab-ci.yml` e afins) com o que cada job roda; ambientes que aparecem (dev, staging, produção) e como se distinguem; variáveis de ambiente lidas pelo código (só os **nomes**, onde são lidas e se há `.env.example`).
3. **Documentos existentes:** README, `docs/`, `CONTRIBUTING`, `CHANGELOG`, ADRs, `CLAUDE.md`, `AGENTS.md`, `.cursorrules`, comentários de cabeçalho longos, wiki citada. Para cada um: o que promete e **uma amostra de 3 a 5 afirmações conferidas** (comando existe no manifesto? arquivo citado existe? versão bate?).
4. **Trabalhos anteriores dos fluxos:** `.specs/features/*/reconhecimento.md` e `arqueologia.md`, `.specs/projeto/dividas.md`, `.specs/seguranca/*/relatorio.md`, `.specs/documentacao/*/`: o que já foi descoberto e pode ser reaproveitado (com data e commit, para saber se envelheceu).

Peça também à sessão: pergunte ao usuário via `AskUserQuestion` (com "Ainda não sei") se há documentação **fora do repositório** (wiki, drive, tickets) e quem conhece o projeto. Fora do repositório é `Premissa` até ser conferido.

## Estado de cada documento existente

| Estado | Critério |
|---|---|
| atual | amostra conferida sem erro |
| desatualizado | algum comando, caminho ou versão não existe mais |
| contraditório | diz o contrário do código ou de outro documento |
| não verificado | não deu para conferir na leitura (fica para a fase 3 ou 5) |

## Modelo de `levantamento.md`

```markdown
# Levantamento: <slug>

- **Data**: <AAAA-MM-DD> · **Commit**: <hash curto> · **Inventário**: `.specs/projeto/inventario.md` (commit <hash>)

## Estrutura
| Pasta | Papel | Fonte |
|---|---|---|

## Linguagens e versões declaradas
- <linguagem> <versão> — `arquivo:linha`

## Pontos de entrada
- <servidor, CLI, worker, tarefa agendada> — `arquivo:linha`

## Scripts, CI e ambientes
| Item | O que faz | Fonte |
|---|---|---|

## Configuração
| Variável | Lida em | Exemplo em `.env.example`? | Obrigatória? |
|---|---|---|---|

## Documentos existentes
| Documento | Promete | Estado | Evidência |
|---|---|---|---|

## Já descoberto por outros fluxos
- <achado> — `<artefato>` (<data>, commit <hash>)

## Fora do repositório
- <wiki, pessoa> — Premissa
```
