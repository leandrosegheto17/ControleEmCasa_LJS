import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  arquivosDoRepositorio,
  DEPLOY_YML,
  publicacoesEmCodigo,
  publicacoesEmDocumento,
  varrer,
} from './wrangler-deploy-unico';

/**
 * G-42: uma única publicação do Worker, só no `.github/workflows/deploy.yml` (SDD 11.1; TM-GH-04; ADR-015). A regra
 * completa está no cabeçalho de `wrangler-deploy-unico.ts`. Os exemplos são montados em partes para que este arquivo
 * (que também é varrido) não contenha um comando de publicação.
 */

const W = ['wran', 'gler'].join('');
const CMD = `${W} deploy`;
const ACAO = ['cloudflare', 'wrangler-action'].join('/');
const RAIZ = join(import.meta.dirname, '../../../..');

describe('o repositório', () => {
  const { proibidas, noDeploy } = varrer(RAIZ);

  it('não publica com o wrangler fora do deploy.yml (nem em script, workflow, package.json ou bloco de documentação)', () => {
    expect(proibidas.map((a) => `${a.arquivo}:${a.linha}: ${a.texto}`)).toEqual([]);
  });

  it('o deploy.yml tem exatamente uma publicação', () => {
    expect(noDeploy.map((a) => `${a.arquivo}:${a.linha}`)).toHaveLength(1);
    expect(noDeploy[0]!.arquivo).toBe(DEPLOY_YML);
  });
});

describe('detecção em arquivos executáveis', () => {
  it.each([
    `pnpm exec ${CMD}`,
    `npx ${W}@4 deploy --env producao`,
    `${W} -c wrangler.jsonc deploy`,
    `${W} --config "a b.jsonc" deploy`,
    `${W} versions deploy`,
    `${W} pages deploy dist`,
    `${W} triggers deploy`,
    `${W} publish`,
    `${W}.cmd deploy`,
  ])('acha %j', (linha) => {
    expect(publicacoesEmCodigo('scripts/x.sh', linha)).toHaveLength(1);
  });

  it('junta linhas quebradas com barra invertida', () => {
    expect(publicacoesEmCodigo('x.sh', `${W} \\\n  deploy`)).toHaveLength(1);
  });

  it('acha em package.json, em código TS (até em comentário) e a action da Cloudflare em workflow', () => {
    expect(publicacoesEmCodigo('package.json', `{ "scripts": { "pub": "${CMD}" } }`)).toHaveLength(1);
    expect(publicacoesEmCodigo('src/a.ts', `// rode ${CMD} aqui`)).toHaveLength(1);
    expect(publicacoesEmCodigo('.github/workflows/x.yml', `      - uses: ${ACAO}@abc`)).toHaveLength(1);
  });

  it('em YAML, comentário não conta; texto em aspas com # continua contando', () => {
    expect(publicacoesEmCodigo('.github/workflows/x.yml', `# o ${CMD} fica no deploy.yml`)).toEqual([]);
    expect(publicacoesEmCodigo('.github/workflows/x.yml', `  run: echo ok # ${CMD}`)).toEqual([]);
    expect(publicacoesEmCodigo('.github/workflows/x.yml', `  run: "echo '#' && ${CMD}"`)).toHaveLength(1);
  });

  it('não confunde outros comandos do wrangler nem palavras parecidas', () => {
    for (const linha of [
      `${W} dev`,
      `${W} rollback --message x`,
      `${W} secret put CHAVE`,
      `${W}.jsonc deploy`,
      'pnpm deploy',
      `o ${W} (deploy) do workflow`,
    ]) {
      expect(publicacoesEmCodigo('x.sh', linha), linha).toEqual([]);
    }
  });
});

describe('detecção em documentação', () => {
  it('texto corrido e código de linha são livres', () => {
    expect(publicacoesEmDocumento('README.md', `Só o deploy.yml roda \`${CMD}\`; nunca rode ${CMD} à mão.`)).toEqual(
      [],
    );
  });

  it('bloco cercado (copiável no terminal) é proibido, com ou sem linguagem, com ``` ou ~~~', () => {
    expect(publicacoesEmDocumento('docs/runbook.md', `Passo:\n\n\`\`\`bash\n${CMD} -c x\n\`\`\`\n`)).toHaveLength(1);
    expect(publicacoesEmDocumento('docs/runbook.md', `\`\`\`\n${CMD}\n\`\`\``)).toHaveLength(1);
    expect(publicacoesEmDocumento('docs/runbook.md', `~~~sh\n${W} \\\n deploy\n~~~`)).toHaveLength(1);
  });

  it('diagrama mermaid é livre, e o texto depois do bloco volta a ser livre', () => {
    const doc = `\`\`\`mermaid\nflowchart LR\n  GHA -->|"${CMD}"| CF\n\`\`\`\n\nO ${CMD} é único.\n`;
    expect(publicacoesEmDocumento('.md/SDD.md', doc)).toEqual([]);
  });

  it('a linha do achado é a do comando dentro do bloco', () => {
    const [achado] = publicacoesEmDocumento('README.md', `a\n\n\`\`\`sh\nls\n${CMD}\n\`\`\``);
    expect(achado!.linha).toBe(5);
  });
});

describe('varredura com arquivos simulados', () => {
  it('separa o deploy.yml (todas as publicações dele) das proibidas, e ignora arquivos que não são código nem doc', () => {
    const raiz = mkdtempSync(join(tmpdir(), 'wrangler-unico-'));
    try {
      const gravar = (caminho: string, texto: string) => {
        mkdirSync(dirname(join(raiz, caminho)), { recursive: true });
        writeFileSync(join(raiz, caminho), texto);
      };
      gravar(DEPLOY_YML, `jobs:\n  a:\n    steps:\n      - run: ${CMD}\n      - run: ${W} versions deploy\n`);
      gravar('.github/workflows/outro.yml', `      - run: pnpm exec ${CMD}\n`);
      gravar('docs/runbook.md', '```sh\n' + `${CMD}\n` + '```\n');
      gravar('notas.sql', `-- ${CMD}\n`);
      const r = varrer(raiz, [DEPLOY_YML, '.github/workflows/outro.yml', 'docs/runbook.md', 'notas.sql']);
      expect(r.noDeploy.map((a) => a.linha)).toEqual([4, 5]);
      expect(r.proibidas.map((a) => `${a.arquivo}:${a.linha}`)).toEqual([
        '.github/workflows/outro.yml:1',
        'docs/runbook.md:2',
      ]);
    } finally {
      rmSync(raiz, { recursive: true, force: true });
    }
  });

  it('a lista do git deixa de fora só a pasta .claude/', () => {
    const arquivos = arquivosDoRepositorio(RAIZ);
    expect(arquivos).toContain('package.json');
    expect(arquivos).toContain('backend/scripts/package.json');
    expect(arquivos.some((a) => a.startsWith('.claude/'))).toBe(false);
    expect(arquivos.some((a) => a.startsWith('.md/'))).toBe(true);
  });
});
