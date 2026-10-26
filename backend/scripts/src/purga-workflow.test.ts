import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * Workflow da purga (PLANO etapa 14; SDD D-05; G-32, G-34, G-49; TM-DB-05; ADR-013): agendado todo dia, roda o
 * `purgar.ts` com a URL do owner vinda só do environment `producao`, nunca com segredo escrito no arquivo.
 */
const RAIZ = join(import.meta.dirname, '../../..');
const texto = readFileSync(join(RAIZ, '.github/workflows/purga.yml'), 'utf8');
const semComentarios = texto.replace(/^\s*#.*$/gm, '').replace(/\s#.*$/gm, '');

describe('.github/workflows/purga.yml', () => {
  it('é agendado todo dia e pode ser disparado à mão', () => {
    expect(semComentarios).toMatch(/schedule:\s*\n\s*-\s*cron:\s*'0 8 \* \* \*'/);
    expect(semComentarios).toMatch(/workflow_dispatch:/);
  });

  it('roda o purgar.ts no environment producao, só com a variável PURGA_ATIVA ligada', () => {
    expect(semComentarios).toMatch(/run: pnpm --filter @controle\/scripts purgar/);
    expect(semComentarios).toMatch(/environment: producao/);
    expect(semComentarios).toMatch(/if: \$\{\{ vars\.PURGA_ATIVA == 'true' \}\}/);
    expect(semComentarios).toMatch(/cancel-in-progress: false/);
  });

  it('segredos só por referência; nenhuma URL de banco, chave do Asaas ou senha no arquivo', () => {
    expect(semComentarios).toMatch(/DATABASE_URL_OWNER: \$\{\{ secrets\.DATABASE_URL_OWNER \}\}/);
    expect(semComentarios).toMatch(/ASAAS_API_KEY: \$\{\{ secrets\.ASAAS_API_KEY \}\}/);
    expect(texto).not.toMatch(/postgres(ql)?:\/\//i);
    expect(texto).not.toMatch(/\$aact_/);
    expect(texto).not.toMatch(/password|senha\s*[:=]/i);
  });

  it('permissões mínimas e ações fixadas por SHA', () => {
    expect(semComentarios).toMatch(/permissions:\s*\n\s*contents: read/);
    const usos = [...semComentarios.matchAll(/uses:\s*(\S+)/g)].map((m) => m[1]!);
    expect(usos.length).toBeGreaterThan(0);
    for (const uso of usos) expect(uso, uso).toMatch(/@[0-9a-f]{40}$/);
  });
});
