# GUARDRAILS.md — Controle em Casa

- **Status:** Aprovado pelo usuário em 2026-10-24 (etapa 0). Ainda não existe código: cada checagem nasce na etapa do `PLANO.md` indicada entre parênteses.
- **Base:** `.md/ANALISE-MYMONEY.md` e `.md/PLANO.md` (decisões P1–P9), `.md/THREAT-MODEL.md`, padrão LJS, `GUARDRAILS.md` do MyMoney (G-01…G-20), `SECURITY-REVIEW.md` do MyMoney (RTPs citados) e ADRs 002, 012 e 013 do legado.
- **Como ler:** cada regra é curta e verificável. **Verificação** diz o que roda: teste, lint, passo de CI ou revisão. **Origem** diz de onde a regra vem: G-xx do legado (`L-G-xx`), RTP do legado, padrão LJS (`LJS`) ou ameaça (`TM-xx`, ver `THREAT-MODEL.md`).
- **Termos:** "tabela de negócio" é toda tabela com `lar_id`. "Tabela de identidade" é `usuario`, `sessao`, `tentativa_login`, `token_email`, `convite`, `aceite_termos`, `webhook_evento` e `push_subscription`.

## Governança

- Mudar, afrouxar ou abrir exceção a uma regra exige uma linha no Log de Alterações, com aprovação do usuário e validade (data ou condição). Exceção sem validade não vale.
- Desligar uma checagem conta como exceção à regra que ela protege. Exemplos: tornar opcional o job de isolamento, `eslint-disable` de regra de segurança, adicionar host à CSP, entrada nova no `.gitleaksignore`, aumentar a tolerância do teste de tempo de resposta.
- Uma regra sem checagem automática diz "revisão" e entra na lista de conferência do PR.

---

## A. Dados e isolamento

**G-01 — RLS com FORCE em toda tabela de negócio.** Toda tabela com `lar_id` tem `ENABLE` e `FORCE ROW LEVEL SECURITY` e uma política para cada comando concedido. Nenhuma política é `using (true)` ou `with check (true)`.
- *Verificação:* teste de catálogo (Vitest contra o Postgres 18 do CI) lê `pg_class.relforcerowsecurity` e `pg_policies`. Vale para tabelas futuras, porque falha com qualquer tabela nova que tenha `lar_id` sem FORCE. (Etapas 2 e 6)
- *Origem:* L-G-01; ADR-002 §2 do legado; LJS.

**G-02 — Identidade por GUC só dentro da transação.** A API abre uma transação por requisição autenticada. O primeiro comando é `select set_config('app.usuario_id', $1, true), set_config('app.lar_id', $2, true)`. São proibidos `set_config(..., false)`, `SET` sem `LOCAL` e consultas de negócio fora dessa transação. As políticas leem `nullif(current_setting('app.usuario_id', true), '')::uuid`: GUC ausente ou vazio nega o acesso. O cache de consultas do Hyperdrive fica desligado.
- *Verificação:* (a) lint/grep no CI recusa `set_config(` com `false` e `SET app.` sem `LOCAL`; (b) teste de API com 2 requisições concorrentes de lares diferentes no mesmo pool; (c) teste que, depois do commit, lê o GUC na mesma conexão e espera `''`/`NULL` e 0 linhas; (d) teste com GUC vazio e GUC ausente: 0 linhas, nunca todas; (e) passo do `deploy.yml` confere `caching.disabled = true` no Hyperdrive. (Etapas 2, 3 e 16)
- *Origem:* LJS; risco R2; TM-DB-01.

**G-03 — O lar vem da sessão e é validado a cada requisição.** `app.usuario_id` vem só da sessão. `app.lar_id` é lido de `membro` para esse usuário dentro da mesma transação, nunca do corpo, da query nem de cabeçalho. Usuário sem vínculo ativo não acessa rota de negócio.
- *Verificação:* teste de API envia `lar_id` alheio no corpo e na query (ignorado); teste com o membro removido no meio da sessão: a requisição seguinte recebe `registro_invalido`/403. (Etapa 6)
- *Origem:* risco R3; ADR-012 do legado, adaptado (sem SECURITY DEFINER); TM-API-02.

