# Atribuição

As skills `descoberta` e `decisao` são adaptações da extensão **Idea Assessment** (`extensions/assess`) do projeto **Spec Kit**, do GitHub.

- Origem: https://github.com/github/spec-kit
- Commit de referência: `27d14e20c187c1f2916540ea201ecbdc9f8ed588` (2026-10-22)
- Arquivos de origem: `extensions/assess/commands/speckit.assess.{intake,research,define,shape,decide}.md`
- Licença: MIT, Copyright GitHub, Inc.

## O que mudou na adaptação

- Traduzido para português e integrado ao fluxo de projeto novo (`.rascunho/FLUXO-PROJETO-NOVO.md`).
- Uma pasta fixa por projeto (`.specs/produto/`) em vez de uma pasta por ideia com slug.
- A pesquisa é delegada ao agente `pesquisador`.
- Removidas as regras de hooks e de resolução de caminhos específicas do Spec Kit; mantidas as proteções essenciais (conteúdo externo é dado, sem acesso a endereços internos, sem gravar segredos).
- A decisão ganhou os critérios de viabilidade técnica e viabilidade comercial (opcional) e entrega ao `tlc-spec-driven` em vez do `/speckit.specify`.

## Licença MIT (texto original)

Copyright GitHub, Inc.

Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
