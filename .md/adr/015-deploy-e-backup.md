# ADR-015: Deploy e backup

- **Status:** Aceito em 2026-10-27, com a ressalva de que a restauração com a role owner do Neon e o primeiro backup real só são validados na etapa 17 (ligar em produção só na etapa 17). **Emendado em 2026-10-27**: gatilho e aprovação (decisões 1 e 2) substituídos pelo disparo manual com guarda de CI verde (seção "Emenda de 2026-10-27"). **Emendado em 2026-10-28** pelo ADR-017 (padrão do Neon): sai a branch de restauração (decisão 3.3) e o script `restauracao-neon.ts` (decisão 7); o dump cifrado é o único ponto de retorno antes de migrar
- **Data:** 2026-10-27
- **Decisores:** Leandro (stakeholder)
- **Detalha:** PLANO etapa 16; PRD-TECNICO RNF-09 e CA-26.5; SDD §3.7, §4, §5.3, §11.1, §11.2, D-06; GUARDRAILS G-02, G-04, G-09, G-32, G-40, G-42, G-43, G-44; THREAT-MODEL TM-DB-02, TM-DB-05, TM-DB-07, TM-GH-01 a TM-GH-06, E-12; ADR-002, ADR-005 e ADR-013

## Contexto

- O app publica um Worker único na Cloudflare e usa o Neon (Postgres 18, ADR-016) pelo Hyperdrive. Até aqui não existe produção: o Neon, o Hyperdrive, os segredos e o domínio nascem na etapa 17.
- Os guardrails pedem um único `wrangler deploy` (G-42), ordem fixa com branch de restauração e dump antes da migração (G-43), cache do Hyperdrive conferido no deploy (G-02, TM-DB-02) e backup diário cifrado com `age`, 30 dias, sem chave privada no GitHub (G-44, TM-GH-03).
- A referência de implementação (GestaodaPelada, somente leitura) tem `deploy.yml`, `backup.yml` e a action `dump-cifrado`. Foram adaptados, não copiados: lá o deploy é manual e o dump é feito em shell.
- O `purga.yml` (etapa 14) já usa o environment `producao` com agenda diária e fica inerte por variável (`PURGA_ATIVA`).
- Um ensaio com o Postgres 17 do docker mostrou que o `pg_dump` como `controle_backup_ro` **falhava antes de começar**: sem `USAGE` em `public` (por causa de `public.pgmigrations`) e sem `SELECT` na sequência de `tentativa_login`.

## Decisão

1. **Gatilho do deploy** (substituída pela emenda de 2026-10-27): `workflow_run` do `ci` concluído, só na `main`. O job só segue com `conclusion == 'success'`, `event == 'push'`, `head_branch == 'main'` e o repositório de origem igual ao próprio (fork nunca publica). O checkout usa o `head_sha` que o CI testou, e o `SENTRY_RELEASE` é esse SHA. Não há `workflow_dispatch`: para publicar de novo, usa-se "Re-run". A suíte verde é a do `ci.yml` (lint, typecheck, test, banco, e2e, gitleaks), a mesma que a trava local exige antes do push.
2. **Aprovação separada dos segredos** (substituída pela emenda de 2026-10-27): o job `aprovar` usa o environment `producao-aprovacao` (revisor obrigatório, nenhum segredo). O `publicar` depende dele e roda no environment `producao` (segredos, só da `main`, **sem** revisor). Se o `producao` tivesse revisor obrigatório, o backup e a purga diários, que leem dele, ficariam esperando aprovação todo dia.
3. **Ordem fixa** no job `publicar`, um passo depois do outro, sem `continue-on-error` e com `bash -eo pipefail`:
   1. build do front;
   2. cache do Hyperdrive conferido pela API da Cloudflare (`caching.disabled === true`; qualquer outra resposta falha). O id vem do `wrangler.jsonc`; o id fictício (só zeros) falha;
   3. branch `restauracao-<run>-<tentativa>` no Neon a partir da `main`, esperando as operações terminarem; depois, apaga as `restauracao-*` mais antigas e **mantém as 2 mais novas**. Nunca apaga a padrão, a protegida nem branch de outro nome;
   4. dump cifrado com `age` (action `dump-cifrado`) como `backup_ro`, artefato `dump-predeploy-<run>-<tentativa>`;
   5. migração com a role `owner` (`pnpm --filter @controle/scripts migrar`), o único passo com essa URL;
   6. `wrangler deploy -c ../../wrangler.jsonc --var URL_PUBLICA:… --var AMBIENTE:producao --var ASAAS_API_URL:https://api.asaas.com/v3 --var SENTRY_RELEASE:<sha>`;
   7. `GET /api/health` com novas tentativas.

   O cache do Hyperdrive é conferido antes de qualquer mudança em produção (G-43 não fixa a posição dele). Falha depois da migração faz `wrangler rollback` se o Worker já tinha sido publicado e aponta a branch e o artefato da restauração. A migração **não** é desfeita sozinha: as migrations são aditivas (G-43), e o código anterior continua compatível.
