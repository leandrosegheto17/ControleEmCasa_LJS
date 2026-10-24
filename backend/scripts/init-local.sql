-- Papéis locais do Postgres (SDD 11.3). Senhas fixas, só para o docker-compose.
-- Em produção, as roles são criadas à mão no Neon (etapa 17). Os grants entram nas migrations (etapa 2).
CREATE ROLE controle_app LOGIN PASSWORD 'controle_app' NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE;
CREATE ROLE controle_backup_ro LOGIN PASSWORD 'controle_backup_ro' NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE;
