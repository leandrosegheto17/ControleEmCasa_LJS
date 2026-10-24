# Implementação (fase 8, por etapa)

Responde: **a tela reproduz o mockup sem mudar o que ela faz?**

## Preparar

- Branch `redesign/<slug>-etapa-<N>` a partir da principal atualizada (ou worktree, com `using-git-worktrees`). A etapa 1 já tem a caracterização da fase 7.
- `tlc-spec-driven`, fase **Execute**, com as tarefas da etapa em `tasks.md`. Lotes com o agente `implementador` (reproduzir o mockup com os componentes do guia é trabalho mecânico); `implementador-dominio` só para estado de tela difícil (formulário com muitas dependências, tempo real).
- Passe ao implementador: a tela do mockup e seus estados (`mockup/telas/<tela>--*.html`), `guia.html`, `tokens.css`, `sistema.md` (mapa de componentes), os requisitos de `acessibilidade.md`, a tela antiga (arquivo e captura) e as regras abaixo.

## Regras da construção

- **Etapa 1**: `tokens.css` copiado **sem alterar** (ou o tema mapeado para `var(--...)`, como decidido em `migracao.md`); a mesma fonte do mockup (origem e pesos); componentes do guia **antes** das telas, com os estados de interação e o foco; mecanismo da flag; testes de acessibilidade automáticos, se aprovados.
- **Telas**: a marcação e as classes do mockup são o modelo; dados vêm do mesmo lugar que a tela antiga usa (mesmas chamadas, mesmos parâmetros). **Nenhuma regra nova**, nenhuma validação a mais ou a menos, mesmos textos de regra.
- A tela antiga não é editada; a única mudança no código antigo é a **costura** onde a flag escolhe (rota, componente raiz ou classe).
- Todo valor visual por `var(--...)`. Precisou de um valor que o guia não tem: pare e leve ao mockup (fase 6, só esse ponto), não invente no código.
- Estado real que o mockup não previu (texto muito longo, erro do servidor diferente, permissão negada): o mesmo, volta ao mockup.
- Commits pequenos (`feat:` para a tela nova atrás da flag, `test:` para testes), um por tarefa.

## A cada lote

1. **Suíte inteira**, com a flag nas duas posições: nenhuma falha nova além das preexistentes de `protecao.md`.
2. **Tokens**: `python .claude/scripts/checar-tokens.py <caminhos do código novo>` (os de **Código novo em** de `migracao.md`). Valor solto é corrigido antes do commit.
3. **Comparação visual** das telas da etapa, com o app rodando localmente:
   `node .claude/scripts/comparar-visual.mjs --base-url <url> --config .specs/redesign/<slug>/mockup/telas.json --tela <ids> [--pacote <pasta>]`
   O resultado vai para `mockup/comparacao/<data>/`. `DIVERGE`: abra o `--diff.png`; corrija o código, ou leve ao usuário (via `AskUserQuestion`: **corrigir o código** (Recomendado), **aceitar a diferença** com o motivo registrado em `migracao.md`, **ajustar o mockup** e voltar à fase 6 nessa tela).
   Sem Playwright: prints lado a lado na galeria (etapa 3 da `mockup-visual`), aceite do usuário.
4. Teste falhou de forma inesperada: `systematic-debugging`.

## Fechar a etapa

Todas as tarefas da etapa concluídas, suíte verde nas duas posições, tokens limpos e comparação dentro do limite (ou aceita): situação da etapa `construída` em `redesign.md`, link do `resumo.md` da comparação na galeria (republique), e a aprovação da fase.
