# Estado

## Retomada

- **Fluxo**: recriação do MyMoney no Padrão LJS — conduzida pelo `.md/PLANO.md`, sem skill de fluxo própria. O `/fluxo` não cobre esse caso: retome direto pelo plano.
- **Item**: `.md/` (`PLANO.md`, `ANALISE-MYMONEY.md`, `PRD.md`, `PRD-TECNICO.md`, `SDD.md`, `GUARDRAILS.md`, `THREAT-MODEL.md`, `adr/001`–`004`)
- **Fase aprovada**: etapa 2, banco: base e identidade, em 2026-10-24 (etapas 0 e 1 aprovadas antes; commits `2f58fc3`, `9415ce9`, `774f1e9`)
- **Próxima fase**: etapa 3, API: esqueleto no Worker (`PLANO.md`, tabela de etapas) — modelo indicado: sonnet
- **Construção**: etapa 3 de 17; etapas 1 e 2 prontas, suíte verde (lint, typecheck, test); a suíte de banco precisa do Postgres no ar (`docker compose up -d`, `.env` copiado do `.env.example`, `EXIGIR_BANCO=1`)
- **Combinado na conversa e não registrado em artefato**:
  - Regra de trabalho do usuário: uma etapa por vez, **um commit por etapa**. Ao fim de cada etapa: o que foi feito, como validar e o que vem a seguir, com aprovação seguir / ajustar / parar.
  - O legado `C:\Leandro\Projetos\MyMoney` é **somente leitura**. O layout das telas é reaproveitado 100% (copiar `estilo/`, CSS Modules, `componentes/`, `formatacao/`, `rotulos/`, `comum/` e `pwa/` na etapa 11).
  - Referência de implementação do padrão, também **somente leitura**: `C:\Leandro\Projetos\GestaodaPelada`. Não copiar dele o que diverge (lista em `ANALISE-MYMONEY.md` §4).
  - Repositório privado criado em `leandrosegheto17/ControleEmCasa_LJS` e ligado como `origin` (branch `main`). **Nenhum push feito**: o push só acontece com confirmação específica, e o hook de trava de testes bloqueia push sem a suíte verde. Os jobs do CI (inclusive o `banco`) ainda não rodaram no GitHub.
  - A porta 5432 do host está ocupada por outro container (`gestaodapelada-db-1`); localmente use `PORTA_POSTGRES=55432` no `.env` (ignorado pelo git).
  - Construção feita por subagente `implementador` (Sonnet), conferida pela sessão principal antes de cada aprovação.
  - Não pedir ao usuário segredo nenhum pela conversa; segredos vão para `wrangler secret` e GitHub Secrets.
- **Gravada em**: 2026-10-24
