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

## T7 — Ensaio de rollback do Worker (2026-10-28)

- Confirmação específica do usuário. Para ter duas versões do app, um segundo deploy do mesmo commit `725ab5c` (execução verde: https://github.com/leandrosegheto17/ControleEmCasa_LJS/actions/runs/40747832727) gerou a versão B `92a2b64f`.
- Versões em ordem: `9a2ade0e` (deploy 1, 17:48) → `95f09291` (segredo `ASAAS_WEBHOOK_TOKEN`, 18:36, mesmo código) → `92a2b64f` (deploy 2, 18:45). Alvo do rollback: `95f09291`, mesmo código e mesmos segredos atuais, para não desfazer o token do webhook.
- `wrangler rollback --message "…" -y` (sem terminal interativo): escolheu sozinho a versão anterior, `SUCCESS Worker Version 95f09291… has been deployed to 100% of traffic`; `/api/health` 200 nas 3 tentativas seguidas. Deployment registrado 18:46:23.
- Volta: `wrangler rollback 92a2b64f-… --message "…"` em **7 s**, `SUCCESS`, `/api/health`, `/` e `/app/` em 200; versão ativa final `92a2b64f` (18:46:45).
- Resolvido o `[A VALIDAR NA ETAPA 17]` do runbook 3.1 (modo não interativo): funciona. Runbook atualizado, com o cuidado de que reverter uma versão anterior a uma troca de segredo desfaz o segredo.
- Não ensaiado: o rollback automático do `deploy.yml` quando a fumaça falha (só roda com falha; o mesmo comando, com o mesmo token da Cloudflare, foi provado agora pelo terminal).

## T8 — CPU do Worker publicado (2026-10-29)

- `pnpm --filter @controle/scripts medir-cpu-publicado` (token de leitura de Analytics no terminal do usuário, nunca na conversa): janela 24 h, **261 requisições**, CPU por requisição **p50 7,07 ms | p99 44,14 ms | teto 10 ms**. Saída do script: **ACIMA do teto (RNF-04)**, código de saída 1.
- **Validado:** o dataset `workersInvocationsAdaptive` e os campos `quantiles.cpuTimeP50`/`cpuTimeP99` e `sum.requests` respondem na Cloudflare real; o `[A VALIDAR NA 17C]` do dataset e dos campos está resolvido. O script não precisou de correção.
- **Veredito:** teto estourado no p99 (4,4 vezes o teto); o p50 está dentro (70% do teto). Pela tarefa, abre-se o ajuste de CPU (T18) antes de aprovar a feature.
- **Limites desta medição:** a janela mistura fumaça do deploy, cadastro, login e uso manual; o dataset não separa por rota, então não diz o que causa a cauda. Candidatos a investigar: hash da senha no cadastro e no login, retomada a frio do isolate, a primeira conexão com o banco pelo Hyperdrive. Isso é hipótese, não medida.

## T18 — Decisão do usuário sobre a CPU (2026-10-29)

- O usuário **aceitou os tempos medidos na T8** (p50 7,07 ms; p99 44,14 ms; teto 10 ms), sem a medição por rota que a T18 previa. Decisão do usuário, registrada como foi dada.
- **Risco aceito, não eliminado:** a causa da cauda do p99 não foi identificada. Requisições acima de 10 ms de CPU podem falhar no plano Free do Workers (erro 1102) ou, se a Cloudflare mudar o limite, passar a falhar. A medição por rota (janelas curtas com `JANELA_HORAS`) segue disponível se o p99 piorar com mais tráfego.
- **Pendente para a T16:** anotar o aceite no ADR-015 e manter o RNF-04 registrado como "aceito com p99 acima do teto" (não como atendido). Reavaliar na 17d, com tráfego de pessoas reais.

## T10 — Lighthouse no app publicado (2026-10-29)

- Lighthouse **11.7.1** (versão fixada, a última com a categoria PWA), perfil padrão de celular (moto g power, 4G simulado), Chrome headless, contra `https://controleemcasa.ljssoftware.com.br/` e `/app/` (que redireciona para `/entrar?volta=%2Fapp%2F`, sem sessão). Relatórios JSON fora do git (pasta temporária).

| Caminho | PWA | Desempenho | Acessibilidade | Boas práticas | SEO |
|---|---|---|---|---|---|
| `/` (landing) | **100** | 59 | 100 | 93 | 92 |
| `/app/` → Entrar | **100** | 57 | 100 | 93 | 92 |

- **Meta cumprida:** PWA ≥ 90 nos dois caminhos.
- **Desempenho (fora da meta da tarefa, registrado):** FCP 7,0 s e LCP 7,7 s na landing (7,5 s e 8,3 s no app), TBT 10 ms, CLS 0. O servidor responde em 20 a 50 ms; a lentidão vem de **recursos que bloqueiam a renderização** (economia estimada de 2,6 s) e de JavaScript não usado (56 KiB), sob a simulação de celular lento com CPU reduzida. Não é a meta de Início ≤ 2 s da T9, que se mede no navegador real, sem essa simulação.
- Sem ajuste aberto: a nota que a tarefa exige (PWA) passou. O desempenho fica como candidato a melhoria futura.

## T12 — Backup diário ligado e primeiro backup (2026-10-29)

- Secrets novos no environment `producao`, criados pelo usuário no terminal dele: `NEON_URL_OWNER` (11:03Z) e `NEON_URL_BACKUP` (11:04Z), só nomes e datas conferidos (`gh secret list --env producao`). Os antigos (`DATABASE_URL_OWNER`, `DATABASE_URL_BACKUP`, `NEON_API_KEY`) e a variável `NEON_PROJECT_ID` seguem lá, a apagar depois do backup e da purga verdes (decisão do usuário).
- Com a confirmação específica do usuário: `gh variable set BACKUP_ATIVO --body true` e `gh workflow run backup.yml --ref main`.
- Execução: https://github.com/leandrosegheto17/ControleEmCasa_LJS/actions/runs/40862690411 — **success**; todos os passos verdes, incluindo "Dump cifrado do banco de produção"; passo de alerta pulado. A validação única da URL (`validarUrlNeon`) aceitou o `NEON_URL_BACKUP`.
- Artefato `backup-2026-10-29-40862690411-1`: **178.587 bytes**, criado 2026-10-29 11:06:54Z, expira 2026-11-28 11:06:53Z (**30 dias**), não expirado.
- Agendamento diário (04:00 BRT) ativo a partir de agora. Falta o download do artefato para o ensaio da T13.

## T15 — Purga diária ligada e primeira execução (2026-10-29)

- Com a confirmação específica do usuário: `gh variable set PURGA_ATIVA --body true` e `gh workflow run purga.yml --ref main`.
- Execução: https://github.com/leandrosegheto17/ControleEmCasa_LJS/actions/runs/40863106175 — **success**, usando o `NEON_URL_OWNER` novo (a validação única aceitou a URL e a conexão com o Neon funcionou).
- Resultado do script (JSON do log): `purga_concluida` com **zero em tudo** (`exclusoes_purgadas`, `lares_apagados`, `ex_membros_purgados`, `contas_nao_confirmadas`, `sessoes`, `tokens`, `tentativas`, `webhook_eventos`; `linhas: {}`) e **`falhas: 0`**. Era o esperado: nenhuma conta em janela de exclusão. Nada foi apagado.
- Agendamento diário (05:00 BRT) ativo a partir de agora.
- **Avisos para a T16 e a 17d:**
  - O `pg` avisa que `sslmode=require` hoje equivale a `verify-full` e vai mudar para a semântica fraca do libpq na próxima versão maior (pg 9). Opção: gravar `sslmode=verify-full` nas URLs do Neon (a validação única já aceita) ou fixar a versão do `pg`.
  - A purga usa `ASAAS_API_URL` = sandbox com `ASAAS_API_KEY` = chave de produção. Com zero cancelamentos a execução não tocou o Asaas, mas, quando houver conta a purgar, a chave de produção contra o endereço do sandbox não vai autenticar. Alinhar os dois antes da 17d.

## T5 — Lado do Worker provado (2026-10-29, 11:14Z)

- Token novo (43 caracteres, `RandomNumberGenerator` de 32 bytes em base64url) gerado no terminal do usuário e gravado no Worker por `wrangler secret put ASAAS_WEBHOOK_TOKEN` via stdin, sem passar pela conversa. **Prova pelo estado do sistema:** a lista de versões do Worker ganhou a versão `4faa816e` em 2026-10-29T11:14:43Z (a anterior era de 2026-10-28T21:46Z).
- Teste do usuário, com o mesmo token da sessão, evento fictício `evt_teste_17c_2` (`PAYMENT_CREATED`, cobrança inexistente): **com token → 200** (`{"ok":true,"resultado":"ignorado"}`, sem efeito em nenhuma conta) e **token errado → 401**. Os dois primeiros testes deram 400 por causa do corpo: faltava `dateCreated` (obrigatório) e, depois, o PowerShell 5.1 removeu as aspas do JSON passado ao `curl.exe`; a rota autenticou nos dois casos. Lição para o runbook: no PowerShell 5.1, enviar o JSON por arquivo (`--data-binary "@arquivo"`, gravado com `-Encoding ascii`).
- Fica um registro de idempotência de teste em `webhook_evento` (`evt_teste_17c_2`), removido pela limpeza dos 12 meses.
- **Ainda não provado:** (1) o token no painel do Asaas é idêntico ao do Worker (campo mascarado; a prova real é o primeiro evento enviado pelo Asaas, na 17d); (2) a chave de produção (`GET /v3/finance/balance` → 200) com consulta feita ou verificável por mim.

## T5 — Token do painel do Asaas fora de sincronia, decisão do usuário (2026-10-29)

- O token do Worker foi trocado em 2026-10-29T11:14Z (versão `4faa816e`) e o painel do Asaas **continua com o token anterior**: os dois estão diferentes. Foi consequência do teste de prova do lado do Worker.
- Decisão do usuário: **deixar o alinhamento para a 17d**. Sem cobrança real o Asaas não envia evento, então não há impacto até lá. Risco: um evento real antes do alinhamento recebe 401 e o Asaas pode pausar a fila do webhook.
- **Pendência obrigatória da 17d, antes da primeira cobrança real:** gravar um token novo no Worker e colar o mesmo no painel do Asaas na mesma sessão, repetir o teste 200/401 (JSON por arquivo, no PowerShell 5.1) e confirmar o primeiro evento real.
- Chave de produção (`GET /v3/finance/balance` → 200): não verificada de forma independente; refazer na 17d junto com o passo acima.

## T11 — UptimeRobot (2026-10-29)

- Conferência feita só por mim: `GET https://controleemcasa.ljssoftware.com.br/api/health` → `200`, `{"ok":true}`, 62 ms.
- **Monitor, estado verde e alerta de queda: não verificados.** O usuário pediu para considerar a tarefa checada, sem enviar relato, captura, intervalo nem o horário do e-mail de queda. Registro como **aceite do usuário, sem evidência**; nada disso foi visto por mim.