**G-04 — Papéis de banco com menor privilégio.** `owner` é dono do schema e só roda migrations. `app` não tem `SUPERUSER`, `BYPASSRLS`, `CREATE` nem DDL, e não tem `DELETE` nas tabelas em que excluir não é regra (`despesa_fixa`, `meta`, `movimento_meta`, `aceite_termos`, `webhook_evento`). `backup_ro` só tem `SELECT`, **sem** `BYPASSRLS`: lê por uma política `backup_leitura` (`for select to backup_ro using (true)`) com `pg_dump --enable-row-security` (SDD D-06), e nunca é usado pela API. Não existe função `SECURITY DEFINER` no schema da aplicação.
- *Verificação:* teste conectado como `app` tenta `CREATE TABLE`, `ALTER`, `DROP`, `DELETE` em tabela protegida e `SET row_security = off`: todos falham. Teste de catálogo: `rolbypassrls` falso para `app` e zero funções `prosecdef` fora de extensões. (Etapa 2)
- *Origem:* LJS; L-G-03 (a lista fechada do legado passa a ser vazia); PLANO, decisão 1.

**G-05 — Teste negativo de isolamento por rota é obrigatório e bloqueia o deploy.** Toda rota de negócio tem casos em que o usuário do lar B tenta ler, listar, contar, filtrar, alterar e excluir dado do lar A, e o membro tenta o mesmo com o individual do outro membro do lar.
- *Verificação:* meta-teste enumera as rotas registradas no Hono e falha se alguma não tiver caso em `isolamento/`. Job `isolamento` obrigatório no CI e pré-requisito do `deploy.yml`. (Etapas 3, 6 a 10 e 13)
- *Origem:* L-G-04; LJS; TM-API-01.

**G-06 — Erro uniforme.** "Não existe", "é de outro lar" e "é individual do outro membro" devolvem o mesmo `registro_invalido`, com o mesmo status e o mesmo corpo. A ordem de recusa é `registro_invalido` antes de `*_arquivada`.
- *Verificação:* helper `esperarRegistroInvalido` em todos os casos de isolamento; teste da ordem das recusas. (Etapa 7)
- *Origem:* L-G-05; ADR-002 §5 do legado.

**G-07 — Referências amarradas a dono e lar no banco.** Toda FK para `categoria`, `conta`, `forma_pagamento`, `meta` e `lancamento` é composta com `lar_id` e, nos itens individuais, com `dono_id`, para que o banco recuse referência a item de outro lar ou de outro dono mesmo que a API falhe.
- *Verificação:* teste de banco como `app` insere lançamento com categoria de outro lar, conta do outro membro e forma alheia: viola a FK. Teste de catálogo lista as FKs compostas esperadas. (Etapas 6 a 8)
- *Origem:* RTP-0026; risco R3.

**G-08 — Escopo, dono e lar são imutáveis pela API.** O escopo vem da categoria, nunca do cliente. `lar_id`, `dono_id` e `escopo` não são atualizáveis pela role `app` (grant de `UPDATE` por coluna). Uma meta ou orçamento conjunto não vira individual, e vice-versa.
- *Verificação:* teste de banco: `UPDATE ... SET escopo/dono_id/lar_id` como `app` falha por permissão. Teste de API: editar meta conjunta mandando `escopo: 'individual'` é recusado pelo Zod `.strict()`. (Etapas 7 e 10)
- *Origem:* RTP-0021; regra "Escopo" (ANALISE §2.2).

**G-09 — Teste nunca roda contra produção.** Testes e seeds só usam `localhost`/Postgres de serviço do CI. Credenciais de produção existem só no environment `producao` e só nos jobs do `deploy.yml` e do `backup.yml`.
- *Verificação:* o helper de testes recusa host que não seja local; passo de CI falha se um job fora desses dois referenciar `secrets.` de produção. (Etapa 1)
- *Origem:* L-G-06.

## B. Privacidade entre membros

**G-10 — Dado privado mora em tabela própria.** Forma, conta, `data_operacao`, `data_ajustada` e `dia_vencimento_aplicado` ficam em `lancamento_pagamento`, e a conta do movimento da meta fica em `movimento_conta`. As duas têm política só do dono. Esconder coluna em consulta não substitui a separação.
- *Verificação:* teste de banco: como o outro membro, `SELECT * FROM lancamento_pagamento` de uma conjunta devolve 0 linhas. Revisão do modelo no SDD. (Etapas 6 e 8)
- *Origem:* ADR-002 §1 do legado; RN-04.

