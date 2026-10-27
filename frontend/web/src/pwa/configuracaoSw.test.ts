// @vitest-environment node
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { NAVEGACAO_NEGADA, NAVEGACAO_PERMITIDA, ehChamadaApi, ehNavegacaoDoApp } from './configuracaoSw';

const sw = readFileSync(new URL('./sw.ts', import.meta.url), 'utf8');

describe('roteamento do service worker (G-39, SDD 9.1)', () => {
  it.each(['/api', '/api/', '/api/sessao', '/api/lancamentos/despesas', '/api/push/assinaturas'])(
    '%s é chamada de API (só rede)',
    (caminho) => {
      expect(ehChamadaApi(caminho)).toBe(true);
    },
  );

  it.each(['/', '/app', '/app/lancamentos', '/apiary', '/api-docs', '/icones/icone-192.png'])(
    '%s não é chamada de API',
    (caminho) => {
      expect(ehChamadaApi(caminho)).toBe(false);
    },
  );

  it.each(['/app', '/app/', '/app/lancamentos', '/app/ajustes/conta'])(
    'navegar para %s serve o index.html',
    (caminho) => {
      expect(ehNavegacaoDoApp(caminho)).toBe(true);
    },
  );

  // Etapa 14: a landing e as páginas públicas nunca são atendidas pelo fallback do app (a atualização não pode quebrar).
  it.each(['/termos', '/privacidade', '/confirmar-exclusao', '/cadastro'])(
    'a página pública %s não usa o fallback do app',
    (caminho) => {
      expect(ehNavegacaoDoApp(caminho)).toBe(false);
    },
  );

  it.each(['/', '/entrar', '/application', '/api/sessao', '/api/app'])(
    'navegar para %s não usa o fallback do app',
    (caminho) => {
      expect(ehNavegacaoDoApp(caminho)).toBe(false);
    },
  );

  it('allowlist ^/app e denylist ^/api', () => {
    expect(NAVEGACAO_PERMITIDA.map((p) => p.test('/app/x'))).toEqual([true]);
    expect(NAVEGACAO_NEGADA.every((p) => p.test('/api/x'))).toBe(true);
  });
});

describe('sw.ts (injectManifest)', () => {
  it('a API usa NetworkOnly e nenhuma estratégia de cache existe', () => {
    expect(sw).toMatch(/registerRoute\(\(\{ url \}\) => ehChamadaApi\(url\.pathname\), new NetworkOnly\(\)\)/);
    for (const proibida of ['CacheFirst', 'StaleWhileRevalidate', 'NetworkFirst', 'runtimeCaching', 'CacheOnly']) {
      expect(sw, proibida).not.toContain(proibida);
    }
  });

  it('o fallback de navegação é o index.html do precache, com allowlist e denylist', () => {
    expect(sw).toContain("createHandlerBoundToURL('/index.html')");
    expect(sw).toContain('allowlist: NAVEGACAO_PERMITIDA');
    expect(sw).toContain('denylist: NAVEGACAO_NEGADA');
  });

  it('a rota da API é registrada antes da de navegação', () => {
    expect(sw.indexOf('NetworkOnly()')).toBeGreaterThan(-1);
    expect(sw.indexOf('NetworkOnly()')).toBeLessThan(sw.indexOf('new NavigationRoute'));
  });

  it('não importa nada de fora do projeto nem dos pacotes do Workbox', () => {
    const imports = [...sw.matchAll(/from '([^']+)'/g)].map((m) => m[1] as string);
    for (const origem of imports)
      expect(origem).toMatch(/^(workbox-(precaching|routing|strategies)|\.\/configuracaoSw|\.\/handlersPush)$/);
    expect(sw).not.toMatch(/importScripts/);
  });
});
