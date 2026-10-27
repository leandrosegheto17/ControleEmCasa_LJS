import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * Backup diário e a action do dump cifrado (PLANO etapa 16; PRD-TECNICO RNF-09; SDD 3.7, 11.2, D-06; G-09, G-44;
 * TM-GH-03, TM-GH-06; THREAT-MODEL E-12; ADR-015): às 04:00 de Brasília, `backup_ro`, cifrado com a chave pública
 * age, artefato de 30 dias, nada em claro, nenhuma chave privada no GitHub, inerte sem BACKUP_ATIVO.
 */
const RAIZ = join(import.meta.dirname, '../../..');
const ler = (caminho: string) => readFileSync(join(RAIZ, caminho), 'utf8');
const semComentarios = (t: string) => t.replace(/^\s*#.*$/gm, '').replace(/\s#.*$/gm, '');

const backup = ler('.github/workflows/backup.yml');
const backupSem = semComentarios(backup);
const acao = ler('.github/actions/dump-cifrado/action.yml');
const acaoSem = semComentarios(acao);

describe('.github/workflows/backup.yml', () => {
  it('roda todo dia às 07:00 UTC (04:00 em Brasília) e pode ser disparado à mão', () => {
    expect(backupSem).toMatch(/schedule:\s*\n\s*-\s*cron:\s*'0 7 \* \* \*'/);
    expect(backup).toMatch(/04:00 em Brasília/);
    expect(backupSem).toMatch(/workflow_dispatch:/);
    expect(backupSem).not.toMatch(/pull_request|push:/);
  });

  it('só com a variável BACKUP_ATIVO ligada, no environment producao, sem dois backups ao mesmo tempo', () => {
    expect(backupSem).toMatch(/if: \$\{\{ vars\.BACKUP_ATIVO == 'true' \}\}/);
    expect(backupSem).toMatch(/environment: producao\s*\n/);
    expect(backupSem).toMatch(/concurrency:\s*\n\s*group: backup\s*\n\s*cancel-in-progress: false/);
  });

  it('usa a action do dump cifrado com a role backup_ro e o destinatário público age', () => {
    expect(backupSem).toMatch(/uses: \.\/\.github\/actions\/dump-cifrado\s*\n/);
    expect(backupSem).toMatch(/url: \$\{\{ secrets\.DATABASE_URL_BACKUP \}\}/);
    expect(backupSem).toMatch(/destinatario: \$\{\{ vars\.AGE_RECIPIENT \}\}/);
    expect(backupSem).toMatch(/nome-artefato: backup-\$\{\{ steps\.data\.outputs\.dia \}\}-/);
    expect(backupSem).toMatch(/TZ=America\/Sao_Paulo date \+%F/);
  });

  it('a falha alerta: passo em failure() que anota o erro e mantém o job vermelho', () => {
    const i = backupSem.indexOf('if: ${{ failure() }}');
    expect(i).toBeGreaterThan(backupSem.indexOf('dump-cifrado'));
    const passo = backupSem.slice(i);
    expect(passo).toMatch(/::error title=Backup falhou::/);
    expect(passo).toMatch(/GITHUB_STEP_SUMMARY/);
    expect(passo).toMatch(/exit 1/);
    expect(backupSem).not.toMatch(/continue-on-error|\|\|\s*true|set \+e/);
    expect(backupSem).toMatch(/defaults:\s*\n\s*run:\s*\n\s*shell: bash/);
  });

  it('segredos só por referência: só a URL do backup_ro, nunca a do owner nem a do app', () => {
    const nomes = new Set([...backupSem.matchAll(/secrets\.(\w+)/g)].map((m) => m[1]));
    expect([...nomes]).toEqual(['DATABASE_URL_BACKUP']);
    expect(backup).not.toMatch(/postgres(ql)?:\/\//i);
    expect(backup).not.toMatch(/password|senha\s*[:=]/i);
  });

  it('permissões mínimas e ações fixadas por SHA', () => {
    expect(backupSem).toMatch(/^permissions:\s*\n\s*contents: read\s*$/m);
    const usos = [...backupSem.matchAll(/uses:\s*(\S+)/g)].map((m) => m[1]!);
    for (const uso of usos.filter((u) => !u.startsWith('./'))) expect(uso, uso).toMatch(/@[0-9a-f]{40}$/);
  });
});

describe('.github/actions/dump-cifrado/action.yml', () => {
  it('gera o dump pelo script testado (pg_dump em pipe para o age) e instala o age', () => {
    expect(acaoSem).toMatch(/run: pnpm --filter @controle\/scripts dump-cifrado\s*\n/);
    expect(acaoSem).toMatch(/apt-get install -y -qq age/);
    expect(acaoSem).toMatch(/URL_BANCO: \$\{\{ inputs\.url \}\}/);
    expect(acaoSem).toMatch(/AGE_RECIPIENT: \$\{\{ inputs\.destinatario \}\}/);
    // nenhuma chamada direta a pg_dump aqui: o pg_dump só roda dentro do script, em pipe para o age
    const comandos = [...acaoSem.matchAll(/^\s*run:\s*(.+)$/gm)].map((m) => m[1]!);
    expect(comandos).toHaveLength(2);
    for (const c of comandos) expect(c).not.toMatch(/pg_dump|psql/);
  });

  it('o artefato é só o arquivo .age, por 30 dias, e falha se ele não existir', () => {
    const saida = /SAIDA: (\$\{\{ runner\.temp \}\}\/\$\{\{ inputs\.nome-artefato \}\}\.dump\.age)\s*\n/.exec(acaoSem);
    expect(saida).not.toBeNull();
    expect(acaoSem).toContain(`path: ${saida![1]}`);
    expect(acaoSem).toMatch(/retention-days: 30\s*\n/);
    expect(acaoSem).toMatch(/if-no-files-found: error/);
    const caminhos = [...acaoSem.matchAll(/^\s*path:\s*(.+?)\s*$/gm)].map((m) => m[1]!);
    expect(caminhos.length).toBeGreaterThan(0);
    for (const c of caminhos) expect(c).toMatch(/\.age$/);
  });

  it('ações fixadas por SHA', () => {
    const usos = [...acaoSem.matchAll(/uses:\s*(\S+)/g)].map((m) => m[1]!);
    expect(usos).toHaveLength(1);
    for (const uso of usos) expect(uso).toMatch(/^actions\/upload-artifact@[0-9a-f]{40}$/);
  });
});

describe('chave privada do age nunca no GitHub (G-44, TM-GH-03)', () => {
  const arquivosGithub = (pasta: string): string[] =>
    readdirSync(join(RAIZ, pasta), { withFileTypes: true }).flatMap((e) =>
      e.isDirectory() ? arquivosGithub(`${pasta}/${e.name}`) : [`${pasta}/${e.name}`],
    );

  it('nenhum workflow ou action lê identidade age, decifra ou cita AGE-SECRET-KEY', () => {
    const arquivos = arquivosGithub('.github');
    expect(arquivos).toContain('.github/workflows/backup.yml');
    for (const arquivo of arquivos) {
      const t = semComentarios(ler(arquivo));
      expect(t, arquivo).not.toMatch(/AGE-SECRET-KEY/i);
      expect(t, arquivo).not.toMatch(/AGE_(IDENTITY|PRIVATE|SECRET)\w*/);
      expect(t, arquivo).not.toMatch(/\bage\s+(-d|--decrypt)\b/);
      expect(t, arquivo).not.toMatch(/\bage\b[^\n]*\s(-i|--identity)\s/);
    }
  });
});