**G-11 — Chave privada omitida, não `null`.** Para quem não é o pagador, as respostas não contêm as chaves `forma_pagamento_id`, `conta_id`, `data_operacao`, `data_ajustada` nem o id de `lancamento_pagamento`. A chave não existe no JSON, nem com valor `null`. Os schemas de resposta do outro membro são `.strict()` e não declaram essas chaves.
- *Verificação:* teste de API com `expect(Object.keys(item)).not.toContain(...)` no detalhe, na lista, no resumo e na resposta de edição feita pelo outro membro; teste de contrato contra os JSON do legado. (Etapa 8)
- *Origem:* RN-04 (ANALISE §2.2); TM-API-04.

**G-12 — Agregação só sobre o que o usuário pode ver.** Todo total, resumo, orçamento, saldo e `pago_por_membro` é uma consulta executada como `app` sob RLS. Dado individual do outro membro nunca altera um número que eu veja.
- *Verificação:* teste "mutação invisível": cria, edita e exclui individual do membro B e confere que nenhuma resposta de A muda (resumo, orçamento, metas, listas, contagens). (Etapas 9 e 10)
- *Origem:* RN-16e do legado; ADR-002 §4 do legado.

**G-13 — Autorização de edição no servidor; ser titular não dá leitura do individual.** As permissões RN-06/07 rodam no `dominio`: um campo sem permissão recusa a edição inteira e o pagamento de fixa é só do pagador. A correção P7 vale: a parcela da fixa fica no vencimento e a categoria continua conjunta. Ser titular só governa convite, plano e exclusão do lar.
- *Verificação:* matriz de testes dono × outro membro × campo (Etapa 8); teste P7 (Etapa 9); teste em que o titular tenta ler conta, forma, meta e lançamento individuais do membro e recebe `registro_invalido` (Etapa 6).
- *Origem:* RN-06/07; P1; P7; L-G-07 (a regra roda no servidor, nunca no navegador).

**G-14 — Convite com token forte, uso único e amarrado ao e-mail.** Token de 256 bits (CSPRNG), guardado como SHA-256, com validade de 7 dias e uso único. Só a conta confirmada com o e-mail convidado aceita. O titular pode revogar. O limite de 2 membros fica garantido no banco. Convite novo invalida o anterior.
- *Verificação:* testes de API: reuso, token expirado, token revogado, aceite com conta de outro e-mail, aceite com o lar cheio (corrida com 2 aceites simultâneos), usuário já membro de outro lar. (Etapa 6)
- *Origem:* LJS; P1; TM-API-06.

## C. Autenticação e sessão

**G-15 — Sessão opaca, cookie `__Host-sid`.** Token de 256 bits de `crypto.getRandomValues`, guardado só como SHA-256. Cookie `__Host-sid; Secure; HttpOnly; SameSite=Lax; Path=/`, sem `Domain` e sem `Max-Age` maior que 12 h. O token nunca aparece no corpo, em log ou em URL.
- *Verificação:* teste do `Set-Cookie` (atributos exatos); teste de banco: a coluna guarda 32 bytes de hash, nunca o token. (Etapa 4)
- *Origem:* LJS.

**G-16 — Validade e revogação da sessão.** Inatividade de 15 min e máximo absoluto de 12 h, verificados no servidor. Sessão nova a cada login (sem reaproveitar cookie anterior). Troca ou redefinição de senha revoga todas as sessões. "Sair" e "sair de todos" revogam no servidor antes de limpar o aparelho; falha de rede mantém o usuário avisado e logado.
- *Verificação:* testes com relógio simulado (14:59 vale, 15:01 expira; 12 h absolutas mesmo com uso); teste de fixação (cookie anterior ao login não vale depois); teste do front de "sair de todos" sem rede. (Etapas 4 e 11)
- *Origem:* LJS; P5; ADR-013 do legado.

**G-17 — Senha com bcrypt no Postgres.** `crypt($1, gen_salt('bf', 12))` e verificação com `crypt($1, senha_hash) = senha_hash`, sempre com a senha como parâmetro, nunca interpolada. Tamanho de 12 caracteres a 72 bytes UTF-8 (o bcrypt ignora o resto). A senha nunca é logada nem devolvida.
- *Verificação:* lint/grep recusa SQL de senha montado com template string; teste de 73 bytes recusado; teste do scrubber de log. (Etapas 2 e 4)
- *Origem:* LJS; L-G-16 (mínimo de 12).

