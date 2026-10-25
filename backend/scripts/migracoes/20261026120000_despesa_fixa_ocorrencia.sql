-- Up Migration
-- Despesas fixas conjuntas e suas ocorrências mensais (etapa 9; SDD 3.5 e 4; RN-15, RN-28; ADR-005, ADR-010).
-- A fixa é sempre conjunta de despesa e é do lar (visível e editável pelos dois membros). Não se exclui: só se
-- encerra. A ocorrência é gerada sob demanda pela API (janela de ±12 meses, `on conflict do nothing`) e fica paga
-- quando aponta o lançamento do pagamento. O id da fixa vem do cliente (ADR-010), por isso não há default; o da
-- ocorrência é gerado no banco (nasce da consulta do mês, nunca de uma escrita própria do cliente).
-- Ambas com ENABLE e FORCE ROW LEVEL SECURITY (G-01). L = lar_id = app.lar_atual().
-- SPEC_DEVIATION: o SDD 3.5 dá também `select ... using (app.em_sistema())` às duas tabelas, para o cron do push
-- (etapa 15). Sem cron ainda, a política de sistema fica para a etapa 15 (menor privilégio até lá).

-- ---------------------------------------------------------------------------------------------------
-- Alvo da FK composta da ocorrência: o lançamento do pagamento é do mesmo lar da ocorrência.
alter table app.lancamento add constraint lancamento_id_lar unique (id, lar_id);

-- ---------------------------------------------------------------------------------------------------
-- despesa_fixa (T despesa_fixa.sql do legado)
create table app.despesa_fixa (
  id uuid primary key,
  lar_id uuid not null default app.lar_atual(),
  descricao text not null,
  categoria_id uuid not null,
  -- Existem só para a FK composta garantir categoria conjunta de despesa (CA-15.9).
  tipo text not null default 'despesa',
  escopo text not null default 'conjunto',
  valor_previsto_centavos bigint not null,
  dia_vencimento smallint not null,
  -- Mês da criação, sempre o dia 1. Vem do "hoje" de São Paulo passado pela API (nunca current_date; RT-04).
  inicio date not null,
  encerrada_em date,
  criado_em timestamptz not null default now(),
  constraint despesa_fixa_descricao_valida check (btrim(descricao) <> '' and char_length(descricao) <= 120),
  constraint despesa_fixa_tipo_despesa check (tipo = 'despesa'),
  constraint despesa_fixa_escopo_conjunto check (escopo = 'conjunto'),
  -- > 0 (RN-18) e o teto do lançamento (G-23): pagar pelo previsto cria um lançamento com esse valor.
  constraint despesa_fixa_previsto_faixa check (valor_previsto_centavos between 1 and 100000000000),
  constraint despesa_fixa_dia_faixa check (dia_vencimento between 1 and 31),
  constraint despesa_fixa_inicio_dia_1 check (inicio = date_trunc('month', inicio)::date),
  -- Categoria conjunta de despesa (RN-15) e do mesmo lar. "No action": excluir categoria em uso dá 23503.
  constraint despesa_fixa_categoria_fk foreign key (categoria_id, tipo, escopo) references app.categoria (id, tipo, escopo),
  constraint despesa_fixa_categoria_lar_fk foreign key (categoria_id, lar_id) references app.categoria (id, lar_id),
  constraint despesa_fixa_lar_fk foreign key (lar_id) references app.lar (id),
  -- Alvo da FK composta da ocorrência.
  constraint despesa_fixa_id_lar unique (id, lar_id)
);
create index despesa_fixa_lar_idx on app.despesa_fixa (lar_id);
create index despesa_fixa_categoria_idx on app.despesa_fixa (categoria_id);

