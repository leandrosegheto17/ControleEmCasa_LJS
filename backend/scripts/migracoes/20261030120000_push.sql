-- Up Migration
-- Web Push (etapa 15, lote 1; SDD 3.6, 4, 5.3, 8.6, 11.1; RN-27, CA-27.1 a CA-27.8; G-04, G-36, G-39, G-49;
-- THREAT-MODEL TM-PUSH-01 a TM-PUSH-06, E-07; ADR-005, ADR-013, ADR-014).
--
-- 1. push_subscription: uma linha por aparelho autorizado (endpoint único). Ligada ao vínculo (membro e lar) em que
--    foi feita, e também ao usuário: o "sair de todos" e a exclusão de conta removem TODAS as inscrições do usuário,
--    inclusive as feitas num lar antigo (CA-27.6).
--    SPEC_DEVIATION: o SDD 3.6 não tem `usuario_id` e põe a RLS em `membro_id = app.membro_atual()`. Com isso a
--    confirmação da exclusão não alcançaria a inscrição feita num vínculo anterior (G-49). Aqui a leitura e a remoção
--    ficam com `usuario_id = app.usuario_atual()`; a inclusão exige o vínculo atual (membro e lar da sessão).
-- 2. preferencia_notificacao: as três preferências do membro (RN-27). Sem linha = os padrões (fixas e metas ligadas,
--    lembrete desligado às 20h).
-- 3. aviso_push: um registro por (membro, tipo, referência, dia) avisado. É a idempotência do CA-27.4: o aviso só sai
--    se o registro foi inserido agora (`on conflict do nothing`), mesmo com a rotina rodando duas vezes.
--    SPEC_DEVIATION: tabela a mais que o SDD 3.6 (25 → 26 tabelas); o SDD não diz onde guardar o "já avisado".
-- 4. Contexto do cron: `app.em_cron()` (só `app.sistema = 'cron'`), mais estrito que `app.em_sistema()` (que inclui o
--    webhook). O cron itera POR LAR com `set_config` local (TM-PUSH-01, E-07) e lê fixas, ocorrências e lançamentos
--    pelas políticas normais do lar (L e D); por isso as tabelas de negócio NÃO ganham política de sistema.
--    SPEC_DEVIATION: o SDD 3.5 dá `select` com S a despesa_fixa, ocorrencia_fixa e meta; aqui não é preciso.
-- 5. Limpeza diária do Worker (SDD 11.1; ADR-013): convites pendentes vencidos viram `expirado` no contexto do cron.

-- ---------------------------------------------------------------------------------------------------
-- Contexto do cron (Worker `scheduled` e o envio de "meta atingida" depois do COMMIT; SDD 8.6).
create function app.em_cron() returns boolean
language sql stable security invoker
as $$
  select coalesce(current_setting('app.sistema', true) = 'cron', false)
$$;

-- Endpoint que a requisição de inscrição está registrando (GUC local, só na rota de inscrição). Quem tem o endpoint
-- tem o navegador: a inscrição nova do mesmo aparelho tira a do usuário anterior (aparelho compartilhado; TM-PUSH-02).
create function app.push_endpoint_atual() returns text
language sql stable security invoker
as $$
  select nullif(current_setting('app.push_endpoint', true), '')
$$;

