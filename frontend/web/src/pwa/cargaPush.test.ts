import { describe, expect, it } from 'vitest';
import { escolherJanela, interpretarCarga, tagDoAviso, urlDoClique } from './cargaPush';

/** Critérios: RN-27, CA-27.7 (texto genérico), G-36 (a notificação leva só texto), ADR 014 (carga `{titulo, corpo, url}`). */

const ORIGEM = 'https://controle.exemplo.com.br';

describe('interpretarCarga', () => {
  it('lê titulo, corpo e url de uma carga válida', () => {
    const carga = interpretarCarga(
      JSON.stringify({ titulo: 'Conta fixa vencendo', corpo: 'Uma despesa fixa vence amanhã.', url: '/app/fixas' }),
      ORIGEM,
    );
    expect(carga).toEqual({
      titulo: 'Conta fixa vencendo',
      corpo: 'Uma despesa fixa vence amanhã.',
      url: '/app/fixas',
      tag: 'fixas',
    });
  });

  it.each([
    ['vazia', ''],
    ['nula', null],
    ['não é JSON', 'olá'],
    ['é um texto JSON', '"oi"'],
    ['é uma lista', '[1]'],
    ['é null', 'null'],
    ['sem título', JSON.stringify({ corpo: 'x', url: '/app/' })],
    ['sem corpo', JSON.stringify({ titulo: 'x', url: '/app/' })],
    ['título que não é texto', JSON.stringify({ titulo: 1, corpo: 'x' })],
    ['corpo que não é texto', JSON.stringify({ titulo: 'x', corpo: { a: 1 } })],
    ['título em branco', JSON.stringify({ titulo: '   ', corpo: 'x' })],
  ])('ignora a carga inválida (%s)', (_nome, texto) => {
    expect(interpretarCarga(texto as string | null, ORIGEM)).toBeNull();
  });

  it('usa só o texto: HTML na carga continua sendo texto, e campos extras são descartados', () => {
    const carga = interpretarCarga(
      JSON.stringify({ titulo: '<b>oi</b>', corpo: '<img src=x onerror=alert(1)>', url: '/app/', extra: 'x' }),
      ORIGEM,
    );
    expect(carga).toEqual({ titulo: '<b>oi</b>', corpo: '<img src=x onerror=alert(1)>', url: '/app/', tag: 'geral' });
  });

  it('limita o tamanho do título e do corpo', () => {
    const carga = interpretarCarga(JSON.stringify({ titulo: 'a'.repeat(500), corpo: 'b'.repeat(2000) }), ORIGEM);
    expect(carga?.titulo).toHaveLength(100);
    expect(carga?.corpo).toHaveLength(300);
  });

  it('url fora de /app/ não derruba o aviso: ele aparece e o clique vai para /app/', () => {
    const carga = interpretarCarga(JSON.stringify({ titulo: 'a', corpo: 'b', url: 'https://mau.example/x' }), ORIGEM);
    expect(carga?.url).toBe('/app/');
  });
});

describe('urlDoClique', () => {
  it.each(['/app/fixas', '/app/lancar', '/app/metas?x=1', '/app/', '/app/ajustes#a'])('aceita %s', (url) => {
    expect(urlDoClique(url, ORIGEM)).toBe(url);
  });

  it.each([
    '/app',
    '/',
    '/entrar',
    '//mau.example/app/x',
    '/app/../entrar',
    '/app/%2e%2e/entrar',
    '/app/\\mau.example',
    'https://mau.example/app/x',
    'https://controle.exemplo.com.br/app/x',
    'javascript:alert(1)',
    '',
    42,
    null,
    undefined,
    { url: '/app/' },
  ])('recusa %j', (url) => {
    expect(urlDoClique(url, ORIGEM)).toBeNull();
  });
});

describe('tagDoAviso', () => {
  it('uma tag por tipo de aviso', () => {
    expect(tagDoAviso('/app/fixas')).toBe('fixas');
    expect(tagDoAviso('/app/lancar')).toBe('lembrete');
    expect(tagDoAviso('/app/metas')).toBe('metas');
    expect(tagDoAviso('/app/')).toBe('geral');
  });
});

describe('escolherJanela', () => {
  it('escolhe a primeira janela do app, da mesma origem', () => {
    expect(
      escolherJanela(
        ['https://outro.example/app/', `${ORIGEM}/entrar`, `${ORIGEM}/app/fixas`, `${ORIGEM}/app/`],
        ORIGEM,
      ),
    ).toBe(2);
  });
  it('devolve -1 sem janela do app', () => {
    expect(escolherJanela([`${ORIGEM}/`, 'https://outro.example/app/', 'isto não é url'], ORIGEM)).toBe(-1);
    expect(escolherJanela([], ORIGEM)).toBe(-1);
  });
});
