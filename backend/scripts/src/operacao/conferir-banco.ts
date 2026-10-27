import { readdirSync } from 'node:fs';
import { join } from 'node:path';
import pg from 'pg';

/**
 * Confere o banco de produção antes de ligá-lo ao Worker (RNF-07; ADR-005; roteiro `.specs/etapa-17/neon.md`, passos 2
 * e 5). Com a URL do owner (`DATABASE_URL_OWNER`), falha se:
 *
 * - alguma role `controle_*` tem `rolsuper`, `rolbypassrls`, `rolcreaterole` ou `rolcreatedb` (a RLS só protege se a
 *   role da API não pode furá-la);
 * - alguma tabela do schema `app` que tem política não está com RLS ligada (ENABLE) E forçada (FORCE);
 * - há migration da pasta `migracoes/` sem registro em `public.pgmigrations`;
 * - `controle_app` ou `controle_backup_ro` não tem `search_path = app` no banco atual (`pg_db_role_setting`). No Neon a
 *   migration não consegue definir (o owner é NOCREATEROLE; T17): é feito antes, como `neondb_owner`.
 *
 * Só imprime contagens e nomes de role/tabela/migration: nunca a URL, a senha nem o texto de erro do driver.
 */

export interface RoleConferida {
  rolname: string;
  rolsuper: boolean;
  rolbypassrls: boolean;
  rolcreaterole: boolean;
  rolcreatedb: boolean;
}

export interface TabelaConferida {
  tabela: string;
  rls: boolean;
  force: boolean;
}

export interface DadosDoBanco {
  roles: RoleConferida[];
  tabelasComPolitica: TabelaConferida[];
  migracoesAplicadas: string[];
  migracoesDaPasta: string[];
  /** Roles que precisam de `search_path = app` e não o têm no banco atual (`lerBanco` sempre preenche). */
  searchPath?: { banco: string; rolesSem: string[] };
}

/** Roles cujo `search_path` por banco tem de ser `app` (migration base; SDD 3.1). */
export const ROLES_COM_SEARCH_PATH = ['controle_app', 'controle_backup_ro'] as const;

const ATRIBUTOS = ['rolsuper', 'rolbypassrls', 'rolcreaterole', 'rolcreatedb'] as const;

/** Lista de problemas (vazia = banco conforme). Função pura: nenhum acesso a rede ou disco. */
export function avaliar(d: DadosDoBanco): string[] {
  const problemas: string[] = [];
  for (const r of d.roles) {
    const ligados = ATRIBUTOS.filter((a) => r[a]);
    if (ligados.length > 0) problemas.push(`Role ${r.rolname} com atributo proibido: ${ligados.join(', ')}.`);
  }
  for (const t of d.tabelasComPolitica) {
    if (!t.rls) problemas.push(`Tabela app.${t.tabela} sem RLS ligada (ENABLE).`);
    else if (!t.force) problemas.push(`Tabela app.${t.tabela} sem RLS forçada (FORCE).`);
  }
  const aplicadas = new Set(d.migracoesAplicadas);
  const pendentes = d.migracoesDaPasta.filter((m) => !aplicadas.has(m));
  if (pendentes.length > 0) problemas.push(`Migrations pendentes (${pendentes.length}): ${pendentes.join(', ')}.`);
  if (d.searchPath) {
    const { banco, rolesSem } = d.searchPath;
    for (const role of rolesSem) {
      problemas.push(
        `Role ${role} sem search_path = app no banco ${banco}. Defina como neondb_owner: ALTER ROLE ${role} IN DATABASE ${banco} SET search_path = app;`,
      );
    }
  }
  return problemas;
}

/** Resumo só com contagens. */
/** Tira da conferência as roles citadas (só ensaio local: o owner do docker é superusuário; em produção não se usa). */
export function semRoles(d: DadosDoBanco, ignorar: string[]): DadosDoBanco {
  return { ...d, roles: d.roles.filter((r) => !ignorar.includes(r.rolname)) };
}

export function resumo(d: DadosDoBanco): string {
  const aplicadas = new Set(d.migracoesAplicadas);
  const pendentes = d.migracoesDaPasta.filter((m) => !aplicadas.has(m)).length;
  return `${d.roles.length} roles controle_*, ${d.tabelasComPolitica.length} tabelas de app com política, ${pendentes} migrations pendentes.`;
}