**G-18 — Tokens de e-mail: 256 bits, hash, 30 min, uso único, consumo por POST.** Confirmação de cadastro e redefinição de senha usam token de 256 bits guardado como SHA-256, válido por 30 min e consumido atomicamente. O link leva o token no fragmento (`#t=`), e a tela o envia por `POST`, para que antivírus e pré-visualizadores de e-mail não o consumam e ele não vá para log nem `Referer`. Conta não confirmada não entra no app.
- *Verificação:* testes de reuso, expiração e corrida (2 POST simultâneos: só 1 vence); teste de que `GET` não consome; teste de login com conta não confirmada. (Etapa 4)
- *Origem:* LJS; TM-NAV-05.

**G-19 — Anti-enumeração por resposta e tempo.** Cadastro, entrar, recuperação, reenvio de confirmação e convite respondem com o mesmo status e corpo para e-mail existente ou não. O caminho sem usuário roda bcrypt contra um hash fixo, e o envio de e-mail vai para `ctx.waitUntil`.
- *Verificação:* teste compara corpo e status byte a byte; teste de tempo (mediana de N chamadas) com tolerância fixada no próprio teste. (Etapas 4 e 6)
- *Origem:* LJS; TM-API-07.

**G-20 — Bloqueio e limite de taxa.** 5 falhas em 15 min bloqueiam por e-mail e por IP, com registro na tabela `tentativa_login` (fonte de verdade). Por cima ficam os bindings `LIMITE_ENTRAR` (10/min), `LIMITE_PUBLICO` (60/min) e `LIMITE_WEBHOOK`. O IP vem só de `CF-Connecting-IP`. O limite é checado antes do bcrypt.
- *Verificação:* teste da 6ª tentativa bloqueada (e-mail e IP separados); teste de que `X-Forwarded-For` é ignorado; teste de que o bloqueio não revela se o e-mail existe. (Etapa 4)
- *Origem:* LJS; TM-API-08.

**G-21 — CSRF: SameSite=Lax mais cabeçalho obrigatório.** Todo `POST/PUT/PATCH/DELETE` em `/api/*` exige o cabeçalho `X-Controle-Em-Casa: 1` (SDD §5) e `Origin` igual a `URL_PUBLICA`, inclusive `/api/entrar` (CSRF de login). `GET` nunca altera estado. A API não envia cabeçalhos CORS. O webhook é a única exceção e se autentica por token (G-28).
- *Verificação:* teste por método sem o cabeçalho (403) e com `Origin` alheio (403); meta-teste: nenhuma rota `GET` escreve; teste de ausência de `Access-Control-Allow-Origin`. (Etapa 3)
- *Origem:* LJS; TM-NAV-03.

## D. Entrada e contrato

**G-22 — Toda entrada passa por Zod `.strict()`.** Corpo, query e parâmetros validados pelos schemas de `backend/contrato`, com chave desconhecida recusada, ids `uuid` e todo texto com tamanho máximo (descrição, nome e `local` de até 60).
- *Verificação:* lint: toda rota usa o validador do contrato; teste de contrato com campo extra (400) e texto acima do limite (400). (Etapas 3 e 7)
- *Origem:* LJS; PLANO, decisão 3.

**G-23 — Dinheiro em centavos inteiros com teto.** `bigint` com sufixo `_centavos`; valores de lançamento de 1 a 10^11 no Zod e em `CHECK` do banco; saldo inicial entre −10^11 e 10^11 centavos. Nenhuma coluna `real`, `double` ou `numeric` e nenhum `number` fracionário no contrato.
- *Verificação:* teste de catálogo dos tipos; testes de 0, negativo, 10^11 + 1 e decimal (todos recusados). (Etapas 2, 5 e 7)
- *Origem:* RTP-0039; L-G-10; ADR-004 do legado.

**G-24 — Datas de calendário em São Paulo, com janela.** "Hoje" em America/Sao_Paulo. Toda escrita ou geração por mês (ocorrências de fixas, orçamento, cópia) fica na janela de ±12 meses. Datas de operação e de pagamento têm faixa validada no servidor. Parcelas de 1 a 24, com total ≥ N.
- *Verificação:* testes de borda (mês −13 e +13 recusados, data de pagamento fora da faixa, virada de dia às 23:30 de SP). (Etapas 5 e 9)
- *Origem:* RTP-0045; RTP-0130; L-G-10.

