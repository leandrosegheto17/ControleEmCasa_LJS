-- Up Migration
-- Exclusão de conta e purga (etapa 14; SDD 3.3, 4, D-05, E-1, E-2; RN-26, CA-23.12; G-04, G-49; ADR-005, ADR-013).
--
-- 1. exclusao_conta: o pedido (solicitada_em), a confirmação pelo link (confirmada_em) e a data da purga
--    (purgar_em = confirmada_em + 30 dias). Tabela de acesso (SDD 3.3, D-03): sem RLS por linha, protegida por grants
--    de coluna; `usuario_id` SEM FK, porque a linha sobrevive à purga como registro mínimo (sem nome nem e-mail).
-- 2. Políticas da purga para a role owner. Todas as tabelas com RLS usam FORCE (G-01), e o FORCE vale também para o
--    dono da tabela: num Postgres em que o owner não é superusuário nem tem BYPASSRLS (o Neon, etapa 17), a purga não
--    enxergaria linha nenhuma e "apagaria" zero linhas em silêncio. Cada tabela com RLS ganha SELECT e DELETE para o
--    owner, só com `app.sistema = 'purga'` gravado como GUC local pelo `purgar.ts` (ADR-013). A role app não ganha nada.

-- ---------------------------------------------------------------------------------------------------
-- exclusao_conta (RN-26)
create table app.exclusao_conta (
  id uuid primary key default gen_random_uuid(),
  usuario_id uuid not null,
  solicitada_em timestamptz not null default now(),
  confirmada_em timestamptz,
  purgar_em timestamptz,
  cancelada_em timestamptz,
  purgada_em timestamptz,
  -- A data da purga existe exatamente quando a exclusão foi confirmada, e é a confirmação + 30 dias (CA-26.2).
  constraint exclusao_conta_purga_com_confirmacao check ((confirmada_em is null) = (purgar_em is null)),
  constraint exclusao_conta_purga_30_dias check (purgar_em is null or purgar_em = confirmada_em + interval '30 days'),
  constraint exclusao_conta_confirmacao_depois_do_pedido check (confirmada_em is null or confirmada_em >= solicitada_em),
  constraint exclusao_conta_purgada_so_confirmada check (purgada_em is null or confirmada_em is not null)
);
-- Um pedido em aberto por usuário (SDD 3.3).
create unique index exclusao_conta_uma_aberta on app.exclusao_conta (usuario_id)
  where cancelada_em is null and purgada_em is null;
-- A purga procura as confirmadas vencidas.
create index exclusao_conta_purgar_em_idx on app.exclusao_conta (purgar_em)
  where confirmada_em is not null and cancelada_em is null and purgada_em is null;

-- Grants da role app (SDD 4): sem DELETE; `purgada_em` só a purga (owner) grava.
grant select, insert on app.exclusao_conta to controle_app;
grant update (confirmada_em, purgar_em, cancelada_em) on app.exclusao_conta to controle_app;

-- ---------------------------------------------------------------------------------------------------
-- Contexto da purga: só o `purgar.ts` grava `app.sistema = 'purga'` (SDD 5.3).
create function app.em_purga() returns boolean
language sql stable security invoker
as $$
  select coalesce(current_setting('app.sistema', true) = 'purga', false)
$$;

-- SELECT e DELETE do owner em toda tabela com RLS do schema app, só no contexto da purga. Feito por laço para que
-- nenhuma tabela fique de fora; as tabelas novas (push, etapa 15) declaram as suas e o teste de catálogo confere.
do $$
declare
  t record;
begin
  for t in
    select c.relname from pg_class c
     where c.relnamespace = 'app'::regnamespace and c.relkind = 'r' and c.relrowsecurity
     order by c.relname
  loop
    execute format('create policy purga_select on app.%I for select to controle_owner using (app.em_purga())', t.relname);
    execute format('create policy purga_delete on app.%I for delete to controle_owner using (app.em_purga())', t.relname);
  end loop;
end
$$;
