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
    rules: { 'import-x/no-restricted-paths': ['error', { zones: zonas }] },
  },
  fronteira('backend/contrato', 'dominio', 'api', 'scripts', 'web'),
  fronteira('backend/dominio', 'api', 'scripts', 'web'),
  fronteira('backend/api', 'scripts', 'web'),
  fronteira('backend/scripts', 'web'),
  fronteira('frontend/web', 'dominio', 'api', 'scripts'),
);
