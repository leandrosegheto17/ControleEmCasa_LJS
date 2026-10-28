# ADR-017: Padrão de uso do Neon

- **Status:** Aceito em 2026-10-28 (decisão do usuário, padrão comum aos projetos dele)
- **Data:** 2026-10-28
- **Decisores:** Leandro (stakeholder)
- **Emenda:** ADR-015 (decisões 3.3 e 7). Mantém o ADR-016 (Postgres 18)
- **Detalha:** GUARDRAILS G-43 e G-44; THREAT-MODEL TM-DB-07; `docs/runbook.md`, seções 2, 3.2 e 4

## Contexto

- O usuário tem mais de um projeto no Neon e quer o mesmo jeito de usá-lo em todos: as mesmas branches, os mesmos nomes
  de variável, a mesma validação de destino e o mesmo ponto de retorno antes de migrar.
- Até aqui o deploy criava uma branch `restauracao-<run>-<tentativa>` no Neon antes de migrar, mantendo as 2 mais novas
  (ADR-015, decisão 3.3). Isso exigia a `NEON_API_KEY` no GitHub, gastava o limite de branches do plano Free e, na
  prática, o dump cifrado já era o ponto de retorno independente do Neon.

## Decisão

1. **Branches:** o projeto Neon tem só duas branches permanentes, `main` (produção) e `dev`. Nada de branch por PR e
   nada de branch de restauração. O deploy não cria nem apaga branch; a `NEON_API_KEY` e a `NEON_PROJECT_ID` saem do
   GitHub (nenhum workflow chama a API do Neon). O ponto de retorno antes de cada migração é só o dump cifrado com `age`
   (`dump-predeploy-<run>-<tentativa>`, G-44), e o diário é o `backup-<data>-...`. A restauração é pelo dump, num banco
   novo da `main` (para voltar a produção) ou da `dev` (ensaio), sem criar branch (runbook 4.2).
   Ordem do deploy: endereço do Asaas → build → cache do Hyperdrive → dump cifrado → migração com o owner → `wrangler
   deploy` → saúde.

## Consequências

- Uma chave a menos no GitHub e nenhum gasto do limite de branches do Neon Free.
- Restaurar fica mais lento que trocar de branch: é sempre decifrar o dump e rodar o `pg_restore` (runbook 4.2).
- O dado escrito entre o dump do deploy e a restauração se perde, como antes.
- As branches `restauracao-*` que os ensaios e o primeiro deploy criaram no Neon precisam ser apagadas à mão no console.
