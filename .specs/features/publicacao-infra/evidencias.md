# Publicação 17b: evidências

Registro das conferências de cada tarefa de `tasks.md`. **Nunca** coloque aqui senha, chave, token ou URL de conexão: só nomes, contagens, `true`/`false`, versões e datas.

| Tarefa | Data | O que foi conferido | Resultado |
| ------ | ---- | ------------------- | --------- |
| T1 | 2026-10-27 | Consulta a `pg_roles` e `pg_has_role(..., 'neon_superuser', 'member')` nas roles `controle_owner`, `controle_app` e `controle_backup_ro` (captura de tela do usuário, sem senha) | `f` em `rolsuper`, `rolbypassrls`, `rolcreaterole`, `rolcreatedb` e `neon_superuser` nas 3 linhas. Houve um desvio: o usuário tinha criado `contas_app` e `contas_backup` pelo console; a consulta mostrou `t` em `rolbypassrls`, `rolcreaterole`, `rolcreatedb` e `neon_superuser` nas duas (o console as põe em `neon_superuser`), então foram apagadas e as 3 `controle_*` recriadas por SQL. `neondb_owner` segue com tudo `t` (administrativa do Neon, nunca usada pelo app). |
| T2 | 2026-10-27 | Banco `controle` com dono `controle_owner` e branch `dev` criados no console do Neon; strings de conexão diretas (sem `-pooler`, `sslmode=require`) das 3 roles guardadas no gerenciador de senhas do usuário | O usuário confirmou: o banco `controle` aparece com dono `controle_owner` nas branches `main` e `dev`. Nenhuma URL ou senha foi enviada. |
