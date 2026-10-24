# Atribuição

A skill `documentar` é própria, escrita a partir do desenho em `.rascunho/FLUXO-DOCUMENTAR.md`, com a estrutura das skills `performance` e `refatoracao`. Trechos foram adaptados (traduzidos e enxugados) das fontes abaixo.

## Anthropic claude-plugins-official — `claude-md-improver`

- Origem: https://github.com/anthropics/claude-plugins-official · commit `465f09344424225c25d438f2e052732c3d688d2f`
- Arquivos: `plugins/claude-md-management/skills/claude-md-improver/SKILL.md`, `references/quality-criteria.md`, `references/templates.md`, `references/update-guidelines.md`
- Usado em: `contexto-ia.md` (descoberta dos arquivos de contexto, incluindo `.claude.local.md` e subpastas; avaliação antes de mudar com os seis critérios e pesos — comandos 20, arquitetura 20, padrões não óbvios 15, concisão 15, atualidade 15, executável 15 — e as notas A a F; o que adicionar e o que não adicionar; diff mostrado antes de gravar; comandos conferidos de verdade). Mudanças: "arquitetura" virou "onde fica cada coisa"; as seções do modelo seguem o BMAD abaixo; sem as dicas de atalho da ferramenta.
- Licença: Apache License 2.0 (arquivo `LICENSE` do plugin). Este trecho é uma obra derivada traduzida e resumida; a licença completa está em https://www.apache.org/licenses/LICENSE-2.0.

## BMAD-METHOD — `bmad-project-context`

- Origem: https://github.com/bmad-code-org/BMAD-METHOD · commit `61e01f82644c4bb533750cfa0d6d61ab61d2cc9b`
- Arquivos: `skills/bmad-project-context/SKILL.md`, `references/best-practices.md`, `references/template.md`
- Usado em: `contexto-ia.md` (o teste "quanto custa quando o agente não sabe"; o que admitir e o que excluir; armadilha só com evidência observada; regra entre partes; versões lidas dos arquivos, não do ambiente; proibição com a alternativa na mesma linha; seções na ordem orientação, regras, onde fica cada coisa, rodar e verificar, convenções que fogem do padrão, armadilhas; linha de verificação com data e commit; um arquivo principal e os outros apontando; arquivo em subpasta só com carregamento conferido; preferir checagem automática a linha; registrar o erro de agente quando acontece) e `escrita.md` (destino de cada trecho existente — manter, reescrever, mover, automatizar, apagar — e os quatro motivos para apagar). Sem os marcadores de bloco gerenciado, o `customize.toml` e os modos `setup`/`adopt`/`refresh`/`audit` como comandos: o modo `revisão` desta skill cobre a atualização.
- Licença: MIT, Copyright (c) 2025 BMad Code, LLC.

## BMAD-METHOD — `bmad-deep-recon` (só ideia)

- Arquivo: `skills/bmad-deep-recon/assets/codebase.template.md` (mesmo commit acima, MIT)
- Usado como ideia em `levantamento.md` e `escrita.md`: cada afirmação citada no lugar, o que foi procurado e não encontrado, perguntas em aberto e decisões achadas no histórico com o porquê. Sem texto copiado.

## wshobson/agents — `c4-architecture`

- Origem: https://github.com/wshobson/agents · commit `0874a27b17a22e2b7c2e2bcd725768e0803cad06`
- Arquivos: `plugins/c4-architecture/commands/c4-architecture.md`, `agents/c4-context.md`, `agents/c4-container.md`
- Usado em: `arquitetura.md` (níveis contexto, contêiner, componente e código; a nota de que contexto e contêiner bastam para a maioria dos times; contexto com pessoas e sistemas externos, sem tecnologia; contêiner como unidade que precisa estar rodando, tirado dos arquivos de deploy, com a tecnologia de cada um e o protocolo entre eles). Sem a análise de baixo para cima de cada pasta, os quatro agentes, as especificações OpenAPI e a pasta `C4-Documentation/`; diagrama em `flowchart` em vez da sintaxe C4 do Mermaid.
- Licença: MIT, Copyright (c) 2024 Seth Hobson.

## Só ideia, sem texto

- `docs-writer` (`.tlc`, `packages/skills-catalog/skills/(development)/docs-writer/SKILL.md`, MIT): conferir links e documentos que apontam para o que mudou antes de gravar.

## Peças acionadas, não copiadas

Skills `inventario`, `arqueologia` (método das seções 1 e 3), `reconhecimento` (perguntas de padrões), `refatoracao` (modelo de `dividas.md`), `auditoria-seguranca`, `bug`, `incidente`, `legado`; script `.claude/scripts/varredura-seguranca.py`; agentes `leitor-codigo` e `verificador`; superpowers `using-git-worktrees`, `verification-before-completion` e `finishing-a-development-branch`.

## Licença MIT (texto original)

Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
