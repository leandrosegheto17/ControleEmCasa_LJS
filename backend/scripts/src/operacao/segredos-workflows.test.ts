import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * Consistência da lista de segredos (ADR-015; G-32): o que deploy.yml, backup.yml e purga.yml leem de `secrets.*` e
 * `vars.*` deve ser exatamente a lista do environment `producao` documentada no runbook.
 */
const RAIZ = join(import.meta.dirname, '../../../..');

type Item = `secret:${string}` | `variavel:${string}`;

function semComentarios(yaml: string): string {
  return yaml.replace(/^\s*#.*$/gm, '').replace(/\s#.*$/gm, '');
}

/** Todo `secrets.X` e `vars.X` lido pelos workflows (ignora GITHUB_TOKEN e o contexto `github.*`). */
function lidosPelosWorkflows(textos: string[]): Set<Item> {
  const lidos = new Set<Item>();
  for (const texto of textos) {
    for (const m of semComentarios(texto).matchAll(/\b(secrets|vars)\.([A-Za-z_][A-Za-z0-9_]*)/g)) {
      const nome = m[2]!;
      if (m[1] === 'secrets' && nome === 'GITHUB_TOKEN') continue;
      lidos.add(m[1] === 'secrets' ? `secret:${nome}` : `variavel:${nome}`);
    }
  }
  return lidos;
}

/** Lista documentada no runbook, entre os marcadores `segredos-workflows`. */
function documentadosNoRunbook(runbook: string): Set<Item> {
  const bloco = /<!-- segredos-workflows:inicio -->([\s\S]*?)<!-- segredos-workflows:fim -->/.exec(runbook);
  if (!bloco) throw new Error('runbook sem os marcadores segredos-workflows');
  const doc = new Set<Item>();
  for (const m of bloco[1]!.matchAll(/^\|\s*(secret|variável)\s*\|\s*`([A-Za-z_][A-Za-z0-9_]*)`\s*\|/gm)) {
    doc.add(m[1] === 'secret' ? `secret:${m[2]!}` : `variavel:${m[2]!}`);
  }
  return doc;
}

function divergencias(lidos: Set<Item>, doc: Set<Item>): { foraDaLista: Item[]; semLeitor: Item[] } {
  return {
    foraDaLista: [...lidos].filter((i) => !doc.has(i)).sort(),
    semLeitor: [...doc].filter((i) => !lidos.has(i)).sort(),
  };
}

const workflows = ['deploy.yml', 'backup.yml', 'purga.yml'].map((n) =>
  readFileSync(join(RAIZ, '.github/workflows', n), 'utf8'),
);
const runbook = readFileSync(join(RAIZ, 'docs/runbook.md'), 'utf8');

describe('lista de segredos e variáveis do environment producao', () => {
  it('os workflows reais leem exatamente o que o runbook documenta', () => {
    const lidos = lidosPelosWorkflows(workflows);
    expect(lidos.size).toBeGreaterThan(0);
    expect(divergencias(lidos, documentadosNoRunbook(runbook))).toEqual({ foraDaLista: [], semLeitor: [] });
  });

  it('(a) falha quando um workflow lê um secret ou variável fora da lista (provado em cópia)', () => {
    const copia = workflows.concat('env:\n  X: ${{ secrets.NOVO_SEGREDO }} ${{ vars.NOVA_VAR }}\n');
    const d = divergencias(lidosPelosWorkflows(copia), documentadosNoRunbook(runbook));
    expect(d.foraDaLista).toEqual(['secret:NOVO_SEGREDO', 'variavel:NOVA_VAR']);
    expect(d.semLeitor).toEqual([]);
  });

  it('(b) falha quando o runbook cita um que nenhum workflow lê (provado em cópia)', () => {
    const copia = runbook.replace(
      '<!-- segredos-workflows:fim -->',
      '| secret   | `SEGREDO_FANTASMA` |\n<!-- segredos-workflows:fim -->',
    );
    const d = divergencias(lidosPelosWorkflows(workflows), documentadosNoRunbook(copia));
    expect(d.semLeitor).toEqual(['secret:SEGREDO_FANTASMA']);
    expect(d.foraDaLista).toEqual([]);
  });

  it('ignora GITHUB_TOKEN, o contexto github.* e comentários', () => {
    const lidos = lidosPelosWorkflows([
      'a: ${{ secrets.GITHUB_TOKEN }} ${{ github.sha }}\n# ${{ secrets.COMENTADO }}\nb: ${{ vars.X_1 }}',
    ]);
    expect([...lidos]).toEqual(['variavel:X_1']);
  });
});
