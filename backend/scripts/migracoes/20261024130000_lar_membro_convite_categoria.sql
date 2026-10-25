-- Up Migration
-- Lar, vínculo e categorias (SDD 3.4 e 3.5; RN-17, RN-22, RN-23; ADR-004, ADR-005, ADR-009).
-- Todas com ENABLE e FORCE ROW LEVEL SECURITY (G-01). As políticas só leem GUC local à transação
-- (app.*_atual()), sem SECURITY DEFINER e sem recursão: a de membro consulta lar e convite, cujas
-- políticas não consultam membro.

-- Papel do vínculo ativo (titular ou membro), gravado pela API junto com app.lar_id e app.membro_id,
-- derivado da mesma linha de membro (ADR-009). Ausente, vazio ou desconhecido vira NULL.
create function app.papel_atual() returns text
language sql stable security invoker
as $$
  select case when current_setting('app.papel', true) in ('titular', 'membro')
              then current_setting('app.papel', true) end
$$;

-- ---------------------------------------------------------------------------------------------------
-- lar (RN-22). Vários lares no mesmo banco: sem o índice ((true)) do legado.
create table app.lar (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  criado_por uuid not null references app.usuario (id) on delete restrict,
  criado_em timestamptz not null default now(),
  constraint lar_nome_valido check (btrim(nome) <> '' and char_length(nome) <= 60)
);
create index lar_criado_por_idx on app.lar (criado_por);

-- ---------------------------------------------------------------------------------------------------
-- membro (RN-22, RN-23): o id é o dono_id das tabelas de negócio.
create table app.membro (
  id uuid primary key default gen_random_uuid(),
  lar_id uuid not null references app.lar (id),
  usuario_id uuid references app.usuario (id) on delete set null,
  nome text not null,
  papel text not null,
  entrou_em timestamptz not null default now(),
  saiu_em timestamptz,
  constraint membro_nome_valido check (btrim(nome) <> '' and char_length(nome) <= 60),
  constraint membro_papel_valido check (papel in ('titular', 'membro')),
  constraint membro_saida_depois_da_entrada check (saiu_em is null or saiu_em >= entrou_em),
  -- Alvo das FKs compostas (dono_id, lar_id): o dono pertence ao lar da linha (SDD 3.1).
  constraint membro_id_lar unique (id, lar_id)
);
-- Um lar ativo por usuário; 1 titular e 1 convidado ativos por lar: o limite de 2 membros vale sob
-- concorrência e independe da RLS (a unicidade não enxerga política; SDD D-01).
create unique index membro_um_lar_ativo on app.membro (usuario_id) where saiu_em is null;
create unique index membro_um_titular on app.membro (lar_id) where papel = 'titular' and saiu_em is null;
create unique index membro_um_convidado on app.membro (lar_id) where papel = 'membro' and saiu_em is null;
create index membro_lar_idx on app.membro (lar_id);

-- ---------------------------------------------------------------------------------------------------
-- convite (RN-23; G-14): token de 256 bits só como SHA-256, 7 dias, uso único.
create table app.convite (
  id uuid primary key default gen_random_uuid(),
  lar_id uuid not null references app.lar (id),
  convidado_por uuid not null,
  email app.citext not null,
  token_hash bytea not null,
  -- Cópias para a tela de aceite: o convidado não enxerga o lar nem o membro que convidou.
  lar_nome text not null,
  convidado_por_nome text not null,
  situacao text not null default 'pendente',
  criado_em timestamptz not null default now(),
  expira_em timestamptz not null,
  respondido_em timestamptz,
  constraint convite_convidado_por_fk foreign key (convidado_por, lar_id) references app.membro (id, lar_id),
  constraint convite_email_tamanho check (char_length(email::text) <= 254),
  constraint convite_token_hash_unico unique (token_hash),
  constraint convite_token_hash_tamanho check (octet_length(token_hash) = 32),
  constraint convite_nomes_validos check (char_length(lar_nome) <= 60 and char_length(convidado_por_nome) <= 60),
  constraint convite_situacao_valida check (situacao in ('pendente', 'aceito', 'recusado', 'cancelado', 'expirado')),
  constraint convite_expiracao_7d check (expira_em = criado_em + interval '7 days')
);
-- No máximo 1 convite pendente por lar (o convite novo revoga o anterior; G-14).
create unique index convite_um_pendente on app.convite (lar_id) where situacao = 'pendente';
create index convite_lar_criado_idx on app.convite (lar_id, criado_em);
create index convite_email_idx on app.convite (email);

