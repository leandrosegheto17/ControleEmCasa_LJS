import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { PUBLICACAO } from './operacao/wrangler-deploy-unico';

/**
 * Workflow do deploy (PLANO etapa 16; SDD 11.1, 11.2; G-02, G-09, G-42, G-43, G-44; TM-DB-02, TM-DB-05, TM-DB-07,
 * TM-GH-01 a TM-GH-04; ADR-015 e emenda de 2026-10-27): disparo manual só da main e só com o CI verde no commit
 * disparado, ordem fixa dos passos, segredos só por referência e só no passo que precisa, ações fixadas por SHA e inerte
 * sem DEPLOY_ATIVO.
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
  it('só dispara à mão (workflow_dispatch, sem inputs): sem gatilho automático, PR, agenda ou chamada', () => {
    expect(semComentarios).toMatch(/^on:\s*\n {2}workflow_dispatch:\s*\npermissions:/m);
    expect(semComentarios).not.toMatch(/inputs:/);
    for (const gatilho of [
      'workflow_run:',
      'pull_request',
      'pull_request_target',
      'push:',
      'schedule:',
      'workflow_call',
      'repository_dispatch',
    ]) {
      expect(semComentarios, gatilho).not.toContain(gatilho);
    }
  });

  it('o job conferir exige DEPLOY_ATIVO e a main, sem segredo nem environment, só com actions: read', () => {
    const conferir = job('conferir');
    expect(conferir).toContain("if: ${{ vars.DEPLOY_ATIVO == 'true' && github.ref == 'refs/heads/main' }}");
    expect(conferir).not.toMatch(/secrets\./);
    expect(conferir).not.toMatch(/environment:/);
    expect(conferir).not.toMatch(/needs:/);
    expect(conferir).toMatch(/permissions:\s*\n\s*actions: read\s*\n\s*steps:/);
  });

  it('o job conferir só segue com o run do ci concluído com sucesso no SHA disparado (push na main), e falha claro', () => {
    const conferir = job('conferir');
    expect(conferir).toMatch(/GH_TOKEN: \$\{\{ github\.token \}\}/);
    expect(conferir).toMatch(/SHA: \$\{\{ github\.sha \}\}/);
    const consulta = conferir.split('\n').find((l) => l.includes('gh api'));
    expect(consulta, 'consulta ao gh api').toBeDefined();
    expect(consulta).toContain('/actions/workflows/ci.yml/runs?');
    expect(consulta).toContain('head_sha=${SHA}');
    expect(consulta).toContain('branch=main');
    expect(consulta).toContain('event=push');
    // Sem run do ci para o SHA: erro próprio.
    expect(conferir).toMatch(/if \[ -z "\$\{?run_ci\}?" \]; then/);
    // Precisa estar concluído E com sucesso (em andamento, vermelho ou cancelado falham).
    expect(conferir).toMatch(/"\$\{?estado\}?" != "completed"/);
    expect(conferir).toMatch(/"\$\{?conclusao\}?" != "success"/);
    expect(conferir.match(/::error title=/g)?.length).toBeGreaterThanOrEqual(2);
    expect(conferir.match(/exit 1/g)?.length).toBeGreaterThanOrEqual(2);
    // Nunca interpola contexto do evento dentro do run (G-40).
    expect(conferir).not.toMatch(/github\.event\./);
  });

  it('o job publicar depende do conferir, roda no environment producao e no commit disparado (ponta da main)', () => {
    const publicar = job('publicar');
    expect(publicar).toMatch(/needs: conferir/);
    expect(publicar).toContain("if: ${{ vars.DEPLOY_ATIVO == 'true' }}");
    expect(publicar).toMatch(/environment:\s*\n\s*name: producao\s*\n/);
    expect(publicar).toMatch(/ref: \$\{\{ github\.sha \}\}/);
    expect(publicar).toMatch(/persist-credentials: false/);
    expect(publicar).toMatch(/SHA: \$\{\{ github\.sha \}\}/);
    expect(semComentarios).not.toMatch(/github\.event\.workflow_run/);
  });

  it('o deploy tem só os jobs conferir e publicar (o de aprovação e o environment producao-aprovacao saíram)', () => {
    const jobs = linhas
      .slice(linhas.indexOf('jobs:') + 1)
      .filter((l) => /^ {2}[\w-]+:\s*$/.test(l))
      .map((l) => l.trim().slice(0, -1));
    expect(jobs).toEqual(['conferir', 'publicar']);
    expect(texto).not.toContain('producao-aprovacao');
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

describe('.github/workflows/deploy.yml: fumaça ampliada (PLANO etapa 17; RNF-06; ADR-015)', () => {
  const fumaca = () => {
    const i = linhas.findIndex((l) => /name: 7\./.test(l));
    expect(i, 'passo 7').toBeGreaterThan(-1);
    const fim = linhas.findIndex((l, k) => k > i && /^ {6}- name:/.test(l));
    return linhas.slice(i, fim === -1 ? linhas.length : fim).join('\n');
  };

  it('confere /api/health, a landing (/) e o app (/app/), cada um com falha em qualquer status que não seja 2xx', () => {
    const passo = fumaca();
    for (const rota of ['/api/health', '/', '/app/']) {
      const alvo = '"${URL_PUBLICA}' + rota + '"';
      expect(
        passo.split(/\r?\n/).some((l) => l.includes('curl -fsS ') && l.includes(alvo)),
        rota,
      ).toBe(true);
    }
  });

  it('confere que a API traz CSP, HSTS e Cache-Control: no-store, e falha com ::error se faltar algum', () => {
    const passo = fumaca();
    expect(passo).toMatch(/curl [^\n]*-D -[^\n]*"\$\{URL_PUBLICA\}\/api\/health"/);
    for (const cabecalho of ['content-security-policy', 'strict-transport-security', 'cache-control:.*no-store']) {
      expect(passo, cabecalho).toContain(cabecalho);
    }
    expect(passo).toMatch(/::error title=/);
    expect(passo).toMatch(/exit 1/);
  });

  it('continua depois da publicação e antes do bloco de rollback (que dispara com qualquer falha dele)', () => {
    const publicacao = posicao(PUBLICACAO, 'publicação');
    const passo7 = posicao(/name: 7\./, 'passo 7');
    const rollback = posicao(/name: Desfazer o Worker/, 'rollback');
    expect(publicacao).toBeLessThan(passo7);
    expect(passo7).toBeLessThan(rollback);
    expect(fumaca()).not.toMatch(/if:|continue-on-error/);
    expect(linhas[rollback + 1]).toContain("failure() && steps.migrar.outcome == 'success'");
  });
});
