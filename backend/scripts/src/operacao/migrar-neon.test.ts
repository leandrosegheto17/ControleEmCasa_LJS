import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import type { DadosDoBanco } from './conferir-banco';
import {
  ARGUMENTOS_MIGRACAO,
  argumentosDaMigracao,
  avaliarDestino,
  migrarNeon,
  type Dependencias,
} from './migrar-neon';

/** G-43; TM-DB-05: o comando só migra o Neon, com o destino confirmado e sem cair no `.env` local. */
const SENHA = 'segredo-super-secreto';
const URL_OK = `postgresql://controle_owner:${SENHA}@ep-abc-123.sa-east-1.aws.neon.tech/controle?sslmode=require`;
const conforme: DadosDoBanco = {
  roles: [],
  tabelasComPolitica: [],
  migracoesAplicadas: ['a'],
  migracoesDaPasta: ['a'],
};

function montar(extra: Partial<Dependencias> = {}) {
  const saidas: string[] = [];
  const erros: string[] = [];
  const migrar = vi.fn(async () => 0);
  const perguntar = vi.fn(async () => 'controle');
  const dep: Dependencias = {
    ambiente: { NEON_URL_OWNER: URL_OK },
    argv: [],
    perguntar,
    migrar,
    conferir: async () => conforme,
    saida: (t) => saidas.push(t),
    erro: (t) => erros.push(t),
    ...extra,
  };
  return { dep, saidas, erros, migrar, perguntar };
}

describe('avaliarDestino', () => {
  it('aceita host direto do Neon com sslmode=require', () => {
    expect(avaliarDestino(URL_OK)).toEqual({
      ok: true,
      usuario: 'controle_owner',
      host: 'ep-abc-123.sa-east-1.aws.neon.tech',
      banco: 'controle',
    });
  });

  it.each([
    ['localhost', 'postgresql://u:p@localhost:5432/controle?sslmode=require'],
    ['127.0.0.1', 'postgresql://u:p@127.0.0.1:5432/controle?sslmode=require'],
    ['::1', 'postgresql://u:p@[::1]:5432/controle?sslmode=require'],
    ['porta 55432', 'postgresql://u:p@ep-x.neon.tech:55432/controle?sslmode=require'],
    ['host fora do Neon', 'postgresql://u:p@db.exemplo.com/controle?sslmode=require'],
    ['pooler', 'postgresql://u:p@ep-abc-pooler.sa-east-1.aws.neon.tech/controle?sslmode=require'],
    ['sem sslmode', 'postgresql://u:p@ep-abc.neon.tech/controle'],
    ['sslmode=disable', 'postgresql://u:p@ep-abc.neon.tech/controle?sslmode=disable'],
  ])('recusa %s', (_n, url) => {
    expect(avaliarDestino(url).ok).toBe(false);
  });

  it('aceita sslmode=verify-full', () => {
    expect(avaliarDestino(URL_OK.replace('require', 'verify-full')).ok).toBe(true);
  });
});

