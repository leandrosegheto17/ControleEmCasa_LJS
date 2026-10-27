# ADR-005: Roles e RLS com GUC por transação

- **Status:** Aceito em 2026-10-24 (etapa 2)
- **Data:** 2026-10-24
- **Decisores:** Leandro (stakeholder)
- **Detalha:** a decisão 2 do PLANO e o ADR-004 (isolamento por lar e por dono); resolve o ponto E-09 do `THREAT-MODEL.md`

## Contexto

- O legado (MyMoney) usava `auth.uid()` do Supabase e a role `authenticated`. Aqui não há Supabase: a API se conecta ao Postgres (Neon, via Hyperdrive) com uma role própria.
- O Hyperdrive reaproveita conexões entre requisições. Uma variável de sessão que sobrevive à transação vaza a identidade de um usuário para o seguinte (TM-DB-01).
- O Padrão LJS pede menor privilégio: a role da API não faz DDL e não apaga onde excluir não é regra (G-04).
- As tabelas de acesso (`usuario`, `sessao`, `tentativa_login`, `token_email`, `aceite_termos`) são lidas antes de existir identidade (entrar, confirmar e-mail, redefinir senha). Não há `lar_id` nem GUC nesse momento.

## Decisão

1. **Três roles**, todas fora do controle das migrations (criadas por `backend/scripts/init-local.sql` no local e à mão no Neon):

   | Role | Atributos | Uso |
   |---|---|---|
   | `controle_owner` | dona do schema `app` e de todos os objetos | migrations, seed e purga; nunca a API |
   | `controle_app` | `LOGIN`, sem `SUPERUSER`, `BYPASSRLS`, `CREATEDB`, `CREATEROLE`; sem `CREATE` em schema; não é dona de nada | a API (Hyperdrive) |
   | `controle_backup_ro` | `LOGIN`, só `SELECT`, sem `BYPASSRLS` | `backup.yml` |

2. **Privilégios por migration, em SQL puro** (`backend/scripts/migracoes/AAAAMMDDHHMMSS_nome.sql`, uma transação por migration, `node-pg-migrate --no-single-transaction`):
   - `public` sem acesso para ninguém; tudo vive no schema `app`; `TEMPORARY` revogado de `public` no banco;
   - `alter default privileges for role controle_owner`: funções não são executáveis por `public`, mas `app` e `backup_ro` as recebem; tabelas novas dão `SELECT` ao `backup_ro` e nada a `public`;
   - cada tabela concede à `app` só o que o SDD 4 lista (`SELECT`, `INSERT`, `UPDATE` por coluna, `DELETE` onde é regra). Nunca `TRUNCATE`, `REFERENCES` nem `TRIGGER`;
   - `search_path = app` nas roles `app` e `backup_ro` (por banco), para as extensões instaladas em `app` (`pgcrypto`, `citext`) resolverem sem qualificar.
3. **Identidade por GUC local à transação.** A API grava `set_config('app.usuario_id', …, true)`, `app.lar_id`, `app.membro_id`, `app.email` e, só nos fluxos de sistema, `app.sistema`. Nunca `SET` sem `LOCAL`, nunca `set_config(…, false)`.
4. **Funções de leitura** em `app`: `usuario_atual()`, `lar_atual()`, `membro_atual()`, `email_atual()` e `em_sistema()`. São SQL `STABLE`, `SECURITY INVOKER`, e só leem `current_setting(nome, true)`.
   - Ausente, vazio (o valor que sobra depois do commit) ou malformado vira **nulo**, nunca erro (`pg_input_is_valid(…, 'uuid')`). Uma política que compara com nulo não devolve linha: fecha por padrão.
   - Não existe `SECURITY DEFINER` no schema da aplicação.
5. **Tabelas de acesso sem RLS por linha** (resolve E-09). A segurança delas vem de:
   - segredo na consulta (hash de token de 256 bits; e-mail + senha comparada com `crypt` no SQL);
   - grants por coluna (`usuario` só atualiza `nome`, `senha_hash`, `email_confirmado_em` e `atualizado_em`; `sessao` só `ultimo_uso_em`; `token_email` só `usado_em`);
   - ausência de `DELETE` onde a linha é registro (`usuario`, `aceite_termos`); a purga roda como owner.
   As tabelas de negócio (etapa 6 em diante) usam `ENABLE` e `FORCE ROW LEVEL SECURITY` com as funções acima (ADR-004).
6. **Testes** contra um Postgres 18 real (ADR-016), num banco descartável por execução: migrations do zero; a `app` recusa DDL, `TRUNCATE`, `DELETE` e `UPDATE` fora das colunas, e `SET ROLE`, com `42501`; as roles não têm `BYPASSRLS` nem `SUPERUSER`; as funções de GUC dão nulo sem `set_config`, o valor dentro da transação e nulo depois do `COMMIT` e do `ROLLBACK`. O CI sobe o Postgres 18 (ADR-016) como serviço e esses testes são obrigatórios lá (`EXIGIR_BANCO=1`).

## Consequências

**Positivas**
- Um filtro esquecido na API não vaza dado: o banco recusa.
- O GUC não atravessa requisições, mesmo com pool de conexões.
- Perder o `app` não permite apagar histórico nem alterar o esquema.

**Negativas**
- O `app` não consegue purgar: a exclusão de conta (30 dias) roda como owner, no GitHub Actions (exceção registrada no GUARDRAILS G-49).
- Cada migration nova precisa lembrar os `grant`s; o teste de catálogo (privilégios proibidos, `SECURITY DEFINER`) cobre as tabelas já existentes.
- As roles são criadas fora das migrations: sem elas, a primeira migration falha com mensagem explícita.
- Tabelas de acesso dependem de segredo forte e de grants; um erro de grant nelas não é pego por RLS.

## Alternativas consideradas

| Alternativa | Por que não |
|---|---|
| `set_config(…, false)` ou `SET` de sessão | Vaza identidade entre requisições no pool do Hyperdrive |
| Uma role só (a mesma das migrations) | Qualquer falha de SQL na API passa a poder alterar o esquema |
| `SECURITY DEFINER` para as consultas de acesso | Contraria a decisão 1 do PLANO; esconde privilégio em função |
| RLS por linha nas tabelas de acesso | Não há identidade na hora de ler; exigiria GUC falso ou `BYPASSRLS` |
| Criar as roles dentro das migrations | O Neon cria roles pelo painel; `CREATEROLE` na migration ampliaria o poder do owner |
