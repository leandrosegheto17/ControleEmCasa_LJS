# Atribuição

A skill `refatoracao` é própria, escrita a partir do desenho em `.rascunho/FLUXO-REFATORACAO.md`. Trechos foram adaptados (traduzidos e enxugados) das fontes abaixo.

## wshobson/agents — `tech-debt`

- Origem: https://github.com/wshobson/agents · commit `0874a27b17a22e2b7c2e2bcd725768e0803cad06`
- Arquivo: `plugins/code-refactoring/commands/tech-debt.md`
- Usado em: `motivo.md` (tipos de dívida com sinais e números, custo em horas por mês de mudanças e de bugs, risco de crítico a baixo, ganhos rápidos por valor e esforço) e `registro.md` (prevenção por limites de lint e checagens no CI). Sem valores em dinheiro, sem painel de tendências, sem plano trimestral nem alocação de equipe; a pontuação (juros, toque, risco ÷ esforço) é nossa.
- Licença: MIT, Copyright (c) 2024 Seth Hobson.

## Tech Leads Club agent-skills — `coupling-analysis`

- Origem: https://github.com/tech-leads-club/agent-skills · commit `bc4f025632b0443ed3450aaec6fe96aec5b9a0c5`
- Arquivo: `packages/skills-catalog/skills/(architecture)/coupling-analysis/SKILL.md`
- Usado em: `mapeamento.md` (três dimensões — força, distância, volatilidade —; níveis intrusivo, funcional, modelo e contrato; volatilidade pelo git e pelo tipo de subdomínio; tabela de diagnóstico; sinais rápidos). Os conceitos vêm do livro *Balancing Coupling in Software Design*, de Vlad Khononov (Addison-Wesley). Sem a fórmula de balanço nem o relatório completo.
- Licença: MIT, Copyright (c) 2026 Tech Leads Club.

## Tech Leads Club agent-skills — `legacy-migration-planner`

- Origem: https://github.com/tech-leads-club/agent-skills · commit `bc4f025632b0443ed3450aaec6fe96aec5b9a0c5`
- Arquivos: `packages/skills-catalog/skills/(architecture)/legacy-migration-planner/SKILL.md`, `references/strangler-fig-patterns.md`, `references/testing-safety-nets.md`, `references/plan-phase.md`, `references/assessment-framework.md`
- Usado em: `plano.md` (padrões de estrangulamento — ramificar por abstração, extração com adaptador, roteador, escrita dupla, componente a componente, interceptação de eventos —, sequência preparar, sombra, canário, ampliar, 100% e limpeza com volta de uma etapa, execução paralela; ordem pelo número de dependentes; costura e volta em cada passo) e `SKILL.md`/`fases.md` (golden master na caracterização, saída de emergência sem testes). Sem a estrutura de pastas `migration-plan/` nem a pesquisa obrigatória na web.
- Licença: CC-BY-4.0 (declarada no frontmatter da skill), autor Felipe Rodrigues (github.com/felipfr). Texto em https://creativecommons.org/licenses/by/4.0/. Alterações: tradução, redução a tabelas e regras, integração às fases 5 a 8.

## BMAD Method — `verification-gap`

- Origem: https://github.com/bmad-code-org/BMAD-METHOD · commit `61e01f82644c4bb533750cfa0d6d61ab61d2cc9b`
- Arquivo: `skills/bmad-build/review-prompts/verification-gap.md`
- Usado em: `verificacao.md` e `mapeamento.md` (o que conta como comportamento observável: retorno, erro lançado, efeito colateral visível, estado, ordem de iteração, mensagem emitida; contratos de quem consome — rotas, esquemas, eventos, leitores do banco —; cuidado com chamada dinâmica). Invertido para o caso da refatoração: em vez de achar testes que faltam para o que mudou, confirmar que nada observável mudou.
- Licença: MIT, Copyright (c) 2025 BMad Code, LLC.

## Só ideia, sem texto

- `code-simplifier` (`anthropics/claude-plugins-official`, `plugins/pr-review-toolkit/agents/code-simplifier.md`, Apache 2.0): preservar exatamente o que o código faz, mudando só como; não exagerar na simplificação.
- superpowers `writing-plans` (https://github.com/obra/superpowers, MIT): passos pequenos com o comando de verificação em cada um. Não é acionado (o plano é do `tlc-spec-driven`).

## Peças acionadas, não copiadas

Skills `inventario`, `reconhecimento`, `arqueologia`, `rede-de-protecao`, `tlc-spec-driven`, `revisao-codigo`, `liberacao`, `implantacao`, `bug`; agentes `leitor-codigo`, `implementador`, `implementador-dominio`, `verificador`, `auditor-seguranca`; superpowers `using-git-worktrees`, `systematic-debugging`, `verification-before-completion` e `finishing-a-development-branch`.

## Licença MIT (texto original)

Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