-- ---------------------------------------------------------------------------------------------------
-- ocorrencia_fixa (T ocorrencia_fixa.sql do legado). Excluir o lançamento do pagamento volta a ocorrência a
-- pendente: `on delete set null (lancamento_id)` (a ação da FK ignora a RLS, como a cascata das parcelas).
create table app.ocorrencia_fixa (
  id uuid primary key default gen_random_uuid(),
  lar_id uuid not null default app.lar_atual(),
  despesa_fixa_id uuid not null,
  mes date not null,
  vencimento date not null,
  -- Cópia do modelo na geração; a edição do modelo atualiza só as pendentes do mês corrente em diante.
  valor_previsto_centavos bigint not null,
  lancamento_id uuid,
  criado_em timestamptz not null default now(),
  constraint ocorrencia_fixa_mes_dia_1 check (mes = date_trunc('month', mes)::date),
  constraint ocorrencia_fixa_vencimento_no_mes check (date_trunc('month', vencimento)::date = mes),
  constraint ocorrencia_fixa_previsto_faixa check (valor_previsto_centavos between 1 and 100000000000),
  -- 1 por fixa e mês (CA-15.1): a geração concorrente resolve pelo `on conflict`.
  constraint ocorrencia_fixa_uma_por_mes unique (despesa_fixa_id, mes),
  -- Um lançamento paga no máximo uma ocorrência.
  constraint ocorrencia_fixa_lancamento_unico unique (lancamento_id),
  constraint ocorrencia_fixa_fixa_fk foreign key (despesa_fixa_id, lar_id) references app.despesa_fixa (id, lar_id),
  constraint ocorrencia_fixa_lancamento_fk foreign key (lancamento_id, lar_id)
    references app.lancamento (id, lar_id) on delete set null (lancamento_id)
);
create index ocorrencia_fixa_lar_mes_idx on app.ocorrencia_fixa (lar_id, mes);

-- ---------------------------------------------------------------------------------------------------
-- RLS (SDD 3.5): as duas são do lar.
alter table app.despesa_fixa enable row level security;
alter table app.despesa_fixa force row level security;
alter table app.ocorrencia_fixa enable row level security;
alter table app.ocorrencia_fixa force row level security;

create policy despesa_fixa_select on app.despesa_fixa for select to controle_app
  using (lar_id = app.lar_atual());
create policy despesa_fixa_insert on app.despesa_fixa for insert to controle_app
  with check (lar_id = app.lar_atual());
create policy despesa_fixa_update on app.despesa_fixa for update to controle_app
  using (lar_id = app.lar_atual())
  with check (lar_id = app.lar_atual());
-- Sem política nem grant de delete: a fixa é encerrada, não excluída (G-04).

create policy ocorrencia_fixa_select on app.ocorrencia_fixa for select to controle_app
  using (lar_id = app.lar_atual());
create policy ocorrencia_fixa_insert on app.ocorrencia_fixa for insert to controle_app
  with check (lar_id = app.lar_atual());
create policy ocorrencia_fixa_update on app.ocorrencia_fixa for update to controle_app
  using (lar_id = app.lar_atual())
  with check (lar_id = app.lar_atual());
-- O encerramento apaga as ocorrências pendentes dos meses em que a fixa deixa de gerar.
create policy ocorrencia_fixa_delete on app.ocorrencia_fixa for delete to controle_app
  using (lar_id = app.lar_atual());

-- Backup sem BYPASSRLS (SDD 3.7, D-06).
create policy backup_leitura on app.despesa_fixa for select to controle_backup_ro using (true);
create policy backup_leitura on app.ocorrencia_fixa for select to controle_backup_ro using (true);

-- ---------------------------------------------------------------------------------------------------
-- Grants da role app (SDD 4). Chave, lar, tipo, escopo e início nunca mudam pela app.
grant select, insert on app.despesa_fixa to controle_app;
grant update (descricao, categoria_id, valor_previsto_centavos, dia_vencimento, encerrada_em)
  on app.despesa_fixa to controle_app;

grant select, insert, delete on app.ocorrencia_fixa to controle_app;
-- SPEC_DEVIATION: o SDD 4 lista só `valor_previsto_centavos` e `lancamento_id`; editar o dia do modelo também move
-- o vencimento das pendentes do mês corrente em diante (RN-15; A salvar_despesa_fixa.sql:59-64), daí `vencimento`.
grant update (valor_previsto_centavos, vencimento, lancamento_id) on app.ocorrencia_fixa to controle_app;
