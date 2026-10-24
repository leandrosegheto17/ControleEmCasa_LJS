# Estado

## Retomada

- **Fluxo**: recriação do MyMoney no Padrão LJS — conduzida pelo `.md/PLANO.md`, sem skill de fluxo própria. O `/fluxo` não cobre esse caso: retome direto pelo plano.
- **Item**: `.md/` (`PLANO.md`, `ANALISE-MYMONEY.md`, `PRD.md`, `PRD-TECNICO.md`, `SDD.md`, `GUARDRAILS.md`, `THREAT-MODEL.md`, `adr/001`–`004`)
- **Fase aprovada**: etapa 0, documentos de método, em 2026-10-24 (análise e plano aprovados na mesma data)
- **Próxima fase**: etapa 1, esqueleto do monorepo (`PLANO.md`, tabela de etapas) — modelo indicado: sonnet
- **Construção**: etapa 1 de 17; nenhum código ainda
- **Combinado na conversa e não registrado em artefato**:
  - Regra de trabalho do usuário: uma etapa por vez, **um commit por etapa**. Ao fim de cada etapa: o que foi feito, como validar e o que vem a seguir, com aprovação seguir / ajustar / parar.
  - O legado `C:\Leandro\Projetos\MyMoney` é **somente leitura**. O layout das telas é reaproveitado 100% (copiar `estilo/`, CSS Modules, `componentes/`, `formatacao/`, `rotulos/`, `comum/` e `pwa/` na etapa 11).
  - Referência de implementação do padrão, também **somente leitura**: `C:\Leandro\Projetos\GestaodaPelada`. Não copiar dele o que diverge (lista em `ANALISE-MYMONEY.md` §4).
  - Pré-requisito da etapa 1: o usuário cria o repositório vazio no GitHub e passa a URL. O push só acontece com confirmação específica, e o hook de trava de testes bloqueia push sem a suíte verde.
  - Não pedir ao usuário segredo nenhum pela conversa; segredos vão para `wrangler secret` e GitHub Secrets.
- **Gravada em**: 2026-10-24
