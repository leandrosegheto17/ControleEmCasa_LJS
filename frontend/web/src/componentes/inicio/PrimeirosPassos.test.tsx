import { render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { describe, expect, it } from 'vitest';
import { PrimeirosPassos } from './PrimeirosPassos';

const classe = (nome: string) => new RegExp(`(^|\\s|_)${nome}(_|\\s|$)`);

function montar(props: { temConta: boolean; temForma: boolean; instalado: boolean }) {
  return render(
    <MemoryRouter>
      <PrimeirosPassos {...props} />
    </MemoryRouter>,
  );
}

function passos() {
  return within(screen.getByRole('region', { name: 'Primeiros passos' })).getAllByRole('listitem');
}

describe('PrimeirosPassos', () => {
  it('section nomeada "Primeiros passos" com o texto do mockup', () => {
    montar({ temConta: false, temForma: false, instalado: false });

    expect(screen.getByRole('region', { name: 'Primeiros passos' })).toBeInTheDocument();
    expect(
      screen.getByText(
        'Para lançar o primeiro gasto, cadastre uma conta e uma forma de pagamento. As categorias iniciais já foram criadas.',
      ),
    ).toBeInTheDocument();
  });

  it('sem conta nem forma: 3 passos, nenhum feito, links para T16 e T18', () => {
    montar({ temConta: false, temForma: false, instalado: false });

    expect(passos()).toHaveLength(3);
    passos().forEach((p) => expect(p.className).not.toMatch(classe('passo-feito')));
    expect(screen.getByRole('link', { name: 'Cadastre uma conta' })).toHaveAttribute(
      'href',
      '/app/ajustes/contas/nova',
    );
    expect(screen.getByRole('link', { name: 'Cadastre uma forma de pagamento' })).toHaveAttribute(
      'href',
      '/app/ajustes/formas/nova',
    );
    expect(screen.getByRole('link', { name: 'Instale o app no celular' })).toHaveAttribute(
      'href',
      '/app/ajustes?instalar=1',
    );
  });

  it('com conta: passo 1 feito, com "(feito)" no nome acessível', () => {
    montar({ temConta: true, temForma: false, instalado: false });

    expect(passos()[0].className).toMatch(classe('passo-feito'));
    expect(passos()[1].className).not.toMatch(classe('passo-feito'));
    expect(screen.getByRole('link', { name: /Cadastre uma conta.*\(feito\)/ })).toBeInTheDocument();
  });

  it('instalado marca o passo 3', () => {
    montar({ temConta: false, temForma: false, instalado: true });

    expect(passos()[2].className).toMatch(classe('passo-feito'));
    expect(screen.getByRole('link', { name: /Instale o app no celular.*\(feito\)/ })).toBeInTheDocument();
  });

  it('com conta e forma: não renderiza', () => {
    const { container } = montar({ temConta: true, temForma: true, instalado: false });

    expect(screen.queryByRole('region', { name: 'Primeiros passos' })).not.toBeInTheDocument();
    expect(container).toBeEmptyDOMElement();
  });
});
