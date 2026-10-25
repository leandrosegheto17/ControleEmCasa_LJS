import { describe, expect, it } from 'vitest';

/**
 * G-02 (a) e SDD 5.3: nenhum código da API pode abrir GUC global nem fora da transação, e só o logger usa console.
 * Varre os fontes de produção (exclui testes e utilitários de teste) por padrões proibidos.
 */
const fontes = import.meta.glob('./**/*.ts', { query: '?raw', import: 'default', eager: true }) as Record<
  string,
  string
>;
const producao = Object.entries(fontes).filter(
  ([caminho]) => !caminho.endsWith('.test.ts') && !caminho.includes('testes-suporte'),
);

/** Remove comentários para não acusar a prosa que descreve a regra. */
function semComentarios(codigo: string): string {
  return codigo.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');
}

describe('varredura de GUC no código da API', () => {
  it('enxerga os fontes de produção (a varredura não é vazia)', () => {
    const nomes = producao.map(([c]) => c);
    expect(nomes).toContain('./infraestrutura/db/transacao.ts');
    expect(nomes.length).toBeGreaterThan(5);
  });

  it('nenhum set_config com is_local falso', () => {
    for (const [caminho, codigo] of producao) {
      expect(semComentarios(codigo), caminho).not.toMatch(/set_config\s*\([^)]*,\s*false\s*\)/i);
    }
  });

  it('nenhum SET app.* nem SET SESSION', () => {
    for (const [caminho, codigo] of producao) {
      const limpo = semComentarios(codigo);
      expect(limpo, caminho).not.toMatch(/\bset\s+(session\s+)?app\./i);
      expect(limpo, caminho).not.toMatch(/\bset\s+session\b/i);
    }
  });

  it('todo set_config de app.* termina em is_local verdadeiro', () => {
    let achados = 0;
    for (const [caminho, codigo] of producao) {
      const chamadas = semComentarios(codigo).match(/set_config\s*\(\s*'app\.[a-z_]+'\s*,[^)]*\)/gi) ?? [];
      for (const chamada of chamadas) {
        achados += 1;
        expect(chamada, caminho).toMatch(/,\s*true\s*\)$/);
      }
    }
    expect(achados).toBeGreaterThanOrEqual(3);
  });

  it('console só no logger (G-46)', () => {
    for (const [caminho, codigo] of producao) {
      if (caminho === './log.ts') continue;
      expect(semComentarios(codigo), caminho).not.toMatch(/\bconsole\./);
    }
  });
});