export function migracoesDaPasta(pasta: string): string[] {
  return readdirSync(pasta)
    .filter((f) => /\.(sql|js|ts)$/.test(f))
    .map((f) => f.replace(/\.(sql|js|ts)$/, ''))
    .sort();
}

export async function lerBanco(c: pg.Client, pasta: string): Promise<DadosDoBanco> {
  const roles = await c.query<RoleConferida>(
    `select rolname, rolsuper, rolbypassrls, rolcreaterole, rolcreatedb
       from pg_roles where rolname like 'controle\\_%' order by 1`,
  );
  const tabelas = await c.query<TabelaConferida>(
    `select cl.relname as tabela, cl.relrowsecurity as rls, cl.relforcerowsecurity as force
       from pg_class cl
      where cl.relnamespace = 'app'::regnamespace and cl.relkind in ('r', 'p')
        and exists (select 1 from pg_policies p where p.schemaname = 'app' and p.tablename = cl.relname)
      order by 1`,
  );
  const existe = await c.query<{ existe: boolean }>(`select to_regclass('public.pgmigrations') is not null as existe`);
  const aplicadas = existe.rows[0]?.existe
    ? (await c.query<{ name: string }>('select name from public.pgmigrations')).rows.map((r) => r.name)
    : [];
  // Configuração por banco (ALTER ROLE ... IN DATABASE ... SET): pg_db_role_setting, com setdatabase do banco atual.
  // Role inexistente também conta como "sem search_path".
  const searchPath = await c.query<{ banco: string; roles_sem: string[] }>(
    `select current_database() as banco,
            coalesce(array_agg(n.rolname order by n.rolname) filter (where not exists (
              select 1 from pg_db_role_setting s join pg_roles r on r.oid = s.setrole
               where r.rolname = n.rolname
                 and s.setdatabase = (select oid from pg_database where datname = current_database())
                 and 'search_path=app' = any(s.setconfig))), '{}') as roles_sem
       from unnest($1::text[]) as n(rolname)`,
    [ROLES_COM_SEARCH_PATH],
  );
  const sp = searchPath.rows[0];
  return {
    roles: roles.rows,
    tabelasComPolitica: tabelas.rows,
    migracoesAplicadas: aplicadas,
    migracoesDaPasta: migracoesDaPasta(pasta),
    searchPath: { banco: sp?.banco ?? '', rolesSem: sp?.roles_sem ?? [] },
  };
}

const PASTA_MIGRACOES = join(import.meta.dirname, '../../migracoes');

export async function conferirBanco(url: string, pasta: string = PASTA_MIGRACOES): Promise<DadosDoBanco> {
  const c = new pg.Client({ connectionString: url });
  await c.connect();
  try {
    return await lerBanco(c, pasta);
  } finally {
    await c.end();
  }
}

export async function main(
  ambiente: NodeJS.ProcessEnv = process.env,
  pasta: string = PASTA_MIGRACOES,
): Promise<number> {
  const url = ambiente['DATABASE_URL_OWNER'];
  if (!url) {
    console.error('DATABASE_URL_OWNER ausente.');
    return 1;
  }
  let dados: DadosDoBanco;
  try {
    dados = await conferirBanco(url, pasta);
  } catch {
    // Texto do erro do driver pode trazer host ou usuário: não vai à saída.
    console.error('Não foi possível ler o banco com DATABASE_URL_OWNER (conexão ou consulta falhou).');
    return 1;
  }
  // IGNORAR_ROLES (lista separada por vírgula) existe só para o ensaio local, onde o owner do docker é superusuário.
  const ignorar = (ambiente['IGNORAR_ROLES'] ?? '')
    .split(',')
    .map((r) => r.trim())
    .filter(Boolean);
  dados = semRoles(dados, ignorar);
  const problemas = avaliar(dados);
  if (problemas.length > 0) {
    for (const p of problemas) console.error(p);
    console.error(`Banco fora do esperado: ${resumo(dados)}`);
    return 1;
  }
  console.info(`Banco conforme: ${resumo(dados)}`);
  return 0;
}

if (import.meta.main) {
  process.exitCode = await main();
}
