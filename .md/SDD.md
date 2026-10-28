# SDD — Controle em Casa

- **Data:** 2026-10-24
- **Status:** aprovado pelo usuário em 2026-10-24 (etapa 0).
- **Base:** `.md/ANALISE-MYMONEY.md` (decisões P1–P9), `.md/PLANO.md` (decisões de arquitetura 1–6), `.md/PRD.md`.
- **Legado (somente leitura):** `C:\Leandro\Projetos\MyMoney` (commit `282f2ae`). Nas referências, **T** = `backend/supabase/schemas/app/tabelas/`, **F** = `.../app/funcoes/`, **A** = `.../api/funcoes/`, **C** = `backend/contrato/src/`.
- **Referência do padrão:** `C:\Leandro\Projetos\GestaodaPelada` (abreviado **GP**). As divergências da ANALISE §4 **não** são copiadas: Node 22, Postgres 16, cookie `__Host-sessao` de 30 dias, papel único sem RLS, aplicador próprio de migrations.
- **Regras:** RN-01…RN-18 como no legado, com as correções da ANALISE §2.3. As regras novas são RN-19 (cadastro), RN-20 (sessão), RN-21 (bloqueio), RN-22 (lar e titular), RN-23 (convite), RN-24 (plano), RN-25 (Free somente leitura), RN-26 (exclusão), RN-27 (push) e RN-28 (correção da fixa). O texto de cada regra fica no `PRD-TECNICO.md`. Este documento diz **onde** cada uma roda.
- **Pontos em aberto:** nenhum; os quatro do rascunho foram decididos em 2026-10-24 (§14).

---

## 1. Visão geral

O app é um **Worker único** da Cloudflare. Ele serve os arquivos estáticos do front (landing em `/`, app em `/app`) e a API Hono em `/api/*` (`run_worker_first: ["/api/*"]`). O banco é o Neon Postgres 18, acessado pelo Hyperdrive. Toda regra de isolamento existe em duas camadas: a API filtra, e a RLS FORCE recusa o que escapar.

```mermaid
flowchart LR
  subgraph Cliente["Navegador / PWA instalado"]
    SPA["React 19 + Router + TanStack Query"]
    SW["Service worker<br/>precache, push, notificationclick"]
    IDB[("IndexedDB<br/>fila offline")]
  end

  subgraph CF["Cloudflare"]
    direction TB
    ASSETS["Assets estáticos<br/>frontend/web/dist (_headers com CSP)"]
    W["Worker: Hono em /api/*<br/>entrada > aplicacao > infraestrutura"]
    RL["Rate limit<br/>LIMITE_ENTRAR, LIMITE_PUBLICO, LIMITE_WEBHOOK"]
    CRON["Cron Triggers<br/>push por hora, limpeza diária"]
    HD["Hyperdrive<br/>pool, cache desligado"]
  end

  NEON[("Neon Postgres 18<br/>sa-east-1, RLS FORCE")]
  RESEND["Resend<br/>e-mail transacional"]
  ASAAS["Asaas<br/>assinatura Pix do lar"]
  SENTRY["Sentry<br/>@sentry/cloudflare + @sentry/react"]
  PUSHSVC["Serviços de push<br/>FCM, Mozilla, Apple"]
  GHA["GitHub Actions<br/>deploy, backup, purga"]

  SPA -->|"GET /, /app/*"| ASSETS
  SPA -->|"fetch /api/* + cookie __Host-sid"| W
  SW --> IDB
  SPA --> IDB
  W --> RL
  W -->|"pg via binding"| HD --> NEON
  CRON --> W
  W -->|"fetch"| RESEND
  W -->|"fetch"| ASAAS
  ASAAS -->|"POST /api/webhooks/asaas"| W
  W -->|"Web Push VAPID ES256"| PUSHSVC --> SW
  W -.->|"erros sem PII"| SENTRY
  SPA -.-> SENTRY
  GHA -->|"owner: migrar, purgar"| NEON
  GHA -->|"backup_ro: pg_dump + age"| NEON
  GHA -->|"wrangler deploy"| CF
```

| Componente | Papel | Observação |
|---|---|---|
| Assets | Landing, páginas legais e o SPA do app | `not_found_handling: single-page-application`. CSP e cabeçalhos vêm de `frontend/web/public/_headers` |
| Worker Hono | API REST em português, webhook e handler `scheduled` | Uma conexão `pg` por requisição (padrão GP `db/cliente.ts`), aberta só na 1ª consulta |
| Hyperdrive | Pool de conexões para o Neon | Cache de consulta **desligado**, conferido no deploy (R2) |
| Neon | Dados, RLS, bcrypt (`pgcrypto`) | Postgres 18 também no local e no CI (ADR-016, que substitui o ADR-002) |
| Cron | `0 * * * *` (push) e `30 6 * * *` (limpeza) | Lotes com `ctx.waitUntil` |
| Resend, Asaas, Push | Módulos isolados em `infraestrutura/{email,asaas,push}` | Sempre via `fetch`, sem SDK |
| GitHub Actions | Deploy, backup diário e purga de exclusões | As únicas peças com a credencial `owner` |

---

## 2. Pacotes e camadas

### 2.1 Monorepo

pnpm 11, Node 24 (`engines` e `.nvmrc`), TypeScript estrito, `"type": "module"`.

| Pacote | Pasta | Depende de | Conteúdo |
|---|---|---|---|
| `@controle/contrato` | `backend/contrato` | `zod` | Schemas Zod de entrada e saída de cada rota, enums, códigos de erro, constantes (`LIMITES`, `PRECO_PRO_CENTAVOS = 990`, `TRIAL_DIAS = 14`, `VERSAO_TERMOS`, `VERSAO_PRIVACIDADE`) |
| `@controle/dominio` | `backend/dominio` | `@controle/contrato` (só tipos) | Regras puras: sem I/O, sem relógio global, sem `Date.now()`. O "hoje" entra por parâmetro |
| `@controle/api` | `backend/api` | `contrato`, `dominio`, `hono`, `kysely`, `pg`, `@sentry/cloudflare` | Worker: `entrada/`, `aplicacao/`, `infraestrutura/`, `config/` |
| `@controle/scripts` | `backend/scripts` | `node-pg-migrate`, `pg`, `tsx` | `migrar.ts`, `seed-local.ts`, `purgar.ts`, `migracoes/*.sql` |
| `@controle/web` | `frontend/web` | `contrato`, React 19, Vite, `vite-plugin-pwa`, React Router, TanStack Query, `@sentry/react` | SPA (landing + app) |

O front **nunca** importa `dominio` nem `api`. O `dominio` nunca importa `api`. O `contrato` não importa ninguém (fronteiras no `eslint.fronteiras.js`).

### 2.2 Camadas da API

```
backend/api/src/
├── entrada/            # HTTP: app.ts, worker.ts (fetch + scheduled), middlewares/, rotas/, erros.ts, corpo.ts
├── aplicacao/          # casos de uso: acesso/, lar/, cadastros/, lancamentos/, fixas/, resumo/,
│                       #   orcamento/, metas/, plano/, push/, conta/, agendadas/
├── infraestrutura/
│   ├── db/             # cliente.ts, transacao.ts (emTransacaoComo), tipos.ts, repositorios/, consultas/ (agregações SQL)
│   ├── seguranca/      # token.ts (256 bits, SHA-256), hmac.ts, comparacao-constante.ts
│   ├── sessao/         # cookie.ts (__Host-sid)
│   ├── relogio/        # agora() e hojeSaoPaulo() injetáveis
│   ├── email/          # MÓDULO ISOLADO: Resend via fetch + modelos de e-mail
│   ├── asaas/          # MÓDULO ISOLADO: cliente REST, verificação do webhook, mapeamento de eventos
│   └── push/           # MÓDULO ISOLADO: VAPID (JWT ES256), criptografia aes128gcm (RFC 8291), envio
└── config/             # lerConfig(env) com Zod: falha fechada se faltar variável
```

| Camada | Pode importar | Não pode |
|---|---|---|
| `entrada` | `aplicacao`, `contrato`, `config`, `infraestrutura/sessao` | repositórios diretamente, SQL |
| `aplicacao` | `dominio`, `contrato`, interfaces de `infraestrutura` (`db/index.ts`, `email`, `asaas`, `push`, `relogio`) | Hono, `c.env` |
| `infraestrutura` | `contrato`, bibliotecas | `aplicacao`, `entrada`, `dominio` |

**Módulos isolados (decisão 4 do PLANO).** `email`, `asaas` e `push` expõem só uma interface pequena e não importam nada do resto da API, nem do banco. A fronteira é testada por regra do ESLint, para extrair o módulo depois para os outros dois apps.

| Módulo | Interface exportada |
|---|---|
| `email` | `enviarEmail({ para, modelo, dados })`, com os modelos `confirmacao`, `recuperacao`, `exclusao`, `convite`, `cobranca_gerada`, `pagamento_confirmado`, `pagamento_atrasado` |
| `asaas` | `criarCliente`, `criarAssinatura`, `cancelarAssinatura`, `buscarPix(cobrancaId)`, `verificarWebhook(req, token)`, `lerEvento(corpo) → EventoAsaas` |
| `push` | `enviarPush(assinatura, carga, vapid) → 'ok' \| 'expirada' \| 'falha'`, `chavePublica()` |

---

## 3. Modelo de dados

### 3.1 Convenções

- Schema `app` para todas as tabelas; `public` sem permissão para ninguém.
- Ids `uuid`. Nas escritas idempotentes (lançamento, conta, forma, categoria, fixa, meta, movimento, pagamento), o id vem do cliente (ADR-010).
- Dinheiro em `bigint` de centavos, sempre positivo (RN-18). O sinal vem do tipo ou do sentido.
- Datas de calendário em `date` (`AAAA-MM-DD`, parser do `pg` devolve texto, como no GP `cliente.ts`). Instantes em `timestamptz`. O "hoje" é `hojeSaoPaulo()` da API, passado como parâmetro (nunca `current_date` do banco).
- **FK composta `(x_id, dono_id)`**, como no legado: garante "conta, forma e lançamento do mesmo dono" sem gatilho.
- **FK composta `(dono_id, lar_id) → membro (id, lar_id)`**, nova: garante que o dono pertence ao lar da linha. Substitui o "lar único" do legado.
- `lar_id` em todas as tabelas de negócio. `dono_id` (um `membro.id`) nas que têm dono.
- Funções de GUC (§5.3): `app.usuario_atual()`, `app.email_atual()`, `app.lar_atual()`, `app.membro_atual()` e `app.em_sistema()`. São SQL `STABLE`, `SECURITY INVOKER`, e só leem `current_setting(…, true)`. Não há função de regra em SQL nem `SECURITY DEFINER` (decisão 1 do PLANO).
- Abreviações nas políticas: **L** = `lar_id = app.lar_atual()`; **D** = `dono_id = app.membro_atual()`; **Cj** = `escopo = 'conjunto'`; **S** = `app.em_sistema()`.

### 3.2 Diagrama

```mermaid
erDiagram
  usuario ||--o{ sessao : tem
  usuario ||--o{ token_email : tem
  usuario ||--o{ aceite_termos : registra
  usuario ||--o{ membro : "vinculo (1 ativo)"
  lar ||--|{ membro : "titular + ate 1 membro"
  lar ||--o{ convite : emite
  lar ||--|| assinatura : plano
  membro ||--o{ conta : dono
  membro ||--o{ forma_pagamento : dono
  conta ||--o{ forma_pagamento : "pix/debito"
  lar ||--o{ categoria : tem
  categoria ||--o{ lancamento : classifica
  lancamento ||--|| lancamento_pagamento : "parte privada"
  lancamento ||--|{ parcela : gera
  despesa_fixa ||--o{ ocorrencia_fixa : "1 por mes"
  ocorrencia_fixa |o--o| lancamento : paga
  categoria ||--o{ orcamento : "por mes"
  meta ||--o{ movimento_meta : "aporte/retirada"
  conta ||--o{ movimento_conta : movimenta
  movimento_meta |o--o| movimento_conta : "conta do autor"
  membro ||--o{ push_subscription : aparelhos
  membro ||--|| preferencia_notificacao : prefere
```

### 3.3 Tabelas de acesso (sem lar)

Essas tabelas não têm `lar_id`: a identidade ainda não existe quando são lidas (entrar, confirmar, redefinir). Ficam **sem RLS por linha**, com acesso protegido por segredo (hash de token, e-mail + senha) e por grants de coluna. A justificativa vai para o `THREAT-MODEL.md`.

