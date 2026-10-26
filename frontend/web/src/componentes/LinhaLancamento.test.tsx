import type { ComponentProps } from 'react';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { describe, expect, it } from 'vitest';
import { LinhaLancamento } from './LinhaLancamento';

// Aceita o nome cru e o nome gerado pelo CSS Module (_nome_hash).
const classe = (nome: string) => new RegExp(`(^|\\s|_)${nome}(_|\\s|$)`);

type Props = ComponentProps<typeof LinhaLancamento>;

const BASE: Props = {
  href: '/lancamentos/00000000-0000-4000-8000-000000000515',
  escopo: 'individual',
  titulo: 'Fone bluetooth (2/3)',
  parcela: { numero: 2, total: 3 },
  categoria: 'Lazer pessoal',
  variavel: true,
  tipo: 'despesa',
  valorCentavos: 8000,
  data: '2026-10-10',
  pagador: { nome: 'Leandro', souEu: true },
};

const MERCADO_CASA: Props = {
  href: '/lancamentos/00000000-0000-4000-8000-000000000540',
  escopo: 'conjunto',
  titulo: 'Mercado',
  parcela: { numero: 1, total: 1 },
  categoria: 'Mercado',
  variavel: true,
  tipo: 'despesa',
  valorCentavos: 4590,
  data: '2026-10-12',
  pagador: { nome: 'Ana', souEu: false },
};

function renderizar(props: Partial<Props> = {}) {
  const resultado = render(
    <MemoryRouter>
      <LinhaLancamento {...BASE} {...props} />
    </MemoryRouter>,
  );
  const link = screen.getByRole('link');
  return { ...resultado, link };
}

