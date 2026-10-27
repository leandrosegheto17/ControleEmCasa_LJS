-- Up Migration
-- Base do banco (SDD 3.1 e 4): schema app, privilegios minimos, extensoes.
-- Pre-requisito: as roles controle_app e controle_backup_ro ja existem
-- (backend/scripts/init-local.sql no local; criadas a mao no Neon, etapa 17).
-- A migration roda como controle_owner, que passa a ser dono de tudo.

do $$
begin
  if (select count(*) from pg_roles where rolname in ('controle_app', 'controle_backup_ro')) <> 2 then
    raise exception 'Faltam as roles controle_app e/ou controle_backup_ro. Crie-as antes de migrar (backend/scripts/init-local.sql).';
  end if;
end
$$;

-- public nao serve a ninguem; as tabelas ficam no schema app.
revoke all on schema public from public;
create schema app;
revoke all on schema app from public;
grant usage on schema app to controle_app, controle_backup_ro;

-- Sem tabelas temporarias para quem nao e dono (DDL fora do schema).
do $$
begin
  execute format('revoke temporary on database %I from public', current_database());
  -- No Neon o controle_owner e NOCREATEROLE e nao pode alterar outra role (42501): o search_path e definido antes,
  -- como neondb_owner (docs/runbook.md, secao 10; .specs/etapa-17/neon.md, passo 5), e o conferir-banco confere.
  begin
    execute format('alter role controle_app in database %I set search_path = app', current_database());
  exception when insufficient_privilege then
    raise notice 'O search_path de controle_app nao foi definido pela migration (sem privilegio). Defina como administrador: ALTER ROLE controle_app IN DATABASE % SET search_path = app; (ver docs/runbook.md, secao 10).', current_database();
  end;
  begin
    execute format('alter role controle_backup_ro in database %I set search_path = app', current_database());
  exception when insufficient_privilege then
    raise notice 'O search_path de controle_backup_ro nao foi definido pela migration (sem privilegio). Defina como administrador: ALTER ROLE controle_backup_ro IN DATABASE % SET search_path = app; (ver docs/runbook.md, secao 10).', current_database();
  end;
end
$$;

-- Privilegios padrao dos objetos que o owner criar daqui em diante:
-- funcoes nao sao executaveis por public; app e backup_ro recebem EXECUTE;
-- tabelas nao dao nada a public e backup_ro recebe SELECT.
alter default privileges for role controle_owner revoke execute on functions from public;
alter default privileges for role controle_owner in schema app revoke all on tables from public;
alter default privileges for role controle_owner in schema app grant execute on functions to controle_app, controle_backup_ro;
alter default privileges for role controle_owner in schema app grant select on tables to controle_backup_ro;

-- Extensoes no schema app: bcrypt no SQL (crypt/gen_salt) e e-mail sem diferenca de caixa.
create extension if not exists pgcrypto schema app;
create extension if not exists citext schema app;
grant execute on all functions in schema app to controle_app, controle_backup_ro;