**usuario**

| Coluna | Tipo | Regra |
|---|---|---|
| id | uuid PK | `default gen_random_uuid()` |
| email | citext not null | `unique`; formato validado no contrato; máx. 254 |
| nome | text not null | `btrim(nome) <> ''` e `char_length <= 60` |
| senha_hash | text not null | `crypt(senha, gen_salt('bf', 12))`; nunca sai do banco (a comparação é `crypt(:senha, senha_hash) = senha_hash` no SQL) |
| email_confirmado_em | timestamptz | nulo até confirmar (RN-19); conta não confirmada é apagada após 7 dias pela purga |
| trial_usado_em | timestamptz | preenchido quando o usuário vira titular de um lar com trial; quem tem valor não ganha novo trial (RN-24, CA-24.10) |
| criado_em, atualizado_em | timestamptz not null | `default now()` |

**sessao** (RN-20)

| Coluna | Tipo | Regra |
|---|---|---|
| id | uuid PK | |
| token_hash | bytea not null unique | `octet_length(token_hash) = 32` (SHA-256 do token de 256 bits) |
| usuario_id | uuid not null FK usuario | `on delete cascade`; índice |
| criada_em | timestamptz not null | |
| ultimo_uso_em | timestamptz not null | inatividade de 15 min; atualizado no máximo 1 vez por minuto |
| expira_absoluta_em | timestamptz not null | `= criada_em + interval '12 hours'` (check) |

**tentativa_login** (RN-21)

| Coluna | Tipo | Regra |
|---|---|---|
| id | bigint identity PK | |
| email_hash | bytea not null | HMAC-SHA-256 do e-mail normalizado com `CHAVE_HMAC` (o e-mail em claro não é guardado) |
| ip_hash | bytea | HMAC-SHA-256 do `CF-Connecting-IP`; nulo fora da Cloudflare |
| sucesso | boolean not null | o sucesso zera a contagem do e-mail (padrão GP `tentativas.ts`) |
| momento | timestamptz not null | índices `(email_hash, momento)` e `(ip_hash, momento)`; poda depois de 24 h |

**token_email**

| Coluna | Tipo | Regra |
|---|---|---|
| id | uuid PK | |
| usuario_id | uuid not null FK usuario | `on delete cascade` |
| finalidade | text not null | `check (finalidade in ('confirmacao','recuperacao','exclusao'))` |
| token_hash | bytea not null unique | 32 bytes |
| criado_em | timestamptz not null | |
| expira_em | timestamptz not null | `criado_em + 30 min` |
| usado_em | timestamptz | uso único; pedir outro marca os anteriores abertos como usados |

Índice único parcial `(usuario_id, finalidade) where usado_em is null`.

**aceite_termos** (RN-19)

| Coluna | Tipo | Regra |
|---|---|---|
| id | uuid PK | |
| usuario_id | uuid not null FK usuario | `on delete cascade` |
| versao_termos, versao_privacidade | text not null | iguais às constantes do contrato no momento do aceite |
| aceito_em | timestamptz not null | |

`unique (usuario_id, versao_termos, versao_privacidade)`. O IP não é guardado.

**exclusao_conta** (RN-26)

| Coluna | Tipo | Regra |
|---|---|---|
| id | uuid PK | |
| usuario_id | uuid not null | **sem FK**: a linha sobrevive à purga como registro mínimo |
| solicitada_em | timestamptz not null | |
| confirmada_em | timestamptz | pelo link de `token_email` (finalidade `exclusao`) |
| purgar_em | timestamptz | `confirmada_em + 30 dias` |
| cancelada_em, purgada_em | timestamptz | |

Índice único parcial `(usuario_id) where cancelada_em is null and purgada_em is null`.

**webhook_evento** (sistema)

| Coluna | Tipo | Regra |
|---|---|---|
| event_id | text PK | id do evento Asaas: idempotência (RN-24) |
| tipo | text not null | ex.: `PAYMENT_CONFIRMED` |
| asaas_assinatura_id | text | índice |
| ocorrido_em | timestamptz not null | data do evento no Asaas; usada para ignorar evento mais velho que o último aplicado |
| recebido_em, processado_em | timestamptz | |
| resumo | jsonb not null | só ids, situação, valor e datas; sem nome, CPF ou e-mail |

### 3.4 Lar e vínculo

**lar** (RN-22)

| Coluna | Tipo | Regra |
|---|---|---|
| id | uuid PK | |
| nome | text not null | `btrim <> ''`, máx. 60 |
| criado_por | uuid not null FK usuario | `on delete restrict`; usado só pela política do 1º insert |
| criado_em | timestamptz not null | |

Sem o índice `((true))` do legado: há vários lares.
**RLS:** select e update `id = app.lar_atual() or criado_por = app.usuario_atual()`; insert `criado_por = app.usuario_atual()`.

**membro** (RN-22)

| Coluna | Tipo | Regra |
|---|---|---|
| id | uuid PK | é o `dono_id` de todas as tabelas de negócio |
| lar_id | uuid not null FK lar | |
| usuario_id | uuid FK usuario | `on delete set null` (purga) |
| nome | text not null | cópia do nome do usuário; vira "Ex-membro" na purga |
| papel | text not null | `check (papel in ('titular','membro'))` |
| entrou_em | timestamptz not null | |
| saiu_em | timestamptz | saída ou remoção (D2): preenche `saiu_em`, troca `nome` por "Ex-membro", zera `usuario_id`; o individual do `dono_id` é purgado em 30 dias; `lancamento_pagamento` e a conta dos movimentos de meta conjunta dele são apagados na hora |

- `unique (id, lar_id)`: alvo das FKs compostas `(dono_id, lar_id)`.
- `create unique index membro_um_lar_ativo on membro (usuario_id) where saiu_em is null`: um lar ativo por usuário.
- `create unique index membro_um_titular on membro (lar_id) where papel = 'titular' and saiu_em is null`.
- `create unique index membro_um_convidado on membro (lar_id) where papel = 'membro' and saiu_em is null`.
- Os dois últimos índices garantem o **limite de 2 membros** (1 titular + 1 membro) sem `posicao` e sem gatilho. A garantia vale sob concorrência e independe da RLS, porque a unicidade não enxerga política. A violação vira o erro `lar_cheio`.

**RLS:** select `L or usuario_id = app.usuario_atual()`. Insert com `usuario_id = app.usuario_atual()` e uma de duas condições:
- `papel = 'titular'` e o lar foi criado pelo usuário (`exists` em `lar` com `criado_por = app.usuario_atual()`);
- `papel = 'membro'` e há convite pendente e válido para `app.email_atual()` naquele lar.

Update de `nome`, `saiu_em` com `usuario_id = app.usuario_atual()`. Não há recursão: a política de `membro` consulta `lar` e `convite`, cujas políticas só leem GUC.

**convite** (RN-23)

| Coluna | Tipo | Regra |
|---|---|---|
| id | uuid PK | |
| lar_id | uuid not null FK lar | |
| convidado_por | uuid not null | FK composta `(convidado_por, lar_id) → membro (id, lar_id)` |
| email | citext not null | e-mail convidado |
| token_hash | bytea not null unique | 32 bytes |
| lar_nome, convidado_por_nome | text not null | cópia para a tela de aceite (o convidado não enxerga `lar`) |
| situacao | text not null | `check (situacao in ('pendente','aceito','recusado','cancelado','expirado'))` |
| criado_em, expira_em, respondido_em | timestamptz | `expira_em = criado_em + 7 dias` |

`create unique index convite_um_pendente on convite (lar_id) where situacao = 'pendente'`.
**RLS:** select e update `L or email = app.email_atual()`; insert `L`. O convite só serve ao e-mail convidado. A API confere o token **e** o e-mail da sessão: um link encaminhado não serve a outra conta.

**assinatura** (RN-24, RN-25)

| Coluna | Tipo | Regra |
|---|---|---|
| lar_id | uuid PK FK lar | o plano é do **lar** (P2) |
| situacao | text not null | `check (situacao in ('trial','ativa','atrasada','cancelada','free'))` |
| trial_ate | timestamptz not null | `criado_em + 14 dias` |
| periodo_ate | timestamptz | fim do período pago |
| asaas_cliente_id | text | do titular |
| asaas_assinatura_id | text unique | |
| cobranca_id | text | cobrança Pix em aberto |
| cobranca_vencimento | date | |
| cobranca_valor_centavos | bigint | `> 0` |
| ultimo_evento_em | timestamptz | ordem dos eventos do webhook |
| criado_em, atualizado_em | timestamptz not null | |

O plano **efetivo** (`free` ou `pro`) é calculado em `dominio/plano.ts` a partir de `situacao`, `trial_ate`, `periodo_ate` e do instante atual. Ele não é guardado. Regra decidida (D4): `cancelada` mantém o Pro até `periodo_ate`; `atrasada` mantém o Pro por 3 dias após `cobranca_vencimento`; `trial` vale até `trial_ate`; depois, `free`. O CPF/CNPJ do titular é repassado ao Asaas ao assinar e **não é guardado** (só `asaas_cliente_id`), nunca em log (D6).
**RLS:** select `L or S`; insert `L`; update `L or S`.

### 3.5 Tabelas de negócio (portadas do legado)

Mudanças em relação ao legado, aplicadas a todas as tabelas desta seção:
- os `default app.lar_atual()` e `default app.membro_atual()` continuam, agora lendo GUC;
- a FK `dono_id → membro(id)` vira a FK composta `(dono_id, lar_id) → membro (id, lar_id)`;
- `to authenticated` vira `to controle_app`.

**conta** (T conta.sql; RN-03, RN-12)

| Coluna | Tipo | Regra |
|---|---|---|
| id | uuid PK | do cliente |
| lar_id, dono_id | uuid not null | FK composta `(dono_id, lar_id) → membro` |
| nome | text not null | `btrim <> ''` |
| saldo_inicial_centavos | bigint not null default 0 | pode ser negativo |
| arquivada | boolean not null default false | |
| criado_em | timestamptz | |

`unique (id, dono_id)`; índice `(dono_id)`. **RLS:** todas as operações com **D**; insert e update também com **L**.

**forma_pagamento** (T forma_pagamento.sql; RN-03, RN-12)

| Coluna | Tipo | Regra |
|---|---|---|
| id | uuid PK | |
| lar_id, dono_id | uuid not null | FK composta para `membro` |
| nome | text not null | |
| tipo | text not null | `pix`, `debito` ou `credito` |
| conta_id | uuid | FK `(conta_id, dono_id) → conta (id, dono_id)` |
| dia_vencimento | smallint | |
| preferida | boolean not null default false | |
| arquivada | boolean not null default false | |

Checks: `forma_pagamento_pix_debito_ck` (pix e débito exigem conta e não têm dia) e `forma_pagamento_credito_ck` (crédito exige dia de 1 a 31). `unique (id, dono_id)`; índice único `(dono_id) where preferida`. **RLS:** igual à de `conta`.

**categoria** (T categoria.sql; RN-01, RN-17)

| Coluna | Tipo | Regra |
|---|---|---|
| id | uuid PK | |
| lar_id | uuid not null FK lar | |
| tipo | text not null | `despesa` ou `receita` |
| escopo | text not null | `conjunto` ou `individual` |
| dono_id | uuid | FK composta `(dono_id, lar_id) → membro` (MATCH SIMPLE, nula na conjunta) |
| nome | text not null | |
| variavel | boolean | só na despesa |
| arquivada | boolean not null default false | |

Checks: `categoria_dono_so_individual`, `categoria_variavel_so_despesa` e `categoria_receita_individual`. Unicidade: `categoria_unica unique nulls not distinct (lar_id, tipo, escopo, dono_id, nome)` e os alvos `(id, tipo, escopo)`, `(id, dono_id)` e `(id, lar_id)`. **RLS:** todas as operações com **L and (Cj or D)**.

**lancamento** (T lancamento.sql; RN-01, RN-04, RN-06, RN-07, RN-18)

| Coluna | Tipo | Regra |
|---|---|---|
| id | uuid PK | do cliente |
| lar_id, dono_id | uuid not null | dono = pagador (conjunta) ou autor (individual) |
| tipo, escopo | text not null | o escopo vem da categoria (RN-01) |
| categoria_id | uuid not null | FKs `(categoria_id, tipo, escopo)`, `(categoria_id, categoria_dono_id)` e `(categoria_id, lar_id)` |
| descricao | text | |
| valor_total_centavos | bigint not null | `> 0` e `<= 100000000000` |
| num_parcelas | smallint not null | de 1 a 24 |
| alterado_por | uuid | FK composta `(alterado_por, lar_id) → membro` |
| alterado_em | timestamptz | |
| categoria_dono_id | uuid gerada | `case when escopo = 'individual' then dono_id end` |