describe('migrarNeon', () => {
  it('sem NEON_URL_OWNER falha com mensagem clara e não migra', async () => {
    const { dep, erros, migrar } = montar({ ambiente: {} });
    expect(await migrarNeon(dep)).toBe(1);
    expect(erros.join('\n')).toContain('NEON_URL_OWNER ausente');
    expect(migrar).not.toHaveBeenCalled();
  });

  it('não usa o .env: variável só num .env de teste não vale, e o código não carrega .env', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'migrar-neon-'));
    const anterior = process.cwd();
    try {
      writeFileSync(join(dir, '.env'), `NEON_URL_OWNER=${URL_OK}\n`);
      process.chdir(dir);
      const { dep, migrar } = montar({ ambiente: {} });
      expect(await migrarNeon(dep)).toBe(1);
      expect(migrar).not.toHaveBeenCalled();
    } finally {
      process.chdir(anterior);
      rmSync(dir, { recursive: true, force: true });
    }
    const fonte = readFileSync(join(import.meta.dirname, 'migrar-neon.ts'), 'utf8');
    const pacote = readFileSync(join(import.meta.dirname, '../../package.json'), 'utf8');
    expect(fonte).not.toMatch(/--env-file|dotenv|loadEnvFile/);
    expect(pacote).toMatch(/"migrar-neon": "tsx src\/operacao\/migrar-neon\.ts"/);
  });

  it('a migração lê a URL de NEON_URL_OWNER (padrão do Neon, ADR-017), nunca de DATABASE_URL_OWNER nem de argv', () => {
    const i = ARGUMENTOS_MIGRACAO.indexOf('--database-url-var');
    expect(ARGUMENTOS_MIGRACAO[i + 1]).toBe('NEON_URL_OWNER');
    expect(ARGUMENTOS_MIGRACAO.join(' ')).not.toMatch(/DATABASE_URL|postgres(ql)?:\/\//);
  });

  it('com só DATABASE_URL_OWNER (nome do banco local) no ambiente, recusa e não migra', async () => {
    const { dep, migrar, erros } = montar({ ambiente: { DATABASE_URL_OWNER: URL_OK } });
    expect(await migrarNeon(dep)).toBe(1);
    expect(migrar).not.toHaveBeenCalled();
    expect(erros.join('\n')).toContain('NEON_URL_OWNER ausente');
  });

  // Branch dev do Neon (decisão do usuário em 2026-10-28, ADR-017): NEON_URL_DEV, com a mesma validação única.
  it('--dev migra pela NEON_URL_DEV e passa esse nome ao node-pg-migrate', async () => {
    const { dep, migrar } = montar({ argv: ['--dev', '--sim'], ambiente: { NEON_URL_DEV: URL_OK } });
    expect(await migrarNeon(dep)).toBe(0);
    expect(migrar).toHaveBeenCalledWith({ NEON_URL_DEV: URL_OK }, 'NEON_URL_DEV');
    const args = argumentosDaMigracao('NEON_URL_DEV');
    expect(args[args.indexOf('--database-url-var') + 1]).toBe('NEON_URL_DEV');
  });

  it('--dev sem NEON_URL_DEV falha, mesmo com NEON_URL_OWNER (nunca cai na main)', async () => {
    const { dep, migrar, erros } = montar({ argv: ['--dev', '--sim'], ambiente: { NEON_URL_OWNER: URL_OK } });
    expect(await migrarNeon(dep)).toBe(1);
    expect(migrar).not.toHaveBeenCalled();
    expect(erros.join('\n')).toContain('NEON_URL_DEV ausente');
  });

  it('--dev recusa NEON_URL_DEV local ou com -pooler (validação única)', async () => {
    for (const url of [
      'postgresql://u:p@localhost:55432/controle?sslmode=require',
      'postgresql://u:p@ep-a-pooler.sa-east-1.aws.neon.tech/controle?sslmode=require',
    ]) {
      const { dep, migrar, erros } = montar({ argv: ['--dev', '--sim'], ambiente: { NEON_URL_DEV: url } });
      expect(await migrarNeon(dep)).toBe(1);
      expect(migrar).not.toHaveBeenCalled();
      expect(erros.join('\n')).toContain('NEON_URL_DEV');
    }
  });

  it('sem --dev usa NEON_URL_OWNER e ignora a NEON_URL_DEV', async () => {
    const { dep, migrar } = montar({ argv: ['--sim'], ambiente: { NEON_URL_DEV: URL_OK } });
    expect(await migrarNeon(dep)).toBe(1);
    expect(migrar).not.toHaveBeenCalled();
  });

  it('destino recusado não pergunta nem migra', async () => {
    const { dep, migrar, perguntar, erros } = montar({
      ambiente: { NEON_URL_OWNER: 'postgresql://u:p@localhost:55432/controle' },
    });
    expect(await migrarNeon(dep)).toBe(1);
    expect(migrar).not.toHaveBeenCalled();
    expect(perguntar).not.toHaveBeenCalled();
    expect(erros.join('\n')).not.toContain('localhost:55432');
  });

  it('mostra usuário, host e banco, nunca a senha nem a URL inteira', async () => {
    const { dep, saidas, erros } = montar();
    await migrarNeon(dep);
    const tudo = [...saidas, ...erros].join('\n');
    expect(tudo).toContain('controle_owner');
    expect(tudo).toContain('ep-abc-123.sa-east-1.aws.neon.tech');
    expect(tudo).toContain('controle');
    expect(tudo).not.toContain(SENHA);
    expect(tudo).not.toContain(URL_OK);
  });

  it('confirmação igual ao banco migra e confere', async () => {
    const { dep, migrar, saidas } = montar();
    expect(await migrarNeon(dep)).toBe(0);
    expect(migrar).toHaveBeenCalledTimes(1);
    expect(saidas.join('\n')).toContain('Banco conforme');
  });

  it('confirmação diferente cancela sem migrar', async () => {
    const { dep, migrar } = montar({ perguntar: async () => 'outro' });
    expect(await migrarNeon(dep)).toBe(1);
    expect(migrar).not.toHaveBeenCalled();
  });

  it('--sim migra sem perguntar', async () => {
    const { dep, migrar, perguntar } = montar({ argv: ['--sim'] });
    expect(await migrarNeon(dep)).toBe(0);
    expect(migrar).toHaveBeenCalledTimes(1);
    expect(perguntar).not.toHaveBeenCalled();
  });

  it('--sim sem a variável falha', async () => {
    const { dep, migrar } = montar({ argv: ['--sim'], ambiente: {} });
    expect(await migrarNeon(dep)).toBe(1);
    expect(migrar).not.toHaveBeenCalled();
  });

  it('migração com falha não confere e sai com 1; erro do driver não vaza', async () => {
    const conferir = vi.fn(async () => conforme);
    const { dep, erros } = montar({ migrar: async () => 3, conferir });
    expect(await migrarNeon(dep)).toBe(1);
    expect(conferir).not.toHaveBeenCalled();
    expect(erros.join('\n')).not.toContain(SENHA);
  });

  it('erro na conferência não vaza o texto do driver', async () => {
    const { dep, erros } = montar({
      conferir: async () => {
        throw new Error(`falha em ${URL_OK}`);
      },
    });
    expect(await migrarNeon(dep)).toBe(1);
    expect(erros.join('\n')).not.toContain(SENHA);
  });
});
