---
paths:
  - ".claude/**"
---

# Ao editar a própria `.claude`

Vale quando se cria ou altera skills, agentes, rules, scripts ou configurações deste conjunto de fluxos. O desenho e o histórico das decisões estão em `.rascunho/DESENHO-FLUXO-1.md` e `.rascunho/DECISOES.md`; registre ali toda decisão nova.

## Pacotes e código de terceiros

- **Nunca edite uma skill instalada por pacote** (ex.: `.claude/skills/tlc-spec-driven/`). A próxima atualização apagaria a mudança. Ajuste pelo `CLAUDE.md`, por uma rule ou por uma skill nossa.
- **Skill adaptada de outro repositório** precisa de:
  - entrada `adaptado` em `.claude/fontes.json` com `origem`, `commit` e `arquivos_origem`;
  - atribuição e licença num `references/ATRIBUICAO.md` (ou apontando para um existente).
- Depois de mexer no `fontes.json`, rode `python .claude/scripts/verificar-atualizacoes.py` para confirmar que a entrada é lida.

## Forma das peças

- **Skill:** `SKILL.md` com até ~150 linhas, só o fluxo de trabalho. Modelos de documento e detalhes ficam em `references/`, lidos apenas na etapa que precisa deles.
- **`description`** diz o que faz, quando usar e quando **não** usar.
- **Modelo e effort** seguem a política do `CLAUDE.md`. Fases de conversa: `model` da skill vale só no primeiro turno, então a skill avisa o usuário para trocar com `/model`. Trabalho pesado: agente com `model` fixo.
- **Perguntas ao usuário** dentro de skills sempre via `AskUserQuestion` (regra do `CLAUDE.md`), inclusive a aprovação seguir / ajustar / parar.
- **Agente:** até ~60 linhas, ferramentas mínimas, resposta num formato curto e fixo.
- **Rule:** só com `paths` (sem `paths` ela carrega sempre e é melhor ir para o `CLAUDE.md`). Plugins não levam rules: o que for essencial para o fluxo precisa estar em skill ou hook.
- Tudo em português.

## Depois de mudar

- Skills e rules aparecem na hora. Agentes novos podem levar alguns minutos para ficar disponíveis na sessão. O hook `SessionStart` só roda ao abrir uma sessão.
- Teste a peça alterada antes de dar por concluída.
