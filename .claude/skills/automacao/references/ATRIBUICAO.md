# Atribuição

A skill `automacao` é própria, escrita a partir do desenho em `.rascunho/FLUXO-AUTOMACAO.md`, construída por cima das skills `escolha-tecnologia`, `feature`, `legado`, `tlc-spec-driven`, `implantacao` e `liberacao`, com a forma dos contratos de `integracao-terceiros`. A escada de ferramentas, a conta de retorno e o desenho seguro (simulação, idempotência, falha parcial, teto de ação em massa, alerta de "não rodou") são conhecimento comum de engenharia, escritos sem cópia de fonte. Um trecho foi adaptado (traduzido, enxuto e generalizado) da fonte abaixo.

## Anthropic claude-plugins-official — `hookify`, skill `writing-rules`

- Origem: https://github.com/anthropics/claude-plugins-official · commit `465f09344424225c25d438f2e052732c3d688d2f`
- Arquivo: `plugins/hookify/skills/writing-rules/SKILL.md`
- Usado em: `claude-code.md`, seção "Regra de hook bem escrita" (identificar o comportamento indesejado e a ferramenta envolvida; escolher o evento; padrão nem largo nem estreito demais, testado com exemplos antes de usar; aviso antes de bloqueio; mensagem que diz o que foi detectado, por que é problema e o que fazer; desativar sem apagar). Mudanças: sem o formato de arquivo do `hookify` (frontmatter, campos, operadores, nomes `hookify.*.local.md`), que só vale com o plugin instalado; "avisar antes de bloquear" virou a simulação da peça; acrescentados teste do script do hook, tempo limite e falha do próprio hook.
- Licença: Apache License 2.0 (arquivo `LICENSE` do plugin). Este trecho é uma obra derivada traduzida e resumida; a licença completa está em https://www.apache.org/licenses/LICENSE-2.0.

## Inspiração (sem trecho copiado)

- `plugins/ralph-loop` (mesma origem e commit, Apache 2.0): em `claude-code.md`, laço de agente sempre com limite de iterações e critério de conclusão verificável, e o agente proibido de declarar conclusão falsa para sair do laço.
- `plugins/claude-code-setup/skills/claude-automation-recommender` (mesma origem e commit, Apache 2.0): em `claude-code.md`, a tabela de tipos de peça do Claude Code (hook, skill, subagente, execução sem interface) como ponto de partida, e o lugar de cada uma.

## Não usado

- Superpowers `dispatching-parallel-agents`: as fases desta skill são sequenciais e a pesquisa em paralelo já acontece dentro da `escolha-tecnologia`; processar itens em paralelo, quando couber, é decisão de desenho da automação, não do fluxo.
- Plugin `hookify` como dependência: instalar é decisão do usuário (`/atualizacoes`).

## Peças acionadas, não copiadas

Skills `escolha-tecnologia`, `feature`, `legado`, `tlc-spec-driven`, `implantacao`, `liberacao`, `integracao-terceiros` (saída e referências de desenho e LGPD), `incidente` (saída e formato do runbook), `bug` (alerta real), `documentar` (modelo de contexto), `update-config` (configuração de hooks), `loop` e `schedule` (agenda do Claude Code), `claude-api` (IA na automação); agentes `verificador`, `auditor-seguranca`, `pesquisador`; script `.claude/scripts/trava-testes.py`; superpowers `verification-before-completion`, `systematic-debugging` e `finishing-a-development-branch`.