4. **O dump do deploy usa o `backup_ro`, não o `owner`**: com RLS FORCE e sem BYPASSRLS no Neon, o `owner` só enxerga linhas com o GUC da purga (ADR-013), e o dump sairia vazio, sem erro.
5. **Concorrência**: grupo `deploy-producao` com `cancel-in-progress: false` (o deploy em andamento nunca é cortado); o backup tem o grupo `backup`.
6. **Backup diário** (`backup.yml`): cron `0 7 * * *` (04:00 em Brasília; o Brasil não tem horário de verão desde 2019) e disparo manual; environment `producao`; `pg_dump --format=custom --enable-row-security` como `backup_ro` com o cliente da imagem `postgres:18-alpine` fixada por digest. A versão maior do servidor é conferida antes e precisa ser 18 (ADR-016, que substitui o ADR-002). A saída vai **por pipe** para `age -r $AGE_RECIPIENT`, então o dump em claro nunca toca o disco. Só o `.age` sobe como artefato do Actions, por **30 dias**, sem compressão. O destino é o artefato (THREAT-MODEL E-12). Falha deixa o job vermelho, com anotação `::error` e resumo do run; o GitHub avisa por e-mail.
7. **Lógica testável fora do YAML**: `backend/scripts/src/operacao/` tem `restauracao-neon.ts`, `cache-hyperdrive.ts` e `dump-cifrado.ts` (todos com `fetch` ou comandos injetáveis e testes sem rede), e `wrangler-deploy-unico.ts`. As chaves vêm só do ambiente, vão só no cabeçalho `Authorization`, nunca em argv ou no log; erros não ecoam corpo de resposta nem o stderr do `pg_dump`.
8. **`wrangler deploy` único** (G-42), por teste que varre todos os arquivos que o git conhece (exceto `.claude/`):
   - em arquivo executável ou de automação (workflows, `package.json`, scripts, Dockerfile, Makefile), nenhuma linha publica com o wrangler (`deploy`, `publish`, `versions|pages|triggers deploy`, com flags antes do subcomando e linhas com `\` juntadas) nem usa as actions de publicação da Cloudflare. Comentário de YAML não conta; comentário em código conta;
   - o `deploy.yml` tem **exatamente uma** publicação;
   - em documentação (`.md`, `.mdx`, `.txt`, inclusive README e runbook), citar no texto ou em código de linha é livre; dentro de bloco cercado (o que se copia para o terminal) é proibido, exceto em bloco `mermaid`.
9. **Inertes até a etapa 17**: `vars.DEPLOY_ATIVO == 'true'` e `vars.BACKUP_ATIVO == 'true'`, como a purga com `PURGA_ATIVA`.
10. **`backup_ro` lê o que o dump precisa** (migração `20261031120000_backup_ro_dump_completo.sql`): `SELECT` nas sequências de `app` (e nas futuras, por privilégio padrão), `USAGE` em `public` e `SELECT` em `public.pgmigrations` e na sequência dela. Só leitura: nenhuma escrita e nenhum `CREATE`. O teste de banco `backup.test.ts` reproduz o que o `pg_dump` faz como `backup_ro`: trava todas as tabelas, lê todas as sequências e lê todas as linhas com a RLS ligada. Também exige a política `backup_leitura` em toda tabela com RLS.

## Alternativas consideradas

- **Deploy por `workflow_dispatch` (como no GestaodaPelada)**: não garante que o commit publicado passou no CI. Descartado na versão original; adotado na emenda de 2026-10-27, com o job `conferir` garantindo o CI verde do commit.
- **`deploy.yml` chamando o `ci.yml` como workflow reutilizável**: garante o mesmo SHA, mas roda a suíte duas vezes por push (o CI do GitHub já está limitado por cobrança). Descartado.
- **Um único environment `producao` com revisor**: travaria o backup e a purga diários à espera de aprovação. A alternativa sem revisor nenhum deixaria o deploy automático a cada push na `main`. Preferido o environment de aprovação separado (inviável no GitHub Free em repositório privado; ver a emenda).
- **Dump com o `owner`**: sai vazio com RLS FORCE (decisão 4).
- **Dump em shell, como no GP**: não seria testável no Windows nem no CI sem `bash`, docker e age. A lógica em TypeScript com comandos injetáveis é testada com scripts falsos.
- **Dump só do schema `app` (`--schema=app`)**: perderia `public.pgmigrations`, e o banco restaurado não saberia quais migrations já rodaram.
- **Branch de restauração com compute**: não é preciso para restaurar e consumiria cota do Neon Free.

## Consequências

**Positivas**
- Nada é publicado sem a suíte verde do commit exato e sem uma decisão humana (desde a emenda, o próprio disparo manual). Toda migração tem antes uma branch do Neon (restauração rápida) e um dump cifrado (restauração independente do Neon).
- Os scripts de operação são testados sem rede e sem credencial. Uma segunda publicação em qualquer arquivo quebra o teste.
- O backup passou a funcionar de verdade com o `backup_ro`. Um ensaio local (dump cifrado → `age -d` → `pg_restore` num banco vazio) restaurou as 27 tabelas e as 12 migrations. Isso não substitui o ensaio em produção.

**Negativas e riscos**
- **A restauração nunca foi testada em produção.** O runbook do lote 2 (`docs/runbook.md`) inclui o ensaio com resultado registrado. Na etapa 17, depois do primeiro backup real, o ensaio é obrigatório.
- **Chave privada `age` perdida = backup inútil** (TM-GH-06): a guarda offline em 2 lugares é procedimento da etapa 17 e do runbook.
- O Neon Free limita o número de branches, e manter 2 de restauração consome parte desse limite. A listagem de branches usa uma única página da API, o que basta para o limite do Free; conferir na etapa 17.
- O `wrangler rollback` em modo não interativo e o formato atual de `--var` precisam ser confirmados no primeiro deploy real (etapa 17).
- Agendas do GitHub param depois de 60 dias sem atividade no repositório: o backup sem commit novo pode parar sem aviso. O UptimeRobot não cobre isso; o runbook pede conferir o último artefato.
- O `age` vem do apt do runner (sem versão fixada) e o `actions/upload-artifact` v7.0.1 foi fixado pelo SHA usado noutro projeto do usuário: conferir com `/atualizacoes`.
- A retenção máxima de artefatos do repositório precisa ser de pelo menos 30 dias (o padrão é 90).

## Pendências

- Lote 2 desta etapa (feito em 2026-10-27): Sentry (`SENTRY_RELEASE` no Worker e `VITE_SENTRY_RELEASE` no build do front), README, `docs/runbook.md` (restauração pela branch e pelo dump, ensaio local registrado na seção 9, guarda da chave `age`, conferência do último backup), e2e críticos na pilha real e Lighthouse. O ensaio mostrou que o `pg_dump` não leva o `ALTER ROLE ... IN DATABASE ... SET search_path`: a restauração pelo dump refaz esse passo (runbook 4.2, passo 5).
- Etapa 17: criar o Neon (branches `main`/`dev`), o Hyperdrive com cache desligado (o id real substitui o fictício do `wrangler.jsonc`), o environment `producao` (sem revisor, só da `main`), os segredos e as variáveis (lista no `.env.example`), o par de chaves `age` e ligar `BACKUP_ATIVO`, `DEPLOY_ATIVO` e `PURGA_ATIVA`.
- G-43 cita um passo de CI que detecta migration não aditiva: feito no lote 2 (`backend/scripts/src/operacao/migracao-aditiva.ts`, passo "Migrations aditivas (G-43)" no job `base` do `ci.yml`). A exceção é a anotação `-- migracao-nao-aditiva: expand=<arquivo>.sql | <justificativa>` (fase expand já no commit de base) ou `log | <justificativa>` (linha aprovada, com validade, no Log de Alterações do GUARDRAILS). Limite: "publicada" é conferido como "já estava na `main` antes deste push"; um commit que nunca foi publicado (deploy não disparado) não é detectado.

## Emenda de 2026-10-27: deploy manual com guarda de CI verde

- **Motivo:** o GitHub Free não permite environment com revisor obrigatório em repositório privado. O `producao-aprovacao` não pausaria nada, e o deploy ficaria automático a cada push na `main`.
- **Decisão do usuário (2026-10-27):** o deploy passa a ser **manual**, por `workflow_dispatch` sem inputs, e sem gatilho automático depois do CI. Substitui as decisões 1 e 2:
  1. **Gatilho:** só `workflow_dispatch`, disparado com `gh workflow run deploy --ref main` ou pela aba Actions ("Run workflow"). Publica a ponta da `main` no momento do disparo (`github.sha`): checkout, `SENTRY_RELEASE` e `VITE_SENTRY_RELEASE` usam esse SHA. Sem input de SHA: para voltar atrás, usa-se o rollback (runbook, seção 3) ou um revert na `main`.
  2. **Guarda (job `conferir`, sem segredo, sem environment, só `actions: read`):** roda só com `vars.DEPLOY_ATIVO == 'true'` e `github.ref == 'refs/heads/main'`. Pela API do GitHub (`gh api .../actions/workflows/ci.yml/runs?head_sha=<sha>&branch=main&event=push`), exige o run do `ci` desse SHA com `status == completed` e `conclusion == success`. Sem run, em andamento, vermelho ou cancelado, falha com `::error` explicando o motivo. O `publicar` depende do `conferir`.
  3. **Environment:** só o `producao` (segredos, regra de branch só da `main`, sem revisor). O `producao-aprovacao` sai do desenho e não é criado na etapa 17.
- **Inalterado:** a ordem fixa, o rollback, a concorrência, a inércia por `DEPLOY_ATIVO`, os segredos só nos passos, as ações fixadas por SHA e o `wrangler deploy` único (G-42).
- **Consequência:** a decisão humana agora é o próprio disparo. Quem tem permissão de escrita no repositório pode publicar, desde que o CI do commit esteja verde (RA-07: o projeto tem uma pessoa só). Um push na `main` não publica mais nada sozinho.

## Emenda de 2026-10-28: padrão do Neon (ADR-017)

- **Decisão do usuário (2026-10-28):** o Neon tem só as branches permanentes `main` e `dev`. O passo 3.3 (branch
  `restauracao-<run>-<tentativa>`, mantendo as 2 mais novas) sai do `deploy.yml`, com o script `restauracao-neon.ts`, os
  testes dele e a `NEON_API_KEY`/`NEON_PROJECT_ID` do environment `producao`. A ordem passa a ser: endereço do Asaas,
  build, cache do Hyperdrive, dump cifrado, migração com o owner, `wrangler deploy` e saúde. Falha depois da migração
  aponta só o artefato `dump-predeploy-<run>-<tentativa>`.
- **Inalterado:** o resto da ordem fixa, o dump com o `backup_ro`, o rollback do Worker, a concorrência e a inércia
  por `DEPLOY_ATIVO`.

## Emenda de 2026-10-29: o que a produção confirmou (17c)

- **CPU do Worker publicado (RNF-04):** medida pela API de análise da Cloudflare, janela de 24 h e 261 requisições:
  p50 7,07 ms e **p99 44,14 ms, acima do teto de 10 ms**. A causa da cauda não foi investigada (a medição por rota,
  T18, foi dispensada). **Decisão do usuário (2026-10-29): aceitar o risco.** O RNF-04 fica "aceito com p99 acima do
  teto", não "atendido"; reavaliar na 17d com tráfego de pessoas reais.
- **Deploy e rollback:** o primeiro deploy de produção, a fumaça e o ensaio de rollback do Worker (7 s) funcionaram.
- **Backup e purga:** `backup.yml` e `purga.yml` rodaram verdes em produção com os secrets `NEON_URL_BACKUP` e
  `NEON_URL_OWNER`; o artefato do backup tem retenção de 30 dias. **A restauração do backup real não foi ensaiada**
  (T13 e T14 aprovadas pelo usuário sem execução): RTO e RPO não medidos.
- **Asaas:** o endereço vem da variável `ASAAS_API_URL` com lista permitida (sandbox ou produção; T17). O token do
  webhook do Worker foi trocado e **não está alinhado com o painel do Asaas**; a chave de produção não foi verificada
  de forma independente. Ambos ficam para a 17d.

