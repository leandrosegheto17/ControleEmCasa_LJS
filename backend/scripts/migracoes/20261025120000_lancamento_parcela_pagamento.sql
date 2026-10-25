-- Up Migration
-- Lançamentos (etapa 8; SDD 3.5 e 4; RN-01, RN-04, RN-06, RN-07, RN-14, RN-18; ADR-005, ADR-008, ADR-010):
-- o cabeçalho (`lancamento`), a parte privada do pagador (`lancamento_pagamento`, G-10) e as parcelas de
-- competência (`parcela`). O id do lançamento vem do cliente (ADR-010), por isso não há default; o da parcela é
-- gerado no banco (a parcela nasce do lançamento, nunca de uma escrita própria do cliente).
-- Todas com ENABLE e FORCE ROW LEVEL SECURITY (G-01). Abreviações: L = lar_id = app.lar_atual();
-- D = dono_id = app.membro_atual(); Cj = escopo = 'conjunto'.

-- ---------------------------------------------------------------------------------------------------
-- lancamento (T lancamento.sql do legado)
create table app.lancamento (
  id uuid primary key,
  lar_id uuid not null default app.lar_atual(),
  -- Quem pagou (conjunta) ou o autor (individual).
  dono_id uuid not null default app.membro_atual(),
  tipo text not null,
  escopo text not null,
  categoria_id uuid not null,
  descricao text,
  valor_total_centavos bigint not null,
  num_parcelas smallint not null,
  alterado_por uuid,
  alterado_em timestamptz,
  criado_em timestamptz not null default now(),
  -- Dono esperado da categoria: o do lançamento se individual; nulo se conjunto.
  categoria_dono_id uuid generated always as (case when escopo = 'individual' then dono_id end) stored,
  constraint lancamento_tipo_valido check (tipo in ('despesa', 'receita')),
  constraint lancamento_escopo_valido check (escopo in ('conjunto', 'individual')),
  -- Descrição opcional já aparada (vazia vira nula na API, CA-18.2), até 120 caracteres (RN-18).
  constraint lancamento_descricao_valida check (descricao is null or (btrim(descricao) <> '' and char_length(descricao) <= 120)),
  -- 1 a 10^11 centavos (CA-T5.1): dois lançamentos no teto ainda somam sem estourar bigint.
  constraint lancamento_valor_faixa check (valor_total_centavos between 1 and 100000000000),
  constraint lancamento_num_parcelas_faixa check (num_parcelas between 1 and 24),
  constraint lancamento_receita_individual check (tipo <> 'receita' or escopo = 'individual'),
  constraint lancamento_alteracao_completa check ((alterado_por is null) = (alterado_em is null)),
  -- O dono e quem alterou pertencem ao lar da linha (SDD 3.1).
  constraint lancamento_dono_fk foreign key (dono_id, lar_id) references app.membro (id, lar_id),
  constraint lancamento_alterado_por_fk foreign key (alterado_por, lar_id) references app.membro (id, lar_id),
  -- O escopo vem da categoria (RN-01): categoria e escopo mudam juntos no mesmo update (RN-07).
  constraint lancamento_categoria_fk foreign key (categoria_id, tipo, escopo) references app.categoria (id, tipo, escopo),
  -- Individual: categoria do mesmo dono (nulo na conjunta, MATCH SIMPLE). E do mesmo lar.
  constraint lancamento_categoria_dono_fk foreign key (categoria_id, categoria_dono_id) references app.categoria (id, dono_id),
  constraint lancamento_categoria_lar_fk foreign key (categoria_id, lar_id) references app.categoria (id, lar_id),
  -- Alvos das FKs compostas da parte privada e das parcelas.
  constraint lancamento_id_dono unique (id, dono_id),
  constraint lancamento_id_escopo_dono unique (id, escopo, dono_id)
);
create index lancamento_lar_idx on app.lancamento (lar_id);
create index lancamento_dono_idx on app.lancamento (dono_id);
create index lancamento_categoria_idx on app.lancamento (categoria_id);

-- ---------------------------------------------------------------------------------------------------
-- lancamento_pagamento (T lancamento_pagamento.sql do legado; RN-04, G-10): como, de onde e quando o pagador
-- pagou. Só o dono a enxerga, mesmo na conjunta. Excluir o lançamento a apaga junto (cascata).
create table app.lancamento_pagamento (
  lancamento_id uuid primary key,
  lar_id uuid not null default app.lar_atual(),
  dono_id uuid not null default app.membro_atual(),
  -- Nula na receita (não há forma).
  forma_pagamento_id uuid,
  -- Nula no crédito: a conta só é debitada no pagamento do cartão (RN-13).
  conta_id uuid,
  data_operacao date not null,
  -- Dia congelado do cartão (ADR-008 item 3); nulo no Pix, no Débito e na receita.
  dia_vencimento_aplicado smallint,
  constraint lancamento_pagamento_dia_faixa check (dia_vencimento_aplicado between 1 and 31),
  constraint lancamento_pagamento_dono_fk foreign key (dono_id, lar_id) references app.membro (id, lar_id),
  constraint lancamento_pagamento_lancamento_fk foreign key (lancamento_id, dono_id)
    references app.lancamento (id, dono_id) on delete cascade,
  constraint lancamento_pagamento_forma_fk foreign key (forma_pagamento_id, dono_id)
    references app.forma_pagamento (id, dono_id),
  constraint lancamento_pagamento_conta_fk foreign key (conta_id, dono_id) references app.conta (id, dono_id)
);
create index lancamento_pagamento_dono_idx on app.lancamento_pagamento (dono_id);
create index lancamento_pagamento_forma_idx on app.lancamento_pagamento (forma_pagamento_id, dono_id);
create index lancamento_pagamento_conta_idx on app.lancamento_pagamento (conta_id, dono_id);

