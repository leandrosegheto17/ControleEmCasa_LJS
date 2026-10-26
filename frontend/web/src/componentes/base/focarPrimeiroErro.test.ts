import { describe, it, expect, afterEach } from 'vitest';
import { focarPrimeiroErro } from './focarPrimeiroErro';

function montar(html: string): HTMLElement {
  const raiz = document.createElement('form');
  raiz.innerHTML = html;
  document.body.appendChild(raiz);
  return raiz;
}

afterEach(() => {
  document.body.innerHTML = '';
});

describe('focarPrimeiroErro', () => {
  it('foca o primeiro campo inválido na ordem do DOM e devolve true', () => {
    const raiz = montar(`
      <input id="a">
      <input id="b" aria-invalid="true">
      <select id="c" aria-invalid="true"><option>x</option></select>
    `);
    expect(focarPrimeiroErro(raiz)).toBe(true);
    expect(document.activeElement?.id).toBe('b');
  });

  it('sem campo inválido devolve false e não mexe no foco', () => {
    const raiz = montar(`<input id="a"><input id="b" aria-invalid="false">`);
    const fora = document.createElement('button');
    document.body.appendChild(fora);
    fora.focus();
    expect(focarPrimeiroErro(raiz)).toBe(false);
    expect(document.activeElement).toBe(fora);
  });

  it('ignora campos inválidos fora da raiz', () => {
    const fora = montar(`<input id="fora" aria-invalid="true">`);
    const raiz = montar(`<input id="dentro" aria-invalid="true">`);
    expect(fora).not.toBe(raiz);
    expect(focarPrimeiroErro(raiz)).toBe(true);
    expect(document.activeElement?.id).toBe('dentro');
  });
});