-- ---------------------------------------------------------------------------------------------------
-- push_subscription (RN-27)
create table app.push_subscription (
  id uuid primary key default gen_random_uuid(),
  usuario_id uuid not null default app.usuario_atual() references app.usuario (id) on delete cascade,
  lar_id uuid not null default app.lar_atual(),
  membro_id uuid not null default app.membro_atual(),
  endpoint text not null,
  -- Chaves do navegador em base64url sem preenchimento: ponto P-256 não comprimido (65 bytes) e segredo (16 bytes).
  p256dh text not null,
  auth text not null,
  criado_em timestamptz not null default now(),
  ultimo_envio_em timestamptz,
  falhas smallint not null default 0,
  constraint push_subscription_endpoint_unico unique (endpoint),
  constraint push_subscription_endpoint_https check (endpoint like 'https://%' and char_length(endpoint) <= 1024),
  constraint push_subscription_p256dh_formato check (p256dh ~ '^[A-Za-z0-9_-]{87}$'),
  constraint push_subscription_auth_formato check (auth ~ '^[A-Za-z0-9_-]{22}$'),
  -- Removida com 404/410 ou ao chegar a 5 falhas seguidas (SDD 3.6).
  constraint push_subscription_falhas_faixa check (falhas between 0 and 5),
  constraint push_subscription_membro_fk foreign key (membro_id, lar_id) references app.membro (id, lar_id)
);
create index push_subscription_usuario_idx on app.push_subscription (usuario_id);
create index push_subscription_membro_idx on app.push_subscription (membro_id);
create index push_subscription_lar_idx on app.push_subscription (lar_id);

-- ---------------------------------------------------------------------------------------------------
-- preferencia_notificacao (RN-27)
create table app.preferencia_notificacao (
  membro_id uuid primary key default app.membro_atual(),
  lar_id uuid not null default app.lar_atual(),
  fixas boolean not null default true,
  lembrete_diario boolean not null default false,
  lembrete_hora smallint not null default 20,
  metas boolean not null default true,
  atualizado_em timestamptz not null default now(),
  constraint preferencia_notificacao_hora_faixa check (lembrete_hora between 0 and 23),
  constraint preferencia_notificacao_membro_fk foreign key (membro_id, lar_id) references app.membro (id, lar_id)
);
create index preferencia_notificacao_lar_idx on app.preferencia_notificacao (lar_id);

-- ---------------------------------------------------------------------------------------------------
-- aviso_push (idempotência do CA-27.4)
create table app.aviso_push (
  membro_id uuid not null,
  lar_id uuid not null,
  tipo text not null,
  -- Id da meta no "meta atingida"; vazio nos avisos agregados do dia (fixas e lembrete).
  referencia text not null default '',
  -- Dia de São Paulo do aviso.
  dia date not null,
  criado_em timestamptz not null default now(),
  constraint aviso_push_pk primary key (membro_id, tipo, referencia, dia),
  constraint aviso_push_tipo_valido check (tipo in ('fixa_vencendo', 'fixa_atrasada', 'lembrete_diario', 'meta_atingida')),
  constraint aviso_push_referencia_tamanho check (char_length(referencia) <= 64),
  constraint aviso_push_membro_fk foreign key (membro_id, lar_id) references app.membro (id, lar_id)
);
create index aviso_push_dia_idx on app.aviso_push (dia);
create index aviso_push_lar_idx on app.aviso_push (lar_id);

-- ---------------------------------------------------------------------------------------------------
-- RLS (G-01)
alter table app.push_subscription enable row level security;
alter table app.push_subscription force row level security;
alter table app.preferencia_notificacao enable row level security;
alter table app.preferencia_notificacao force row level security;
alter table app.aviso_push enable row level security;
alter table app.aviso_push force row level security;

-- push_subscription: o usuário vê e remove só as próprias (TM-PUSH-04); a inscrição nasce no vínculo atual; o cron
-- (C) lê, atualiza o envio/falhas e remove as expiradas. Na rota de inscrição, o mesmo endpoint de outro usuário
-- também é visível e removível (troca de dono do aparelho).
create policy push_subscription_select on app.push_subscription for select to controle_app
  using (
    usuario_id = app.usuario_atual()
    or (app.usuario_atual() is not null and endpoint = app.push_endpoint_atual())
    or app.em_cron()
  );
create policy push_subscription_insert on app.push_subscription for insert to controle_app
  with check (usuario_id = app.usuario_atual() and lar_id = app.lar_atual() and membro_id = app.membro_atual());
