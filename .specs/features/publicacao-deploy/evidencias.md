# Evidências — 17c (primeiro deploy e medições)

Sem segredo: só links, nomes e resultados.

## T1 — Push com a suíte verde (2026-10-28)

- Trava de testes (`trava-testes.py --rodar`) verde no `725ab5c`. A primeira rodada reprovou `fixas-isolamento.test.ts` (erro não capturado; o arquivo passa isolado, 9 de 9); a segunda, com a saída gravada, ficou verde.
- Push da `main` com confirmação do usuário: `9303d12..a3edf15`, depois `a3edf15..725ab5c`.
- `ci` do `a3edf15` falhou (execução 40726482091), duas causas, ambas corrigidas:
  - `e2e-pilha`: o `routes` com `custom_domain` (17a) fazia o `wrangler dev` usar o domínio de produção como host e o CSRF recusava cadastro e login locais. Provado comentando a `routes` (2 e2e passaram). Correção: `--local-upstream localhost:<porta>` no `frontend/web/e2e-pilha/global.ts` (`6f4cf81`). O `ci` já falhava assim desde o `9303d12`.
  - `banco`: `lancamentos-consultas.test.ts` (CA-02.1) procurava a substring `'777'` e um UUID aleatório a continha. Alteração aprovada pelo usuário: busca o `777` como valor JSON (`/[:,[]777[,}\]]/`), mesma afirmação (`725ab5c`).
- `ci` do `725ab5c` **verde** nos 5 jobs (e2e-pilha, e2e-web, base, banco, gitleaks): https://github.com/leandrosegheto17/ControleEmCasa_LJS/actions/runs/40734763157

## T2 — Conferência antes de ligar o deploy (2026-10-28)

- Secrets do Worker `controle-em-casa` (só nomes): `ASAAS_API_KEY`, `ASAAS_WEBHOOK_TOKEN`, `CHAVE_HMAC`, `RESEND_API_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_PUBLIC_KEY`, `VAPID_SUBJECT`. Sem `SENTRY_DSN` (T14 da 17b adiada, o Worker roda inerte).
- Environment `producao`, secrets: `ASAAS_API_KEY`, `CLOUDFLARE_API_TOKEN`, `DATABASE_URL_BACKUP`, `DATABASE_URL_OWNER`, `NEON_API_KEY`. Variáveis: `AGE_RECIPIENT`, `ASAAS_API_URL`, `CLOUDFLARE_ACCOUNT_ID`, `NEON_PROJECT_ID`. Sem `VITE_SENTRY_DSN` (mesma razão).
- Variáveis de repositório: nenhuma. As flags `DEPLOY_ATIVO`, `BACKUP_ATIVO` e `PURGA_ATIVA` estão desligadas.
- `wrangler deploy --dry-run` (wrangler 4.152.0): aceitou a configuração, com Hyperdrive `8ebd6378…` e os 3 `ratelimits` (`LIMITE_ENTRAR` 10/60 s, `LIMITE_PUBLICO` 30/60 s, `LIMITE_WEBHOOK` 60/60 s); pacote de 2264 KiB (419 KiB gzip). O dry-run é local: **não prova** que o plano Free aceita o binding `ratelimits`; essa prova fica para o deploy real (T3), e a TC só entra se ele recusar.
- Os valores `URL_PUBLICA`, `AMBIENTE` e `ASAAS_API_URL` do `wrangler.jsonc` são de desenvolvimento (localhost, local, sandbox); o `deploy.yml` os troca por `--var` no deploy.
