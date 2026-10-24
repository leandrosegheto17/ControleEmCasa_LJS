# Atribuição

A skill `redesign` é própria, escrita a partir do desenho em `.rascunho/FLUXO-REDESIGN.md`, construída por cima das skills `inventario`, `reconhecimento`, `arqueologia`, `mockup-visual` (modo redesign, acrescentado para este fluxo), `rede-de-protecao`, `tlc-spec-driven`, `revisao-codigo` e `liberacao`, com a forma de etapas da `refatoracao`. Coexistência atrás de flag, testes nas duas posições, priorização de problemas, roteiro de teste com usuários e medição antes e depois são conhecimento comum de engenharia e de experiência do usuário, escritos sem cópia de fonte. Os trechos abaixo foram adaptados (traduzidos, enxutos e reorganizados).

## wshobson/agents — `wcag-audit-patterns`

- Origem: https://github.com/wshobson/agents · commit `0874a27b17a22e2b7c2e2bcd725768e0803cad06`
- Arquivos: `plugins/accessibility-compliance/skills/wcag-audit-patterns/SKILL.md` e `references/details.md`
- Usado em: `acessibilidade.md` (checklist pelos quatro princípios com os critérios WCAG 2.2, severidade em três níveis, verificação automática com axe e manual obrigatória). Mudanças: sem os exemplos de código, critérios agrupados por tela, severidade ligada ao que bloqueia no fluxo (guia, etapa, liberação), acrescentados os critérios novos da 2.2 que o original não lista (2.5.7, 3.2.6, 3.3.7, 3.3.8).
- Licença: MIT (repositório `wshobson/agents`).

## tech-leads-club/agent-skills — `web-accessibility` (skill `accessibility`)

- Origem: https://github.com/tech-leads-club/agent-skills · commit `bc4f025632b0443ed3450aaec6fe96aec5b9a0c5`
- Arquivos: `packages/skills-catalog/skills/(quality)/web-accessibility/SKILL.md` e `references/WCAG.md`
- Usado em: `acessibilidade.md` (tabela de contraste por tamanho de texto, lista de testes manuais: teclado, leitor de tela, zoom, alto contraste, movimento reduzido; preferir elemento nativo a ARIA; problemas comuns por impacto). Mudanças: WCAG 2.1 atualizada para 2.2, em português, sem exemplos de código.
- Licença: MIT (declarada no frontmatter: `license: MIT`).

## Material do usuário (`.claude_legado`, só citado)

- `skills/accessibility-review/SKILL.md`: acessibilidade como critério desde a especificação, nível declarado explicitamente mesmo quando é o padrão, violação crítica bloqueia a tela (em `acessibilidade.md` e nas regras da skill).
- `skills/design-system-consistency-check/SKILL.md`: todo componente classificado, reuso proposto antes de aceitar duplicação, componente novo com nome e propósito (em `sistema.md`, mapa de componentes).
- `scripts/comparar-visual.mjs`: base de `.claude/scripts/comparar-visual.mjs` (mapa de telas, respostas interceptadas, diferença de pixels no navegador). Mudanças: caminhos de `.specs/`, modo `--so-app` (capturas do estado atual) e `--listar` (confere o mapa sem navegador), bloco `flag` para ligar a interface nova, limite por tela, escolha do navegador, funções exportadas e testadas, sem os casos específicos do projeto original.

## Inspiração (sem trecho copiado)

- Anthropic `webapp-testing` (https://github.com/anthropics/skills, commit `dbd4588f9e1033efb41dad4bef2f7947c8993d44`, Apache 2.0): esperar a rede parar antes de capturar, reconhecer a página antes de agir, gerenciar o ciclo de vida do servidor (no script, a opção `--iniciar`). O script dela não é usado: o nosso roda no Playwright do próprio projeto.
- `frontend-design` (citado pela `mockup-visual`): qualidade visual sem estética genérica, nas direções.

## Peças acionadas, não copiadas

Skills `inventario`, `reconhecimento`, `arqueologia`, `mockup-visual`, `rede-de-protecao`, `tlc-spec-driven`, `revisao-codigo`, `liberacao`, `escolha-tecnologia` (biblioteca de flag), `feature` e `legado` (saída de emergência), `performance` (guardas de desempenho e saída), `integracao-terceiros` (ferramenta de análise externa), `documentar` (modelo de contexto); agentes `leitor-codigo`, `pesquisador`, `implementador`, `implementador-dominio`, `verificador`, `auditor-seguranca`; scripts `checar-tokens.py`, `comparar-visual.mjs` e `trava-testes.py`; superpowers `verification-before-completion`, `systematic-debugging`, `using-git-worktrees` e `finishing-a-development-branch`.