Check `lancamento_receita_individual`. Alvos: `unique (id, dono_id)` e `unique (id, escopo, dono_id)`.
**RLS:** select, update e delete com **L and (Cj or D)**; insert **L and D**. A política de update deixa o outro membro editar a conjunta: no legado isso exigia o `SECURITY DEFINER` de `editar_lancamento`, que **deixa de existir**. O `with check` impede o outro membro de tornar a conjunta individual: dono ≠ eu e escopo individual falha. A matriz campo a campo da RN-06 fica em `dominio/permissoes.ts`.

**lancamento_pagamento** (T lancamento_pagamento.sql; RN-04)

| Coluna | Tipo | Regra |
|---|---|---|
| lancamento_id | uuid PK | FK `(lancamento_id, dono_id) → lancamento` `on delete cascade` |
| lar_id, dono_id | uuid not null | |
| forma_pagamento_id | uuid | FK `(forma_pagamento_id, dono_id) → forma_pagamento` |
| conta_id | uuid | FK `(conta_id, dono_id) → conta`; nula no crédito |
| data_operacao | date not null | |
| dia_vencimento_aplicado | smallint | de 1 a 31 (dia congelado) |

**RLS:** todas as operações com **D**; insert e update também com **L**. Só o pagador enxerga, mesmo na conjunta. Por isso a API **omite** as chaves `pagamento` e `data_ajustada` para o outro membro (RN-04, C `respostas/lancamento.ts`). Como o outro membro nunca grava aqui, a edição dele não muda a data da operação (RN-06 revisada em 2026-10-25). Na remoção do membro pelo titular, estas linhas do removido ficam até a purga (etapa 14; desvio do CA-23.12 aceito em 2026-10-25).

**parcela** (T parcela.sql; RN-14)

| Coluna | Tipo | Regra |
|---|---|---|
| id | uuid PK | |
| lancamento_id | uuid not null | FK `(lancamento_id, escopo, dono_id) → lancamento` `on delete cascade on update cascade` |
| lar_id, escopo, dono_id | | desnormalizados para RLS e índice |
| numero | smallint not null | `>= 1`; `unique (lancamento_id, numero)` |
| valor_centavos | bigint not null | `> 0` |
| data | date not null | |
| data_ajustada | boolean not null default false | |

Índices `(lar_id, data)` e `(dono_id, data)`. **RLS:** todas as operações com **L and (Cj or D)**. O insert e o update da conjunta pelo outro membro são necessários no recálculo da edição.

**despesa_fixa** (T despesa_fixa.sql; RN-15)

Colunas: `id`, `lar_id`, `descricao`, `categoria_id`, `tipo = 'despesa'`, `escopo = 'conjunto'`, `valor_previsto_centavos > 0`, `dia_vencimento` de 1 a 31, `inicio` (1º dia do mês), `encerrada_em`, `criado_em`. FK `(categoria_id, tipo, escopo) → categoria`.
**RLS:** select, insert e update com **L**; select também com **S** (cron de push). **Sem delete:** a fixa é encerrada, não excluída.

**ocorrencia_fixa** (T ocorrencia_fixa.sql; RN-15, RN-28)

Colunas: `id`, `lar_id`, `despesa_fixa_id`, `mes` (1º dia), `vencimento` (check: no mesmo mês), `valor_previsto_centavos`, `lancamento_id unique` FK `on delete set null`, `criado_em`. `unique (despesa_fixa_id, mes)`; índice `(lar_id, mes)`.
**RLS:** todas as operações com **L**; select também com **S**.

**orcamento** (T orcamento.sql; Pro)

Colunas: `id`, `lar_id`, `mes` (dia 1), `categoria_id`, `tipo = 'despesa'`, `escopo`, `dono_id`, `valor_centavos > 0`, `criado_em`. Check `orcamento_dono_so_individual`. FKs `(categoria_id, tipo, escopo)` e `(categoria_id, dono_id)`. `unique (categoria_id, mes)`; índice `(lar_id, mes)`.
**RLS:** todas as operações com **L and (Cj or D)**.

**meta** (T meta.sql; RN-08; Pro)

Colunas: `id`, `lar_id`, `dono_id` (quem criou ou o dono), `nome`, `alvo_centavos > 0`, `prazo` (1º dia do mês), `escopo`, `atingida_em`, `criado_em`. Índice `(lar_id)`.
**RLS:** select, insert e update com **L and (Cj or D)**; select também com **S**. **Sem delete.** Update só nas colunas `nome`, `alvo_centavos`, `prazo` e `atingida_em`, como no legado.

**movimento_meta** (T movimento_meta.sql; RN-08, RN-09; Pro)

Colunas: `id`, `lar_id`, `meta_id`, `tipo` (`aporte` ou `retirada`), `valor_centavos > 0`, `data`, `local` (já aparado, não vazio, até 60 caracteres), `autor_id` (FK composta para `membro`), `criado_em`. Alvo `unique (id, autor_id)`; índice `(meta_id, data)`.
**RLS:** select `L and exists (select 1 from app.meta m where m.id = meta_id)`; insert, além disso, com `autor_id = app.membro_atual()`. **Imutável:** sem update e sem delete.

**movimento_conta** (T movimento_conta.sql; RN-12, RN-13)

Colunas: `id`, `lar_id`, `dono_id`, `conta_id`, `tipo` (`ajuste`, `aporte`, `retirada` ou `pagamento_cartao`), `sentido` (`entrada` ou `saida`), `valor_centavos > 0`, `data`, `forma_credito_id`, `movimento_meta_id unique`, `criado_em`. FKs compostas para conta, forma e `(movimento_meta_id, dono_id) → movimento_meta (id, autor_id)`. Checks `movimento_conta_forma_credito_ck` e `movimento_conta_meta_ck`. Índice `(conta_id, data)`.
**RLS:** todas as operações com **D**; insert também com **L**. Nenhuma operação do legado altera ou apaga movimento, por isso o `app` só tem select e insert.

### 3.6 Push

**push_subscription** (RN-27)

| Coluna | Tipo | Regra |
|---|---|---|
| id | uuid PK | |
| lar_id, membro_id | uuid not null | FK composta `(membro_id, lar_id) → membro` |
| endpoint | text not null unique | só `https:`; máx. 1024 |
| p256dh, auth | text not null | chaves do navegador (base64url) |
| criado_em, ultimo_envio_em | timestamptz | |
| falhas | smallint not null default 0 | removida com 410/404 ou depois de 5 falhas |

**RLS:** todas as operações com `membro_id = app.membro_atual()`; select e delete também com **S**.

**preferencia_notificacao** (RN-27)

| Coluna | Tipo | Regra |
|---|---|---|
| membro_id | uuid PK | FK composta `(membro_id, lar_id) → membro` |
| lar_id | uuid not null | |
| fixas | boolean not null default true | fixa vencendo ou atrasada |
| lembrete_diario | boolean not null default false | opcional (P8) |
| lembrete_hora | smallint not null default 20 | de 0 a 23, hora de São Paulo |
| metas | boolean not null default true | meta atingida |
| atualizado_em | timestamptz | |

**RLS:** igual à de `push_subscription`, sem delete.

### 3.7 Política extra de backup

Toda tabela recebe `create policy backup_leitura on app.<t> for select to controle_backup_ro using (true)`. O `pg_dump` roda com `--enable-row-security`, e assim o backup não precisa de BYPASSRLS (§4).

**Contagem:** 25 tabelas (5 de acesso, 1 de sistema, 4 de lar e vínculo, 13 de negócio, 2 de push).

---

## 4. Roles e grants

| Role | Atributos | Uso | Credencial em |
|---|---|---|---|
| `controle_owner` (owner) | dono do schema `app` e de todos os objetos; `NOLOGIN` fora do deploy | migrations (`node-pg-migrate`), seed, purga | GitHub `producao`; `.env` local |
| `controle_app` (app) | `LOGIN`, **sem** BYPASSRLS, sem CREATE em schema nenhum, não é dono de nada | Worker via Hyperdrive | Configuração do Hyperdrive |
| `controle_backup_ro` (backup_ro) | `LOGIN`, só SELECT, sem BYPASSRLS | `backup.yml` | GitHub `producao` |

- **`app` pode** fazer DML conforme a tabela abaixo e executar as funções de GUC.
- **`app` não pode**:
  - executar DDL, TRUNCATE ou REFERENCES;
  - criar função;
  - usar `SET ROLE`;
  - fazer DELETE nas tabelas marcadas com "—";
  - fazer UPDATE fora das colunas listadas.
- `alter default privileges for role controle_owner in schema app revoke all on tables from public` e `revoke execute on functions from public`.
- Teste da etapa 2: conectado como `app`, tentar `create table`, `drop`, `truncate`, `delete from app.meta`, `update app.meta set escopo = …` e `set role controle_owner`. Tudo tem que falhar.

| Tabela | SELECT | INSERT | UPDATE (colunas) | DELETE |
|---|---|---|---|---|
| usuario | sim | sim | `nome`, `senha_hash`, `email_confirmado_em`, `atualizado_em` | — (purga pelo owner) |
| sessao | sim | sim | `ultimo_uso_em` | sim |
| tentativa_login | sim | sim | — | sim (poda) |
| token_email | sim | sim | `usado_em` | sim (poda) |
| aceite_termos | sim | sim | — | — |
| exclusao_conta | sim | sim | `confirmada_em`, `purgar_em`, `cancelada_em` | — |
| webhook_evento | sim | sim | `processado_em` | sim (poda de 90 dias) |
| lar | sim | sim | `nome` | — |
| membro | sim | sim | `nome`, `saiu_em` | — |
| convite | sim | sim | `situacao`, `respondido_em` | — |
| assinatura | sim | sim | todas, exceto `lar_id` e `criado_em` | — |
| conta | sim | sim | `nome`, `saldo_inicial_centavos`, `arquivada` | sim (sem vínculo, senão `em_uso`) |
| forma_pagamento | sim | sim | `nome`, `tipo`, `conta_id`, `dia_vencimento`, `preferida`, `arquivada` | sim |
| categoria | sim | sim | `nome`, `variavel`, `arquivada` | sim |
| lancamento | sim | sim | `escopo`, `categoria_id`, `descricao`, `valor_total_centavos`, `num_parcelas`, `alterado_por`, `alterado_em` | sim |
| lancamento_pagamento | sim | sim | `forma_pagamento_id`, `conta_id`, `data_operacao`, `dia_vencimento_aplicado` | sim |
| parcela | sim | sim | `numero`, `valor_centavos`, `data`, `data_ajustada` (o escopo vem por cascata) | sim |
| despesa_fixa | sim | sim | `descricao`, `categoria_id`, `valor_previsto_centavos`, `dia_vencimento`, `encerrada_em` | **—** |
| ocorrencia_fixa | sim | sim | `valor_previsto_centavos`, `lancamento_id` | sim (encerrar) |
| orcamento | sim | sim | `valor_centavos` | sim (valor nulo remove) |
| meta | sim | sim | `nome`, `alvo_centavos`, `prazo`, `atingida_em` | **—** |
| movimento_meta | sim | sim | **—** | **—** |
| movimento_conta | sim | sim | — | — |
| push_subscription | sim | sim | `ultimo_envio_em`, `falhas` | sim |
| preferencia_notificacao | sim | sim | todas, exceto as chaves | — |

`backup_ro`: `grant usage on schema app` e `grant select on all tables in schema app`, mais a política `backup_leitura`. Desde a etapa 16 (ADR-015), também `SELECT` nas sequências de `app` e leitura de `public.pgmigrations` (o `pg_dump` falhava sem elas, e o banco restaurado precisa saber quais migrations rodaram). Só leitura; nada além disso.

---

## 5. Requisição na API

### 5.1 Ordem dos middlewares