describe('LinhaLancamento', () => {
  it('individual: ícone de escopo com classe "eu", rótulo "Eu" e símbolo de rotulos/escopo', () => {
    const { link } = renderizar();
    const icone = link.querySelector('svg[role="img"]') as SVGElement;
    expect(icone).not.toBeNull();
    expect(icone.getAttribute('class')).toMatch(classe('eu'));
    expect(icone).toHaveAttribute('aria-label', 'Eu');
    expect(icone.querySelector('use')?.getAttribute('href')).toBe('#i-pessoa');
  });

  it('conjunta: ícone de escopo com classe "casa", rótulo "Casa" e símbolo casa', () => {
    const { link } = renderizar(MERCADO_CASA);
    const icone = link.querySelector('svg[role="img"]') as SVGElement;
    expect(icone.getAttribute('class')).toMatch(classe('casa'));
    expect(icone).toHaveAttribute('aria-label', 'Casa');
    expect(icone.querySelector('use')?.getAttribute('href')).toBe('#i-casa');
  });

  it('mostra o título recebido, a categoria, o selo "variável", a data curta e o valor', () => {
    const { link } = renderizar();
    expect(link).toHaveTextContent('Fone bluetooth (2/3)');
    expect(link).toHaveTextContent('Lazer pessoal');
    expect(link).toHaveTextContent('variável');
    expect(link).toHaveTextContent('10/10');
    expect(link).toHaveTextContent('R$ 80,00');
  });

  it('categoria fixa não mostra o selo "variável"', () => {
    const { link } = renderizar({ variavel: false });
    expect(link).not.toHaveTextContent('variável');
  });

  it('conjunta paga pelo outro membro: "Pago por Ana" no celular e "Ana" na coluna do pagador', () => {
    const { link } = renderizar(MERCADO_CASA);
    expect(link).toHaveTextContent('Pago por Ana');
    const colunaPagador = Array.from(link.querySelectorAll('span')).find((el) =>
      classe('col-pagador').test(el.className),
    );
    expect(colunaPagador).toBeDefined();
    expect(colunaPagador).toHaveTextContent(/^Ana$/);
  });

  it('pagador sou eu: a coluna do pagador mostra "Você"', () => {
    const { link } = renderizar();
    const colunaPagador = Array.from(link.querySelectorAll('span')).find((el) =>
      classe('col-pagador').test(el.className),
    );
    expect(colunaPagador).toHaveTextContent(/^Você$/);
  });

  it('receita: valor com a classe de receita, sinal "+" e rótulo "Receita"', () => {
    const { link } = renderizar({
      tipo: 'receita',
      titulo: 'Salário',
      categoria: 'Salário',
      variavel: false,
      valorCentavos: 750000,
    });
    const valor = Array.from(link.querySelectorAll('span')).find((el) => classe('valor-receita').test(el.className));
    expect(valor).toBeDefined();
    expect(valor).toHaveTextContent('+ R$ 7.500,00');
    expect(link).toHaveTextContent('Receita');
  });

  it('despesa não usa a classe de receita nem o sinal "+"', () => {
    const { link } = renderizar();
    expect(link.innerHTML).not.toMatch(/valor-receita/);
    expect(link).not.toHaveTextContent('+ R$');
  });

  it('aguardando envio: selo "aguardando envio" com o ícone envio', () => {
    const { link } = renderizar({ aguardando: true });
    const selo = Array.from(link.querySelectorAll('span')).find((el) =>
      classe('selo-aguardando').test(el.className),
    ) as HTMLElement;
    expect(selo).toBeDefined();
    expect(selo).toHaveTextContent('aguardando envio');
    expect(selo.querySelector('use')?.getAttribute('href')).toBe('#i-envio');
  });

  it('sem "aguardando" não há selo de aguardando envio', () => {
    const { link } = renderizar();
    expect(link).not.toHaveTextContent('aguardando envio');
  });

  it('nome acessível completo da conjunta, no padrão da UX-SPEC §5', () => {
    renderizar(MERCADO_CASA);
    expect(
      screen.getByRole('link', { name: 'Mercado, Casa, pago por Ana, R$ 45,90, 12 de outubro' }),
    ).toBeInTheDocument();
  });

  it('nome acessível da parcelada lê "parcela k de N" no lugar do "(k/N)"', () => {
    renderizar();
    expect(
      screen.getByRole('link', { name: 'Fone bluetooth, parcela 2 de 3, Eu, R$ 80,00, 10 de outubro' }),
    ).toBeInTheDocument();
  });

  it('nome acessível à vista não diz "parcela"', () => {
    const { link } = renderizar({ titulo: 'Almoço', parcela: { numero: 1, total: 1 } });
    expect(link.getAttribute('aria-label')).toBe('Almoço, Eu, R$ 80,00, 10 de outubro');
    expect(link.getAttribute('aria-label')).not.toMatch(/parcela/);
  });

  it('nome acessível da conjunta paga por mim diz "pago por você"', () => {
    const { link } = renderizar({ ...MERCADO_CASA, pagador: { nome: 'Leandro', souEu: true } });
    expect(link.getAttribute('aria-label')).toMatch(/pago por você,/);
  });

  it('nome acessível da receita acrescenta "receita"', () => {
    const { link } = renderizar({
      tipo: 'receita',
      titulo: 'Salário',
      categoria: 'Salário',
      variavel: false,
      valorCentavos: 750000,
    });
    expect(link.getAttribute('aria-label')).toMatch(/receita/);
  });

  it('nome acessível do item da fila acrescenta "aguardando envio"', () => {
    const { link } = renderizar({ ...MERCADO_CASA, aguardando: true });
    expect(link.getAttribute('aria-label')).toMatch(/^Mercado, Casa, pago por Ana, R\$ 45,90, 12 de outubro/);
    expect(link.getAttribute('aria-label')).toMatch(/aguardando envio/);
  });

  it('repassa o href ao link', () => {
    const { link } = renderizar();
    expect(link).toHaveAttribute('href', '/lancamentos/00000000-0000-4000-8000-000000000515');
  });

  it('não mostra forma, conta nem data da compra', () => {
    const { link } = renderizar(MERCADO_CASA);
    expect(link).not.toHaveTextContent(/Pix|Débito|Crédito|Nubank|Itaú/);
  });

  it('descrição com marcação aparece como texto, sem virar HTML', () => {
    const { link } = renderizar({ titulo: '<b>Fone</b>' });
    expect(link).toHaveTextContent('<b>Fone</b>');
    expect(link.querySelector('b')).toBeNull();
  });
});
