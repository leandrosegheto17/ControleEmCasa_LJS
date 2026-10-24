# Atribuição

A skill `auditoria-seguranca` é própria, escrita a partir do desenho em `.rascunho/FLUXO-SEGURANCA.md`. Trechos foram adaptados (traduzidos e enxugados) das fontes abaixo.

## Tech Leads Club agent-skills — `security-threat-model`

- Origem: https://github.com/tech-leads-club/agent-skills · commit `bc4f025632b0443ed3450aaec6fe96aec5b9a0c5` (a skill declara autoria original em github.com/openai/skills)
- Arquivos: `packages/skills-catalog/skills/(security)/security-threat-model/SKILL.md`, `references/prompt-template.md` e `references/security-controls-and-assets.md`
- Usado em: `ameacas.md` (pedido de resumo de segurança do repositório; sistema por fronteiras de confiança; ativos; capacidades e não capacidades do atacante; entradas controladas por atacante, operador ou desenvolvedor; caminhos de abuso; prioridade por probabilidade × impacto ajustada pelos controles; confirmar de 1 a 3 premissas com o usuário antes de fechar; caminhos de foco para a revisão manual; checagem de qualidade; regras do diagrama Mermaid; categorias de ativos). Sem o contrato de saída literal (tabela de 13 colunas reduzida a 9) e sem o nome de arquivo `<repo>-threat-model.md`.
- Licença: Apache License 2.0. Texto em http://www.apache.org/licenses/LICENSE-2.0 (cópia em `.tlc/packages/skills-catalog/skills/(security)/security-threat-model/LICENSE.txt`). Alterações: tradução para o português, redução, integração às fases 2 e 3 deste fluxo.

## wshobson/agents — `stride-analysis-patterns`

- Origem: https://github.com/wshobson/agents · commit `0874a27b17a22e2b7c2e2bcd725768e0803cad06`
- Arquivos: `plugins/security-scanning/skills/stride-analysis-patterns/SKILL.md` e `references/details.md`
- Usado em: `ameacas.md` (as seis categorias STRIDE com a pergunta e o controle típico de cada uma; categorias aplicáveis por tipo de elemento; "não pule categorias"; matriz de risco reduzida a 3 × 3). Sem o código Python dos modelos.
- Licença: MIT, Copyright (c) 2024 Seth Hobson.

## Claude Plugins Official — `security-auditor` e `security-guidance` (inspiração)

- Origem: https://github.com/anthropics/claude-plugins-official · commit `465f09344424225c25d438f2e052732c3d688d2f`
- Arquivos: `plugins/code-modernization/agents/security-auditor.md` e `plugins/security-guidance/hooks/patterns.py`
- Usado em: `achados.md` (lista da revisão manual: destinos perigosos de comando, desserialização, XSS, TLS desligado, ECB, injeção em workflow do GitHub Actions; achado com CWE, cenário de exploração em uma frase e "sem cenário, rebaixe"; texto no código que tenta instruir a IA é achado) e agente `auditor-seguranca` (segredo mascarado nos primeiros caracteres). Sem o hook (envia código a serviço externo, fora pela política do `REAPROVEITAMENTO.md`).
- Licença: Apache License 2.0, Copyright Anthropic. Texto em http://www.apache.org/licenses/LICENSE-2.0. Alterações: tradução, redução a lista de verificação.

## Material próprio (`.claude_legado`)

- `scripts/seguranca.py`: base de `.claude/scripts/varredura-seguranca.py` (ferramentas procuradas no PATH, `NÃO EXECUTADO` nunca em silêncio, parsers de npm/pnpm audit, pip-audit, osv-scanner, gitleaks e semgrep, sondas com padrões de vazamento, cabeçalhos e CORS, `--estrito` para o CI). Mudanças: subcomandos, Docker só com `--docker`, `--pular` registrado, gitleaks com `--redact`, busca embutida de segredos no histórico com valor mascarado, sondas só contra localhost ou host autorizado, sem OWASP ZAP; testes novos.
- `skills/finding-severity-classification/SKILL.md`: critério crítico/alto/médio/baixo com destino (bloqueia ou débito com prazo), "nunca rebaixar para não bloquear", obrigação legal não vira débito (aqui: no mínimo alto).
- `skills/security-threat-model/` (cópia antiga da mesma skill do `.tlc`; a origem registrada é a do `.tlc`).

Origem citada; sem licença de terceiro.

## Peças acionadas, não copiadas

Agentes `auditor-seguranca` e `leitor-codigo`, skills `bug` e `incidente`, `verification-before-completion` (superpowers, https://github.com/obra/superpowers, MIT). OWASP Top 10 citada só pelos nomes das categorias.

## Licença MIT (texto original)

Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