| # | Middleware | Onde | Falha |
|---|---|---|---|
| 1 | Sentry (`withSentry`) e cabeçalhos: `Cache-Control: no-store`, `X-Content-Type-Options: nosniff`, `Referrer-Policy: no-referrer` | `/api/*` | — |
| 2 | `bodyLimit` (`LIMITES.corpoBytes`, 64 KiB) | `/api/*` | 413 `corpo_grande` |
| 3 | Rate limit por IP: `LIMITE_ENTRAR` em `/api/sessao/entrar`; `LIMITE_PUBLICO` em cadastro, confirmar, reenviar, senha, convites por token e `exclusao/cancelar`; `LIMITE_WEBHOOK` em `/api/webhooks/*` | rotas citadas | 429 `muitas_requisicoes` |
| 4 | CSRF: toda escrita exige `X-Controle-Em-Casa: 1` e `Origin` igual a `URL_PUBLICA` (exceto o webhook) | `/api/*` | 403 `origem_invalida` |
| 5 | Conexão da requisição (`criarDb(c.env.HYPERDRIVE, c.executionCtx)`, fechada no `finally` via `waitUntil`), relógio e config | `/api/*` | 503 `indisponivel` |
| 6 | Sessão: lê o cookie `__Host-sid`, SHA-256 e busca numa única instrução `UPDATE … RETURNING` que confere 15 min de inatividade e 12 h absolutas e atualiza `ultimo_uso_em` (RN-20) | `/api/*` | — (sessão inválida limpa o cookie e põe `null`) |
| 7 | `exigirSessao` | rotas autenticadas | 401 `sessao_expirada` |
| 8 | `emTransacaoComo`: BEGIN, GUCs (§5.3) e o resto da cadeia dentro da transação | rotas autenticadas | 409 `sem_lar` nas rotas que exigem lar |
| 9 | `exigePlano('pro')` nas **escritas** de orçamento e metas (RN-25) | lista do §6 | 403 `plano_necessario` |
| 10 | Validação Zod do contrato (params, query, corpo) | cada rota | 400 `valor_invalido` |
| 11 | Handler, depois COMMIT ou ROLLBACK; `onError` registra só `erro.name` | — | 500 `erro_interno` |

O webhook pula os passos 4, 6, 7, 8 e 9: ele tem a própria transação com `app.sistema = 'webhook'`. O `GET /api/health` responde antes do passo 5, **sem banco** (R5).

### 5.2 Sessão e cookie (RN-20)

- Token: 32 bytes de `crypto.getRandomValues`, em base64url (GP `seguranca/token.ts`). O banco guarda só o SHA-256.
- Cookie: `__Host-sid=<token>; Path=/; Secure; HttpOnly; SameSite=Lax; Max-Age=43200`. Sem `Domain`.
- Rotação: cada login cria uma sessão nova. A redefinição de senha e o "sair de todos" apagam todas as sessões do usuário.
- Expiração: `ultimo_uso_em > agora - 15 min` **e** `expira_absoluta_em > agora`. O `ultimo_uso_em` só é regravado se tiver mais de 60 s, o que poupa escrita.
- `GET /api/sessao` devolve 200 `{usuario, membro|null, lar|null, plano|null, termos_pendentes}` ou 401. A fila offline (§9.3) usa o `usuario.id`.

### 5.3 GUC por transação e vazamento no pool

`emTransacaoComo(db, sessao, fn)` faz, na **mesma** transação e conexão:

```sql
BEGIN;
SELECT set_config('app.usuario_id', $usuario_id, true),
       set_config('app.email',      $email,      true);
-- vínculo: o lar vem do banco, nunca do cliente
SELECT set_config('app.lar_id',    m.lar_id::text, true),
       set_config('app.membro_id', m.id::text,     true),
       m.papel
  FROM app.membro m
 WHERE m.usuario_id = $usuario_id AND m.saiu_em IS NULL;
-- ... handler ...
COMMIT;  -- ou ROLLBACK: os GUCs locais somem nos dois casos
```

- O `app.lar_id` é **derivado** da linha de `membro` na própria instrução. Assim fica validado contra o vínculo por construção (R3). Nenhuma rota aceita `lar_id` do cliente.
- `app.membro_id` evita que as políticas façam subconsulta em `membro` por linha. A política continua barata, e não há recursão.
- `app.sistema` (`webhook`, `cron` ou `purga`) só é definido pelo webhook, pelo `scheduled` e pelo `purgar.ts`. Nenhuma rota de usuário o define, e um teste de catálogo varre `entrada/rotas` para garantir isso.
- **Proibido** `SET` sem `LOCAL`, `set_config(…, false)` e GUC fora de transação. Uma regra do ESLint e um teste por `grep` em `backend/api/src` recusam esses padrões.
- O Hyperdrive reaproveita conexões entre requisições. Com `is_local = true`, o valor some no fim da transação, mesmo com ROLLBACK ou erro no meio.
- **Teste de vazamento** (etapa 3):
  1. A e B disparam requisições simultâneas, 50 rodadas, e cada um só vê os próprios dados.
  2. Depois do COMMIT, uma consulta na mesma conexão lê `current_setting('app.usuario_id', true)` vazio.
  3. Uma requisição que falha no meio (ROLLBACK) também deixa o GUC vazio.
  4. Sem GUC, `select count(*) from app.lancamento` como `app` devolve 0.
- Cache do Hyperdrive desligado (`caching.disabled = true`), conferido no `deploy.yml` (GP `verificar-cache-hyperdrive`).

### 5.4 `exigePlano`

`plano = planoEfetivo(assinatura, agora)` em `dominio/plano.ts`. A assinatura é lida dentro da transação, pela RLS do lar. No Free:
- `GET` de orçamento e metas responde normalmente: dados preservados, somente leitura (RN-25);
- as escritas respondem 403 `plano_necessario`;
- o resumo do mês continua devolvendo `orcamento` e `metas` como estão;
- nada é apagado.

---

## 6. Mapa de rotas

Convenções:
- tudo sob `/api`, JSON;
- datas `AAAA-MM-DD` e mês `AAAA-MM-01`;
- os schemas ficam em `@controle/contrato`, com o nome indicado (`entrada.X` / `saida.X`);
- escritas idempotentes recebem o id do cliente no corpo ou na rota (`PUT /recurso/:id` = criar ou atualizar);
- **A** = autenticado com lar; **A0** = autenticado sem exigir lar; **P** = público; **Pro** = `exigePlano('pro')`;
- retorno escalar do legado (uuid, bigint, integer) vira objeto (`{ id }`, `{ diferenca_centavos }`, `{ copiadas }`), e `void` vira 204.

### 6.1 As 36 operações do legado

| # | Operação legada (A) | Método e rota | Acesso | Entrada → saída (contrato) | RN |
|---|---|---|---|---|---|
| 1 | `ping` | `GET /api/health` | P | — → `{ ok: true }` (sem banco) | — |
| 2 | `contexto` | `GET /api/contexto` | A | — → `saida.Contexto` (C `contexto.ts`, mais `lar {id, nome}`, `papel`, `plano`) | RN-22, RN-24 |
| 3 | `inicializar_membro` | `POST /api/lar` | A0 | `entrada.CriarLar {nome?}` → 201 `saida.Lar` (idempotente: quem já tem lar recebe 200 com o lar atual). Cria o lar, o titular, as 6 categorias conjuntas, as 7 individuais e a assinatura `trial` | RN-17, RN-22, RN-24 |
| 4 | `dados_lancamento` | `GET /api/lancamentos/dados` | A | — → `saida.DadosLancamento` | RN-01, padrões do lançamento rápido |
| 5 | view `contas` | `GET /api/contas` | A | — → `saida.LinhaContas[]` | RN-03, RN-12 |
| 6 | `salvar_conta` | `PUT /api/contas/:id` | A | `entrada.SalvarConta {nome, saldo_inicial_centavos}` → `{ id }` | RN-03 |
| 7 | `ajustar_saldo` | `POST /api/contas/:id/ajuste` | A | `entrada.AjustarSaldo {saldo_real_centavos, simular}` → `{ diferenca_centavos }` | RN-12 |
| 8 | `arquivar_conta` | `POST /api/contas/:id/arquivar` | A | — → 204 | RN-03 |
| 9 | `excluir_conta` | `DELETE /api/contas/:id` | A | — → 204 \| 409 `em_uso` | RN-03 |
| 10 | view `formas_pagamento` | `GET /api/formas` | A | — → `saida.LinhaFormasPagamento[]` (gasto e comprometido do crédito) | RN-03, RN-13 |
| 11 | `salvar_forma` | `PUT /api/formas/:id` | A | `entrada.SalvarForma {nome, tipo, conta_id?, dia_vencimento?}` → `{ id }` | RN-12 |
| 12 | `arquivar_forma` | `POST /api/formas/:id/arquivar` | A | — → 204 | RN-03 |
| 13 | `excluir_forma` | `DELETE /api/formas/:id` | A | — → 204 \| 409 `em_uso` | RN-03 |
| 14 | `definir_preferida` | `PUT /api/formas/:id/preferida` | A | `entrada.DefinirPreferida {preferida}` → 204 | padrões do lançamento rápido |
| 15 | `registrar_pagamento_cartao` | `POST /api/formas/:id/pagamentos` | A | `entrada.PagamentoCartao {id, conta_id, valor_centavos, data?}` → 201 `{ id, ja_existia }` (200 com `ja_existia: true` no reenvio; decisão de 2026-10-25) | RN-12, RN-13 |
| 16 | view `categorias` | `GET /api/categorias` | A | — → `saida.LinhaCategorias[]` | RN-17 |
| 17 | `salvar_categoria` | `PUT /api/categorias/:id` | A | `entrada.SalvarCategoria {nome, tipo, escopo, variavel}` → `{ id }` \| 409 `nome_repetido` | RN-17 |
| 18 | `arquivar_categoria` | `POST /api/categorias/:id/arquivar` | A | — → 204 | RN-17 |
| 19 | `excluir_categoria` | `DELETE /api/categorias/:id` | A | — → 204 \| 409 `categoria_em_uso` | RN-17 |
| 20 | `lancar_despesa` | `POST /api/lancamentos/despesas` | A | `entrada.LancarDespesa {id, valor_centavos, categoria_id, forma_id, parcelas, data?, descricao?}` → 201 `saida.LancarDespesa` (200 com `ja_existia: true` no reenvio) | RN-01, RN-05, RN-14, RN-18 |
| 21 | `lancar_receita` | `POST /api/lancamentos/receitas` | A | `entrada.LancarReceita {id, valor_centavos, categoria_id, conta_id, data?, descricao?}` → 201/200 `saida.LancarReceita` | RN-12, RN-17 |
| 22 | `lancamentos_mes` | `GET /api/lancamentos?mes=&escopo=&categoria_id=&forma_id=&variavel=` | A | `entrada.FiltroLancamentos` → `saida.LancamentosMes` | RN-02, RN-04 |
| 23 | `lancamento` | `GET /api/lancamentos/:id` | A | — → `saida.Lancamento` (`pagamento` e `data_ajustada` **omitidos** para quem não é o pagador) | RN-04 |
| 24 | `editar_lancamento` | `PATCH /api/lancamentos/:id` | A | `entrada.EditarLancamento {valor_total_centavos?, categoria_id?, descricao?, data?, forma_id?, num_parcelas?, confirmar_descarte?}` → `saida.LancamentoEditado {id, escopo, num_parcelas, alterado_em}` | RN-06, RN-07, RN-14, RN-28 |
| 25 | `alterar_data_parcela` | `PATCH /api/parcelas/:id` | A | `entrada.AlterarDataParcela {data}` → 204 | RN-06, RN-14 |
| 26 | `excluir_lancamento` | `DELETE /api/lancamentos/:id` | A | — → 204 (pagamento de fixa volta a ocorrência para pendente) | RN-06 |
| 27 | view `despesas_fixas` | `GET /api/fixas` | A | — → `saida.LinhaDespesasFixas[]` | RN-15 |
| 28 | `salvar_despesa_fixa` | `PUT /api/fixas/:id` | A | `entrada.SalvarFixa {descricao, categoria_id, valor_previsto_centavos, dia_vencimento}` → `{ id }` | RN-15 |
| 29 | `encerrar_despesa_fixa` | `POST /api/fixas/:id/encerrar` | A | — → 204 (apaga as pendentes futuras) | RN-15 |
| 30 | `ocorrencias_mes` | `GET /api/fixas/ocorrencias?mes=` | A | → `saida.OcorrenciasMes` (gera as ocorrências sob demanda, ±12 meses, idempotente) | RN-15 |
| 31 | `pagar_ocorrencia` | `POST /api/ocorrencias/:id/pagamento` | A | `entrada.PagarOcorrencia {id, forma_id, valor_centavos?, data?}` → `saida.PagamentoOcorrencia {ocorrencia_id, lancamento_id, situacao, valor_pago_centavos, vencimento, ja_existia}` \| 409 `ocorrencia_paga` | RN-04, RN-15, RN-28 |
| 32 | `desfazer_pagamento` | `DELETE /api/ocorrencias/:id/pagamento` | A | — → 204 (só o pagador) | RN-06, RN-15 |
| 33 | `resumo_mes` | `GET /api/resumo?mes=` | A | → `saida.ResumoMes` | RN-16, RN-12, RN-13 |
| 34 | `orcamento_mes` | `GET /api/orcamento?mes=&escopo=` | A | → `saida.OrcamentoMes` | RN-16, RN-17, RN-25 |
| 35 | `definir_orcamento` | `PUT /api/orcamento/:mes/:categoria_id` | A, **Pro** | `entrada.DefinirOrcamento {valor_centavos \| null}` → 204 (nulo remove) | RN-17, RN-25 |
| 36 | `copiar_orcamento` | `POST /api/orcamento/:mes/copiar` | A, **Pro** | `entrada.CopiarOrcamento {escopo}` → `{ copiadas }` | RN-25 |
| 37 | view `metas` | `GET /api/metas` e `GET /api/metas/:id` (com `por_local`) | A | → `saida.LinhaMetas[]` / `saida.LinhaMetas` | RN-08, RN-25 |
| 38 | `salvar_meta` | `PUT /api/metas/:id` | A, **Pro** | `entrada.SalvarMeta {nome, alvo_centavos, prazo?, escopo?}` → `{ id }` | RN-08, RN-25 |
| 39 | `movimentar_meta` | `POST /api/metas/:id/movimentos` | A, **Pro** | `entrada.MovimentarMeta {id, tipo, valor_centavos, local, data?, conta_id?}` → `{ id }` \| 422 `retirada_maior_que_guardado`. Agenda o push "meta atingida" | RN-08, RN-09, RN-25, RN-27 |
| 40 | `movimentos_meta` | `GET /api/metas/:id/movimentos` | A | → `saida.MovimentosMeta` (`conta` só para o autor) | RN-08 |
| 41 | `locais_guardados` | `GET /api/metas/locais` | A | → `saida.LocaisGuardados` | RN-09 |