**G-25 — SQL só parametrizado e num só lugar.** Consultas só por Kysely com parâmetros. `sql.raw`, `sql.lit` e concatenação com entrada são proibidos. Só `infraestrutura/` importa `kysely`/`pg`, e só `dados/` no front faz `fetch('/api/…')`.
- *Verificação:* ESLint (`no-restricted-syntax`/`no-restricted-imports`) com fixture de violação. (Etapas 1 e 3)
- *Origem:* L-G-08; LJS.

**G-26 — Idempotência pelo id do cliente; o dono vem da sessão.** Toda escrita leva o id gerado no cliente. Reenvio do mesmo usuário devolve `ja_existia`, e id que pertence a outro devolve `registro_invalido`. Nenhum campo de dono é aceito no corpo.
- *Verificação:* testes de reenvio, de id alheio e de corpo com `dono_id` (recusado pelo `.strict()`). (Etapas 7 e 8)
- *Origem:* L-G-17; regra "Idempotência".

**G-27 — Tamanho de requisição e resposta limitado.** Corpo de no máximo 32 KB; textos livres até 120 caracteres; listas paginadas ou limitadas ao mês; filtros com valores fechados.
- *Verificação:* teste de corpo acima do limite (413); teste de lista sem filtro de mês (400). (Etapas 3 e 8)
- *Origem:* risco R1; TM-API-10.

## E. Cobrança e planos

**G-28 — Webhook Asaas autenticado e isolado.** `POST /api/webhooks/asaas` fica fora da sessão e do CSRF e compara `asaas-access-token` com o segredo em tempo constante. Falha devolve 401 sem detalhe. Passa por `LIMITE_WEBHOOK` e não aceita outro método.
- *Verificação:* testes sem token, com token errado e com token de outro tamanho (401, sem escrita); teste de que o cookie de sessão é ignorado. (Etapa 13)
- *Origem:* LJS; TM-ASA-01.

**G-29 — Webhook idempotente e conferido.** `webhook_evento.event_id` é único; evento repetido devolve 200 sem efeito. A assinatura só muda por transições válidas da máquina de estados (evento antigo não desfaz o novo). Antes de ativar o Pro, o handler confere `externalReference` = assinatura local, valor = preço vigente e `customer` = cliente do lar.
- *Verificação:* testes com `event_id` duplicado, eventos invertidos (`PAYMENT_OVERDUE` depois de `PAYMENT_RECEIVED`), valor divergente e `externalReference` de outro lar. (Etapa 13)
- *Origem:* LJS; TM-ASA-02.

**G-30 — Limites do plano na API, nunca só no front.** `exigePlano('pro')` em toda escrita de orçamento e metas. No Free elas ficam somente leitura, sem apagar nada. O plano é lido no servidor a cada requisição.
- *Verificação:* meta-teste: toda rota de escrita de orçamento e metas tem o middleware; teste com plano Free chamando a API direto (403 `plano_insuficiente`) e leitura preservada. (Etapa 13)
- *Origem:* LJS; P2; TM-API-09.

**G-31 — Assinatura é do lar e só o titular mexe.** O plano deriva do titular. Só o titular assina, gera Pix e cancela. O trial de 14 dias vale uma vez por lar.
- *Verificação:* testes: membro tenta assinar e cancelar (403); segundo trial no mesmo lar recusado. (Etapa 13)
- *Origem:* P2.

## F. Segredos e configuração

**G-32 — Segredo só em GitHub Secrets e `wrangler secret`.** Os segredos de produção ficam no environment `producao` (só a `main`) e em `wrangler secret`. `wrangler.jsonc` e `vars` não têm segredo. `.env.example` lista nomes sem valores. Segredo exposto é trocado, e apagar do código não basta.
- *Verificação:* gitleaks no CI e em todo o histórico; teste de que `.env.example` só tem `NOME=`; teste de que `wrangler.jsonc` não tem chave com nome de segredo. (Etapa 1)
- *Origem:* LJS; L-G-15.

**G-33 — Nenhuma URL absoluta no código.** Links de e-mail, convite, retorno do Asaas e push usam `URL_PUBLICA`. Redirecionamentos internos (`?voltar=`) aceitam só caminho relativo iniciado por `/app/`.
- *Verificação:* grep no CI por `https?://` fora da lista fechada (Sentry, Asaas, Resend, testes); teste de redirecionamento aberto (`//evil`, `/\evil`, `https:`). (Etapas 3 e 11)
- *Origem:* LJS; TM-NAV-06.

