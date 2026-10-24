# Atribuição

A skill `avaliar-terceiros` é própria, escrita a partir do desenho em `.rascunho/FLUXO-AVALIACAO-TERCEIROS.md`, com a estrutura das skills `documentar` e `auditoria-seguranca`. A parte legal (`legal.md`) é material próprio: não havia referência pronta. Trechos foram adaptados (traduzidos e enxugados) das fontes abaixo.

## security-ownership-map (OpenAI skills, via tech-leads-club/agent-skills)

- Origem: https://github.com/tech-leads-club/agent-skills · commit `bc4f025632b0443ed3450aaec6fe96aec5b9a0c5` (metadado do arquivo: `author: github.com/openai/skills`)
- Arquivos: `packages/skills-catalog/skills/(security)/security-ownership-map/SKILL.md`, `scripts/build_ownership_map.py`
- Usado em: `.claude/scripts/propriedade-git.py` e `saude.md` (regras de caminho sensível por padrão e etiqueta, com as mesmas regras padrão de autenticação, criptografia e segredos; robôs como dependabot ignorados; leitura do `git log` sem merges e sem renomeações; código sensível com um só autor e, se parado há mais de 365 dias, órfão; donos ocultos com metade ou mais das mudanças de uma área). Mudanças: sem grafo pessoa-arquivo, coocorrência, comunidades, fusos horários e exportação para Neo4j (exigiam `networkx` e não servem à decisão); acrescentados o fator ônibus do projeto (menor número de pessoas com mais da metade das mudanças nos arquivos atuais), o recorte de 12 meses, a atividade mensal e a saída sem e-mails.
- Licença: Apache License 2.0 (arquivo `LICENSE.txt` da pasta da skill). Obra derivada traduzida e resumida; a licença completa está em https://www.apache.org/licenses/LICENSE-2.0.

## BMAD-METHOD — `bmad-deep-recon`, pacote técnico

- Origem: https://github.com/bmad-code-org/BMAD-METHOD · commit `61e01f82644c4bb533750cfa0d6d61ab61d2cc9b`
- Arquivo: `skills/bmad-deep-recon/types/technical.md`
- Usado em: `saude.md`, pedido ao `pesquisador` (dimensão 5, saúde do ecossistema: vitalidade de quem contribui e das versões, durabilidade de quem sustenta, risco de arrependimento em cinco anos; e os cuidados: retrospectivas em vez de anúncios, números de produção em vez de defesa, conferir se a reclamação antiga ainda vale, métricas ao longo do tempo e não instantâneos, o rastreador de issues mostra a distância entre documentação e realidade, sinais do ecossistema com até 6 meses, afirmação de falha com duas fontes).
- Licença: MIT, Copyright (c) 2025 BMad Code, LLC.

## Legado (`.claude_legado`, material do usuário)

- `skills/build-vs-buy-analysis/SKILL.md`: em `decisao.md`, a tabela controle, tempo até funcionar, custo e dependência; reversibilidade em 6, 12 e 24 meses; número de custo marcado real, estimativa ou não quantificável, nunca inventado; fator decisivo nomeado em vez de empate neutro; condição sob a qual a recomendação mudaria; alternativa de compra sempre concreta.
- `skills/risk-and-compliance-check/SKILL.md`: em `legal.md` (LGPD), minimização, retenção e descarte, localização dos dados, terceiros com acesso (controlador e operador) e cada item respondido com evidência ou "não se aplica" com o porquê.

Origem citada; sem licença de terceiro.

## Peças acionadas, não copiadas

Skills `revisao-codigo`, `auditoria-seguranca`, `escolha-tecnologia`, `documentar` (método de `execucao.md` e chamada depois da decisão), `arqueologia` (método da seção 1), `inventario`; agentes `leitor-codigo` e `pesquisador`; superpowers `verification-before-completion`.

## Licença MIT (texto original)

Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
