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

## Alteração manual: plano Pro na conta de teste do usuário (2026-10-28, fora das tarefas)

- Pedido do usuário: deixar a conta de teste dele com o plano ativado, sem expiração do período grátis.
- Como o plano é calculado (`dominio/plano.ts`): `situacao = 'ativa'` dá Pro sem checar prazo. Ajuste feito: `app.assinatura` do lar do titular com `situacao = 'ativa'` e `periodo_ate = null` (sem assinatura nem cobrança no Asaas, então nenhum webhook ou cron a rebaixa).
- Execução pelo próprio usuário, em produção, com a role `neondb_owner` (única com `BYPASSRLS`; `controle_owner` não enxerga `membro` nem `assinatura` por causa da RLS forçada, o que parecia "tabela vazia"). `pg_stat_user_tables` mostrou 1 linha em `usuario`, `lar`, `membro` e `assinatura`.
- Script de uso único, fora do repositório, que só confirma se atualiza exatamente 1 linha de titular e confere role e banco antes. O estado anterior ficou com o usuário (para desfazer).
- Resultado relatado pelo usuário: o app mostra o plano ativado em Meu plano. Não recebi a saída do script nem o estado anterior.
- Cuidado: não usar "Assinar" nessa conta, para não misturar assinatura manual com cobrança real do Asaas.
- Lição para o runbook: para ler ou ajustar tabelas com RLS forçada em produção, a role do editor precisa ser `neondb_owner` (e o banco `controle`); com `controle_owner` as tabelas parecem vazias.

## T5 — CORREÇÃO (2026-10-28): a evidência acima não vale, a T5 foi reaberta

- Ao preparar o ensaio de rollback (T7), a lista de versões do Worker (`wrangler deployments list --json`) não mostrou nenhuma versão "Secret Change" depois do deploy das 17:48, e a troca do token do webhook deveria ter criado uma.
- O usuário então mostrou o que rodou: `wrangler secret put` direto no PowerShell, que respondeu "O termo 'wrangler' não é reconhecido". O `wrangler` só existe dentro do pacote `backend/api`; o comando certo é `pnpm --filter @controle/api exec wrangler secret put ASAAS_WEBHOOK_TOKEN -c ../../wrangler.jsonc`. **O token novo não foi gravado no Worker.**
- Portanto o "200" do teste com o token novo e o registro do token "nos dois lados" **não estão provados**. Não se sabe também o que foi configurado no painel do Asaas. A prova da chave de produção (`GET /v3/finance/balance` → 200, relato do usuário) fica sem verificação independente.
- Estado correto: T5 **aberta**. Refazer gravando no Worker pelo comando completo, regravar o mesmo valor no Asaas, e provar com o `curl` (200 com o token novo, 401 com o errado) **e** conferindo que a lista de versões do Worker mostra a nova "Secret Change".
- Lição: conferir pelo estado do sistema (versões do Worker), não só pelo relato do resultado; o ensaio de rollback só roda depois de a T5 ficar correta, porque a versão guarda os segredos.

## T5 — Refeita em parte (2026-10-28, 18:36Z)

- Token novo do webhook (43 caracteres) gerado e gravado no Worker pela sessão do Claude, com a confirmação do usuário, sem aparecer na conversa: `Success! Uploaded secret ASAAS_WEBHOOK_TOKEN`. **Prova pelo estado do sistema:** a lista de versões do Worker ganhou a versão `95f09291` (18:36, "Secret Change"), e o endpoint continua dando `401` com token errado e `{"ok":true}` no `/api/health`.
- Painel do Asaas (produção): o usuário relata ter colado o token na configuração do webhook (URL `https://controleemcasa.ljssoftware.com.br/api/webhooks/asaas`, versão da API v3, envio não sequencial, eventos de cobrança e assinatura). A área de transferência tinha depois 60 caracteres = a URL do webhook, que o usuário copiou em seguida, o que explica a diferença.
- **Não provado:** que o valor do Asaas é idêntico ao do Worker (o campo do Asaas é mascarado, e o token saiu da área de transferência). Um segundo comando de teste automatizado foi bloqueado pelo sistema de permissões e não foi contornado. A prova definitiva é o primeiro evento real do Asaas (17d), ou refazer o passo com o teste `200`/`401` feito antes de copiar outra coisa.
- **Não verificado de forma independente:** a chave de produção do Asaas (`GET /v3/finance/balance` → 200 é só relato do usuário, e o relato do 200 do webhook, feito antes, se mostrou falso). Refazer a consulta no fechamento (T16) ou antes.
- T5 segue **aberta** nesses dois itens; não bloqueia o ensaio de rollback (T7), cujo estado dos segredos agora está estável.
