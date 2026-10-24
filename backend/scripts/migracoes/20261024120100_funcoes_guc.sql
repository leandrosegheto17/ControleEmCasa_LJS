-- Up Migration
-- Funcoes de GUC (SDD 3.1 e 5.3): leitura segura de variaveis locais a transacao.
-- SQL STABLE, SECURITY INVOKER; so leem current_setting(..., true).
-- Ausente, vazio ou malformado vira NULL (nunca erro): a politica de RLS fecha por nulo.
-- Quem grava e a API, com set_config(nome, valor, true), sempre dentro da transacao.

create function app.usuario_atual() returns uuid
language sql stable security invoker
as $$
  select case when pg_input_is_valid(current_setting('app.usuario_id', true), 'uuid')
              then current_setting('app.usuario_id', true)::uuid end
$$;

create function app.lar_atual() returns uuid
language sql stable security invoker
as $$
  select case when pg_input_is_valid(current_setting('app.lar_id', true), 'uuid')
              then current_setting('app.lar_id', true)::uuid end
$$;

create function app.membro_atual() returns uuid
language sql stable security invoker
as $$
  select case when pg_input_is_valid(current_setting('app.membro_id', true), 'uuid')
              then current_setting('app.membro_id', true)::uuid end
$$;

create function app.email_atual() returns text
language sql stable security invoker
as $$
  select nullif(current_setting('app.email', true), '')
$$;

create function app.em_sistema() returns boolean
language sql stable security invoker
as $$
  select coalesce(current_setting('app.sistema', true) in ('webhook', 'cron', 'purga'), false)
$$;