São 36 funções `api.*` e 5 views, ou 41 entradas. O `_meta.test.ts` do legado é portado: ele falha se uma das 36 operações ou das 5 views ficar sem rota e sem caso de teste.

### 6.2 Rotas novas

| Grupo | Método e rota | Acesso | Entrada → saída | RN |
|---|---|---|---|---|
| Cadastro | `POST /api/cadastro` | P, LIMITE_PUBLICO | `entrada.Cadastro {nome, email, senha, aceite: {termos, privacidade}}` → 202 neutro (mesma resposta e tempo se o e-mail já existe; nesse caso manda o e-mail "você já tem conta") | RN-19 |
| | `POST /api/cadastro/confirmar` | P | `{token}` → 204 \| 400 `link_expirado` | RN-19 |
| | `POST /api/cadastro/reenviar` | P | `{email}` → 202 neutro | RN-19 |
| Sessão | `POST /api/sessao/entrar` | P, LIMITE_ENTRAR | `entrada.Entrar {email, senha}` → 204 + cookie \| 400 `credenciais_invalidas` \| 403 `email_nao_confirmado` (só com a senha certa) \| 403 `conta_em_exclusao` \| 429 `muitas_tentativas` | RN-20, RN-21 |
| | `GET /api/sessao` | A0 | → `saida.SessaoAtual` \| 401 | RN-20 |
| | `POST /api/sessao/sair` | A0 | → 204 (idempotente; limpa o cookie) | RN-20 |
| | `POST /api/sessao/sair-de-todos` | A0 | → 204 (apaga todas as sessões do usuário) | RN-20 |
| Senha | `POST /api/senha/esqueci` | P | `{email}` → 202 neutro | RN-20 |
| | `POST /api/senha/redefinir` | P | `{token, senha}` → 204 \| 400 `link_expirado` \| 400 `senha_fraca` (apaga as sessões) | RN-20 |
| Termos | `POST /api/termos/aceite` | A0 | `{termos, privacidade}` (versões) → 204 | RN-19 |
| Lar | `GET /api/lar` | A | → `saida.LarDetalhe {lar, membros[{id, nome, papel, sou_eu}], convite_pendente?}` | RN-22 |
| | `PATCH /api/lar` | A, titular | `{nome}` → 204 | RN-22 |
| | `DELETE /api/lar/membros/:id` | A, titular | — → 204 (remove o membro; efeito da saída, D2) \| 400 `registro_invalido` (não titular ou alvo inválido) | RN-22, RN-23 |
| | `POST /api/lar/sair` | A, membro | — → 204 (individual purgado em 30 dias; conjuntas ficam com "Ex-membro"; o titular não sai por aqui) | RN-22, RN-23 |
| Convite | `POST /api/lar/convites` | A, titular | `entrada.Convidar {email}` → 201 `{id, email, expira_em}` \| 409 `lar_cheio` \| 409 `convite_pendente` | RN-23 |
| | `DELETE /api/lar/convites/:id` | A, titular | → 204 | RN-23 |
| | `GET /api/convites/atual?token=` | A0, LIMITE_PUBLICO | → `{lar_nome, convidado_por_nome, expira_em}` \| 404 `convite_invalido` (token errado, de outro e-mail, expirado ou usado: a mesma resposta) | RN-23 |
| | `POST /api/convites/aceitar` | A0 | `{token}` → 204 \| 404 `convite_invalido` \| 409 `lar_cheio` \| 409 `ja_tem_lar` (lar com dados, ou titular com membro; lar só com as categorias iniciais é descartado no aceite) | RN-23 |
| | `POST /api/convites/recusar` | A0 | `{token}` → 204 | RN-23 |
| Plano | `GET /api/plano` | A | → `saida.MeuPlano {plano, situacao, trial_ate, periodo_ate, preco_centavos, sou_titular, cobranca?: {vencimento, valor_centavos, pix_copia_cola, qr_png_base64}}` | RN-24 |
| | `POST /api/plano/assinar` | A, titular | `entrada.Assinar {cpf_cnpj}` → 201 `saida.MeuPlano` \| 409 `assinatura_ativa` | RN-24 |
| | `POST /api/plano/cancelar` | A, titular | → 204 \| 409 `sem_assinatura` | RN-24 |
| Webhook | `POST /api/webhooks/asaas` | token `asaas-access-token`, LIMITE_WEBHOOK | evento Asaas → 200 (também no evento repetido ou ignorado) \| 401 `token_invalido` | RN-24 |
| Push | `GET /api/push/chave` | A | → `{ chave_publica }` (VAPID) | RN-27 |
| | `POST /api/push/assinaturas` | A | `entrada.AssinaturaPush {endpoint, keys: {p256dh, auth}}` → 204 (upsert por endpoint) | RN-27 |
| | `DELETE /api/push/assinaturas` | A | `{endpoint}` → 204 | RN-27 |
| | `GET /api/notificacoes/preferencias` | A | → `saida.Preferencias` | RN-27 |
| | `PUT /api/notificacoes/preferencias` | A | `entrada.Preferencias {fixas, lembrete_diario, lembrete_hora, metas}` → 204 | RN-27 |
| Conta | `POST /api/conta/exclusao` | A0 | `{senha}` → 202 (envia o link de confirmação) \| 400 `credenciais_invalidas` | RN-26 |
| | `POST /api/conta/exclusao/confirmar` | P | `{token}` → 204 (revoga as sessões e agenda a purga em 30 dias) \| 400 `link_expirado` (titular com membro ativo: lar encerrado com aviso por e-mail e no app ao membro; assinatura do Asaas cancelada na confirmação) | RN-26 |
| | `POST /api/conta/exclusao/cancelar` | P, LIMITE_PUBLICO | `{email, senha}` → 204 (dentro dos 30 dias) \| 400 `credenciais_invalidas` | RN-26 |
| Saúde | `GET /api/health` | P | → `{ ok: true, versao }` sem banco | — |

**Contagem:** o §6.1 tem 41 entradas (36 operações + 5 views), em 42 combinações de método e rota, porque a view `metas` vira lista e detalhe. O §6.2 tem 32 linhas; sem repetir o health, são 31 rotas novas. Total de **73 rotas**.

---

## 7. Erros

Corpo único: `{ "code": "<código estável>", "message": "<texto pt-BR seguro>" }`. A validação pode trazer `campos?: Record<string, string>`, sem ecoar o valor recebido. O front decide pelo `code`. O `message` serve só de reserva, e as traduções ficam em `rotulos/erros.ts`.

| Código | HTTP | Origem |
|---|---|---|
| `valor_invalido` | 400 | legado; também a falha da validação Zod |
| `credenciais_invalidas` | 400 | legado (auth); também e-mail inexistente (anti-enumeração com `HASH_FIXO`, GP `contas.ts`) |
| `senha_fraca` | 400 | legado (auth): de 12 caracteres a 72 bytes (RN-19, G-17) |
| `link_expirado` | 400 | legado (auth); vale para confirmação, recuperação e exclusão |
| `sessao_expirada` | 401 | sem sessão, sessão expirada ou revogada (o front chama de `autenticacao`) |
| `token_invalido` | 401 | webhook |
| `sem_permissao` | 403 | legado (RN-06/07) |
| `plano_necessario` | 403 | RN-25 |
| `origem_invalida` | 403 | CSRF |
| `email_nao_confirmado`, `conta_em_exclusao` | 403 | RN-19, RN-26 |
| `titular_obrigatorio` | 403 | rota só do titular |
| `registro_invalido` | 404 | legado: "não existe" e "não é seu" dão o mesmo código e o mesmo status (anti-enumeração); id de corpo também |
| `convite_invalido` | 404 | RN-23 |
| `rota_inexistente` | 404 | `notFound` |
| `sem_lar` | 409 | autenticado sem lar: o front leva a `/app/bem-vindo` |
| `em_uso`, `categoria_em_uso`, `nome_repetido` | 409 | legado |
| `ocorrencia_paga`, `confirmar_descarte_ajustes` | 409 | legado |
| `lar_cheio`, `convite_pendente`, `ja_tem_lar` | 409 | RN-22, RN-23 |
| `assinatura_ativa`, `sem_assinatura` | 409 | RN-24 |
| `corpo_grande` | 413 | `bodyLimit` |
| `categoria_arquivada`, `forma_arquivada`, `conta_arquivada` | 422 | legado; recusa depois de `registro_invalido` (ordem preservada) |
| `retirada_maior_que_guardado` | 422 | legado |
| `muitas_requisicoes`, `muitas_tentativas` | 429 | rate limit, RN-21 |
| `erro_interno` | 500 | `onError` (log só com `erro.name`) |
| `indisponivel` | 503 | banco ou Hyperdrive fora; Asaas fora em `assinar` |

- **Tradução dos erros do Postgres** (`infraestrutura/db/codigo-erro.ts`):
  - `23505` em `categoria_unica` → `nome_repetido`;
  - `23505` em `membro_um_convidado` ou `membro_um_titular` → `lar_cheio`;
  - `23505` em `membro_um_lar_ativo` → `ja_tem_lar`;
  - `23503` na exclusão → `em_uso` ou `categoria_em_uso`;
  - `42501` ou violação de RLS → `registro_invalido`;
  - `23514` → `valor_invalido`.
- Os códigos do legado (`C erros.ts`) continuam com o mesmo nome. A lista só cresce.
- **Mudança de transporte:** no legado tudo era 400 com `message = código`. Agora o código vai em `code`, e o status varia. O `dados/erros.ts` do front lê o `code`.

---

## 8. Fluxos

### 8.1 Cadastro e confirmação (RN-19)

