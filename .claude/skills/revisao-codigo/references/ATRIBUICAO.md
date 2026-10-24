# Atribuição

A skill `revisao-codigo` é própria, escrita a partir do desenho em `.rascunho/FLUXO-REVISAO-CODIGO.md`. Trechos foram adaptados (traduzidos e enxugados) das fontes abaixo.

## BMAD Method — `bmad-code-review`

- Origem: https://github.com/bmad-code-org/BMAD-METHOD · commit `61e01f82644c4bb533750cfa0d6d61ab61d2cc9b`
- Arquivos: `skills/bmad-code-review/references/claims-check.md`, `references/deletion-check.md`, `review-prompts/edge-case-hunter.md` e `review-prompts/verification-gap.md`
- Usado em: `analise.md` (pedido ao `verificador` em modo revisão: percorrer cada caminho alcançável pelas linhas mudadas e listar só os sem tratamento; caminhos implícitos de conjuntos fixos; conferir cada chamada nova contra a declaração; código removido sem restabelecer o contrato; a descrição do autor como testemunho a falsificar, lida **só depois** do percurso, e alegação repetida em comentário continua alegação; testes que não contam) e `admissao.md` (descrição do PR e commits guardados em `alegacoes.md` sem análise). Sem o formato JSON de saída, sem as etapas de triagem e roteamento do BMAD.
- Licença: MIT, Copyright (c) 2025 BMad Code, LLC.

## Claude Plugins Official — `pr-review-toolkit` e `security-guidance`

- Origem: https://github.com/anthropics/claude-plugins-official · commit `465f09344424225c25d438f2e052732c3d688d2f`
- Arquivos: `plugins/pr-review-toolkit/agents/silent-failure-hunter.md`, `pr-test-analyzer.md`, `comment-analyzer.md`, `type-design-analyzer.md`, `code-reviewer.md`, `code-simplifier.md` e `commands/review-pr.md`; `plugins/security-guidance/hooks/patterns.py`
- Usado em: `analise.md` como listas de verificação (erros engolidos; testes de comportamento e não de implementação, casos negativos; comentário confere com o código e não apodrece; tipos com invariantes na construção; aderência ao contexto do projeto e filtro de confiança; proporção e simplicidade; achados agregados em bloqueante, sugestão e pontos positivos) e lista de chamadas perigosas típicas de código gerado (apontando para a lista já adaptada em `auditoria-seguranca/references/achados.md`). Sem os agentes em si nem o hook.
- Licença: Apache License 2.0, Copyright Anthropic. Texto em http://www.apache.org/licenses/LICENSE-2.0. Alterações: tradução, redução a listas de verificação, integração às fases 4 a 8.

## wshobson/agents — `code-review-excellence`

- Origem: https://github.com/wshobson/agents · commit `0874a27b17a22e2b7c2e2bcd725768e0803cad06`
- Arquivo: `plugins/developer-essentials/skills/code-review-excellence/SKILL.md`
- Usado em: `admissao.md` (contexto antes do código, limite de ~400 linhas e pedido de divisão, CI antes da atenção humana) e `retorno.md` (retorno específico, com o porquê, sobre o código e não a pessoa, sugestão marcada como não bloqueante, reconhecer o que está bom, sem "já que está aí"; modelo de resumo, pontos fortes, mudanças exigidas, sugestões, perguntas e veredito).
- Licença: MIT, Copyright (c) 2024 Seth Hobson.

## Material próprio (`.claude_legado`)

`skills/coding-guidelines/SKILL.md` (sem licença declarada): **só a ideia**, sem texto — cada linha mudada precisa se explicar pelo pedido; nada de abstração ou configuração especulativa. Origem citada.

## Peças acionadas, não copiadas

Skill `code-review` (do Claude Code, não editada), agentes `verificador`, `auditor-seguranca`, `leitor-codigo`, `pesquisador`, `implementador` e `implementador-dominio`, skills `bug`, `incidente`, `run`, `verification-before-completion` e `finishing-a-development-branch` (superpowers, https://github.com/obra/superpowers, MIT).

## Licença MIT (texto original)

Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
