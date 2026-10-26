import { render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { describe, expect, it } from 'vitest';
import type { SaidaResumoMes as ResumoMes } from '@controle/contrato';
import { lerResposta } from '../../test/apoio/fetchSimulado';
import { CartaoMetas } from './CartaoMetas';

const metas = lerResposta<ResumoMes>('resumo-mes.json').conjunto.metas;

function montar(lista: typeof metas) {
  return render(
    <MemoryRouter>
      <CartaoMetas
        titulo="Metas da casa"
        bloco="casa"
        metas={lista}
        linkMeta={(id: string) => `/metas/${id}`}
        textoVazio="Nenhuma meta da casa."
        linkNova="/metas/nova"
      />
    </MemoryRouter>,
  );
}

describe('CartaoMetas', () => {
  it('cartão nomeado pelo título com uma meta por item', () => {
    montar(metas);

    const cartao = screen.getByRole('article', { name: 'Metas da casa' });
    const links = within(cartao).getAllByRole('link');
    expect(links).toHaveLength(2);
    expect(links[0]).toHaveAttribute('href', '/metas/00000000-0000-4000-8000-000000000901');
    expect(links[1]).toHaveAttribute('href', '/metas/00000000-0000-4000-8000-000000000902');
    expect(within(cartao).getAllByRole('progressbar')).toHaveLength(2);
  });

  it('vazio: linha de estado e "Nova meta"', () => {
    montar([]);

    expect(screen.getByText('Nenhuma meta da casa.')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Nova meta' })).toHaveAttribute('href', '/metas/nova');
    expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
  });
});