```mermaid
sequenceDiagram
  autonumber
  participant U as Navegador
  participant W as Worker
  participant DB as Neon
  participant R as Resend
  U->>W: POST /api/cadastro {nome, email, senha, aceite}
  W->>W: LIMITE_PUBLICO, CSRF, Zod, senha_fraca?
  W->>DB: BEGIN; usuario existe?
  alt e-mail novo
    W->>DB: INSERT usuario (crypt(senha, gen_salt('bf',12)))
    W->>DB: INSERT aceite_termos (versões atuais)
    W->>DB: INSERT token_email (confirmacao, hash, 30 min)
    W->>DB: COMMIT
    W-)R: waitUntil: e-mail "Confirme seu e-mail" (link /confirmar#t=token)
  else e-mail já cadastrado
    W->>DB: crypt() com HASH_FIXO (mesmo custo)
    W-)R: waitUntil: e-mail "Você já tem conta"
  end
  W-->>U: 202 (mesma resposta e mesmo tempo)
  U->>U: abre o link; o front lê o token do fragmento
  U->>W: POST /api/cadastro/confirmar {token}
  W->>DB: UPDATE token_email SET usado_em ... WHERE hash, finalidade, não usado, não expirado RETURNING usuario_id
  alt válido
    W->>DB: UPDATE usuario SET email_confirmado_em = now()
    W-->>U: 204, leva para /entrar
  else inválido ou expirado
    W-->>U: 400 link_expirado (oferece reenviar)
  end
```

### 8.2 Entrar (RN-20, RN-21)

```mermaid
sequenceDiagram
  autonumber
  participant U as Navegador
  participant W as Worker
  participant DB as Neon
  U->>W: POST /api/sessao/entrar {email, senha}
  W->>W: LIMITE_ENTRAR (IP), CSRF, Zod
  W->>DB: BEGIN; falhas na janela de 15 min por email_hash e por ip_hash
  alt 5 ou mais falhas
    W-->>U: 429 muitas_tentativas
  else
    W->>DB: SELECT id, crypt(senha, coalesce(senha_hash, HASH_FIXO)) = coalesce(senha_hash, HASH_FIXO) AS ok
    alt ok e e-mail confirmado e sem exclusão pendente
      W->>DB: INSERT tentativa_login (sucesso)
      W->>DB: INSERT sessao (token_hash, criada_em, expira_absoluta_em = +12 h)
      W->>DB: COMMIT
      W-->>U: 204 Set-Cookie __Host-sid (Secure, HttpOnly, SameSite=Lax)
    else ok, mas e-mail não confirmado
      W-->>U: 403 email_nao_confirmado
    else falha
      W->>DB: INSERT tentativa_login (falha); COMMIT
      W-->>U: 400 credenciais_invalidas
    end
  end
  U->>W: GET /api/sessao
  W-->>U: 200 {usuario, membro, lar, plano}
  Note over U: sem lar, vai para /app/bem-vindo, que chama POST /api/lar
```

### 8.3 Lançar despesa offline e reenviar (ADR-007 do legado, P5)

```mermaid
sequenceDiagram
  autonumber
  participant T as Tela Lançar
  participant F as dados/fila (IndexedDB)
  participant W as Worker
  participant DB as Neon
  T->>T: gera id (uuid v4) no aparelho
  T->>W: POST /api/lancamentos/despesas {id, ...}
  W--xT: falha de rede, ou 401 por sessão expirada (15 min)
  T->>F: enfileira {id, args, dono: usuario.id da última sessão}
  T-->>T: "Salvo no aparelho, será enviado"
  Note over T,F: receita sem conexão não entra na fila (sem_conexao)
  T->>W: POST /api/sessao/entrar (usuário volta)
  W-->>T: 204 + cookie
  T->>W: GET /api/sessao
  W-->>T: usuario.id
  F->>F: filtra os itens com dono = usuario.id (os de outro usuário ficam parados)
  loop cada item, em ordem
    F->>W: POST /api/lancamentos/despesas {mesmo id}
    W->>DB: BEGIN + GUC; INSERT ... ON CONFLICT (id)
    alt id novo
      W-->>F: 201 {..., ja_existia: false}
    else já gravado pelo mesmo membro
      W-->>F: 200 {..., ja_existia: true}
    else id de outro
      W-->>F: 404 registro_invalido (fica marcado como erro para a tela)
    end
    F->>F: remove o item; invalida as consultas do mês
  end
```

### 8.4 Convite (RN-23)

```mermaid
sequenceDiagram
  autonumber
  participant Ti as Titular
  participant W as Worker
  participant DB as Neon
  participant R as Resend
  participant Co as Convidado
  Ti->>W: POST /api/lar/convites {email}
  W->>DB: GUC (titular); membros ativos < 2? há convite pendente?
  W->>DB: INSERT convite (token_hash, 7 dias, lar_nome, convidado_por_nome)
  W-)R: e-mail "Você foi convidado" (link /convite#t=token)
  W-->>Ti: 201
  Co->>Co: abre o link; sem sessão, cadastra-se ou entra com o MESMO e-mail
  Co->>W: GET /api/convites/atual?token=
  W->>DB: GUC (usuario e email, sem lar); SELECT convite WHERE token_hash AND email = app.email_atual()
  W-->>Co: {lar_nome, convidado_por_nome}
  Co->>W: POST /api/convites/aceitar {token}
  W->>DB: já tem membro ativo?
  alt já tem lar
    W-->>Co: 409 ja_tem_lar (lar com dados); lar só com categorias iniciais é descartado e o aceite segue
  else
    W->>DB: INSERT membro (papel 'membro'); índice único garante o limite de 2
    W->>DB: UPDATE convite SET situacao = 'aceito'
    W->>DB: refaz os GUCs; INSERT das 7 categorias individuais do novo membro
    W->>DB: COMMIT
    W-->>Co: 204, leva para /app
  end
```

### 8.5 Assinatura e webhook (RN-24)

```mermaid
sequenceDiagram
  autonumber
  participant Ti as Titular
  participant W as Worker
  participant DB as Neon
  participant A as Asaas
  participant R as Resend
  Ti->>W: POST /api/plano/assinar {cpf_cnpj}
  W->>DB: GUC; papel = titular? assinatura do lar
  W->>A: POST /customers (nome, e-mail, cpfCnpj): o CPF não é guardado aqui
  W->>A: POST /subscriptions (PIX, R$ 9,90, MONTHLY, externalReference = lar_id)
  A-->>W: subscription.id e 1ª cobrança
  W->>A: GET /payments/{id}/pixQrCode
  W->>DB: UPDATE assinatura (asaas_ids, cobranca_*); COMMIT
  W-->>Ti: 201 MeuPlano com Pix copia-e-cola e QR
  A->>W: POST /api/webhooks/asaas (asaas-access-token)
  W->>W: LIMITE_WEBHOOK; compara o token em tempo constante
  W->>DB: BEGIN; set_config('app.sistema','webhook',true)
  W->>DB: INSERT webhook_evento (event_id) ON CONFLICT DO NOTHING
  alt evento repetido
    W-->>A: 200 (nada muda)
  else evento novo
    W->>DB: SELECT assinatura WHERE asaas_assinatura_id FOR UPDATE
    alt ocorrido_em < ultimo_evento_em
      W->>DB: marca o evento como processado e ignorado
    else
      W->>W: dominio/plano.ts: transicao(situacao, evento)
      W->>DB: UPDATE assinatura (situacao, periodo_ate, ultimo_evento_em)
    end
    W->>DB: UPDATE webhook_evento SET processado_em; COMMIT
    W-)R: e-mail conforme o evento (cobrança gerada, confirmado, atraso)
    W-->>A: 200
  end
```

Transições em `dominio/plano.ts`:

| Evento Asaas | Situação resultante |
|---|---|
| `PAYMENT_CREATED` | situação mantida; guarda a cobrança |
| `PAYMENT_CONFIRMED`, `PAYMENT_RECEIVED` | `ativa`, com `periodo_ate` = vencimento + 1 mês |
| `PAYMENT_OVERDUE` | `atrasada` |
| `SUBSCRIPTION_DELETED`, `SUBSCRIPTION_INACTIVATED` | `cancelada` |

Trial expirado sem pagamento: o plano efetivo vira `free`, sem precisar de evento. O momento de perder o Pro segue a decisão D4 (§3.4).

### 8.6 Push por cron (RN-27)

```mermaid
sequenceDiagram
  autonumber
  participant C as Cron 0 * * * *
  participant W as Worker scheduled
  participant DB as Neon
  participant P as Serviço de push
  C->>W: scheduled(evento, env, ctx)
  W->>W: hora = horaSaoPaulo(agora)
  W->>DB: BEGIN; set_config('app.sistema','cron',true)
  opt hora == 9
    W->>DB: ocorrências do dia (vence hoje ou amanhã) e atrasadas de ontem, não pagas, de fixas ativas, com preferencia.fixas
  end
  W->>DB: membros com lembrete_diario e lembrete_hora == hora, sem lançamento hoje
  W->>DB: push_subscription desses membros (lotes de 50)
  W->>DB: COMMIT
  loop lote, em ctx.waitUntil
    W->>W: JWT VAPID ES256 (crypto.subtle) e carga aes128gcm
    W->>P: POST endpoint (TTL, Urgency)
    alt 201
      W->>DB: ultimo_envio_em = now()
    else 404 ou 410
      W->>DB: DELETE push_subscription
    else erro
      W->>DB: falhas = falhas + 1 (remove em 5)
    end
  end
  Note over W: "meta atingida" não usa o cron. É enviado em waitUntil depois do COMMIT de movimentar_meta, para quem vê a meta
```

A carga do push tem só título, texto curto e URL `/app/...`. Não leva valor nem descrição da despesa individual do outro membro (RN-02).

---

## 9. Front

### 9.1 Estrutura (a mesma do legado)

```
frontend/web/src/
├── paginas/        # rotas finas: publicas/ (landing, entrar, cadastro, confirmar, redefinir, termos, privacidade, convite) e app/
├── componentes/    # base/ (~45) e de tela, com *.module.css (~90)
├── ganchos/        # TanStack Query e estado de URL; novos: useSessao, usePlano, useLar, usePush
├── dados/          # ÚNICO módulo com fetch e IndexedDB (reescrito)
├── formatacao/     # moeda, data, mês pt-BR
├── rotulos/        # enums do contrato e mensagens de erro por code
├── comum/          # tipos e funções puras (ErroDados, ehUuid, tipos de fila)
├── configuracao/   # ambiente (VITE_SENTRY_DSN, versão)
├── pwa/            # registro do SW, sw.ts (injectManifest: precache, push, notificationclick), instrução de instalação iOS
└── estilo/         # tokens.css, global.css, fontes IBM Plex locais
```

| Item | Ação |
|---|---|
| `estilo/`, `*.module.css`, `componentes/base`, componentes de apresentação, `formatacao/`, `rotulos/`, `comum/`, ícones, sprite SVG, `clienteConsulta.ts` | **Copiar** sem mudança |
| `pwa/` | Copiar e adaptar: `start_url` e `scope` em `/app/`; `navigateFallback: '/index.html'` com allowlist `^/app` e denylist `^/api`; troca de `generateSW` por `injectManifest` por causa dos handlers de push |
| `dados/fila` | Copiar e adaptar: o dono vem de `GET /api/sessao` (`usuario.id`), não mais do supabase-js |
| `dados/` (cerca de 30 arquivos), `mapaRotas.tsx`, guardas de rota | **Reescrever** |
| `rotulos/erros.ts` | Acrescentar os códigos novos (§7) |
| Telas novas: landing, cadastro, confirmar, recuperação, termos, privacidade, bem-vindo, convite, lar, Meu plano, notificações, exclusão | **Criar** com os componentes base e os tokens (P9) |
| CSP | Sai do `vercel.json` e vai para `public/_headers`: `default-src 'self'`; `connect-src 'self'` e o ingest do Sentry; `frame-ancestors 'none'`; HSTS, `nosniff`, `Referrer-Policy: no-referrer`, `Permissions-Policy` |

### 9.2 Camada `dados/`

| Arquivo | Responsabilidade |
|---|---|
| `transporte.ts` | `chamar(metodo, rota, corpo?)`: `fetch('/api/…', { credentials: 'same-origin' })`, `X-Controle-Em-Casa: 1` nas escritas, JSON, `AbortSignal` com 10 s, validação da resposta com o schema Zod `saida.*` **só em dev e teste** (em produção, só tipos) |
| `erros.ts` | Converte a resposta em `ErroDados`: 401 → `autenticacao`; 429 e 5xx → `indisponivel`; falha de rede → `rede`; senão, o `code` |
| `sessao.ts` | `sessaoAtual`, `entrar`, `sair`, `sairDeTodos` (401 conta como "já sem sessão"; sem rede mantém), `cadastrar`, `confirmar`, `pedirRedefinicao`, `redefinir`; um 401 global invalida o cache e leva a `/entrar?volta=` |
| `consultas/*`, `comandos/*` | Uma função por rota do §6, com os mesmos nomes exportados do legado (`buscarResumoMes`, `lancarDespesa`…) |
| `fila/` | IndexedDB; itens `{id, args, dono, criado_em, erro?}`; esvazia depois do login e no evento `online`, só com os itens do mesmo `dono`; ao trocar de usuário, os itens do anterior ficam guardados e não são enviados |
| `push.ts` | `pedirPermissao`, `assinar` (com a chave de `GET /api/push/chave`), `remover` |

