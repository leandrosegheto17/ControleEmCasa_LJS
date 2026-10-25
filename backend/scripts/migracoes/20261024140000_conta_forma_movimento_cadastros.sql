-- Up Migration
-- Cadastros individuais (etapa 7; SDD 3.5 e 4; RN-03, RN-12; ADR-005, ADR-010): conta, forma de pagamento e
-- movimento de conta (a base do ajuste de saldo). O id vem do cliente (ADR-010), por isso não há default.
-- Todas com ENABLE e FORCE ROW LEVEL SECURITY (G-01). Abreviações: L = lar_id = app.lar_atual();
-- D = dono_id = app.membro_atual(). Conta e forma são sempre individuais: ninguém as vê além do dono.

-- ---------------------------------------------------------------------------------------------------
-- conta (T conta.sql do legado; RN-03, RN-12)
create table app.conta (
  id uuid primary key,
  lar_id uuid not null default app.lar_atual(),
  dono_id uuid not null default app.membro_atual(),
  nome text not null,
  -- Pode ser negativo (conta no vermelho); faixa de RN-18.
  saldo_inicial_centavos bigint not null default 0,
  arquivada boolean not null default false,
  criado_em timestamptz not null default now(),
  constraint conta_nome_valido check (btrim(nome) <> '' and char_length(nome) <= 80),
  constraint conta_saldo_inicial_faixa check (saldo_inicial_centavos between -100000000000 and 100000000000),
  -- O dono pertence ao lar da linha (SDD 3.1).
  constraint conta_dono_fk foreign key (dono_id, lar_id) references app.membro (id, lar_id),
  -- Alvo das FKs compostas "do mesmo dono" (forma, movimento, lançamento_pagamento).
  constraint conta_id_dono unique (id, dono_id)
);
create index conta_dono_idx on app.conta (dono_id);

-- ---------------------------------------------------------------------------------------------------
-- forma_pagamento (T forma_pagamento.sql do legado; RN-03)
create table app.forma_pagamento (
  id uuid primary key,
  lar_id uuid not null default app.lar_atual(),
  dono_id uuid not null default app.membro_atual(),
  nome text not null,
  tipo text not null,
  conta_id uuid,
  dia_vencimento smallint,
  preferida boolean not null default false,
  arquivada boolean not null default false,
  criado_em timestamptz not null default now(),
  constraint forma_pagamento_nome_valido check (btrim(nome) <> '' and char_length(nome) <= 120),
  constraint forma_pagamento_tipo_valido check (tipo in ('pix', 'debito', 'credito')),
  constraint forma_pagamento_dono_fk foreign key (dono_id, lar_id) references app.membro (id, lar_id),
  -- Conta do mesmo dono (sem gatilho).
  constraint forma_pagamento_conta_fk foreign key (conta_id, dono_id) references app.conta (id, dono_id),
  -- Pix e débito exigem conta e não têm dia; crédito exige dia de 1 a 31 e a conta é opcional.
  constraint forma_pagamento_pix_debito_ck check (tipo = 'credito' or (conta_id is not null and dia_vencimento is null)),
  constraint forma_pagamento_credito_ck check (tipo <> 'credito' or (dia_vencimento is not null and dia_vencimento between 1 and 31)),
  constraint forma_pagamento_id_dono unique (id, dono_id)
);
create index forma_pagamento_dono_idx on app.forma_pagamento (dono_id);
create index forma_pagamento_conta_idx on app.forma_pagamento (conta_id, dono_id);
-- Uma preferida por dono (CA-03.4); a troca grava a antiga como falsa antes da nova.
create unique index forma_pagamento_uma_preferida on app.forma_pagamento (dono_id) where preferida;

