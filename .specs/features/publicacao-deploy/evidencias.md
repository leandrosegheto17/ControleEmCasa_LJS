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

## T3 — Primeiro deploy de produção (2026-10-28)

- Confirmação específica do usuário para ligar `DEPLOY_ATIVO=true` (variável de repositório) e disparar `gh workflow run deploy --ref main`.
- Execução verde, commit `725ab5c`, na primeira tentativa: https://github.com/leandrosegheto17/ControleEmCasa_LJS/actions/runs/40738869128
  - `conferir` (CI verde no commit via `gh api`, `actions: read`) e `publicar` com os passos 1 a 7 verdes; o rollback foi pulado.
  - Passo 2: `Cache do Hyperdrive desligado.` (fecha a ressalva da T6 da 17b: o Hyperdrive `8ebd6378…` existe na Cloudflare).
  - Passo 3: `Branch de restauração criada: restauracao-40738869128-1; antigas apagadas: 1.`
  - Passo 4: dump cifrado `dump-predeploy-40738869128-1` (artefato).
  - Passo 5: `No migrations to run!` (a `main` do Neon já estava migrada na 17b).
  - Passo 6: Worker `controle-em-casa` publicado, versão `9a2ade0e-970b-439c-ac81-f9305e021e0a`, com o domínio custom `controleemcasa.ljssoftware.com.br` e os crons `0 * * * *` e `30 6 * * *`.
  - Passo 7: `/api/health` → `{"ok":true}`. A 1ª tentativa não resolveu o DNS (domínio novo) e a repetição automática passou.
- **Prova do escopo do `CLOUDFLARE_API_TOKEN`:** o mesmo token fez o `cache-hyperdrive`, o `wrangler deploy` (Worker, assets, domínio custom e crons). Escopo declarado na 17b (Workers Scripts Edit, Hyperdrive Edit, Workers Routes Edit, Zone Read) é suficiente.
- **Prova do `ratelimits` no Workers Free:** o `wrangler deploy` publicou com os 3 bindings (`LIMITE_ENTRAR` 10/60 s, `LIMITE_PUBLICO` 30/60 s, `LIMITE_WEBHOOK` 60/60 s). **A TC (plano B) é dispensada.** Ainda não provado: que o limite efetivamente recusa na produção (só o binding existe).

## T4 — Fumaça no domínio publicado (2026-10-28, `curl` de fora do GitHub)

- `https://controleemcasa.ljssoftware.com.br/api/health`: `200`, `{"ok":true}`, `Cache-Control: no-store`, `Strict-Transport-Security: max-age=31536000; includeSubDomains`, `Content-Security-Policy: default-src 'none'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'`.
- `/` → 200 `text/html`, verificação do TLS ok (`ssl_verify_result=0`); `/app/` → 200 `text/html`; `/termos` → 200.
- `/api/sessao` sem cookie → 401 `sessao_expirada` (esperado). **Não prova** o caminho Worker → Hyperdrive → Neon; isso é provado pelo cadastro real da T6.

## T6 — E-mail real do Resend em produção (2026-10-28)

- Relato do usuário (ação manual no app publicado, e-mail dele; nenhum endereço, senha nem link registrado aqui): cadastro com aceite dos termos, e-mail de confirmação recebido e confirmado, lar criado, "esqueci minha senha" com e-mail de recuperação recebido, senha redefinida e novo login com a senha nova, tudo sem erro.
- Os **dois e-mails chegaram na caixa de entrada**, não no spam. Isso melhora a ressalva da 17b (a T13 da 17b registrou um teste que caiu no spam); a reputação do domínio segue por observar quando houver mais envios e outros provedores de e-mail.
- Prova indireta de que o caminho Worker → Hyperdrive → Neon funciona na produção: cadastro, confirmação, criação do lar e login gravam e leem no banco.

## T5 — Webhook do Asaas e chave de produção (2026-10-28)

- Rota `POST /api/webhooks/asaas` existe em produção e recusa sem token e com token errado: `401` nos dois casos (corpo `{"code":"token_invalido","message":"Não autorizado."}`), conferido de fora antes da troca.
- Token novo do webhook (43 caracteres, gerado com `crypto.randomBytes(32)` em base64url) gravado pelo usuário, sem passar pela conversa: no Worker (`wrangler secret put ASAAS_WEBHOOK_TOKEN`) e no painel do Asaas de produção (URL `https://controleemcasa.ljssoftware.com.br/api/webhooks/asaas`, eventos de cobrança e de assinatura).
- Prova do token novo: evento fictício `evt_teste_17c` (`PAYMENT_CREATED` de uma cobrança inexistente) enviado pelo usuário com o token novo → `200`. Fica um registro de idempotência de teste em `webhook_evento`, que a limpeza dos 12 meses remove.
- Chave de produção do Asaas: `GET /v3/finance/balance` (só leitura) → `200`, relato do usuário. Prova que a chave é válida; **não prova** que é idêntica à gravada no Worker e no environment `producao` (a primeira cobrança real, na 17d, confirma).
- Ainda não provado: entrega de um evento real do Asaas ao Worker (o Asaas só dispara eventos de cobranças reais; fica para a 17d).