**G-34 — Credenciais de terceiros com menor privilégio.** Chave do Resend só de envio, restrita ao domínio. Chave do Asaas com transferência/saque por API desligada no painel. CPF/CNPJ vai ao Asaas e não é guardado nem logado. Hyperdrive com a role `app` e TLS com verificação. `owner` só no passo de migração.
- *Verificação:* revisão na publicação (lista de conferência da etapa 17); teste de que o código não referencia a URL de `owner`. (Etapas 16 e 17)
- *Origem:* TM-RES-01; TM-ASA-03.

## G. Front e PWA

**G-35 — CSP e cabeçalhos no Worker.** `default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self' <ingest do Sentry>; frame-ancestors 'none'; object-src 'none'; base-uri 'none'; form-action 'self'`, sem `unsafe-inline` nem `unsafe-eval` em script. Também `Strict-Transport-Security`, `X-Content-Type-Options: nosniff`, `Referrer-Policy: no-referrer` e `Permissions-Policy` mínima. Sem analytics nem script de terceiros.
- *Verificação:* teste dos cabeçalhos em `/`, `/app/*` e `/api/*`; teste que falha se o bundle tiver host fora da lista. (Etapas 3 e 11)
- *Origem:* L-G-20; LJS.

**G-36 — Texto do usuário nunca vira HTML.** Proibidos `dangerouslySetInnerHTML`, `innerHTML` e `document.write`. Descrição, nome e `local` são exibidos como texto. E-mails escapam todo campo do usuário e não transformam esse texto em link. A notificação push leva só texto fixo.
- *Verificação:* ESLint (`react/no-danger`, `no-restricted-properties`); teste dos templates de e-mail com `<script>` e URL no nome do titular. (Etapas 4, 6, 11 e 15)
- *Origem:* TM-NAV-02.

**G-37 — Sem import dinâmico aberto nem avaliação de código.** `import()` só com string literal (rotas lazy). `eval`, `new Function` e `setTimeout` com string são proibidos.
- *Verificação:* ESLint com fixture de violação, inclusive template literal com variável. (Etapa 1)
- *Origem:* RTP-0008 (e RTP-0014).

**G-38 — Fila offline por usuário.** Cada item da fila guarda o `usuario_id` da sessão que o criou. Só é enviado quando a sessão atual é do mesmo usuário; com outro usuário logado, fica retido e invisível para ele. O servidor ignora qualquer dono vindo do item (G-26). Só lançamento de despesa entra na fila, e nada some sem ação do usuário.
- *Verificação:* teste de unidade da fila; e2e: A enfileira sem rede, sessão expira, B entra no mesmo aparelho e nada é enviado nem exibido; A entra e a fila sai sem duplicata. (Etapa 11)
- *Origem:* L-G-17; P5; TM-NAV-04.

**G-39 — Limpar o aparelho ao sair; o service worker não guarda API.** Ao sair (ou ao receber 401 de sessão revogada), o front limpa o cache do TanStack Query, os dados de API em memória e o IndexedDB exceto a fila do próprio usuário, e remove a `push_subscription` do aparelho. O service worker usa `NetworkOnly` para `/api/*`.
- *Verificação:* teste do front após "sair" (cache vazio, subscription removida no servidor); teste da configuração do Workbox (nenhuma rota `/api` em cache). (Etapas 11 e 15)
- *Origem:* TM-NAV-04; TM-PUSH-02.

## H. CI/CD e dependências

**G-40 — Ações fixadas por SHA e permissões mínimas.** Todo `uses:` aponta para SHA completo de 40 caracteres, com a tag em comentário. `permissions:` vem explícito por workflow com o mínimo necessário. Sem `pull_request_target` e sem `${{ github.event.* }}` interpolado em `run:`.
- *Verificação:* teste/script de CI lê `.github/workflows/*.yml` e falha em violação. (Etapa 1)
- *Origem:* RTP-0055; LJS.

**G-41 — Dependências travadas e com quarentena.** `pnpm-lock.yaml` versionado e `pnpm install --frozen-lockfile` no CI. `minimumReleaseAge` de 1440 min no `pnpm-workspace.yaml`. Scripts de instalação só da lista `onlyBuiltDependencies`. `pnpm audit --audit-level high` falha o CI.
- *Verificação:* teste lê `pnpm-workspace.yaml` (as chaves existem); job de CI. (Etapa 1)
- *Origem:* LJS; TM-GH-02.