-- ---------------------------------------------------------------------------------------------------
-- movimento_conta (T movimento_conta.sql do legado; RN-12, RN-13). O valor é sempre positivo e o sinal
-- vem do sentido (RN-18). Nenhuma operação altera ou apaga movimento: a app só lê e insere.
-- SPEC_DEVIATION: o SDD 3.5 também lista `movimento_meta_id` (unique, FK composta para movimento_meta) e o
-- check `movimento_conta_meta_ck`; a tabela `movimento_meta` é da etapa 10, que acrescenta a coluna e o check.
create table app.movimento_conta (
  id uuid primary key default gen_random_uuid(),
  lar_id uuid not null default app.lar_atual(),
  dono_id uuid not null default app.membro_atual(),
  conta_id uuid not null,
  tipo text not null,
  sentido text not null,
  valor_centavos bigint not null,
  data date not null,
  forma_credito_id uuid,
  criado_em timestamptz not null default now(),
  constraint movimento_conta_tipo_valido check (tipo in ('ajuste', 'aporte', 'retirada', 'pagamento_cartao')),
  constraint movimento_conta_sentido_valido check (sentido in ('entrada', 'saida')),
  constraint movimento_conta_valor_positivo check (valor_centavos > 0),
  constraint movimento_conta_dono_fk foreign key (dono_id, lar_id) references app.membro (id, lar_id),
  constraint movimento_conta_conta_fk foreign key (conta_id, dono_id) references app.conta (id, dono_id),
  constraint movimento_conta_forma_fk foreign key (forma_credito_id, dono_id) references app.forma_pagamento (id, dono_id),
  constraint movimento_conta_forma_credito_ck check ((tipo = 'pagamento_cartao') = (forma_credito_id is not null))
);
create index movimento_conta_conta_data_idx on app.movimento_conta (conta_id, data);
create index movimento_conta_forma_idx on app.movimento_conta (forma_credito_id, dono_id);

-- ---------------------------------------------------------------------------------------------------
-- RLS (SDD 3.5)
alter table app.conta enable row level security;
alter table app.conta force row level security;
alter table app.forma_pagamento enable row level security;
alter table app.forma_pagamento force row level security;
alter table app.movimento_conta enable row level security;
alter table app.movimento_conta force row level security;

create policy conta_select on app.conta for select to controle_app
  using (dono_id = app.membro_atual());
create policy conta_insert on app.conta for insert to controle_app
  with check (dono_id = app.membro_atual() and lar_id = app.lar_atual());
create policy conta_update on app.conta for update to controle_app
  using (dono_id = app.membro_atual())
  with check (dono_id = app.membro_atual() and lar_id = app.lar_atual());
create policy conta_delete on app.conta for delete to controle_app
  using (dono_id = app.membro_atual());

create policy forma_pagamento_select on app.forma_pagamento for select to controle_app
  using (dono_id = app.membro_atual());
create policy forma_pagamento_insert on app.forma_pagamento for insert to controle_app
  with check (dono_id = app.membro_atual() and lar_id = app.lar_atual());
create policy forma_pagamento_update on app.forma_pagamento for update to controle_app
  using (dono_id = app.membro_atual())
  with check (dono_id = app.membro_atual() and lar_id = app.lar_atual());
create policy forma_pagamento_delete on app.forma_pagamento for delete to controle_app
  using (dono_id = app.membro_atual());

create policy movimento_conta_select on app.movimento_conta for select to controle_app
  using (dono_id = app.membro_atual());
create policy movimento_conta_insert on app.movimento_conta for insert to controle_app
  with check (dono_id = app.membro_atual() and lar_id = app.lar_atual());

-- Backup sem BYPASSRLS (SDD 3.7, D-06).
create policy backup_leitura on app.conta for select to controle_backup_ro using (true);
create policy backup_leitura on app.forma_pagamento for select to controle_backup_ro using (true);
create policy backup_leitura on app.movimento_conta for select to controle_backup_ro using (true);

-- ---------------------------------------------------------------------------------------------------
-- Grants da role app (SDD 4). Excluir conta e forma é regra (com `em_uso` pela FK); movimento é imutável.
grant select, insert, delete on app.conta to controle_app;
grant update (nome, saldo_inicial_centavos, arquivada) on app.conta to controle_app;

grant select, insert, delete on app.forma_pagamento to controle_app;
-- Mais estrito que o SDD 4: sem UPDATE de `tipo`, que não muda depois de criada (RN-03).
grant update (nome, conta_id, dia_vencimento, preferida, arquivada) on app.forma_pagamento to controle_app;

grant select, insert on app.movimento_conta to controle_app;
