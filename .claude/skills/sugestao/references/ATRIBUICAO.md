# Atribuição

A skill `sugestao` é própria, escrita a partir do desenho em `.rascunho/FLUXO-SUGESTAO-TERCEIROS.md`, construída por cima da skill `demandas` (registro único, também própria, comum aos fluxos 10, 11 e 32) e dos fluxos de destino. As perguntas de entendimento do problema, a separação entre problema e solução e as regras de resposta ao autor são conhecimento comum de gestão de produto, escritos sem cópia de fonte. Um trecho foi adaptado (traduzido, enxuto e generalizado) da fonte abaixo.

## wshobson/agents — `before-you-build`

- Origem: https://github.com/wshobson/agents · commit `0874a27b17a22e2b7c2e2bcd725768e0803cad06`
- Arquivos: `plugins/before-you-build/skills/before-you-build/SKILL.md` e `references/risk-checklist.md` (o README do plugin aponta o original em https://github.com/bin1874/before-you-build-skill)
- Usado em: `avaliacao.md`, "Riscos de produto" da fase 4 (demanda com contorno e comportamento que mostra urgência; adoção: muda comportamento ou só acrescenta superfície, medida por um evento; confiança: dado, permissão ou mudança de hábito que o usuário pode recusar; retorno) e "Menor versão que resolve" da fase 5 (a menor fatia agora, o resto só depois de provar valor; nomear a evidência que falta em vez de inventar). Mudanças: aplicado a uma sugestão de melhoria num produto existente, não a um produto novo; sem os riscos de posicionamento, monetização e distribuição, que aqui vêm do plano comercial quando ele existe; sem o formato de saída próprio.
- Licença: MIT, Copyright (c) 2024 Seth Hobson.

## Inspiração (sem trecho copiado)

- `.bmad/skills/bmad-advanced-elicitation/assets/methods.csv` (BMAD-METHOD, commit `61e01f82644c4bb533750cfa0d6d61ab61d2cc9b`, MIT, Copyright (c) 2025 BMad Code, LLC): métodos "Pre-mortem Analysis" (imaginar a falha futura e voltar às causas e à prevenção) e "Inversion Analysis" (o que garantiria a falha), no pré-mortem da fase 5.
- `.anthropic-skills/skills/discernment-nudge` (Anthropic, Apache 2.0): na fase 6, "Antes de decidir", 2 ou 3 perguntas ligadas ao ponto mais incerto da conta, para o usuário conferir premissas antes de agir. Só a ideia; a skill não é acionada.

## Legado (`.claude_legado`, material do usuário)

- `skills/product-roadmap-prioritization/SKILL.md`: em `avaliacao.md`, RICE com a conta à vista, escalas de impacto (3 a 0,25) e de confiança (100, 80, 50%), cada item ligado a um objetivo do produto (sem objetivo é sinal para questionar), números arredondados e palpite declarado, dependência real ordenando antes do número, e dizer o que sai ou atrasa, não só o que entra. "Agora / próximo / depois" virou as decisões fazer agora, planejar e observação.
- `skills/commercial-impact-triage/SKILL.md`: em `avaliacao.md`, os seis eixos comerciais (monetização, público, canal, posicionamento, custo estrutural, premissa) com as seções do plano comercial a revisar, a regra de dúvida ("na dúvida, marque") e "tamanho da implementação não mede impacto comercial". Adaptado ao `plano-comercial.md` do fluxo 1 (mesma numeração das 7 seções).

Origem citada; sem licença de terceiro.

## Peças acionadas, não copiadas

Skills `demandas` (registrar, procurar, situação, avisar, encaminhar, conferir ligações), `inventario`, `plano-comercial` (revisão do plano, decisão do usuário) e os destinos do encaminhamento (`feature`, `legado`, `bug`, `performance`, `redesign`, `integracao-terceiros`, `automacao`, `documentar`, `incidente`, `projeto-novo`); agentes `leitor-codigo` e `pesquisador`; superpowers `verification-before-completion`.