**G-42 — Um único `wrangler deploy`.** Só o `deploy.yml` faz deploy, da `main`, com CI verde e environment `producao`. Um teste falha se `wrangler deploy` aparecer em outro arquivo ou mais de uma vez.
- *Verificação:* teste de repositório (grep em todo o versionado). (Etapa 16)
- *Origem:* LJS; L-G-14.

**G-43 — Migração com `owner`, aditiva e depois da cópia.** Ordem fixa: build, branch de restauração no Neon, dump cifrado, migração com `owner` e deploy. As migrations são aditivas: `drop`, `rename` e `alter type` exigem justificativa ligada a uma fase *expand* publicada ou a uma linha do Log.
- *Verificação:* teste da ordem dos passos do `deploy.yml`; passo de CI que detecta migration não aditiva; migrations do zero no Postgres 18 do CI. (Etapas 2 e 16)
- *Origem:* L-G-12; L-G-14; LJS.

**G-44 — Backup cifrado com `age`.** `pg_dump -Fc` com `backup_ro`, cifrado com a chave pública `age` antes de sair do runner, retido por 30 dias. A chave privada nunca entra no GitHub. O dump em claro nunca vai para disco persistente nem para artefato. A restauração é ensaiada e o resultado registrado.
- *Verificação:* teste do workflow (o artefato só sai como `.age`; nenhuma referência à chave privada); registro do ensaio no `docs/runbook.md`. (Etapa 16)
- *Origem:* LJS; TM-GH-03.

## I. Observabilidade e logs

**G-45 — Sentry com limpeza de dados.** `sendDefaultPii: false`. `beforeSend`/`beforeBreadcrumb` removem corpo de requisição, cookies, cabeçalhos `Cookie`, `Authorization` e `asaas-access-token`, e-mails (regex), query strings e fragmentos com token. Release = SHA.
- *Verificação:* teste de unidade do scrubber com evento contendo cada um desses itens. (Etapa 16)
- *Origem:* LJS; TM-OBS-01.

**G-46 — Log sem dado pessoal.** `onError` e logs não registram e-mail, nome, valor, descrição, token, IP completo nem corpo. A resposta de erro é genérica e traz um id de correlação.
- *Verificação:* teste do `onError` com exceção que carrega e-mail e valor; ESLint proíbe `console.log` fora do logger. (Etapa 3)
- *Origem:* LJS.

**G-47 — API sem cache e sem stack.** Toda resposta de `/api/*` tem `Cache-Control: no-store`. Erro 500 não expõe stack, SQL nem nome de constraint.
- *Verificação:* teste de cabeçalho em sucesso e erro; teste de erro de banco forçado. (Etapa 3)
- *Origem:* LJS.

## J. LGPD

**G-48 — Aceite registrado com versão.** O cadastro grava em `aceite_termos` o usuário, a versão dos termos e da privacidade e a data/hora. Uma versão nova exige novo aceite antes de usar o app. O registro não é apagável pela role `app`.
- *Verificação:* teste de cadastro sem aceite (400); teste de versão nova (bloqueia até aceitar). (Etapas 4 e 14)
- *Origem:* LJS.

**G-49 — Exclusão com purga em 30 dias.** A exclusão é confirmada por e-mail, revoga as sessões e as subscriptions na hora, e `backend/scripts/purgar.ts`, agendado no GitHub Actions com a role owner (exceção registrada ao "owner só nas migrations"; ADR 013), purga os dados em até 30 dias. Não existe role `purga`; a role `app` continua sem DELETE onde não é regra. Os backups expiram em 30 dias. Titular com membro ativo: o lar é encerrado com aviso ao membro e some inteiro na purga. Conta em exclusão não reativa (`conta_em_exclusao`); conta não confirmada é apagada após 7 dias.
- *Verificação:* teste do Cron com relógio simulado (dia 29 mantém, dia 30 apaga tudo do usuário, inclusive tokens, tentativas e push); teste do caso titular com membro. (Etapa 14)
- *Origem:* LJS; P1.

**G-50 — Minimização e retenção.** Coleta só e-mail, nome e hash de senha. `tentativa_login`, tokens, sessões expiradas e convites vencidos são apagados pelo Cron depois de 30 dias. `webhook_evento` guarda só os campos usados, não o payload inteiro com dados do pagador.
- *Verificação:* teste do Cron de limpeza; revisão do schema de `webhook_evento`. (Etapas 4, 13 e 14)
- *Origem:* LJS.

