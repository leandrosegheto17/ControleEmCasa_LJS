import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import prettier from 'eslint-config-prettier';
import globals from 'globals';
import { importX } from 'eslint-plugin-import-x';
import { createTypeScriptImportResolver } from 'eslint-import-resolver-typescript';

/**
 * Fronteiras entre pacotes (SDD 2.1):
 * - contrato não importa ninguém;
 * - dominio só importa contrato (tipos) e nunca api;
 * - web importa só contrato (nunca dominio nem api);
 * - api e scripts não importam web.
 * Cada fronteira cobre o nome do pacote e o caminho relativo.
 */
const PACOTES = {
  contrato: { nome: '@controle/contrato', pasta: 'backend/contrato' },
  dominio: { nome: '@controle/dominio', pasta: 'backend/dominio' },
  api: { nome: '@controle/api', pasta: 'backend/api' },
  scripts: { nome: '@controle/scripts', pasta: 'backend/scripts' },
  web: { nome: '@controle/web', pasta: 'frontend/web' },
};

const proibir = (...chaves) => ({
  patterns: [
    {
      group: chaves.flatMap((c) => [PACOTES[c].nome, `${PACOTES[c].nome}/*`, `**/${PACOTES[c].pasta}/**`]),
      message: `Importação proibida nesta pasta (fronteira de pacotes): ${chaves.join(', ')}.`,
    },
  ],
});

const fronteira = (pasta, ...proibidos) => ({
  files: [`${pasta}/**/*.{ts,tsx,mjs,js}`],
  rules: { 'no-restricted-imports': ['error', proibir(...proibidos)] },
});

// Caminho relativo que atravessa a fronteira: checado pelo caminho resolvido, não pelo texto do import.
const zonas = Object.entries({
  contrato: ['dominio', 'api', 'scripts', 'web'],
  dominio: ['api', 'scripts', 'web'],
  api: ['scripts', 'web'],
  scripts: ['web'],
  web: ['dominio', 'api', 'scripts'],
}).flatMap(([alvo, origens]) =>
  origens.map((origem) => ({
    target: `./${PACOTES[alvo].pasta}`,
    from: `./${PACOTES[origem].pasta}`,
    message: `${alvo} não importa ${origem} (fronteira de pacotes).`,
  })),
);

/**
 * Camadas dentro de `frontend/web/src` (SDD 9.1; PLANO decisão 5): quem cada camada pode importar.
 * Os arquivos da raiz de `src` (main, rotas, mapaRotas, sessaoGlobal, clienteConsulta) ligam as camadas e não têm restrição.
 */
const SRC_WEB = 'frontend/web/src';
const PODE_IMPORTAR_NO_WEB = {
  paginas: ['componentes', 'ganchos', 'formatacao', 'rotulos', 'comum'],
  componentes: ['formatacao', 'rotulos', 'comum'],
  ganchos: ['dados', 'formatacao', 'comum'],
  dados: ['configuracao', 'comum'],
  formatacao: ['comum'],
  rotulos: ['comum'],
  pwa: [],
  configuracao: [],
  comum: [],
};
const CAMADAS_WEB = Object.keys(PODE_IMPORTAR_NO_WEB);
const zonasDasCamadasWeb = [
  ...CAMADAS_WEB.flatMap((camada) =>
    CAMADAS_WEB.filter((outra) => outra !== camada && !PODE_IMPORTAR_NO_WEB[camada].includes(outra)).map((outra) => ({
      target: `./${SRC_WEB}/${camada}`,
      from: `./${SRC_WEB}/${outra}`,
      message: `${camada}/ não importa ${outra}/ (SDD 9.1).`,
    })),
  ),
  {
    target: `./${SRC_WEB}/componentes/base`,
    from: `./${SRC_WEB}/componentes`,
    except: ['./base'],
    message: 'componentes/base/ não importa o resto de componentes/ (SDD 9.1).',
  },
];

// G-36 e G-37: texto do usuário nunca vira HTML; sem import dinâmico aberto nem avaliação de código.
const MSG_HTML = 'Texto nunca vira HTML (G-36): exiba como texto.';
const MSG_IMPORT_ABERTO = 'import() só com string literal (G-37).';
const SINTAXE_PROIBIDA_NO_WEB = [
  { selector: "JSXAttribute[name.name='dangerouslySetInnerHTML']", message: MSG_HTML },
  { selector: 'AssignmentExpression[left.property.name=/^(innerHTML|outerHTML)$/]', message: MSG_HTML },
  { selector: 'CallExpression[callee.property.name=/^(insertAdjacentHTML|writeln)$/]', message: MSG_HTML },
  { selector: "CallExpression[callee.object.name='document'][callee.property.name='write']", message: MSG_HTML },
  { selector: "ImportExpression:not([source.type='Literal'])", message: MSG_IMPORT_ABERTO },
  { selector: "CallExpression[callee.name='require']", message: 'Sem require no front (G-37).' },
  {
    selector:
      'CallExpression[callee.name=/^(setTimeout|setInterval)$/][arguments.0.type=/^(Literal|TemplateLiteral)$/]',
    message: 'setTimeout/setInterval com texto avalia código (G-37).',
  },
];