O cookie é `HttpOnly`: o front não o lê. "Estou logado?" vem sempre de `GET /api/sessao`.

### 9.3 Rotas do front

| Rota | Tela | Guarda |
|---|---|---|
| `/` | Landing (proposta, planos, "Começar grátis") | pública |
| `/entrar`, `/cadastro`, `/confirmar`, `/redefinir-senha` | Acesso (layout do legado em Entrar e Redefinir) | pública; logado vai para `/app` |
| `/termos`, `/privacidade` | Páginas legais versionadas | pública |
| `/convite` | Lê o token do fragmento; sem sessão, manda entrar ou cadastrar e volta | pública |
| `/app/bem-vindo` | Cria o lar (`POST /api/lar`) | sessão sem lar |
| `/app`, `/app/lancar` | Início e folha Lançar | sessão + lar |
| `/app/lancamentos`, `/app/lancamentos/:id` | Lista e detalhe | sessão + lar |
| `/app/fixas`, `/app/fixas/nova`, `/app/fixas/:id` | Fixas | sessão + lar |
| `/app/orcamento` | Orçamento (somente leitura no Free, com aviso e link para o plano) | sessão + lar |
| `/app/metas`, `/app/metas/nova`, `/app/metas/:id`, `/app/metas/:id/editar` | Metas (nova e editar exigem Pro) | sessão + lar |
| `/app/ajustes` e `/app/ajustes/{contas,formas,categorias}[/nova\|/:id]` | Ajustes, como no legado | sessão + lar |
| `/app/ajustes/lar` | Membros e convite | sessão + lar |
| `/app/ajustes/plano` | Meu plano | sessão + lar |
| `/app/ajustes/notificacoes` | Push e preferências | sessão + lar |
| `/app/ajustes/conta` | Sair de todos e exclusão de conta | sessão |
| `*` | Não encontrada | — |

---

## 10. Onde cada cálculo roda

O Worker Free tem **10 ms de CPU** por requisição. O tempo esperando o banco não conta como CPU, mas parsear e somar milhares de linhas em JS conta (R1). Por isso:
- o que soma ou agrega muitas linhas vira **SQL via Kysely**, em `infraestrutura/db/consultas/`;
- o que decide sobre poucos valores fica em `dominio`, puro e testado com os casos portados do pgTAP.

| Cálculo | Onde | Por quê |
|---|---|---|
| Totais do mês: conjunto, minha parte, meu individual, variáveis, por categoria, `pago_por_membro` em valor (RN-16) | SQL: `consultas/resumo.ts` (`sum … filter`, `group by`, CTEs) | Agrega todas as parcelas do mês |
| Percentuais do `pago_por_membro` (o último fecha 100) | `dominio/percentuais.ts` | 2 valores |
| Saldo das contas (RN-12, `data <= hoje`) | SQL: `consultas/saldos.ts` | Soma receitas, pix/débito e movimentos |
| Gasto do cartão no mês e comprometido futuro (RN-13) | SQL: `consultas/cartao.ts` | Soma parcelas |
| Orçado × realizado por categoria e o total do escopo | SQL: `consultas/orcamento.ts` | Soma parcelas por categoria |
| Situação do orçamento (< 80, ≤ 100, > 100) e destaques top 3 | `dominio/orcamento.ts` | Poucas linhas já agregadas |
| Guardado por meta e por local | SQL: `consultas/metas.ts` | Soma movimentos |
| Progresso da meta (falta, % limitado a 99, mensal necessário), marcar e desmarcar `atingida_em` | `dominio/metas.ts` | Valores escalares |
| Lista do mês com filtros e `total_filtrado` | SQL: `consultas/lancamentos-mes.ts` | Uma página de parcelas, já ordenada |
| Geração das parcelas, `diaNoMes`, dia congelado, resto na 1ª parcela (RN-14) | `dominio/parcelas.ts` | Até 24 itens |
| Permissões de edição campo a campo (RN-06, RN-07) e correção da fixa (RN-28) | `dominio/permissoes.ts` | Matriz pequena |
| Meses em que a fixa gera ocorrência e a situação paga, atrasada ou pendente | `dominio/fixas.ts`; inserção em lote `INSERT … SELECT … ON CONFLICT DO NOTHING` | Janela de ±12 meses |
| Hoje e mês em São Paulo, `mesFechado` | `dominio/datas.ts` (`Intl.DateTimeFormat` com `timeZone: 'America/Sao_Paulo'`) | — |
| Plano efetivo e transições do Asaas | `dominio/plano.ts` | — |
| Privacidade da resposta (omitir `pagamento` e `data_ajustada`) | `aplicacao/lancamentos/detalhe.ts`; o SQL nem seleciona as colunas privadas para quem não é o pagador | Duas camadas: RLS e montagem da resposta |

- **Medição:** na etapa 9, com a massa sintética de 2 anos (cerca de 6 mil parcelas), `wrangler dev` mede a CPU de `GET /api/resumo`, `GET /api/lancamentos` e `GET /api/orcamento`.
- **Meta:** p95 abaixo de 5 ms de CPU, com folga para o Sentry.
- **Se passar:** mais cálculo vai para o SQL antes de seguir (PLANO, etapa 9).
- **Medição da etapa 9 (2026-10-25, `wrangler dev` local no Windows, massa de 2 anos com 5.718 parcelas):** `pnpm --filter @controle/scripts massa` grava a massa e `medir-cpu` mede a CPU do processo `workerd` por requisição (média de 200 requisições sequenciais, duas rodadas). O perfilador do V8 pelo inspetor não serviu: no Windows ele amostra a poucos ms e o workerd não marca o tempo ocioso. Resultado, em ms de CPU do processo menos a referência `/api/health` (6,5 a 7,0 ms): `/api/sessao` (sem agregação) 11 a 19; `/api/contas` 10 a 15; `/api/resumo` 17 a 22; `/api/resumo?mes=2026-01-01` 22 a 23; `/api/lancamentos` 13 a 20; `/api/fixas/ocorrencias` 11 a 16; `/api/formas` 10 a 21. O ruído entre rodadas (±5 ms) é do mesmo tamanho do incremento das agregações sobre a linha de base com banco (`/api/sessao`). Leitura: a linha de base local (proxy do wrangler, HTTP, conexão nova com o Postgres por requisição, sessão e transação) já passa de 10 ms neste método; as agregações já estão em SQL e o JS do resumo só compõe dezenas de linhas. O limite de 10 ms **não pôde ser certificado localmente**: a confirmação fica para a medição no ambiente publicado (etapa 17, `cpuTime` dos logs do Workers). Decisão pendente do usuário (ver relatório da etapa 9).
- Em produção, a resposta não passa pelo Zod. O schema serve para tipar e para os testes de contrato.

---

## 11. Configuração

### 11.1 `wrangler.jsonc` (raiz)

```jsonc
{
  "name": "controle-em-casa",
  "main": "backend/api/src/entrada/worker.ts",
  "compatibility_date": "2026-10-01",
  "compatibility_flags": ["nodejs_compat"],
  "assets": {
    "directory": "frontend/web/dist",
    "not_found_handling": "single-page-application",
    "run_worker_first": ["/api/*"]
  },
  "hyperdrive": [
    {
      "binding": "HYPERDRIVE",
      "id": "<id do Hyperdrive de produção>",
      "localConnectionString": "postgres://controle_app:controle_app@localhost:5432/controle"
    }
  ],
  "ratelimits": [
    { "name": "LIMITE_ENTRAR",  "namespace_id": "2001", "simple": { "limit": 10, "period": 60 } },
    { "name": "LIMITE_PUBLICO", "namespace_id": "2002", "simple": { "limit": 30, "period": 60 } },
    { "name": "LIMITE_WEBHOOK", "namespace_id": "2003", "simple": { "limit": 60, "period": 60 } }
  ],
  "triggers": { "crons": ["0 * * * *", "30 6 * * *"] },
  "vars": {
    "URL_PUBLICA": "http://localhost:8787",
    "MAIL_FROM": "Controle em Casa <nao-responda@ljssoftware.com.br>",
    "ASAAS_API_URL": "https://api-sandbox.asaas.com/v3",
    "VAPID_PUBLIC_KEY": "<chave pública base64url>",
    "VAPID_SUBJECT": "mailto:contato@ljssoftware.com.br",
    "AMBIENTE": "local"
  },
  "observability": { "enabled": true }
}
```

- O deploy injeta `--var URL_PUBLICA:https://controleemcasa.ljssoftware.com.br --var AMBIENTE:producao --var ASAAS_API_URL:https://api.asaas.com/v3 --var SENTRY_RELEASE:<sha>`. Só existe um `wrangler deploy`, no `deploy.yml`, garantido por teste (padrão GP).
- `deploy.yml` (etapa 16, ADR-015): disparo manual (`workflow_dispatch`, emenda de 2026-10-27) só da `main`; o job `conferir` (sem segredo) exige o run do `ci` do mesmo SHA, num push à `main`, concluído com sucesso; então publica a ponta da `main` (`github.sha`) no environment `producao` (sem revisor). Ordem fixa: build do front → cache do Hyperdrive conferido (`caching.disabled`) → dump cifrado (`backup_ro`, `age`, artefato de 30 dias; o único ponto de retorno antes de migrar, porque o Neon tem só as branches `main` e `dev`, ADR-017) → migração com o `owner` → `wrangler deploy` → `GET /api/health`. Falha depois da migração faz `wrangler rollback` (se o Worker já tinha sido publicado) e aponta o dump. Inerte até `DEPLOY_ATIVO = true` (etapa 17).
- `backup.yml` (etapa 16, ADR-015): todo dia às 07:00 UTC (04:00 BRT), `pg_dump --format=custom --enable-row-security` como `backup_ro`, com o cliente do Postgres 18 (imagem fixada por digest; ADR-016), em pipe para `age -r $AGE_RECIPIENT`; só o `.age` sai do runner, como artefato do Actions de 30 dias. Inerte até `BACKUP_ATIVO = true` (etapa 17).
- O cron `30 6 * * *` (03:30 BRT) faz a limpeza:
  - sessões expiradas;
  - tentativas com mais de 24 h;
  - tokens expirados há mais de 1 dia;
  - `webhook_evento` com mais de 90 dias;
  - convites pendentes vencidos, que viram `expirado`.

### 11.2 Variáveis de ambiente

| Nome | Onde | Obrigatória | Formato | Segredo |
|---|---|---|---|---|
| `HYPERDRIVE` | binding do Worker | sim | — | (conexão como `controle_app`) |
| `LIMITE_ENTRAR`, `LIMITE_PUBLICO`, `LIMITE_WEBHOOK` | binding | sim em produção (sem binding no local, não limita; em https, registra a ausência, padrão GP) | — | não |
| `URL_PUBLICA` | var | sim | URL `https://…` sem barra final | não |
| `AMBIENTE` | var | sim | `local`, `teste` ou `producao` | não |
| `MAIL_FROM` | var | sim | `Nome <email>` | não |
| `RESEND_API_KEY` | `wrangler secret` | sim (em `local`, um transporte de console é aceito) | `re_…` | **sim** |
| `ASAAS_API_URL` | var | sim | URL sandbox ou produção | não |
| `ASAAS_API_KEY` | secret | sim a partir da etapa 13 | `$aact_…` | **sim** |
| `ASAAS_WEBHOOK_TOKEN` | secret | sim a partir da etapa 13 | 32 ou mais caracteres aleatórios | **sim** |
| `VAPID_PUBLIC_KEY` | var | sim a partir da etapa 15 | P-256, base64url (65 bytes) | não |
| `VAPID_PRIVATE_KEY` | secret | sim a partir da etapa 15 | `d` da JWK, base64url (32 bytes) | **sim** |
| `VAPID_SUBJECT` | var | sim | `mailto:` | não |
| `CHAVE_HMAC` | secret | sim | 32 bytes, base64url (hash de e-mail e IP nas tentativas) | **sim** |
| `SENTRY_DSN` | secret | não (sem ele, o Sentry fica desligado) | URL DSN | sim (tratado como segredo) |
| `SENTRY_RELEASE` | `--var` no deploy | não | SHA do commit | não |
| `VITE_SENTRY_DSN` | build do web | não | URL DSN | não (vai para o bundle) |
| `DATABASE_URL_OWNER` | `.env` local e GitHub `producao` | sim para migrar, seed e purga | `postgres://controle_owner:…` | **sim** |
| `DATABASE_URL_BACKUP` | GitHub `producao` | sim para o backup e o dump do deploy | `postgres://controle_backup_ro:…` | **sim** |
| `AGE_RECIPIENT` | GitHub `producao` (variável) | sim para o backup e o deploy | chave pública `age1…` | não (a identidade privada fica offline, fora do GitHub) |
| `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID` | GitHub `producao` (secret / variável) | sim para o deploy | — | **sim** / não |
| `DEPLOY_ATIVO`, `BACKUP_ATIVO`, `PURGA_ATIVA` | variáveis do repositório no GitHub | `true` liga o `deploy.yml`, o `backup.yml` e o `purga.yml` (etapa 17); sem elas, nada roda | `true` | não |
| `ASAAS_API_URL` | GitHub `producao` (variável, para a purga) | sim para a purga | URL de produção | não |
| `SENTRY_AUTH_TOKEN` | GitHub `producao` | não (upload de sourcemaps) | — | **sim** |