## K. Arquitetura e qualidade (herdadas do legado, sem natureza de segurança)

**G-51 — Totais somam parcelas pelo mês de `parcela.data`, nunca o cabeçalho.** *Verificação:* testes de total com crédito parcelado atravessando meses; grep de `valor_total_centavos` nas consultas de total. *Origem:* L-G-11.

**G-52 — Contrato da API só muda de forma aditiva.** Remover ou renomear exige 2 deploys com 30 dias de intervalo. *Verificação:* teste de contrato contra os JSON do legado. *Origem:* L-G-13.

**G-53 — Fronteiras de import do front (`paginas → componentes → base`; `ganchos → dados`).** *Verificação:* `eslint.fronteiras.js`. *Origem:* L-G-09.

**G-54 — `tokens.css` e as fontes são cópias sem alteração do legado.** *Verificação:* teste de hash no CI; comparação visual manual. *Origem:* L-G-18.

**G-55 — WCAG 2.1 AA, alvos de 44 px; zero violação *serious*/*critical* do axe.** *Verificação:* `@axe-core/playwright` no CI. *Origem:* L-G-19.

---

## Mapa do legado

| Legado | Aqui | Observação |
|---|---|---|
| G-01 | G-01 | Igual, por tabela com `lar_id` |
| G-02 | G-05, G-21 | Sem PostgREST: a superfície são as rotas do Hono |
| G-03 | G-04 | Lista fechada de SECURITY DEFINER passa a ser **vazia** |
| G-04, G-05, G-06 | G-05, G-06, G-09 | Adaptadas a vários lares |
| G-07, G-08 | G-13, G-25 | A regra sai do Postgres para `dominio`/API, e nunca vai para o navegador |
| G-10, G-11 | G-23, G-24, G-51 | — |
| G-12, G-13, G-14 | G-43, G-52, G-42 | `migrar.sh` dá lugar ao `deploy.yml` |
| G-15 | G-32 | `service_role` não existe mais |
| G-16 | G-17, G-18 | **Invertida:** o cadastro passa a ser aberto, com confirmação |
| G-17 | G-26, G-38 | Mais o dono por usuário (P5) |
| G-18, G-19, G-20 | G-54, G-55, G-35 | CSP passa para os cabeçalhos do Worker |

## Log de Alterações

| Data | Proposto por | Aprovado por | Mudança | Motivo | Validade |
|---|---|---|---|---|---|
| 2026-10-24 | segurança (agente) | — (pendente) | Versão inicial G-01…G-55 | Etapa 0 do PLANO | — |
| 2026-10-27 | implementador (agente) | Leandro (2026-10-27) | G-42 cumprida por deploy manual (`workflow_dispatch` só da `main`, job `conferir` exige o `ci` verde no mesmo SHA); sai o environment `producao-aprovacao`. A regra não muda nem afrouxa | GitHub Free não permite revisor obrigatório em repositório privado (emenda ao ADR-015) | Permanente (até nova decisão sobre o deploy) |
| 2026-10-27 | sessão principal | Leandro (2026-10-27) | `.gitleaks.toml`: allowlist por caminho de 3 arquivos `observabilidade.test.ts` (contrato, api, web) | O CI sinalizou como `generic-api-key` a constante `TOKEN` de exemplo, valor falso de propósito nos testes de scrubbing do Sentry | Enquanto os testes usarem valor falso |
| 2026-10-27 | sessão principal | Leandro (2026-10-27) | `.gitleaks.toml`: allowlist de `backend/api/src/push-modulo.test.ts` (vetor público do RFC 8291, apêndice A) e `.md/THREAT-MODEL.md` (texto) | Varredura do histórico inteiro acusou os dois; nenhum é segredo | Enquanto o teste usar o vetor do RFC |
| 2026-10-27 | implementador (agente) | Leandro (2026-10-27) | Menções de versão: os testes de banco e as migrations do zero rodam no Postgres 18 do CI (G-01, G-43); a imagem do `pg_dump` passa a `postgres:18-alpine` fixada por digest (como G-40 exige das ações). A regra não muda | O Neon de produção nasceu em Postgres 18; ADR-016 substitui o ADR-002 | Permanente (até nova troca de versão maior) |
