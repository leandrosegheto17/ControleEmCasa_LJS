-- Up Migration
-- Backup diario (etapa 16; SDD 3.7, 4, D-06; G-44; ADR-015): `pg_dump -Fc --enable-row-security` como
-- controle_backup_ro. O ensaio com o Postgres 17 do docker mostrou que o dump falhava antes de comecar:
--   * "permission denied for schema public" ao travar public.pgmigrations (o controle do node-pg-migrate);
--   * "permission denied for sequence tentativa_login_id_seq" ao ler o last_value da sequencia.
-- SPEC_DEVIATION: o SDD 4 dizia "nada alem" de usage em app, SELECT nas tabelas de app e a politica backup_leitura.
-- Somam-se so leituras: SELECT nas sequencias de app (e nas futuras) e leitura do controle das migrations (para o
-- banco restaurado saber quais migrations ja rodaram). Nenhuma escrita, nenhum CREATE.

grant select on all sequences in schema app to controle_backup_ro;
alter default privileges for role controle_owner in schema app grant select on sequences to controle_backup_ro;

-- O node-pg-migrate cria public.pgmigrations antes de rodar a primeira migration; o nome da sequencia vem do catalogo.
grant usage on schema public to controle_backup_ro;
grant select on public.pgmigrations to controle_backup_ro;
do $$
declare
  seq text := pg_get_serial_sequence('public.pgmigrations', 'id');
begin
  if seq is not null then
    execute format('grant select on sequence %s to controle_backup_ro', seq);
  end if;
end
$$;
