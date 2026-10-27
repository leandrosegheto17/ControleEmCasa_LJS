import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import {
  avisarSemBanco,
  comCliente,
  criarBancoDescartavel,
  temBanco,
  URL_OWNER,
  type BancoDescartavel,
} from '../apoio-banco-teste';
import { avaliar, main, type DadosDoBanco } from './conferir-banco';

/**
 * T17: o `conferir-banco` reprova quando `controle_app` ou `controle_backup_ro` não tem `search_path = app` no banco
 * atual. No Neon a migration não consegue definir (owner NOCREATEROLE); o passo é feito antes, como `neondb_owner`.
 */
avisarSemBanco();

const limpo: DadosDoBanco = {
  roles: [{ rolname: 'controle_app', rolsuper: false, rolbypassrls: false, rolcreaterole: false, rolcreatedb: false }],
  tabelasComPolitica: [{ tabela: 'lancamento', rls: true, force: true }],
  migracoesAplicadas: ['a'],
  migracoesDaPasta: ['a'],
  searchPath: { banco: 'controle', rolesSem: [] },
};

const instrucao = (role: string, banco: string) =>
  `Role ${role} sem search_path = app no banco ${banco}. Defina como neondb_owner: ALTER ROLE ${role} IN DATABASE ${banco} SET search_path = app;`;

describe('avaliar: search_path por banco (funções puras)', () => {
  it('as duas roles com search_path: sem problemas', () => {
    expect(avaliar(limpo)).toEqual([]);
  });

  it.each(['controle_app', 'controle_backup_ro'])('%s sem search_path reprova com o nome e a instrução', (role) => {
    expect(avaliar({ ...limpo, searchPath: { banco: 'controle', rolesSem: [role] } })).toEqual([
      instrucao(role, 'controle'),
    ]);
  });

  it('as duas sem search_path: um problema por role, com o banco certo', () => {
    expect(
      avaliar({ ...limpo, searchPath: { banco: 'outro', rolesSem: ['controle_app', 'controle_backup_ro'] } }),
    ).toEqual([instrucao('controle_app', 'outro'), instrucao('controle_backup_ro', 'outro')]);
  });
});

describe.skipIf(!temBanco)('search_path no Postgres 18 local', () => {
  // O owner do docker (POSTGRES_USER) é superusuário; em produção controle_owner é NOSUPERUSER (neon.md, passo 2).
  const AMB = { IGNORAR_ROLES: 'controle_owner' };
  let banco: BancoDescartavel;
  let nome: string;
  const saida: string[] = [];
  const espioes: Array<{ mockRestore(): void }> = [];

  const sql = (s: string) => comCliente(URL_OWNER as string, (c) => c.query(s));

  beforeAll(async () => {
    banco = await criarBancoDescartavel('controle_csp');
    nome = new URL(banco.owner).pathname.slice(1);
    for (const m of ['info', 'error'] as const) {
      espioes.push(vi.spyOn(console, m).mockImplementation((...a: unknown[]) => void saida.push(a.join(' '))));
    }
  }, 60_000);

  afterAll(async () => {
    espioes.forEach((e) => e.mockRestore());
    if (temBanco) await banco?.apagar();
  }, 60_000);

  it('passa quando as duas roles têm search_path = app no banco (migrado como superusuário)', async () => {
    saida.length = 0;
    expect(await main({ ...AMB, DATABASE_URL_OWNER: banco.owner })).toBe(0);
    expect(saida.join('\n')).toMatch(/^Banco conforme: /);
  });

  it('reprova quando controle_app não tem search_path no banco (como no Neon antes do passo do neondb_owner)', async () => {
    await sql(`alter role controle_app in database ${nome} reset search_path`);
    try {
      saida.length = 0;
      expect(await main({ ...AMB, DATABASE_URL_OWNER: banco.owner })).toBe(1);
      const tudo = saida.join('\n');
      expect(tudo).toContain(instrucao('controle_app', nome));
      expect(tudo).not.toContain('Role controle_backup_ro sem search_path');
    } finally {
      await sql(`alter role controle_app in database ${nome} set search_path = app`);
    }
  });

  it('reprova as duas quando nenhuma tem search_path, e search_path diferente de app também reprova', async () => {
    await sql(`alter role controle_app in database ${nome} set search_path = public`);
    await sql(`alter role controle_backup_ro in database ${nome} reset search_path`);
    try {
      saida.length = 0;
      expect(await main({ ...AMB, DATABASE_URL_OWNER: banco.owner })).toBe(1);
      const tudo = saida.join('\n');
      expect(tudo).toContain(instrucao('controle_app', nome));
      expect(tudo).toContain(instrucao('controle_backup_ro', nome));
    } finally {
      await sql(`alter role controle_app in database ${nome} set search_path = app`);
      await sql(`alter role controle_backup_ro in database ${nome} set search_path = app`);
    }
  });

  it('search_path definido noutro banco não conta para este banco', async () => {
    await sql(`alter role controle_backup_ro in database ${nome} reset search_path`);
    await sql(`alter role controle_backup_ro in database postgres set search_path = app`);
    try {
      saida.length = 0;
      expect(await main({ ...AMB, DATABASE_URL_OWNER: banco.owner })).toBe(1);
      expect(saida.join('\n')).toContain(instrucao('controle_backup_ro', nome));
    } finally {
      await sql(`alter role controle_backup_ro in database postgres reset search_path`);
      await sql(`alter role controle_backup_ro in database ${nome} set search_path = app`);
    }
  });
});
