import { describe, expect, it } from 'vitest';
import {
  linkConta,
  linkEnvios,
  linkFixas,
  linkForma,
  linkLancamentos,
  linkMeta,
  linkOrcamento,
  noApp,
} from './linksApp';

/** Os links do app moram sob `/app` (SDD 9.3); `links.ts` guarda os caminhos relativos à raiz do app. */
describe('formatacao/linksApp', () => {
  it('noApp põe o prefixo e trata a raiz', () => {
    expect(noApp('/')).toBe('/app');
    expect(noApp('/?mes=2026-10&envios=1')).toBe('/app?mes=2026-10&envios=1');
    expect(noApp('/ajustes/contas')).toBe('/app/ajustes/contas');
  });

  it('cada link ganha /app e mantém a query', () => {
    expect(linkLancamentos({ mes: '2026-10', escopo: 'conjunto', categoria: 'c' })).toBe(
      '/app/lancamentos?mes=2026-10&escopo=casa&categoria=c',
    );
    expect(linkOrcamento({ mes: '2026-10', escopo: 'individual' })).toBe('/app/orcamento?mes=2026-10&escopo=eu');
    expect(linkFixas({ mes: '2026-10', pagar: 'x' })).toBe('/app/fixas?mes=2026-10&pagar=x');
    expect(linkEnvios('2026-10')).toBe('/app?mes=2026-10&envios=1');
    expect(linkMeta('m')).toBe('/app/metas/m');
    expect(linkMeta('m', { movimentar: 'aporte' })).toBe('/app/metas/m?movimentar=aporte');
    expect(linkConta('c')).toBe('/app/ajustes/contas/c');
    expect(linkForma('f')).toBe('/app/ajustes/formas/f');
  });
});
