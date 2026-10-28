import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { main, validarUrlNeon } from './url-neon';

/**
 * Padrão do Neon (ADR-017, decisão 4): uma só validação de URL do Neon, usada em todo caminho que toca o Neon. Recusa
 * host `-pooler`, destino local, host fora de `.neon.tech` e URL sem TLS. Nenhum teste conecta a banco algum.
 */
const SENHA = 'segredo-super-secreto';
const URL_OK = `postgresql://controle_owner:${SENHA}@ep-abc-123.sa-east-1.aws.neon.tech/controle?sslmode=require`;

describe('validarUrlNeon', () => {
  it('aceita host direto do Neon com sslmode=require e devolve usuário, host e banco', () => {
    expect(validarUrlNeon(URL_OK, 'NEON_URL_OWNER')).toEqual({
      ok: true,
      usuario: 'controle_owner',
      host: 'ep-abc-123.sa-east-1.aws.neon.tech',
      banco: 'controle',
    });
  });

  it('aceita sslmode=verify-full, postgres: e parâmetros a mais (channel_binding)', () => {
    expect(validarUrlNeon(URL_OK.replace('require', 'verify-full'), 'X').ok).toBe(true);
    expect(validarUrlNeon(URL_OK.replace('postgresql:', 'postgres:'), 'X').ok).toBe(true);
    expect(validarUrlNeon(`${URL_OK}&channel_binding=require`, 'X').ok).toBe(true);
  });

  it.each([
    ['localhost', 'postgresql://u:p@localhost:5432/controle?sslmode=require', /local/],
    ['127.0.0.1', 'postgresql://u:p@127.0.0.1:5432/controle?sslmode=require', /local/],
    ['::1', 'postgresql://u:p@[::1]:5432/controle?sslmode=require', /local/],
    ['LOCALHOST maiúsculo', 'postgresql://u:p@LOCALHOST/controle?sslmode=require', /local/],
    ['porta 55432 do Docker', 'postgresql://u:p@ep-x.neon.tech:55432/controle?sslmode=require', /local/],
    ['host fora do Neon', 'postgresql://u:p@db.exemplo.com/controle?sslmode=require', /\.neon\.tech/],
    [
      'neon.tech no meio do host',
      'postgresql://u:p@ep-x.neon.tech.exemplo.com/controle?sslmode=require',
      /\.neon\.tech/,
    ],
    ['pooler', 'postgresql://u:p@ep-abc-pooler.sa-east-1.aws.neon.tech/controle?sslmode=require', /-pooler/],
    ['sem sslmode', 'postgresql://u:p@ep-abc.neon.tech/controle', /sslmode/],
    ['sslmode=disable', 'postgresql://u:p@ep-abc.neon.tech/controle?sslmode=disable', /sslmode/],
    ['sslmode=prefer', 'postgresql://u:p@ep-abc.neon.tech/controle?sslmode=prefer', /sslmode/],
    ['sem banco', 'postgresql://u:p@ep-abc.neon.tech/?sslmode=require', /banco/],
    ['outro protocolo', 'mysql://u:p@ep-abc.neon.tech/controle?sslmode=require', /postgres/],
    ['texto que não é URL', 'nao e url', /URL válida/],
    // Database padronizado do projeto no Neon: `controle` (decisão do usuário em 2026-10-28, ADR-017).
    ['banco neondb (padrão do console)', 'postgresql://u:p@ep-abc.neon.tech/neondb?sslmode=require', /controle/],
    ['banco com outro nome', 'postgresql://u:p@ep-abc.neon.tech/controle_restaurado?sslmode=require', /controle/],
    ['banco com caixa diferente', 'postgresql://u:p@ep-abc.neon.tech/Controle?sslmode=require', /controle/],
  ])('recusa %s', (_n, url, motivo) => {
    const d = validarUrlNeon(url, 'NEON_URL_OWNER');
    expect(d.ok).toBe(false);
    if (!d.ok) expect(d.motivo).toMatch(motivo);
  });

  it('a mensagem cita a variável e nunca a senha nem a URL', () => {
    const ruim = `postgresql://u:${SENHA}@ep-abc-pooler.neon.tech/controle?sslmode=require`;
    const d = validarUrlNeon(ruim, 'NEON_URL_BACKUP');
    expect(d.ok).toBe(false);
    if (!d.ok) {
      expect(d.motivo).toContain('NEON_URL_BACKUP');
      expect(d.motivo).not.toContain(SENHA);
      expect(d.motivo).not.toContain(ruim);
    }
  });
});

describe('conferir-url-neon (linha de comando da restauração)', () => {
  function rodar(argv: string[], ambiente: NodeJS.ProcessEnv) {
    const saidas: string[] = [];
    const erros: string[] = [];
    const codigo = main(
      argv,
      ambiente,
      (t) => saidas.push(t),
      (t) => erros.push(t),
    );
    return { codigo, tudo: [...saidas, ...erros].join('\n'), erros };
  }

  it('aceita a variável válida e mostra usuário, host e banco, nunca a senha', () => {
    const r = rodar(['NEON_URL_RESTAURACAO'], { NEON_URL_RESTAURACAO: URL_OK });
    expect(r.codigo).toBe(0);
    expect(r.tudo).toContain('ep-abc-123.sa-east-1.aws.neon.tech');
    expect(r.tudo).not.toContain(SENHA);
  });

  it('recusa destino inválido, variável ausente, nome fora de NEON_URL_* e URL passada em argv', () => {
    expect(rodar(['NEON_URL_X'], { NEON_URL_X: 'postgresql://u:p@localhost/controle?sslmode=require' }).codigo).toBe(1);
    expect(rodar(['NEON_URL_X'], {}).codigo).toBe(1);
    expect(rodar([], {}).codigo).toBe(1);
    expect(rodar(['DATABASE_URL_OWNER'], { DATABASE_URL_OWNER: URL_OK }).codigo).toBe(1);
    const comUrl = rodar([URL_OK], {});
    expect(comUrl.codigo).toBe(1);
    expect(comUrl.tudo).not.toContain(SENHA);
  });

  it('está no package.json como conferir-url-neon', () => {
    const pacote = readFileSync(join(import.meta.dirname, '../../package.json'), 'utf8');
    expect(pacote).toMatch(/"conferir-url-neon": "tsx src\/operacao\/url-neon\.ts"/);
  });
});

describe('todo caminho que toca o Neon usa a validação única', () => {
  it.each(['migrar-neon.ts', 'dump-cifrado.ts', 'conferir-banco.ts', '../purgar.ts'])(
    '%s importa validarUrlNeon',
    (arq) => {
      const fonte = readFileSync(join(import.meta.dirname, arq), 'utf8');
      expect(fonte).toMatch(/import \{[^}]*\bvalidarUrlNeon\b[^}]*\} from '\.\/(operacao\/)?url-neon'/);
    },
  );
});