-- ---------------------------------------------------------------------------------------------------
-- parcela (T parcela.sql do legado; RN-14, ADR-008): `escopo` e `dono_id` desnormalizados para a RLS e os
-- índices; a FK composta os mantém coerentes e propaga a troca de escopo do lançamento (RN-07).
create table app.parcela (
  id uuid primary key default gen_random_uuid(),
  lancamento_id uuid not null,
  lar_id uuid not null default app.lar_atual(),
  escopo text not null,
  dono_id uuid not null default app.membro_atual(),
  numero smallint not null,
  valor_centavos bigint not null,
  data date not null,
  data_ajustada boolean not null default false,
  constraint parcela_escopo_valido check (escopo in ('conjunto', 'individual')),
  constraint parcela_numero_faixa check (numero between 1 and 24),
  constraint parcela_valor_positivo check (valor_centavos > 0),
  constraint parcela_numero_unico unique (lancamento_id, numero),
  constraint parcela_dono_fk foreign key (dono_id, lar_id) references app.membro (id, lar_id),
  constraint parcela_lancamento_fk foreign key (lancamento_id, escopo, dono_id)
    references app.lancamento (id, escopo, dono_id) on delete cascade on update cascade
);
create index parcela_lar_data_idx on app.parcela (lar_id, data);
create index parcela_dono_data_idx on app.parcela (dono_id, data);

-- ---------------------------------------------------------------------------------------------------
-- RLS (SDD 3.5)
alter table app.lancamento enable row level security;
alter table app.lancamento force row level security;
alter table app.lancamento_pagamento enable row level security;
alter table app.lancamento_pagamento force row level security;
alter table app.parcela enable row level security;
alter table app.parcela force row level security;

-- lancamento: a conjunta do lar e a individual do próprio membro. A política de update deixa o outro membro
-- editar a conjunta (sem SECURITY DEFINER, SDD D-04); o `with check` impede que ele a torne individual (dono ≠
-- eu e escopo individual falha). A matriz campo a campo (RN-06) fica em `dominio/permissoes.ts`.
create policy lancamento_select on app.lancamento for select to controle_app
  using (lar_id = app.lar_atual() and (escopo = 'conjunto' or dono_id = app.membro_atual()));
create policy lancamento_insert on app.lancamento for insert to controle_app
  with check (lar_id = app.lar_atual() and dono_id = app.membro_atual());
create policy lancamento_update on app.lancamento for update to controle_app
  using (lar_id = app.lar_atual() and (escopo = 'conjunto' or dono_id = app.membro_atual()))
  with check (lar_id = app.lar_atual() and (escopo = 'conjunto' or dono_id = app.membro_atual()));
create policy lancamento_delete on app.lancamento for delete to controle_app
  using (lar_id = app.lar_atual() and (escopo = 'conjunto' or dono_id = app.membro_atual()));

-- lancamento_pagamento: só o dono, em todas as operações (G-10).
create policy lancamento_pagamento_select on app.lancamento_pagamento for select to controle_app
  using (dono_id = app.membro_atual());
create policy lancamento_pagamento_insert on app.lancamento_pagamento for insert to controle_app
  with check (dono_id = app.membro_atual() and lar_id = app.lar_atual());
create policy lancamento_pagamento_update on app.lancamento_pagamento for update to controle_app
  using (dono_id = app.membro_atual())
  with check (dono_id = app.membro_atual() and lar_id = app.lar_atual());
create policy lancamento_pagamento_delete on app.lancamento_pagamento for delete to controle_app
  using (dono_id = app.membro_atual());

-- parcela: a conjunta do lar e a individual do próprio membro.
create policy parcela_select on app.parcela for select to controle_app
  using (lar_id = app.lar_atual() and (escopo = 'conjunto' or dono_id = app.membro_atual()));
create policy parcela_insert on app.parcela for insert to controle_app
  with check (lar_id = app.lar_atual() and (escopo = 'conjunto' or dono_id = app.membro_atual()));
create policy parcela_update on app.parcela for update to controle_app
  using (lar_id = app.lar_atual() and (escopo = 'conjunto' or dono_id = app.membro_atual()))
  with check (lar_id = app.lar_atual() and (escopo = 'conjunto' or dono_id = app.membro_atual()));
create policy parcela_delete on app.parcela for delete to controle_app
  using (lar_id = app.lar_atual() and (escopo = 'conjunto' or dono_id = app.membro_atual()));

-- Backup sem BYPASSRLS (SDD 3.7, D-06).
create policy backup_leitura on app.lancamento for select to controle_backup_ro using (true);
create policy backup_leitura on app.lancamento_pagamento for select to controle_backup_ro using (true);
create policy backup_leitura on app.parcela for select to controle_backup_ro using (true);

-- ---------------------------------------------------------------------------------------------------
-- Grants da role app (SDD 4). Chave, lar, dono e tipo nunca mudam pela app.
grant select, insert, delete on app.lancamento to controle_app;
grant update (escopo, categoria_id, descricao, valor_total_centavos, num_parcelas, alterado_por, alterado_em)
  on app.lancamento to controle_app;

grant select, insert, delete on app.lancamento_pagamento to controle_app;
grant update (forma_pagamento_id, conta_id, data_operacao, dia_vencimento_aplicado)
  on app.lancamento_pagamento to controle_app;

grant select, insert, delete on app.parcela to controle_app;
-- Mais estrito que o SDD 4: sem UPDATE de `numero` (o recálculo mantém os números e apaga ou cria os que
-- sobram ou faltam); o escopo muda só pela cascata da FK.
grant update (valor_centavos, data, data_ajustada) on app.parcela to controle_app;
