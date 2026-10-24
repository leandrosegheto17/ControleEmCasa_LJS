# Atribuição

A skill `incidente` é própria. Trechos foram adaptados (traduzidos e enxugados) dos projetos abaixo.

## wshobson/agents — plugin `incident-response`

- Origem: https://github.com/wshobson/agents · commit `0874a27b17a22e2b7c2e2bcd725768e0803cad06`
- Arquivos: `plugins/incident-response/skills/postmortem-writing/SKILL.md` e `references/details.md`; `plugins/incident-response/skills/incident-runbook-templates/SKILL.md` e `references/details.md`
- Usado em: `postmortem.md` (cultura sem culpa, 5 porquês, modelos de post-mortem completo e curto, o que funcionou / não funcionou / sorte, ações com responsável e prazo, antipadrões; tipos prevenção, detecção e mitigação; modelo de runbook com checklist rápido, pré-requisito e "se falhar", escalonamento e data da última verificação); `resposta.md` (avaliação de impacto, classificação inicial por sintoma, checagem de alcance antes de comando destrutivo); `comunicacao.md` (avisos inicial, de atualização e de resolução, atualização em intervalo fixo). Sem os comandos de Kubernetes e PostgreSQL específicos do original.
- Licença: MIT, Copyright (c) 2024 Seth Hobson.

## BMAD Method — `codebase-historian`

- Origem: https://github.com/bmad-code-org/BMAD-METHOD · commit `61e01f82644c4bb533750cfa0d6d61ab61d2cc9b`
- Arquivo: `skills/bmad-deep-recon/references/codebase-historian.md`
- Usado em: `analise.md` (reconstruir a história do código com `git log -S/-G`, `git blame -L` e o PR ligado ao commit; mensagem de commit como alegação a conferir com o diff).
- Licença: MIT, Copyright (c) 2025 BMad Code, LLC.

## Material próprio (`.claude_legado`)

`skills/observability-setup/SKILL.md`: alerta acionável (nem tarde, nem ruído), métrica no ponto de risco e disparo de alerta testado, usados na prevenção (`postmortem.md`). Origem citada; sem licença de terceiro.

## Peças acionadas, não copiadas

`systematic-debugging` e `verification-before-completion` (superpowers, https://github.com/obra/superpowers, MIT); skills `bug` e `liberacao` deste conjunto.

## Licença MIT (texto original)

Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
