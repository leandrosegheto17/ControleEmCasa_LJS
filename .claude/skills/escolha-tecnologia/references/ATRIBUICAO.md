# Atribuição

A skill `escolha-tecnologia` é própria, escrita a partir do desenho em `.rascunho/FLUXO-ESCOLHA-TECNOLOGIA.md`. Trechos foram adaptados (traduzidos e enxugados) das fontes abaixo.

## wshobson/agents — Architecture Decision Records

- Origem: https://github.com/wshobson/agents · commit `0874a27b17a22e2b7c2e2bcd725768e0803cad06`
- Arquivos: `plugins/documentation-generation/skills/architecture-decision-records/SKILL.md` e `references/decision-templates.md`
- Usado em: `decisao.md` (estrutura MADR do modelo completo: contexto, critérios que decidiram, opções com prós e contras, decisão, consequências boas e ruins, riscos; modelo leve no formato "no contexto de..., escolhemos..., aceitando..." (Y-statement); ADR aceito não se edita, troca por ADR que substitui). Sem o índice em README, as ferramentas `adr-tools` nem o processo de revisão por pares.
- Licença: MIT, Copyright (c) 2024 Seth Hobson.

## BMAD Method — pacote de pesquisa técnica

- Origem: https://github.com/bmad-code-org/BMAD-METHOD · commit `61e01f82644c4bb533750cfa0d6d61ab61d2cc9b`
- Arquivo: `skills/bmad-deep-recon/types/technical.md`
- Usado em: `avaliacao.md` (as 5 dimensões do pedido ao `pesquisador`: maturidade, integração, uso real, esforço de aprender e operar, saúde do projeto ao longo do tempo; conferir se reclamação antiga ainda vale; duas fontes para número de desempenho e para "falhou"; prazos de validade das evidências).
- Licença: MIT, Copyright (c) 2025 BMad Code, LLC.

## Material próprio (`.claude_legado`)

- `skills/adr-drafting/SKILL.md`: título do ADR como frase afirmativa, contexto com as forças em jogo, consequência negativa obrigatória, numeração pelo maior existente, imutabilidade com "substituído por" nos dois sentidos.
- `skills/tech-stack-selection/SKILL.md`: requisito que motiva cada escolha, alternativa real (não de palha), "a equipe conhece" declarado ao lado do requisito técnico, escolha de alto risco tratada com mais rigor.
- `skills/build-vs-buy-analysis/SKILL.md` (inspiração): opção comprada sempre nomeada, custo marcado como real ou estimativa, fator decisivo nomeado, condição em que a recomendação mudaria.

Origem citada; sem licença de terceiro.

## Não usado

`the-jury` (`.claude_legado`, CC-BY-4.0): painel de 3 a 5 subagentes, caro para o ganho; a decisão fica com o usuário. Só a ideia geral de pré-mortem aparece em `decisao.md`, sem texto adaptado.

## Peças acionadas, não copiadas

Agente `pesquisador`, agente `leitor-codigo`, skill `spike`, formato de decisões `AD-NNN` do `tlc-spec-driven` (`references/memory.md`, MIT), `verification-before-completion` (superpowers, https://github.com/obra/superpowers, MIT).

## Licença MIT (texto original)

Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
