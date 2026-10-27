import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { PUBLICACAO } from './operacao/wrangler-deploy-unico';

/**
 * Workflow do deploy (PLANO etapa 16; SDD 11.1, 11.2; G-02, G-09, G-42, G-43, G-44; TM-DB-02, TM-DB-05, TM-DB-07,
 * TM-GH-01 a TM-GH-04; ADR-015): só depois do CI verde num push à main, aprovação explícita, ordem fixa dos passos,
 * segredos só por referência e só no passo que precisa, ações fixadas por SHA e inerte sem DEPLOY_ATIVO.
 */
const RAIZ = join(import.meta.dirname, '../../..');
const texto = readFileSync(join(RAIZ, '.github/workflows/deploy.yml'), 'utf8');
const semComentarios = texto.replace(/^\s*#.*$/gm, '').replace(/\s#.*$/gm, '');
const linhas = semComentarios.split(/\r?\n/);

/** Bloco de um job (do `  nome:` até o próximo job de mesma indentação). */
function job(nome: string): string {
  const inicio = linhas.findIndex((l) => l === `  ${nome}:`);
  expect(inicio, `job ${nome}`).toBeGreaterThan(-1);
  let fim = linhas.length;
  for (let i = inicio + 1; i < linhas.length; i += 1) {
    if (/^ {2}[\w-]+:\s*$/.test(linhas[i]!) || /^\S/.test(linhas[i]!)) {
      fim = i;
      break;
    }
  }
  return linhas.slice(inicio, fim).join('\n');
}

/** Índice (na ordem do arquivo) da primeira linha que casa com o padrão; falha se não houver. */
function posicao(padrao: RegExp, rotulo: string): number {
  const i = linhas.findIndex((l) => padrao.test(l));
  expect(i, rotulo).toBeGreaterThan(-1);
  return i;
}

describe('.github/workflows/deploy.yml', () => {
  it('só dispara quando o workflow ci termina, e só para a main (sem push, PR, agenda ou disparo manual)', () => {
    expect(semComentarios).toMatch(
      /on:\s*\n\s*workflow_run:\s*\n\s*workflows: \[ci\]\s*\n\s*types: \[completed\]\s*\n\s*branches: \[main\]/,
    );
    for (const gatilho of [
      'pull_request',
      'pull_request_target',
      'push:',
      'schedule:',
      'workflow_dispatch',
      'workflow_call',
    ]) {
      expect(semComentarios, gatilho).not.toContain(gatilho);
    }
  });

  it('o job aprovar exige DEPLOY_ATIVO, CI verde, evento push, branch main e o próprio repositório', () => {
    const aprovar = job('aprovar');
    expect(aprovar).toContain("vars.DEPLOY_ATIVO == 'true'");
    expect(aprovar).toContain("github.event.workflow_run.conclusion == 'success'");
    expect(aprovar).toContain("github.event.workflow_run.event == 'push'");
    expect(aprovar).toContain("github.event.workflow_run.head_branch == 'main'");
    expect(aprovar).toContain('github.event.workflow_run.head_repository.full_name == github.repository');
    expect(aprovar).toMatch(/environment: producao-aprovacao/);
    expect(aprovar).not.toMatch(/secrets\./);
  });

  it('o job publicar depende da aprovação, roda no environment producao e no commit exato que o CI testou', () => {
    const publicar = job('publicar');
    expect(publicar).toMatch(/needs: aprovar/);
    expect(publicar).toContain("if: ${{ vars.DEPLOY_ATIVO == 'true' }}");
    expect(publicar).toMatch(/environment:\s*\n\s*name: producao\s*\n/);
    expect(publicar).toMatch(/ref: \$\{\{ github\.event\.workflow_run\.head_sha \}\}/);
    expect(publicar).toMatch(/persist-credentials: false/);
    expect(publicar).toMatch(/SHA: \$\{\{ github\.event\.workflow_run\.head_sha \}\}/);
  });

  it('nunca dois deploys ao mesmo tempo, e o que está rodando não é cancelado', () => {
    expect(semComentarios).toMatch(/concurrency:\s*\n\s*group: deploy-producao\s*\n\s*cancel-in-progress: false/);
  });

  it('ordem fixa: build, cache do Hyperdrive, branch de restauração, dump cifrado, migração, publicação, saúde', () => {
    const ordem = [
      posicao(/run: pnpm --filter @controle\/web build$/, 'build'),
      posicao(/run: pnpm --filter @controle\/scripts cache-hyperdrive$/, 'cache do Hyperdrive'),
      posicao(/run: pnpm --filter @controle\/scripts restauracao-neon$/, 'branch de restauração'),
      posicao(/uses: \.\/\.github\/actions\/dump-cifrado$/, 'dump cifrado'),
      posicao(/run: pnpm --filter @controle\/scripts migrar$/, 'migração'),
      posicao(PUBLICACAO, 'publicação'),
      posicao(/curl -fsS .*\/api\/health"$/, 'saúde'),
    ];
    expect(ordem).toEqual([...ordem].sort((a, b) => a - b));
  });

  it('a publicação injeta URL_PUBLICA, AMBIENTE producao, ASAAS_API_URL de produção e SENTRY_RELEASE = SHA', () => {
    const linha = linhas.find((l) => PUBLICACAO.test(l))!;
    expect(linha).toContain('-c ../../wrangler.jsonc');
    expect(linha).toContain('--var "URL_PUBLICA:${URL_PUBLICA}"');
    expect(linha).toContain('--var AMBIENTE:producao');
    expect(linha).toContain('--var "ASAAS_API_URL:${ASAAS_API_URL}"');
    expect(linha).toContain('--var "SENTRY_RELEASE:${SHA}"');
    expect(semComentarios).toMatch(/URL_PUBLICA: https:\/\/controleemcasa\.ljssoftware\.com\.br\n/);
    expect(semComentarios).toMatch(/ASAAS_API_URL: https:\/\/api\.asaas\.com\/v3\n/);
  });

  it('o dump antes da migração usa a role backup_ro (o owner, com RLS FORCE, sairia sem linhas) e o destinatário público', () => {
    const i = linhas.findIndex((l) => /uses: \.\/\.github\/actions\/dump-cifrado/.test(l));
    const bloco = linhas.slice(i, i + 5).join('\n');
    expect(bloco).toMatch(/url: \$\{\{ secrets\.DATABASE_URL_BACKUP \}\}/);
    expect(bloco).toMatch(/destinatario: \$\{\{ vars\.AGE_RECIPIENT \}\}/);
    expect(bloco).toMatch(/nome-artefato: dump-predeploy-/);
  });

  it('a migração é a única com a URL do owner', () => {
    const comOwner = linhas.filter((l) => l.includes('secrets.DATABASE_URL_OWNER'));
    expect(comOwner).toEqual(['          DATABASE_URL_OWNER: ${{ secrets.DATABASE_URL_OWNER }}']);
    const migrar = posicao(/run: pnpm --filter @controle\/scripts migrar$/, 'migração');
    const owner = posicao(/secrets\.DATABASE_URL_OWNER/, 'owner');
    expect(migrar - owner).toBeGreaterThan(0);
    expect(migrar - owner).toBeLessThanOrEqual(2);
  });

  it('falha em qualquer passo para o deploy: nada de continue-on-error, || true ou set +e', () => {
    expect(semComentarios).not.toMatch(/continue-on-error/);
    expect(semComentarios).not.toMatch(/\|\|\s*true/);
    expect(semComentarios).not.toMatch(/set \+e/);
    expect(semComentarios).toMatch(/defaults:\s*\n\s*run:\s*\n\s*shell: bash/);
  });

  it('depois da migração, a falha desfaz o Worker (se publicado) e aponta a branch e o dump de restauração', () => {
    expect(semComentarios).toMatch(/if: \$\{\{ failure\(\) && steps\.migrar\.outcome == 'success' \}\}/);
    expect(semComentarios).toMatch(/wrangler rollback -c \.\.\/\.\.\/wrangler\.jsonc/);
    expect(semComentarios).toMatch(/restauracao-\$\{RUN\}/);
    expect(semComentarios).toMatch(/dump-predeploy-\$\{RUN\}/);
  });

  it('segredos só por referência, só nos passos (nunca no env do job) e só os quatro necessários', () => {
    const nomes = new Set([...semComentarios.matchAll(/secrets\.(\w+)/g)].map((m) => m[1]));
    expect([...nomes].sort()).toEqual([
      'CLOUDFLARE_API_TOKEN',
      'DATABASE_URL_BACKUP',
      'DATABASE_URL_OWNER',
      'NEON_API_KEY',
    ]);
    for (const l of linhas.filter((x) => x.includes('secrets.'))) {
      expect(l, l).toMatch(/^ {10}\S/);
    }
    expect(texto).not.toMatch(/postgres(ql)?:\/\//i);
    expect(texto).not.toMatch(/AGE-SECRET-KEY/i);
    expect(texto).not.toMatch(/\bage1[02-9ac-hj-np-z]{20,}/);
    expect(texto).not.toMatch(/password|senha\s*[:=]/i);
    expect(texto).not.toMatch(/napi_|\$aact_/);
  });

  it('permissões mínimas e ações de terceiros fixadas por SHA', () => {
    expect(semComentarios).toMatch(/^permissions:\s*\n\s*contents: read\s*$/m);
    const usos = [...semComentarios.matchAll(/uses:\s*(\S+)/g)].map((m) => m[1]!);
    expect(usos.length).toBeGreaterThan(0);
    for (const uso of usos.filter((u) => !u.startsWith('./'))) expect(uso, uso).toMatch(/@[0-9a-f]{40}$/);
  });
});
