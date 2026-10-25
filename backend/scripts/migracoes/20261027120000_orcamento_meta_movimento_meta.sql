-- Up Migration
-- Orçamento e metas (etapa 10; SDD 3.5 e 4; RN-08, RN-09, RN-16, RN-18; ADR-005, ADR-010): orçamento por categoria
-- de despesa e mês, meta, movimento de meta (aporte e retirada) e o vínculo opcional do movimento de meta com o
-- movimento de conta do autor. O id da meta e o do movimento vêm do cliente (ADR-010), por isso não há default; o do
-- orçamento é gerado no banco (a escrita é por (categoria, mês), idempotente por natureza: CA-T3.5).
-- Todas com ENABLE e FORCE ROW LEVEL SECURITY (G-01). Abreviações: L = lar_id = app.lar_atual();
-- D = dono_id = app.membro_atual(); Cj = escopo = 'conjunto'.
-- O bloqueio Pro (RN-25) entra na etapa 13, na API; aqui nada depende de plano.
-- SPEC_DEVIATION: o SDD 3.5 dá também `select ... using (app.em_sistema())` à meta, para o push "meta atingida"
-- (etapa 15). Sem push ainda, a política de sistema fica para a etapa 15 (menor privilégio até lá, como na etapa 9).

-- ---------------------------------------------------------------------------------------------------
-- orcamento (T orcamento.sql do legado; RN-16)
create table app.orcamento (
  id uuid primary key default gen_random_uuid(),
  lar_id uuid not null default app.lar_atual(),
  -- Primeiro dia do mês (normalizado pela API).
  mes date not null,
  categoria_id uuid not null,
  -- Existem só para a FK composta garantir categoria de despesa e o escopo coerente (como em despesa_fixa).
  tipo text not null default 'despesa',
  escopo text not null,
  -- Nulo na conjunta; o dono da categoria na individual.
  dono_id uuid,
  -- > 0 (RN-18) e o teto do lançamento (G-23), por consistência com a fixa.
  valor_centavos bigint not null,
  criado_em timestamptz not null default now(),
  constraint orcamento_mes_dia_1 check (mes = date_trunc('month', mes)::date),
  constraint orcamento_tipo_despesa check (tipo = 'despesa'),
  constraint orcamento_escopo_valido check (escopo in ('conjunto', 'individual')),
  constraint orcamento_dono_so_individual check ((escopo = 'individual') = (dono_id is not null)),
  constraint orcamento_valor_faixa check (valor_centavos between 1 and 100000000000),
  constraint orcamento_categoria_fk foreign key (categoria_id, tipo, escopo) references app.categoria (id, tipo, escopo),
  -- Individual: categoria do mesmo dono (nulo na conjunta, MATCH SIMPLE). E do mesmo lar.
  constraint orcamento_categoria_dono_fk foreign key (categoria_id, dono_id) references app.categoria (id, dono_id),
  constraint orcamento_categoria_lar_fk foreign key (categoria_id, lar_id) references app.categoria (id, lar_id),
  constraint orcamento_dono_fk foreign key (dono_id, lar_id) references app.membro (id, lar_id),
  -- Um valor por categoria e mês: o `on conflict` do definir e do copiar resolve a corrida.
  constraint orcamento_uma_por_mes unique (categoria_id, mes)
);
create index orcamento_lar_mes_idx on app.orcamento (lar_id, mes);

-- ---------------------------------------------------------------------------------------------------
-- meta (T meta.sql do legado; RN-08). Não se exclui; o escopo nunca muda.
create table app.meta (
  id uuid primary key,
  lar_id uuid not null default app.lar_atual(),
  -- Quem criou (na conjunta) ou o dono (na individual).
  dono_id uuid not null default app.membro_atual(),
  nome text not null,
  alvo_centavos bigint not null,
  -- Primeiro dia do mês do prazo; nulo = sem prazo.
  prazo date,
  escopo text not null,
  atingida_em date,
  criado_em timestamptz not null default now(),
  constraint meta_nome_valido check (btrim(nome) <> '' and char_length(nome) <= 120),
  constraint meta_alvo_faixa check (alvo_centavos between 1 and 100000000000),
  constraint meta_prazo_dia_1 check (prazo is null or prazo = date_trunc('month', prazo)::date),
  constraint meta_escopo_valido check (escopo in ('conjunto', 'individual')),
  constraint meta_dono_fk foreign key (dono_id, lar_id) references app.membro (id, lar_id),
  -- Alvo da FK composta do movimento: o movimento é do mesmo lar da meta.
  constraint meta_id_lar unique (id, lar_id)
);
create index meta_lar_idx on app.meta (lar_id);

