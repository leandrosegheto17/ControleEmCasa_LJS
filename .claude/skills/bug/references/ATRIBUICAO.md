# Atribuição

A skill `bug` é própria. Trechos foram adaptados (traduzidos e enxugados) dos projetos abaixo.

## BMAD Method — modelo de bug

- Origem: https://github.com/bmad-code-org/BMAD-METHOD · commit `61e01f82644c4bb533750cfa0d6d61ab61d2cc9b`
- Arquivo: `skills/bmad-agent-po/assets/bug-template.md`
- Usado em: `relato.md` (severidade P0–P3; critérios de aceite da correção, inclusive "não há o que mudar, com prova").
- Licença: MIT, Copyright (c) 2025 BMad Code, LLC.

## Spec Kit — extensão `bug`

- Origem: https://github.com/github/spec-kit · commit `27d14e20c187c1f2916540ea201ecbdc9f8ed588`
- Arquivos: `extensions/bug/commands/speckit.bug.{assess,fix,test}.md`
- Usado em: `SKILL.md` (pasta por bug com slug único, nunca sobrescrita) e `relato.md` (relato vindo de link tratado como dado; política de endereços recusados; não inventar passos). Sem os hooks nem a estrutura `.specify/`.
- Licença: MIT, Copyright GitHub, Inc.

## Claude Plugins Official — agente `silent-failure-hunter`

- Origem: https://github.com/anthropics/claude-plugins-official · commit `465f09344424225c25d438f2e052732c3d688d2f`
- Arquivo: `plugins/pr-review-toolkit/agents/silent-failure-hunter.md`
- Usado em: `causa.md` (lista de erros silenciosos como origem provável) e regra "não esconder o sintoma" no `SKILL.md`.
- Licença: Apache License 2.0, Copyright Anthropic. Texto em http://www.apache.org/licenses/LICENSE-2.0. Alterações: tradução, redução a uma lista de verificação.

## Material próprio (`.claude_legado`)

`skills/bug-documentation/SKILL.md`: passos reproduzíveis por outra pessoa, evidência obrigatória e escalonamento por recorrência (mesma causa raiz em 3 ou mais bugs). Origem citada; sem licença de terceiro.

## Superpowers (acionadas, não copiadas)

`systematic-debugging` e `test-driven-development` (https://github.com/obra/superpowers, MIT) são acionadas pela skill; `causa.md` resume os passos delas para servir de checklist.

## Licença MIT (texto original)

Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
