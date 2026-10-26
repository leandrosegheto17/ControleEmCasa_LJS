import { readFileSync } from 'node:fs';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import { defineConfig } from 'vitest/config';
import { lerToken } from './scripts/lerToken.mjs';

const porta = Number(process.env.PORTA ?? 5173);
const corFundo = lerToken(readFileSync(new URL('./src/estilo/tokens.css', import.meta.url), 'utf8'), '--cor-fundo');

// No ambiente jsdom (consumidor "client") o Vite reescreve `new URL('x', import.meta.url)`
// para uma URL http de servidor; nos testes queremos o `file:` real do arquivo.
const manterImportMetaUrlDosTestes = {
  name: 'manter-import-meta-url-dos-testes',
  enforce: 'pre' as const,
  transform(code: string, id: string) {
    if (!/\.test\.tsx?$/.test(id) || !code.includes('import.meta.url')) return null;
    return { code: code.replaceAll('import.meta.url', "import.meta['url']"), map: null };
  },
};

export default defineConfig({
  plugins: [
    react(),
    {
      name: 'cor-do-tema',
      transformIndexHtml: () => [{ tag: 'meta', attrs: { name: 'theme-color', content: corFundo }, injectTo: 'head' }],
    },
    // injectManifest (SDD 9.1): o service worker é nosso (`src/pwa/sw.ts`), por causa dos handlers de push da etapa 15.
    // O app vive em /app/ (start_url e scope). O SW nunca guarda resposta da API (G-39): ver `pwa/configuracaoSw.ts`.
    VitePWA({
      strategies: 'injectManifest',
      srcDir: 'src/pwa',
      filename: 'sw.ts',
      registerType: 'autoUpdate',
      injectRegister: false,
      scope: '/app/',
      manifest: {
        name: 'Controle em Casa',
        short_name: 'Controle',
        lang: 'pt-BR',
        start_url: '/app/',
        scope: '/app/',
        display: 'standalone',
        theme_color: corFundo,
        background_color: corFundo,
        icons: [
          { src: '/icones/icone-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: '/icones/icone-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          { src: '/icones/icone-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      injectManifest: { globPatterns: ['**/*.{js,css,html,woff2,svg,png,webmanifest}'] },
      devOptions: { enabled: false },
    }),
  ],
  build: { outDir: 'dist', target: ['es2022', 'safari18'] },
  server: { port: porta, strictPort: true },
  test: {
    projects: [
      {
        extends: true,
        plugins: [manterImportMetaUrlDosTestes],
        test: {
          name: 'componentes',
          environment: 'jsdom',
          setupFiles: ['./test/setup.ts'],
          include: ['src/**/*.test.{ts,tsx}'],
          // Os testes de estilo e de arquivos estáticos leem o disco: rodam no projeto "arquivos".
          exclude: ['src/estilo/estilo.test.ts', 'src/cabecalhos.test.ts'],
        },
      },
      {
        // jsdom troca a classe URL global e quebra `readFileSync(new URL(...))`.
        extends: true,
        test: {
          name: 'arquivos',
          environment: 'node',
          include: [
            'src/app.test.ts',
            'src/cabecalhos.test.ts',
            'src/estilo/estilo.test.ts',
            'test/**/*.test.ts',
            'scripts/**/*.test.mjs',
          ],
        },
      },
    ],
  },
});
