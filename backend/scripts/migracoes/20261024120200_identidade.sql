-- Up Migration
-- Tabelas de acesso (SDD 3.3): sem lar_id e sem RLS por linha, porque a identidade
-- ainda nao existe quando sao lidas. Protegidas por segredo (hash de token, e-mail + senha)
-- e por grants de coluna (SDD 4). Justificativa no THREAT-MODEL e no ADR 005.

create table app.usuario (
  id uuid primary key default gen_random_uuid(),
  email app.citext not null,
  nome text not null,
  senha_hash text not null,
  email_confirmado_em timestamptz,
  trial_usado_em timestamptz,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  constraint usuario_email_unico unique (email),
  constraint usuario_email_tamanho check (char_length(email::text) <= 254),
  constraint usuario_nome_valido check (btrim(nome) <> '' and char_length(nome) <= 60)
);

create table app.sessao (
  id uuid primary key default gen_random_uuid(),
  token_hash bytea not null,
  usuario_id uuid not null references app.usuario (id) on delete cascade,
  criada_em timestamptz not null default now(),
  ultimo_uso_em timestamptz not null default now(),
  expira_absoluta_em timestamptz not null,
  constraint sessao_token_hash_unico unique (token_hash),
  constraint sessao_token_hash_tamanho check (octet_length(token_hash) = 32),
  constraint sessao_expiracao_12h check (expira_absoluta_em = criada_em + interval '12 hours')
);
create index sessao_usuario_idx on app.sessao (usuario_id);

create table app.tentativa_login (
  id bigint generated always as identity primary key,
  email_hash bytea not null,
  ip_hash bytea,
  sucesso boolean not null,
  momento timestamptz not null default now()
);
create index tentativa_login_email_momento_idx on app.tentativa_login (email_hash, momento);
create index tentativa_login_ip_momento_idx on app.tentativa_login (ip_hash, momento);

create table app.token_email (
  id uuid primary key default gen_random_uuid(),
  usuario_id uuid not null references app.usuario (id) on delete cascade,
  finalidade text not null,
  token_hash bytea not null,
  criado_em timestamptz not null default now(),
  expira_em timestamptz not null,
  usado_em timestamptz,
  constraint token_email_finalidade_valida check (finalidade in ('confirmacao', 'recuperacao', 'exclusao')),
  constraint token_email_token_hash_unico unique (token_hash),
  constraint token_email_token_hash_tamanho check (octet_length(token_hash) = 32),
  constraint token_email_expiracao_30min check (expira_em = criado_em + interval '30 minutes')
);
create index token_email_usuario_idx on app.token_email (usuario_id);
create unique index token_email_aberto_unico on app.token_email (usuario_id, finalidade) where usado_em is null;

create table app.aceite_termos (
  id uuid primary key default gen_random_uuid(),
  usuario_id uuid not null references app.usuario (id) on delete cascade,
  versao_termos text not null,
  versao_privacidade text not null,
  aceito_em timestamptz not null default now(),
  constraint aceite_termos_versoes_unico unique (usuario_id, versao_termos, versao_privacidade)
);

-- Grants da role app (SDD 4). Sem TRUNCATE, REFERENCES nem TRIGGER em lugar nenhum.
-- backup_ro recebe SELECT pelos privilegios padrao da migration base.
grant select, insert on app.usuario to controle_app;
grant update (nome, senha_hash, email_confirmado_em, atualizado_em) on app.usuario to controle_app;

grant select, insert, delete on app.sessao to controle_app;
grant update (ultimo_uso_em) on app.sessao to controle_app;

grant select, insert, delete on app.tentativa_login to controle_app;

grant select, insert, delete on app.token_email to controle_app;
grant update (usado_em) on app.token_email to controle_app;

grant select, insert on app.aceite_termos to controle_app;