-- ---------------------------------------------------------------------------------------------------
-- categoria (T categoria.sql do legado; RN-01, RN-17). Nasce aqui porque o lar nasce com as iniciais;
-- as rotas de cadastro são da etapa 7.
create table app.categoria (
  id uuid primary key default gen_random_uuid(),
  lar_id uuid not null default app.lar_atual() references app.lar (id),
  tipo text not null,
  escopo text not null,
  dono_id uuid,
  nome text not null,
  -- Só despesa distingue fixa/variável; receita fica nula.
  variavel boolean,
  arquivada boolean not null default false,
  criado_em timestamptz not null default now(),
  constraint categoria_tipo_valido check (tipo in ('despesa', 'receita')),
  constraint categoria_escopo_valido check (escopo in ('conjunto', 'individual')),
  constraint categoria_nome_valido check (btrim(nome) <> '' and char_length(nome) <= 120),
  constraint categoria_dono_so_individual check ((escopo = 'individual') = (dono_id is not null)),
  constraint categoria_variavel_so_despesa check ((tipo = 'despesa') = (variavel is not null)),
  constraint categoria_receita_individual check (tipo <> 'receita' or escopo = 'individual'),
  -- O dono pertence ao lar (MATCH SIMPLE: nula na conjunta).
  constraint categoria_dono_fk foreign key (dono_id, lar_id) references app.membro (id, lar_id),
  -- nulls not distinct: conjuntas têm dono_id nulo e, sem isso, nunca colidiriam (CA-17.2, CA-17.4).
  constraint categoria_unica unique nulls not distinct (lar_id, tipo, escopo, dono_id, nome),
  -- Alvos das FKs compostas das etapas 7 a 10 (lançamento, orçamento).
  constraint categoria_id_tipo_escopo unique (id, tipo, escopo),
  constraint categoria_id_dono unique (id, dono_id),
  constraint categoria_id_lar unique (id, lar_id)
);
create index categoria_dono_idx on app.categoria (dono_id);

-- ---------------------------------------------------------------------------------------------------
-- RLS (SDD 3.4, 3.5 e 3.7). Abreviações: L = lar_id = app.lar_atual(); D = dono_id = app.membro_atual().
alter table app.lar enable row level security;
alter table app.lar force row level security;
alter table app.membro enable row level security;
alter table app.membro force row level security;
alter table app.convite enable row level security;
alter table app.convite force row level security;
alter table app.categoria enable row level security;
alter table app.categoria force row level security;

-- lar: o próprio lar, ou o lar que o usuário acabou de criar (1º insert, antes de existir o vínculo).
create policy lar_select on app.lar for select to controle_app
  using (id = app.lar_atual() or criado_por = app.usuario_atual());
create policy lar_insert on app.lar for insert to controle_app
  with check (criado_por = app.usuario_atual());
-- SDD 3.4 libera o update também a quem criou; aqui ele fica só com o titular do lar ativo (mais
-- estrito; ADR-009): renomear é ação do titular e um ex-criador não mexe num lar antigo.
create policy lar_update on app.lar for update to controle_app
  using (id = app.lar_atual() and app.papel_atual() = 'titular')
  with check (id = app.lar_atual() and app.papel_atual() = 'titular');