-- ---------------------------------------------------------------------------------------------------
-- movimento_meta (T movimento_meta.sql do legado; RN-08, RN-09). Imutável: sem update e sem delete.
create table app.movimento_meta (
  id uuid primary key,
  lar_id uuid not null default app.lar_atual(),
  meta_id uuid not null,
  tipo text not null,
  valor_centavos bigint not null,
  data date not null,
  -- Texto livre já aparado, de 1 a 60 caracteres (RN-09).
  local text not null,
  autor_id uuid not null default app.membro_atual(),
  criado_em timestamptz not null default now(),
  constraint movimento_meta_tipo_valido check (tipo in ('aporte', 'retirada')),
  constraint movimento_meta_valor_faixa check (valor_centavos between 1 and 100000000000),
  constraint movimento_meta_local_valido check (btrim(local) = local and local <> '' and char_length(local) <= 60),
  constraint movimento_meta_meta_fk foreign key (meta_id, lar_id) references app.meta (id, lar_id),
  constraint movimento_meta_autor_fk foreign key (autor_id, lar_id) references app.membro (id, lar_id),
  -- Alvo da FK composta do movimento de conta: a conta é do autor do movimento.
  constraint movimento_meta_id_autor unique (id, autor_id)
);
create index movimento_meta_meta_data_idx on app.movimento_meta (meta_id, data);
create index movimento_meta_autor_data_idx on app.movimento_meta (autor_id, data);

-- ---------------------------------------------------------------------------------------------------
-- movimento_conta: o vínculo com o movimento de meta (a coluna e o check que a etapa 7 deixou para esta etapa).
-- O aporte com conta debita (saída) e a retirada com conta credita (entrada); o movimento de conta é do autor.
alter table app.movimento_conta add column movimento_meta_id uuid;
alter table app.movimento_conta add constraint movimento_conta_movimento_meta_unico unique (movimento_meta_id);
alter table app.movimento_conta add constraint movimento_conta_movimento_meta_fk
  foreign key (movimento_meta_id, dono_id) references app.movimento_meta (id, autor_id);
alter table app.movimento_conta add constraint movimento_conta_meta_ck
  check ((tipo in ('aporte', 'retirada')) = (movimento_meta_id is not null));

-- ---------------------------------------------------------------------------------------------------
-- RLS (SDD 3.5)
alter table app.orcamento enable row level security;
alter table app.orcamento force row level security;
alter table app.meta enable row level security;
alter table app.meta force row level security;
alter table app.movimento_meta enable row level security;
alter table app.movimento_meta force row level security;

-- orcamento: o conjunto do lar e o individual do próprio membro.
create policy orcamento_select on app.orcamento for select to controle_app
  using (lar_id = app.lar_atual() and (escopo = 'conjunto' or dono_id = app.membro_atual()));
create policy orcamento_insert on app.orcamento for insert to controle_app
  with check (lar_id = app.lar_atual() and (escopo = 'conjunto' or dono_id = app.membro_atual()));
create policy orcamento_update on app.orcamento for update to controle_app
  using (lar_id = app.lar_atual() and (escopo = 'conjunto' or dono_id = app.membro_atual()))
  with check (lar_id = app.lar_atual() and (escopo = 'conjunto' or dono_id = app.membro_atual()));
create policy orcamento_delete on app.orcamento for delete to controle_app
  using (lar_id = app.lar_atual() and (escopo = 'conjunto' or dono_id = app.membro_atual()));

-- meta: a conjunta do lar e a individual do dono. Sem política de delete (a meta não se exclui).
create policy meta_select on app.meta for select to controle_app
  using (lar_id = app.lar_atual() and (escopo = 'conjunto' or dono_id = app.membro_atual()));
create policy meta_insert on app.meta for insert to controle_app
  with check (lar_id = app.lar_atual() and dono_id = app.membro_atual());
create policy meta_update on app.meta for update to controle_app
  using (lar_id = app.lar_atual() and (escopo = 'conjunto' or dono_id = app.membro_atual()))
  with check (lar_id = app.lar_atual() and (escopo = 'conjunto' or dono_id = app.membro_atual()));

-- movimento_meta: quem enxerga a meta enxerga os movimentos (a subconsulta passa pela RLS da meta); só o próprio
-- autor insere. Sem update nem delete.
create policy movimento_meta_select on app.movimento_meta for select to controle_app
  using (lar_id = app.lar_atual() and exists (select 1 from app.meta m where m.id = meta_id));
create policy movimento_meta_insert on app.movimento_meta for insert to controle_app
  with check (
    lar_id = app.lar_atual() and autor_id = app.membro_atual()
    and exists (select 1 from app.meta m where m.id = meta_id)
  );

-- Backup sem BYPASSRLS (SDD 3.7, D-06).
create policy backup_leitura on app.orcamento for select to controle_backup_ro using (true);
create policy backup_leitura on app.meta for select to controle_backup_ro using (true);
create policy backup_leitura on app.movimento_meta for select to controle_backup_ro using (true);

-- ---------------------------------------------------------------------------------------------------
-- Grants da role app (SDD 4). Chave, lar, dono, escopo e tipo nunca mudam pela app.
grant select, insert, delete on app.orcamento to controle_app;
grant update (valor_centavos) on app.orcamento to controle_app;

grant select, insert on app.meta to controle_app;
grant update (nome, alvo_centavos, prazo, atingida_em) on app.meta to controle_app;

grant select, insert on app.movimento_meta to controle_app;
