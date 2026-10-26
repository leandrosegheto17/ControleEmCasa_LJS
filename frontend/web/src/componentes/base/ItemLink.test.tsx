import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { describe, expect, it } from 'vitest';
import { ItemLink } from './ItemLink';

const classe = (nome: string) => new RegExp(`(^|\\s|_)${nome}(_|\\s|$)`);

function renderLink(props: Partial<Parameters<typeof ItemLink>[0]>) {
  render(
    <MemoryRouter>
      <ul>
        <ItemLink rotulo="Conta" para="/contas/1" {...props} />
      </ul>
    </MemoryRouter>,
  );
  return screen.getByRole('link');
}

describe('ItemLink', () => {
  it('com valor, o saldo é span.valor filho direto do link, fora de .sub', () => {
    const link = renderLink({ valor: 'R$ 10,00' });

    const valor = link.querySelector(':scope > span.valor');
    expect(valor).not.toBeNull();
    expect(valor).toHaveTextContent('R$ 10,00');
    expect(valor?.closest('[class*="sub"]')).toBeNull();
  });

  it('com nota e valor, a nota fica em .sub e o valor é irmão dentro de span.fim', () => {
    const link = renderLink({ valor: 'R$ 10,00', nota: 'Atualizado' });

    const fim = Array.from(link.children).find((el) => classe('fim').test(el.className));
    expect(fim).toBeDefined();
    const [nota, valor] = Array.from(fim!.children);
    expect(nota.className).toMatch(classe('sub'));
    expect(nota).toHaveTextContent('Atualizado');
    expect(valor).toHaveClass('valor');
    expect(valor).toHaveTextContent('R$ 10,00');
    expect(link.querySelector(':scope > span.valor')).toBeNull();
  });

  it('sem valor, mostra a contagem e a seta em .sub', () => {
    const link = renderLink({ contagem: 3 });

    const sub = link.querySelector(':scope > span[class*="sub"]');
    expect(sub).toHaveTextContent('3');
    expect(sub?.querySelector('use')?.getAttribute('href')).toBe('#i-dir');
    expect(link.querySelector('.valor')).toBeNull();
  });

  it('seta={false} tira a seta do link', () => {
    const link = renderLink({ seta: false });

    expect(link.querySelector('svg')).toBeNull();
  });
});