export default tseslint.config(
  {
    ignores: [
      '**/dist/**',
      '**/node_modules/**',
      '**/coverage/**',
      '**/.wrangler/**',
      '.claude/**',
      '.md/**',
      '.specs/**',
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  prettier,
  { languageOptions: { globals: { ...globals.node } } },
  { files: ['frontend/web/**/*.{ts,tsx}'], languageOptions: { globals: { ...globals.browser } } },
  {
    plugins: { 'import-x': importX },
    settings: { 'import-x/resolver-next': [createTypeScriptImportResolver({ project: './tsconfig.base.json' })] },
    rules: {
      // `basePath` fixo: as zonas valem em qualquer diretório de trabalho (editor, testes de lint).
      'import-x/no-restricted-paths': [
        'error',
        { basePath: import.meta.dirname, zones: [...zonas, ...zonasDasCamadasWeb] },
      ],
    },
  },
  // Código copiado do legado: espaço fino/NBSP em regex de formatação e `_nome` para o que é descartado de propósito.
  {
    files: ['frontend/web/**/*.{ts,tsx}'],
    rules: {
      'no-irregular-whitespace': ['error', { skipRegExps: true }],
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
    },
  },
  // G-46: console só no logger da API (log.ts). Os testes podem espiar o console.
  {
    files: ['backend/api/src/**/*.ts'],
    ignores: ['backend/api/src/log.ts', 'backend/api/src/**/*.test.ts'],
    rules: { 'no-console': 'error' },
  },
  fronteira('backend/contrato', 'dominio', 'api', 'scripts', 'web'),
  fronteira('backend/dominio', 'api', 'scripts', 'web'),
  fronteira('backend/api', 'scripts', 'web'),
  fronteira('backend/scripts', 'web'),
  fronteira('frontend/web', 'dominio', 'api', 'scripts'),
  // Só `dados/` guarda dados no aparelho (IndexedDB) e faz `fetch` (SDD 9.2; G-39).
  {
    files: ['frontend/web/**/*.{ts,tsx,mjs,js}'],
    ignores: ['frontend/web/src/dados/**'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          ...proibir('dominio', 'api', 'scripts'),
          paths: [{ name: 'idb-keyval', message: 'idb-keyval só em dados/ (SDD 9.2).' }],
        },
      ],
    },
  },
  {
    files: ['frontend/web/src/**/*.{ts,tsx}'],
    ignores: ['frontend/web/src/dados/**', 'frontend/web/src/**/*.test.{ts,tsx}'],
    rules: {
      'no-restricted-globals': ['error', { name: 'fetch', message: 'fetch só em dados/transporte.ts (SDD 9.2).' }],
    },
  },
  {
    files: ['frontend/web/**/*.{ts,tsx,mjs,js}'],
    ignores: ['frontend/web/test/**', 'frontend/web/src/**/*.test.{ts,tsx}'],
    rules: {
      'no-restricted-syntax': ['error', ...SINTAXE_PROIBIDA_NO_WEB],
      'no-eval': 'error',
      'no-new-func': 'error',
      'no-implied-eval': 'error',
      'no-script-url': 'error',
    },
  },
  // Módulo isolado de e-mail (SDD 2.2; decisão 4 do PLANO): só importa da própria pasta, para ser extraído depois.
  {
    files: ['backend/api/src/infraestrutura/email/**/*.ts'],
    ignores: ['backend/api/src/infraestrutura/email/**/*.test.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['../*', '@controle/*', 'hono', 'hono/*', 'kysely', 'pg', 'cloudflare:*'],
              message: 'O módulo de e-mail é isolado: importe só da própria pasta (SDD 2.2).',
            },
          ],
        },
      ],
    },
  },
  // Módulo isolado do Asaas (SDD 2.2; decisão 4 do PLANO): mesma fronteira do e-mail.
  {
    files: ['backend/api/src/infraestrutura/asaas/**/*.ts'],
    ignores: ['backend/api/src/infraestrutura/asaas/**/*.test.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['../*', '@controle/*', 'hono', 'hono/*', 'kysely', 'pg', 'cloudflare:*'],
              message: 'O módulo do Asaas é isolado: importe só da própria pasta (SDD 2.2).',
            },
          ],
        },
      ],
    },
  },
  // Módulo isolado de Web Push (SDD 2.2; decisão 4 do PLANO; ADR-014): mesma fronteira, e só `fetch`/`crypto.subtle`.
  {
    files: ['backend/api/src/infraestrutura/push/**/*.ts'],
    ignores: ['backend/api/src/infraestrutura/push/**/*.test.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['../*', '@controle/*', 'hono', 'hono/*', 'kysely', 'pg', 'cloudflare:*', 'node:*', 'web-push'],
              message: 'O módulo de push é isolado: importe só da própria pasta, sem SDK (SDD 2.2).',
            },
          ],
        },
      ],
      'no-console': 'error',
    },
  },
);