O `config/index.ts` valida tudo com Zod na 1ª requisição e falha fechado (`ConfigInvalida`, sem logar o valor). O `.env.example` traz cada variável comentada. No local, os segredos ficam em `.dev.vars`, que está no `.gitignore` e é coberto pelo gitleaks.

### 11.3 `docker-compose.yml`

```yaml
services:
  banco:
    image: postgres:18-alpine
    environment:
      POSTGRES_DB: controle
      POSTGRES_USER: controle_owner
      POSTGRES_PASSWORD: controle_owner
      TZ: UTC
    ports: ["5432:5432"]
    volumes:
      - dados-banco:/var/lib/postgresql # no 18 o PGDATA é /var/lib/postgresql/18/docker
      - ./backend/scripts/init-local.sql:/docker-entrypoint-initdb.d/01-roles.sql:ro
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U controle_owner -d controle"]
      interval: 2s
      retries: 30
volumes:
  dados-banco:
```

- `init-local.sql` cria `controle_app` e `controle_backup_ro` com senhas locais fixas. Em produção, as roles são criadas à mão no Neon na etapa 17 e ficam registradas no runbook.
- `pnpm migrar`: `node-pg-migrate up` como owner, uma transação por migration, arquivos `backend/scripts/migracoes/AAAAMMDDHHMMSS_nome.sql`.
- `pnpm seed`: 2 lares, cada um com 2 membros, e a massa de 2 anos no lar A, só para o local.
- O CI usa o mesmo `postgres:18` como serviço.

---

## 12. Testes

### 12.1 Pirâmide

| Nível | Ferramenta | Escopo | Base portada do legado |
|---|---|---|---|
| Domínio | Vitest | `backend/dominio`: parcelas, datas, permissões, orçamento, metas, fixas, plano, percentuais. Tabelas de casos | pgTAP de regra (F `gerar_parcelas`, `dia_no_mes`, `permissoes_edicao`, `situacao_orcamento`, `progresso_meta` etc.) |
| Banco | Vitest + `pg` no Postgres 18 | Grants e RLS por tabela como `controle_app` (DDL e DELETE recusados, políticas, índices de limite de membros), migrations do zero | pgTAP de RLS e de privilégios |
| API | `@cloudflare/vitest-pool-workers` + Postgres real (`localConnectionString`) | Cada rota: contrato Zod de entrada e saída, códigos de erro, idempotência, ordem das recusas, plano, CSRF, rate limit, sessão (15 min e 12 h com relógio injetado), webhook (repetido e fora de ordem) | `backend/testes-api/casos/*` (241 casos) e `_meta.test.ts` |
| Front | Vitest + Testing Library + axe | Componentes, ganchos, `dados/` com `fetch` simulado em `/api/*`, fila offline | cerca de 75 arquivos; os mocks do Supabase são regravados |
| E2E | Playwright | Críticos: cadastro → confirmar → entrar → criar lar; lançar (também offline → reenvio); convite; assinar no sandbox; comparação visual contra o mockup | cerca de 45 specs |

### 12.2 Testes obrigatórios

- **Isolamento negativo por rota.** Uma tabela gerada a partir do registro de rotas, que falha se uma rota ficar de fora, roda para cada rota autenticada:
  1. um usuário do lar B tenta ler e escrever cada recurso do lar A pelo id → `404 registro_invalido`, sem diferença entre "não existe" e "é de outro";
  2. o membro 2 tenta ler e escrever o individual do membro 1 (conta, forma, categoria individual, lançamento individual, orçamento e meta individuais, `lancamento_pagamento`) → `404 registro_invalido`;
  3. o detalhe de uma conjunta paga pelo membro 1, visto pelo membro 2, não tem as chaves `pagamento` nem `data_ajustada` (`'pagamento' in corpo === false`);
  4. totais do resumo de 2 não mudam quando 1 lança algo individual (RN-16e).
- **Vazamento de GUC** (§5.3): concorrência A/B, GUC vazio depois do COMMIT e do ROLLBACK, nenhuma linha sem GUC, nenhuma rota de usuário definindo `app.sistema`.
- **Grants:** `controle_app` não consegue DDL, `DELETE` em `meta`, `movimento_meta` e `despesa_fixa`, `UPDATE` de `meta.escopo`, nem `SET ROLE`.
- **Limite de membros:** 2 aceites simultâneos no mesmo lar → um 204 e um 409 `lar_cheio`.
- **Anti-enumeração:** cadastro, "esqueci" e entrar com e-mail inexistente × existente dão a mesma resposta, e o tempo fica dentro da mesma faixa (bcrypt com `HASH_FIXO`).
- **Correção da fixa (RN-28):** o pagador edita o valor do pagamento da fixa → a parcela continua na data de vencimento. A troca para categoria individual é recusada (`sem_permissao`).
- **Webhook:** o mesmo `event_id` 2 vezes aplica uma vez só; `CONFIRMED` depois de `OVERDUE` com `ocorrido_em` anterior é ignorado; token errado → 401.
- **Logs sem PII:** `onError` e Sentry `beforeSend` sem e-mail, token, cookie ou corpo da requisição (teste com e-mail no corpo de uma requisição que falha).

`pnpm lint && pnpm typecheck && pnpm test` verdes antes de cada commit (PLANO). O CI roda tudo isso com o serviço Postgres 18, mais gitleaks e a checagem de migration aditiva.

---

## 13. Decisões deste documento (para ADR)

| # | Decisão | Por quê |
|---|---|---|
| D-01 | Limite de 2 membros com dois índices únicos parciais (titular e membro), sem `posicao` e sem gatilho | Concorrência e RLS não interferem: a unicidade não enxerga política |
| D-02 | GUCs `app.usuario_id`, `app.email`, `app.lar_id`, `app.membro_id` (e `app.sistema` só em webhook, cron e purga), todos com `set_config(…, true)` | O lar e o membro vêm da linha de `membro`, não do cliente. As políticas ficam sem subconsulta e sem recursão. Não há `SECURITY DEFINER` |
| D-03 | Tabelas de acesso sem RLS por linha, protegidas por segredo e grants de coluna | A identidade ainda não existe quando elas são lidas |
| D-04 | `editar_lancamento` sem `SECURITY DEFINER`: a política de update da conjunta vale para os dois membros, e a matriz RN-06 fica em `dominio`. Revisado em 2026-10-25 (etapa 8): o outro membro não lê nem grava `lancamento_pagamento`, então edita só descrição, valor (redistribuído mantendo as datas das parcelas) e categoria do mesmo escopo; a data é só do pagador (RN-06 revisada) | Remove a única exceção do legado sem abrir a parte privada (G-10) |
| D-05 | Purga das exclusões por `purgar.ts` no GitHub Actions, como owner | O `app` continua sem DELETE em `meta`, `movimento_meta` e `despesa_fixa` |
| D-06 | Backup com `--enable-row-security` e a política `backup_leitura` | Dispensa BYPASSRLS no Neon |
| D-07 | Tokens de confirmação, recuperação, exclusão e convite no fragmento da URL (`#t=`) | O token não aparece em log de servidor nem em `Referer` |
| D-08 | Retornos escalares do legado viram objetos JSON; `void` vira 204 | REST consistente; só o `dados/` do front adapta |

---

## 14. Pontos decididos (antes `[A ESCLARECER]`)

| # | Ponto | Onde afeta | **Resolvido** (2026-10-24) |
|---|---|---|---|
| E-1 | Exclusão do titular com membro ativo | RN-26, `POST /api/conta/exclusao/confirmar`, `purgar.ts` | O lar é encerrado com aviso (e-mail e app) ao membro; prazo = janela de 30 dias; na purga o lar inteiro some, inclusive o individual do membro, que cai no primeiro acesso com lar novo vazio. Assinatura do Asaas cancelada na confirmação |
| E-2 | Saída ou remoção de membro | RN-22, `membro.saiu_em`, `DELETE /api/lar/membros/:id`, `POST /api/lar/sair` | Individual purgado em 30 dias; conjuntas ficam com "Ex-membro"; `lancamento_pagamento` apagado; movimentos de meta conjunta ficam sem a conta. O titular pode remover o membro. O ex-membro cai no primeiro acesso |
| E-3 | Convidado que já tem lar | RN-23, `POST /api/convites/aceitar` | Lar só com categorias iniciais é descartado no aceite; com qualquer dado, `409 ja_tem_lar` até ele excluir o próprio lar. Titular com membro: `ja_tem_lar` |
| E-4 | Momento em que o lar perde o Pro | RN-24, RN-25, `dominio/plano.ts` | Pro até `periodo_ate` no cancelamento; 3 dias de carência no `atrasada`; trial até o fim dos 14 dias; sem novo trial |

**Purga (D5):** `backend/scripts/purgar.ts`, agendado no GitHub Actions com a role owner (exceção registrada ao "owner só nas migrations"; ADR na etapa 14). A role `app` não ganha DELETE além do que já é regra; a role `purga` não será criada. A rotina apaga usuários em exclusão há 30 dias, contas não confirmadas há 7 dias e, após 30 dias, tentativas, tokens e sessões expiradas; `webhook_evento` fica 12 meses sem dados do pagador.

---

## 15. Rastreabilidade

| RN | Onde roda |
|---|---|
| RN-01 | `aplicacao/lancamentos/lancar.ts` (escopo lido da categoria) + FK `(categoria_id, tipo, escopo)` |
| RN-02, RN-03, RN-10 | RLS (§3) + filtro explícito nos repositórios + teste negativo (§12.2) |
| RN-04 | `aplicacao/lancamentos/detalhe.ts` + RLS de `lancamento_pagamento` |
| RN-05, RN-12, RN-13 | `consultas/saldos.ts`, `consultas/cartao.ts` |
| RN-06, RN-07, RN-28 | `dominio/permissoes.ts` + política `with check` de `lancamento` |
| RN-08, RN-09 | `dominio/metas.ts`, `consultas/metas.ts`, RLS de `movimento_meta` |
| RN-11 (legado) | Substituída por RN-22: vários lares, até 2 membros (D-01) |
| RN-14 | `dominio/parcelas.ts` |
| RN-15 | `dominio/fixas.ts`, `aplicacao/fixas/*` |
| RN-16 | `consultas/resumo.ts`, `dominio/percentuais.ts` |
| RN-17 | contrato + checks de `categoria` |
| RN-18 | checks de valor + `dominio/centavos.ts` |
| RN-19 | `aplicacao/acesso/cadastro.ts`, `confirmar.ts`, `aceite_termos` |
| RN-20 | `middlewares/sessao.ts`, `repositorios/sessoes.ts`, `sessao/cookie.ts` |
| RN-21 | `repositorios/tentativas.ts`, `LIMITE_ENTRAR` |
| RN-22 | `aplicacao/lar/*`, índices de `membro` |
| RN-23 | `aplicacao/lar/convite.ts`, política de `convite` |
| RN-24 | `aplicacao/plano/*`, `infraestrutura/asaas`, `dominio/plano.ts`, webhook |
| RN-25 | `middlewares/exigir-plano.ts` |
| RN-26 | `aplicacao/conta/exclusao.ts`, `backend/scripts/purgar.ts` |
| RN-27 | `aplicacao/agendadas/push.ts`, `infraestrutura/push`, `pwa/sw.ts` |
