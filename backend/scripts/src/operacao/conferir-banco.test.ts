import { randomBytes } from 'node:crypto';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import {
  avisarSemBanco,
  comCliente,
  criarBancoDescartavel,
  temBanco,
  URL_OWNER,
  type BancoDescartavel,
} from '../apoio-banco-teste';
import { avaliar, main, resumo, type DadosDoBanco } from './conferir-banco';

/** RNF-07; ADR-005: roles sem atributo perigoso, RLS ligada e forçada, nenhuma migration pendente. */
avisarSemBanco();

const limpo: DadosDoBanco = {
  roles: [{ rolname: 'controle_app', rolsuper: false, rolbypassrls: false, rolcreaterole: false, rolcreatedb: false }],
  tabelasComPolitica: [{ tabela: 'lancamento', rls: true, force: true }],
  migracoesAplicadas: ['a', 'b'],
  migracoesDaPasta: ['a', 'b'],
};

describe('avaliar (funções puras)', () => {
  it('banco conforme: sem problemas', () => {
    expect(avaliar(limpo)).toEqual([]);
  });

  it.each(['rolsuper', 'rolbypassrls', 'rolcreaterole', 'rolcreatedb'] as const)('role com %s falha', (atributo) => {
    const d = { ...limpo, roles: [{ ...limpo.roles[0]!, [atributo]: true }] };
    expect(avaliar(d)).toEqual([`Role controle_app com atributo proibido: ${atributo}.`]);
  });

  it('tabela sem FORCE e tabela sem RLS falham com mensagem própria', () => {
    const d = {
      ...limpo,
      tabelasComPolitica: [
        { tabela: 'a', rls: true, force: false },
        { tabela: 'b', rls: false, force: false },
      ],
    };
    expect(avaliar(d)).toEqual(['Tabela app.a sem RLS forçada (FORCE).', 'Tabela app.b sem RLS ligada (ENABLE).']);
  });

  it('migration pendente falha e lista o nome', () => {
    expect(avaliar({ ...limpo, migracoesDaPasta: ['a', 'b', 'c'] })).toEqual(['Migrations pendentes (1): c.']);
  });

  it('o resumo só tem contagens', () => {
    expect(resumo({ ...limpo, migracoesDaPasta: ['a', 'b', 'c'] })).toBe(
      '1 roles controle_*, 1 tabelas de app com política, 1 migrations pendentes.',
    );
  });
});

describe('main sem banco', () => {
  it('sem DATABASE_URL_OWNER falha com mensagem clara', async () => {
    const erro = vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(await main({})).toBe(1);
    expect(erro).toHaveBeenCalledWith('DATABASE_URL_OWNER ausente.');
    erro.mockRestore();
  });
});

