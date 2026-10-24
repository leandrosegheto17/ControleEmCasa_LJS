# Execução (fase 3)

Responde: **roda? como?** É o mesmo método da seção 1 (Ambiente) da skill `arqueologia`, feito para o projeto inteiro e com um compromisso a mais: **seguir só o que está escrito** e anotar cada tropeço, porque cada tropeço vira instrução.

## Preparar

1. Na árvore do projeto, crie a branch `docs/<slug>` (é onde a documentação vai ser escrita) e anote em `documentacao.md`.
2. Crie um **worktree limpo** fora da árvore (`git worktree add <pasta temporária> HEAD`, com `using-git-worktrees`): sem `node_modules`, `.venv`, `.env`, build ou cache da máquina, que escondem passos faltantes.
3. Se houver `.specs/features/*/arqueologia.md` ou `execucao.md` de trabalho anterior, leia a seção de ambiente: parte do caminho já pode estar descoberta (confira, não copie).

## Seguir o escrito

No worktree, execute **na ordem** o que o README e os documentos de `levantamento.md` mandam: pré-requisitos, instalação, configuração, banco, testes, aplicação. Para cada passo, registre o comando exato, o resultado (código de saída e trecho curto da saída) e a data.

- Passo falhou ou faltou: descubra o que resolve (mensagem de erro, manifesto, CI, `Dockerfile`, que muitas vezes é o roteiro mais fiel) e anote como **tropeço**: o que estava escrito, o que aconteceu, o que resolveu, a fonte.
- O CI é um ambiente que roda: compare o que ele faz com o que a documentação diz.
- Rode a **suíte** (comando de `.specs/projeto/testes.json`) e anote o resultado; falhas que já existiam vão como estão, sem corrigir.
- Suba a **aplicação** e confirme que responde (uma requisição, a tela inicial, o comando `--help`), anotando o endereço local.

## Limites

- Instalar runtime, banco ou serviço **fora do worktree** (global, Docker, gerenciador de versões) é decisão do usuário: pergunte via `AskUserQuestion`.
- Segredo necessário para rodar: peça ao usuário que o coloque num `.env` local do worktree (nunca no chat nem em arquivo versionado). Na documentação, vai só o nome da variável e onde obter.
- Nunca use banco, fila ou serviço de produção para documentar. Serviço de terceiro: só em sandbox, com confirmação.
- Ao fim, remova o worktree (`git worktree remove`) e confirme que a árvore real não mudou (`git status --porcelain`).

## Modelo de `execucao.md`

```markdown
# Execução: <slug>

- **Data**: <AAAA-MM-DD> · **Commit**: <hash curto> · **Máquina**: <SO, versões de runtime usadas>
- **Roda?** sim | parcialmente (<o quê>) | não (<bloqueio>)
- **Suíte**: `<comando>` → <N passaram, M falharam (preexistentes)> · **Aplicação**: `<comando>` → <endereço, resposta observada>

## Passos
| # | Escrito em | Comando | Resultado | Tropeço? |
|---|---|---|---|---|

## Tropeços
- **<passo>** — escrito: <...> · aconteceu: <erro> · resolveu: <comando ou ajuste> · fonte: <`arquivo:linha`, CI, mensagem>

## Pré-requisitos reais
- <runtime e versão, serviço, ferramenta> — <declarado em `arquivo` | descoberto no tropeço N>

## Não resolvido
- [A ESCLARECER: ...]
```

## Escrever o "Como rodar"

No destino de `documentacao.md` (em geral o README), na branch: pré-requisitos reais, instalação, configuração (nomes de variáveis, de onde vêm), testes, aplicação, e as ressalvas dos tropeços. Só comandos que rodaram. O que não rodou vai marcado (`escrita.md`).