-- membro: os membros do próprio lar e as próprias linhas.
create policy membro_select on app.membro for select to controle_app
  using (lar_id = app.lar_atual() or usuario_id = app.usuario_atual());
-- Entrada: titular só no lar que o próprio usuário criou; membro só com convite pendente para o
-- e-mail da sessão naquele lar. A validade (7 dias) é conferida pela API com o relógio injetável.
create policy membro_insert on app.membro for insert to controle_app
  with check (
    usuario_id = app.usuario_atual()
    and (
      (papel = 'titular'
        and exists (select 1 from app.lar l where l.id = membro.lar_id and l.criado_por = app.usuario_atual()))
      or (papel = 'membro'
        and exists (select 1 from app.convite c
                     where c.lar_id = membro.lar_id and c.situacao = 'pendente'
                       and c.email = app.email_atual()::app.citext))
    )
  );
-- Saída (a própria linha) ou remoção pelo titular do lar (D2). Só nome e saiu_em são atualizáveis.
create policy membro_update on app.membro for update to controle_app
  using (usuario_id = app.usuario_atual() or (lar_id = app.lar_atual() and app.papel_atual() = 'titular'))
  with check (usuario_id = app.usuario_atual() or (lar_id = app.lar_atual() and app.papel_atual() = 'titular'));

-- convite: o lar vê os seus; o convidado vê os endereçados ao e-mail da sessão.
create policy convite_select on app.convite for select to controle_app
  using (lar_id = app.lar_atual() or email = app.email_atual()::app.citext);
create policy convite_insert on app.convite for insert to controle_app
  with check (lar_id = app.lar_atual() and app.papel_atual() = 'titular');
create policy convite_update on app.convite for update to controle_app
  using ((lar_id = app.lar_atual() and app.papel_atual() = 'titular') or email = app.email_atual()::app.citext)
  with check ((lar_id = app.lar_atual() and app.papel_atual() = 'titular') or email = app.email_atual()::app.citext);

-- categoria: conjunta do lar, ou individual do próprio membro. Os parênteses impedem que a
-- individual do outro passe pelo ramo do lar (T categoria.sql do legado).
create policy categoria_select on app.categoria for select to controle_app
  using (lar_id = app.lar_atual() and (escopo = 'conjunto' or dono_id = app.membro_atual()));
create policy categoria_insert on app.categoria for insert to controle_app
  with check (lar_id = app.lar_atual() and (escopo = 'conjunto' or dono_id = app.membro_atual()));
create policy categoria_update on app.categoria for update to controle_app
  using (lar_id = app.lar_atual() and (escopo = 'conjunto' or dono_id = app.membro_atual()))
  with check (lar_id = app.lar_atual() and (escopo = 'conjunto' or dono_id = app.membro_atual()));
create policy categoria_delete on app.categoria for delete to controle_app
  using (lar_id = app.lar_atual() and (escopo = 'conjunto' or dono_id = app.membro_atual()));

-- Backup sem BYPASSRLS (SDD 3.7, D-06).
create policy backup_leitura on app.lar for select to controle_backup_ro using (true);
create policy backup_leitura on app.membro for select to controle_backup_ro using (true);
create policy backup_leitura on app.convite for select to controle_backup_ro using (true);
create policy backup_leitura on app.categoria for select to controle_backup_ro using (true);

-- ---------------------------------------------------------------------------------------------------
-- Grants da role app (SDD 4). Sem DELETE em lar, membro e convite: sair é saiu_em, revogar é situacao.
grant select, insert on app.lar to controle_app;
grant update (nome) on app.lar to controle_app;

grant select, insert on app.membro to controle_app;
grant update (nome, saiu_em) on app.membro to controle_app;

grant select, insert on app.convite to controle_app;
grant update (situacao, respondido_em) on app.convite to controle_app;

grant select, insert, delete on app.categoria to controle_app;
grant update (nome, variavel, arquivada) on app.categoria to controle_app;