describe.skipIf(!temBanco)('no Postgres 18 local', () => {
  // O owner do docker (POSTGRES_USER) é superusuário; em produção controle_owner é NOSUPERUSER (neon.md, passo 2).
  const AMB = { IGNORAR_ROLES: 'controle_owner' };
  let banco: BancoDescartavel;
  const saida: string[] = [];
  const espioes: Array<{ mockRestore(): void }> = [];

  beforeAll(async () => {
    banco = await criarBancoDescartavel('controle_conf');
    for (const m of ['info', 'error'] as const) {
      espioes.push(vi.spyOn(console, m).mockImplementation((...a: unknown[]) => void saida.push(a.join(' '))));
    }
  }, 60_000);

  afterAll(async () => {
    espioes.forEach((e) => e.mockRestore());
    if (temBanco) await banco?.apagar();
  }, 60_000);

  it('passa no banco migrado do zero', async () => {
    saida.length = 0;
    expect(await main({ ...AMB, DATABASE_URL_OWNER: banco.owner })).toBe(0);
    expect(saida.join('\n')).toMatch(
      /^Banco conforme: \d+ roles controle_\*, \d+ tabelas de app com política, 0 migrations pendentes\.$/,
    );
  });

  it('sem ignorar o owner local, acusa o superusuário (a detecção funciona no banco real)', async () => {
    saida.length = 0;
    expect(await main({ DATABASE_URL_OWNER: banco.owner })).toBe(1);
    expect(saida.join(' | ')).toContain('Role controle_owner com atributo proibido:');
  });

  it('falha com mensagem clara quando uma role controle_* ganha BYPASSRLS', async () => {
    const role = `controle_x${randomBytes(3).toString('hex')}`;
    await comCliente(URL_OWNER as string, (c) => c.query(`create role ${role} nologin bypassrls`));
    try {
      saida.length = 0;
      expect(await main({ ...AMB, DATABASE_URL_OWNER: banco.owner })).toBe(1);
      expect(saida.join('\n')).toContain(`Role ${role} com atributo proibido: rolbypassrls.`);
    } finally {
      await comCliente(URL_OWNER as string, (c) => c.query(`drop role ${role}`));
    }
  });

  it('só confere roles controle_*: controleX... e roles de fora do prefixo, mesmo perigosas, não são acusadas', async () => {
    const sufixo = randomBytes(3).toString('hex');
    const casaPrefixo = `controle_ok${sufixo}`;
    const quaseCasa = `controleXfoo${sufixo}`;
    const fora = `outra_fora${sufixo}`;
    const contagem = () => Number(/(\d+) roles controle_\*/.exec(saida.join('\n'))?.[1]);
    saida.length = 0;
    expect(await main({ ...AMB, DATABASE_URL_OWNER: banco.owner })).toBe(0);
    const antes = contagem();
    try {
      await comCliente(URL_OWNER as string, async (c) => {
        await c.query(`create role ${casaPrefixo} nologin`);
        await c.query(`create role ${quaseCasa} nologin bypassrls createrole`);
        await c.query(`create role ${fora} nologin bypassrls createdb`);
      });
      saida.length = 0;
      expect(await main({ ...AMB, DATABASE_URL_OWNER: banco.owner })).toBe(0);
      const tudo = saida.join('\n');
      expect(tudo).not.toContain(quaseCasa);
      expect(tudo).not.toContain(fora);
      expect(contagem()).toBe(antes + 1);
    } finally {
      await comCliente(URL_OWNER as string, async (c) => {
        for (const r of [casaPrefixo, quaseCasa, fora]) await c.query(`drop role if exists ${r}`);
      });
    }
  });

  it('falha com mensagem clara quando uma tabela perde o FORCE', async () => {
    await comCliente(banco.owner, (c) => c.query('alter table app.lancamento no force row level security'));
    saida.length = 0;
    expect(await main({ ...AMB, DATABASE_URL_OWNER: banco.owner })).toBe(1);
    expect(saida.join('\n')).toContain('Tabela app.lancamento sem RLS forçada (FORCE).');
    await comCliente(banco.owner, (c) => c.query('alter table app.lancamento force row level security'));
  });

  it('falha quando há migration pendente (pasta com arquivo a mais)', async () => {
    const pasta = mkdtempSync(join(tmpdir(), 'migr-'));
    try {
      const reais = (
        await comCliente(banco.owner, (c) => c.query<{ name: string }>('select name from public.pgmigrations'))
      ).rows;
      for (const r of reais) writeFileSync(join(pasta, `${r.name}.sql`), '');
      writeFileSync(join(pasta, '99999999999999_nova.sql'), '');
      saida.length = 0;
      expect(await main({ ...AMB, DATABASE_URL_OWNER: banco.owner }, pasta)).toBe(1);
      expect(saida.join('\n')).toContain('Migrations pendentes (1): 99999999999999_nova.');
    } finally {
      rmSync(pasta, { recursive: true, force: true });
    }
  });

  it('a saída nunca contém a URL, o usuário nem a senha (nem em erro de conexão)', async () => {
    const senha = 'senha-secreta-xyz';
    const urlRuim = `postgres://dono_x:${senha}@127.0.0.1:1/banco_x`;
    saida.length = 0;
    expect(await main({ DATABASE_URL_OWNER: urlRuim })).toBe(1);
    expect(await main({ ...AMB, DATABASE_URL_OWNER: banco.owner })).toBe(0);
    const tudo = saida.join('\n');
    const u = new URL(banco.owner);
    for (const proibido of [senha, 'dono_x', urlRuim, banco.owner, u.password, u.host]) {
      expect(tudo).not.toContain(proibido);
    }
  });
});
