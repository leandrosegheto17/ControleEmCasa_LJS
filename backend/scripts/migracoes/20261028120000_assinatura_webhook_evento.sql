-- Up Migration
-- Cobrança do lar (etapa 13; SDD 3.3 e 3.4, 4, 8.5; RN-24, RN-25; G-04, G-28, G-29, G-31, G-50; ADR-005, ADR-012).
-- assinatura: uma por lar (o plano é do LAR). O plano efetivo (free ou pro) não é guardado: é calculado em
-- `dominio/plano.ts` a partir de situacao, trial_ate, periodo_ate, cobranca_vencimento e do instante atual.
-- webhook_evento: idempotência do webhook do Asaas pelo id do evento; guarda só ids, situação, valor e datas
-- (nunca nome, CPF/CNPJ ou e-mail do pagador; G-50). O CPF/CNPJ do titular NUNCA é gravado (CA-24.11).
-- Abreviações: L = lar_id = app.lar_atual(); S = app.em_sistema() (só o webhook, o cron e a purga gravam o GUC).

-- ---------------------------------------------------------------------------------------------------
-- assinatura (RN-24)
create table app.assinatura (
  lar_id uuid primary key references app.lar (id),
  situacao text not null,
  trial_ate timestamptz not null,
  periodo_ate timestamptz,
  asaas_cliente_id text,
  asaas_assinatura_id text,
  -- Cobrança atual (a última conhecida): a tela Meu plano mostra o Pix enquanto ela não foi paga.
  cobranca_id text,
  cobranca_vencimento date,
  cobranca_valor_centavos bigint,
  -- SPEC_DEVIATION: coluna a mais que o SDD 3.4. Guarda se a cobrança atual já foi paga ou venceu, para que um
  -- "cobrança criada" atrasado (CA-24.4) não traga de volta um Pix já pago.
  cobranca_situacao text,
  ultimo_evento_em timestamptz,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  constraint assinatura_situacao_valida check (situacao in ('trial', 'ativa', 'atrasada', 'cancelada', 'free')),
  constraint assinatura_asaas_assinatura_unica unique (asaas_assinatura_id),
  constraint assinatura_ids_tamanho check (
    char_length(asaas_cliente_id) <= 100 and char_length(asaas_assinatura_id) <= 100 and char_length(cobranca_id) <= 100
  ),
  constraint assinatura_cobranca_valor_positivo check (cobranca_valor_centavos > 0),
  constraint assinatura_cobranca_situacao_valida check (cobranca_situacao in ('pendente', 'paga', 'vencida')),
  -- A cobrança atual existe inteira ou não existe.
  constraint assinatura_cobranca_completa check (
    (cobranca_id is null) = (cobranca_vencimento is null)
    and (cobranca_id is null) = (cobranca_valor_centavos is null)
    and (cobranca_id is null) = (cobranca_situacao is null)
  )
);

-- Lares que já existiam (só no banco local: em produção ainda não há dado): trial de 14 dias a partir da criação,
-- e o trial do titular marcado como usado (CA-24.10). Roda antes do RLS (o owner não tem política).
insert into app.assinatura (lar_id, situacao, trial_ate, criado_em, atualizado_em)
select l.id, 'trial', l.criado_em + interval '14 days', l.criado_em, l.criado_em from app.lar l;
update app.usuario u set trial_usado_em = l.criado_em
  from app.lar l where l.criado_por = u.id and u.trial_usado_em is null;

-- ---------------------------------------------------------------------------------------------------
-- webhook_evento (sistema; RN-24, G-29, G-50)
create table app.webhook_evento (
  event_id text primary key,
  tipo text not null,
  asaas_assinatura_id text,
  ocorrido_em timestamptz not null,
  recebido_em timestamptz not null default now(),
  processado_em timestamptz,
  resumo jsonb not null default '{}'::jsonb,
  constraint webhook_evento_id_tamanho check (char_length(event_id) between 1 and 100),
  constraint webhook_evento_tipo_tamanho check (char_length(tipo) between 1 and 60),
  constraint webhook_evento_assinatura_tamanho check (char_length(asaas_assinatura_id) <= 100)
);
create index webhook_evento_assinatura_idx on app.webhook_evento (asaas_assinatura_id);
create index webhook_evento_recebido_idx on app.webhook_evento (recebido_em);

-- ---------------------------------------------------------------------------------------------------
-- RLS (G-01)
alter table app.assinatura enable row level security;
alter table app.assinatura force row level security;
alter table app.webhook_evento enable row level security;
alter table app.webhook_evento force row level security;

-- assinatura: o próprio lar lê (os dois membros: plano e validade); só o titular grava (G-31); o webhook (S) lê e
-- atualiza qualquer uma. SDD 3.4 dá insert e update a L; aqui ficam também presos ao titular (mais estrito).
create policy assinatura_select on app.assinatura for select to controle_app
  using (lar_id = app.lar_atual() or app.em_sistema());
create policy assinatura_insert on app.assinatura for insert to controle_app
  with check (lar_id = app.lar_atual() and app.papel_atual() = 'titular');
create policy assinatura_update on app.assinatura for update to controle_app
  using ((lar_id = app.lar_atual() and app.papel_atual() = 'titular') or app.em_sistema())
  with check ((lar_id = app.lar_atual() and app.papel_atual() = 'titular') or app.em_sistema());

-- webhook_evento: só o sistema (webhook). SPEC_DEVIATION: o SDD 3.3 deixa as tabelas sem lar sem RLS por linha;
-- esta não tem segredo que a proteja (como o hash do token nas outras), então fica restrita ao contexto de sistema.
create policy webhook_evento_select on app.webhook_evento for select to controle_app using (app.em_sistema());
create policy webhook_evento_insert on app.webhook_evento for insert to controle_app with check (app.em_sistema());
create policy webhook_evento_update on app.webhook_evento for update to controle_app
  using (app.em_sistema()) with check (app.em_sistema());

-- Backup sem BYPASSRLS (SDD 3.7, D-06).
create policy backup_leitura on app.assinatura for select to controle_backup_ro using (true);
create policy backup_leitura on app.webhook_evento for select to controle_backup_ro using (true);

-- ---------------------------------------------------------------------------------------------------
-- Grants da role app (SDD 4). A assinatura não se apaga; lar_id e criado_em nunca mudam.
grant select, insert on app.assinatura to controle_app;
grant update (situacao, trial_ate, periodo_ate, asaas_cliente_id, asaas_assinatura_id, cobranca_id,
              cobranca_vencimento, cobranca_valor_centavos, cobranca_situacao, ultimo_evento_em, atualizado_em)
  on app.assinatura to controle_app;

-- SPEC_DEVIATION: o SDD 4 dá DELETE (poda de 90 dias) ao app; o G-04 proíbe DELETE em webhook_evento. Fica o mais
-- estrito até a poda existir (cron, etapa 14), que decide entre as duas fontes.
grant select, insert on app.webhook_evento to controle_app;
grant update (processado_em) on app.webhook_evento to controle_app;

-- Sem novo trial (CA-24.10): marcado quando o usuário vira titular de um lar com trial.
grant update (trial_usado_em) on app.usuario to controle_app;
