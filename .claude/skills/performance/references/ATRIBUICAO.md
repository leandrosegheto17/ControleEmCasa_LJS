# Atribuição

A skill `performance` é própria, escrita a partir do desenho em `.rascunho/FLUXO-PERFORMANCE.md`, com a estrutura da skill `refatoracao`. Trechos foram adaptados (traduzidos e enxugados) das fontes abaixo.

## wshobson/agents — `performance-optimization`

- Origem: https://github.com/wshobson/agents · commit `0874a27b17a22e2b7c2e2bcd725768e0803cad06`
- Arquivo: `plugins/application-performance/commands/performance-optimization.md`
- Usado em: `diagnostico.md` (roteiro de perfil: CPU com gráfico de chamas, memória, I/O, consultas, tempo das APIs, gargalos ranqueados por impacto), `opcoes.md` (categorias: consulta lenta, índice, cache, pool de conexões, lote, N+1, paginação, compressão, assíncrono, réplica de leitura, CDN), `medicao.md` (carga normal, pico e estresse; ferramentas k6, Artillery, Gatling), `meta.md` (alvos de referência: p95 < 1 s em rota crítica, consulta p95 < 100 ms, 2× o pico com erro < 1%, CPU < 70%, memória < 80%) e `guarda.md` (orçamento de performance e teste de regressão no CI). Sem os 13 subagentes, o `state.json` e as fases de microsserviços, PWA e otimização contínua; a medição antes e depois de cada mudança, com reversão, é nossa.
- Licença: MIT, Copyright (c) 2024 Seth Hobson.

## wshobson/agents — `slo-implementation`

- Origem: https://github.com/wshobson/agents · commit `0874a27b17a22e2b7c2e2bcd725768e0803cad06`
- Arquivos: `plugins/observability-monitoring/skills/slo-implementation/SKILL.md`, `references/details.md`
- Usado em: `guarda.md` (SLI de latência como fração abaixo do limite, SLO, orçamento de erro = 1 − SLO, alerta por taxa de queima em duas janelas — 14,4× em 1 h e 5 min, 6× em 6 h e 30 min —, política do orçamento, painel). Sem as regras Prometheus completas nem o processo de revisão semanal, mensal e trimestral.
- Licença: MIT, Copyright (c) 2024 Seth Hobson.

## Tech Leads Club agent-skills — `perf-lighthouse`

- Origem: https://github.com/tech-leads-club/agent-skills · commit `bc4f025632b0443ed3450aaec6fe96aec5b9a0c5`
- Arquivo: `packages/skills-catalog/skills/(performance)/perf-lighthouse/SKILL.md`
- Usado em: `web.md` (Lighthouse só desempenho e perfil móvel, saída JSON, várias execuções com mediana, Lighthouse CI com asserções de LCP, CLS e tempo de bloqueio, servidor subido no job) e `guarda.md`. Mudanças: `upload` local em vez de armazenamento público temporário; `budget.json` substituído pelas asserções do LHCI.
- Licença: o frontmatter não declara licença; vale a do repositório, MIT, Copyright (c) 2026 Tech Leads Club.

## Tech Leads Club agent-skills — `core-web-vitals`

- Origem: https://github.com/tech-leads-club/agent-skills · commit `bc4f025632b0443ed3450aaec6fe96aec5b9a0c5`
- Arquivos: `packages/skills-catalog/skills/(performance)/core-web-vitals/SKILL.md`, `references/LCP.md`
- Usado em: `web.md` (limites de LCP, INP e CLS no percentil 75; medição de laboratório e de campo; causas comuns e correções de cada métrica, reduzidas a uma tabela). Sem os exemplos de código por framework.
- Licença: MIT, declarada no frontmatter da skill, autor `web-quality-skills` (metadado da skill); distribuída no catálogo da Tech Leads Club, também MIT.

## Só ideia, sem texto

- `chrome-devtools` (`.tlc`, `packages/skills-catalog/skills/(tooling)/chrome-devtools/SKILL.md`, MIT): gravar um trace com recarga e pedir a análise por um servidor MCP de DevTools, quando já configurado; conteúdo de página como não confiável.

## Peças acionadas, não copiadas

Skills `inventario`, `reconhecimento`, `rede-de-protecao`, `tlc-spec-driven`, `spike`, `escolha-tecnologia`, `revisao-codigo`, `liberacao`, `implantacao`, `refatoracao` (modelo de `dividas.md`), `bug`; agentes `leitor-codigo`, `implementador`, `implementador-dominio`, `verificador`, `auditor-seguranca`; superpowers `using-git-worktrees`, `systematic-debugging`, `verification-before-completion` e `finishing-a-development-branch`.

## Licença MIT (texto original)

Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