create policy push_subscription_update on app.push_subscription for update to controle_app
  using (app.em_cron())
  with check (app.em_cron());
create policy push_subscription_delete on app.push_subscription for delete to controle_app
  using (
    usuario_id = app.usuario_atual()
    or (app.usuario_atual() is not null and endpoint = app.push_endpoint_atual())
    or app.em_cron()
  );

-- preferencia_notificacao: só o próprio membro (o outro membro não vê; PRD-TECNICO §2); o cron lê. Sem delete.
create policy preferencia_notificacao_select on app.preferencia_notificacao for select to controle_app
  using ((membro_id = app.membro_atual() and lar_id = app.lar_atual()) or app.em_cron());
create policy preferencia_notificacao_insert on app.preferencia_notificacao for insert to controle_app
  with check (membro_id = app.membro_atual() and lar_id = app.lar_atual());
create policy preferencia_notificacao_update on app.preferencia_notificacao for update to controle_app
  using (membro_id = app.membro_atual() and lar_id = app.lar_atual())
  with check (membro_id = app.membro_atual() and lar_id = app.lar_atual());

-- aviso_push: só o cron.
create policy aviso_push_select on app.aviso_push for select to controle_app using (app.em_cron());
create policy aviso_push_insert on app.aviso_push for insert to controle_app with check (app.em_cron());
create policy aviso_push_delete on app.aviso_push for delete to controle_app using (app.em_cron());

-- convite: a limpeza diária do cron marca como `expirado` o pendente vencido, e nada além disso. O ramo do cron entra
-- nas políticas existentes (uma por comando, como a etapa 6 testa); os ramos do lar e do convidado não mudam.
alter policy convite_select on app.convite
  using (lar_id = app.lar_atual() or email = app.email_atual()::app.citext or app.em_cron());
alter policy convite_update on app.convite
  using (
    (lar_id = app.lar_atual() and app.papel_atual() = 'titular')
    or email = app.email_atual()::app.citext
    or (app.em_cron() and situacao = 'pendente')
  )
  with check (
    (lar_id = app.lar_atual() and app.papel_atual() = 'titular')
    or email = app.email_atual()::app.citext
    or (app.em_cron() and situacao = 'expirado')
  );

-- Backup sem BYPASSRLS (SDD 3.7, D-06).
create policy backup_leitura on app.push_subscription for select to controle_backup_ro using (true);
create policy backup_leitura on app.preferencia_notificacao for select to controle_backup_ro using (true);
create policy backup_leitura on app.aviso_push for select to controle_backup_ro using (true);

-- Purga pelo owner (ADR-013): as tabelas novas declaram as suas, como a migração da etapa 14 previu.
create policy purga_select on app.push_subscription for select to controle_owner using (app.em_purga());
create policy purga_delete on app.push_subscription for delete to controle_owner using (app.em_purga());
create policy purga_select on app.preferencia_notificacao for select to controle_owner using (app.em_purga());
create policy purga_delete on app.preferencia_notificacao for delete to controle_owner using (app.em_purga());
create policy purga_select on app.aviso_push for select to controle_owner using (app.em_purga());
create policy purga_delete on app.aviso_push for delete to controle_owner using (app.em_purga());

-- ---------------------------------------------------------------------------------------------------
-- Grants da role app (SDD 4). Chaves, endpoint, usuário, lar e membro da inscrição nunca mudam: inscrição nova do
-- mesmo aparelho é remoção e inclusão.
grant select, insert, delete on app.push_subscription to controle_app;
grant update (ultimo_envio_em, falhas) on app.push_subscription to controle_app;

grant select, insert on app.preferencia_notificacao to controle_app;
grant update (fixas, lembrete_diario, lembrete_hora, metas, atualizado_em) on app.preferencia_notificacao to controle_app;

-- DELETE só para a poda diária dos avisos antigos (o registro só importa no próprio dia).
grant select, insert, delete on app.aviso_push to controle_app;
