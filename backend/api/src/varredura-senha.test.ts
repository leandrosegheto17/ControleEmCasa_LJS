import { describe, expect, it } from 'vitest';

/**
 * G-17 e G-25: SQL de senha nunca é montado por template string comum; `crypt()` só aparece dentro do
 * template `sql` do Kysely (parametrizado). `sql.raw` é proibido. Varre os fontes de produção da API.
 */
const fontes = import.meta.glob('./**/*.ts', { query: '?raw', import: 'default', eager: true }) as Record<
  string,
  string
>;
const producao = Object.entries(fontes).filter(
  ([caminho]) => !caminho.endsWith('.test.ts') && !caminho.includes('testes-suporte'),
);

function semComentarios(codigo: string): string {
  return codigo.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');
}

describe('varredura de SQL de senha no código da API', () => {
  it('enxerga o repositório de usuários', () => {
    expect(producao.map(([c]) => c)).toContain('./infraestrutura/db/repositorios/usuarios.ts');
  });

  it('todo crypt() está dentro de um template `sql` e recebe a senha como parâmetro', () => {
    let achados = 0;
    for (const [caminho, codigo] of producao) {
      // Partes alternadas pela crase: as ímpares são o conteúdo dos templates (o código não aninha crases).
      // A tag é o que vem logo antes da crase de abertura: `sql`, com ou sem genérico (`sql<{ ... }>`).
      const partes = semComentarios(codigo).split('`');
      for (let i = 1; i < partes.length; i += 2) {
        const conteudo = partes[i] ?? '';
        if (!/\bcrypt\s*\(/.test(conteudo)) continue;
        achados += 1;
        expect(partes[i - 1], `${caminho}: crypt() fora do template sql`).toMatch(/\bsql(?:<[^()=]*>)?\s*$/);
        expect(conteudo, `${caminho}: senha interpolada sem parâmetro`).toMatch(/crypt\(\$\{/);
      }
    }
    expect(achados).toBeGreaterThanOrEqual(3);
  });

  it('nenhum sql.raw', () => {
    for (const [caminho, codigo] of producao) expect(semComentarios(codigo), caminho).not.toMatch(/sql\s*\.\s*raw/);
  });
});
