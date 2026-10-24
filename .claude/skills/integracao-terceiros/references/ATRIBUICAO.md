# Atribuição

A skill `integracao-terceiros` é própria, escrita a partir do desenho em `.rascunho/FLUXO-INTEGRACAO.md`, construída por cima das skills `feature` e `legado` e com a forma dos contratos de `avaliar-terceiros`. Os padrões de resiliência do `desenho.md` (adaptador, tempo limite, recuo, disjuntor, idempotência, caixa de saída, reconciliação) são conhecimento comum de engenharia, escritos sem cópia de fonte. Trechos foram adaptados (traduzidos, enxutos e trocados para o contexto brasileiro) das fontes abaixo.

## wshobson/agents — `gdpr-data-handling`

- Origem: https://github.com/wshobson/agents · commit `0874a27b17a22e2b7c2e2bcd725768e0803cad06`
- Arquivos: `plugins/hr-legal-compliance/skills/gdpr-data-handling/SKILL.md`, `references/details.md`
- Usado em: `seguranca-legal.md` (categorias de dado com sensíveis e menores à parte; uma base legal por finalidade, entre as hipóteses da lei; minimização campo a campo; direitos do titular com prazo; retenção definida; transferência internacional só com mecanismo; contrato de tratamento com cada fornecedor; checklist final). Mudanças: GDPR trocado pela LGPD (artigos, prazos e regulamento da ANPD, todos marcados `PREMISSA` até conferência); sem os exemplos de código (consentimento, pedidos do titular, retenção), que viram requisitos da spec quando cabem; acrescentados papéis de controlador e operador aplicados ao fornecedor, controlador independente e aviso de incidente pelo fornecedor.
- Licença: MIT, Copyright (c) 2024 Seth Hobson.

## wshobson/agents — `pci-compliance` (inspiração)

- Origem: a mesma, arquivos `plugins/payment-processing/skills/pci-compliance/SKILL.md` e `references/details.md`
- Usado em: `seguranca-legal.md`, linha de cartão (nunca guardar código de segurança, trilha nem PIN; checkout hospedado ou tokenização tiram o cartão dos nossos sistemas e reduzem o escopo) e mascaramento em log. Só a ideia; sem trecho copiado.
- Licença: MIT, Copyright (c) 2024 Seth Hobson.

## Legado (`.claude_legado`, material do usuário)

- `skills/api-integration/SKILL.md`: em `desenho.md`, todo erro documentado com tratamento (não só o sucesso); simulador que reproduz também os erros; simulado claramente separado da chamada real; tarefa só pronta depois de exercitar o real (aqui, o ponta a ponta no sandbox da fase 7); revalidar quando a versão do contrato muda (laço de mudança do fornecedor em `fases.md`).
- `skills/api-contract-design/SKILL.md`: em `contrato.md`, o contrato como compromisso explícito (operações, campos, formato de erro) e a versão como sinal de mudança incompatível; daqui vem fixar a versão da API e ler o changelog.
- `skills/compliance-validation/SKILL.md`: em `seguranca-legal.md`, testar o mecanismo real e não a intenção documentada; lacuna de obrigação legal não vira débito; decisão de negócio (finalidade, base legal) sinalizada ao responsável, não decidida pela técnica; terceiro com acesso a dado recebe só o necessário.

Origem citada; sem licença de terceiro.

## Não usado

- `.anthropic-skills/skills/mcp-builder`: trata de construir servidores MCP para modelos de linguagem, não de integrar um sistema a um fornecedor. Fica de fora.

## Peças acionadas, não copiadas

Skills `feature`, `legado`, `escolha-tecnologia`, `spike`, `auditoria-seguranca`, `liberacao`, `implantacao`, `revisao-codigo` (pela `feature`), `rede-de-protecao` (pela `feature`), `tlc-spec-driven` (pela `feature`), `incidente` (saída e formato do runbook); agentes `pesquisador`, `verificador`, `auditor-seguranca`; script `.claude/scripts/varredura-seguranca.py`; superpowers `verification-before-completion` e `systematic-debugging`.

## Licença MIT (texto original)

Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
