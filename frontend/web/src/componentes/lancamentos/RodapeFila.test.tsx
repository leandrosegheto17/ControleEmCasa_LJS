import { readFileSync } from 'node:fs';
import { render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { describe, expect, it } from 'vitest';
import { RodapeFila } from './RodapeFila';

const RESPOSTAS = new URL('../../../test/fixtures/respostas/', import.meta.url);
const DADOS = JSON.parse(readFileSync(new URL('dados-lancamento.json', RESPOSTAS), 'utf8')) as {
  categorias_despesa: unknown[];
};

const PADARIA = {
  id: 'item-1',
  dono: '00000000-0000-4000-8000-0000000000a1',
  args: {
    p_id: '00000000-0000-4000-8000-000000000999',
    valor_centavos: 1250,
    categoria_id: '00000000-0000-4000-8000-000000000411',
    forma_id: '00000000-0000-4000-8000-000000000301',
    parcelas: 1,
    data: '2026-10-09',
    descricao: 'Padaria',
  },
  exibicao: { categoria_nome: 'Almoço/Alimentação fora', forma_nome: 'Pix Nubank' },
  criadoEm: '2026-10-09T12:00:00-03:00',
  situacao: 'aguardando' as const,
};

function renderizar(itens: unknown[]) {
  return render(
    <MemoryRouter>
      <RodapeFila itens={itens as never} categorias={DADOS.categorias_despesa as never} />
    </MemoryRouter>,
  );
}

describe('RodapeFila', () => {
  it('1 item: seção "Aguardando envio (fora do total)" com a linha e o selo', () => {
    renderizar([PADARIA]);
    const secao = screen.getByRole('region', { name: 'Aguardando envio (fora do total)' });
    const link = within(secao).getByRole('link');
    expect(link).toHaveTextContent('Padaria');
    expect(link).toHaveTextContent('Almoço/Alimentação fora');
    expect(link).toHaveTextContent('R$ 12,50');
    expect(link).toHaveTextContent('09/10');
    expect(link).toHaveTextContent('aguardando envio');
  });

  it('nome acessível da linha inclui "aguardando envio"', () => {
    renderizar([PADARIA]);
    expect(screen.getByRole('link', { name: /aguardando envio/ })).toBeInTheDocument();
  });

  it('escopo vem da categoria em dados_lancamento (Almoço → Eu)', () => {
    renderizar([PADARIA]);
    expect(screen.getByRole('img', { name: 'Eu' })).toBeInTheDocument();
  });

  it('sem descrição, o título é o nome da categoria', () => {
    renderizar([{ ...PADARIA, args: { ...PADARIA.args, descricao: null } }]);
    const link = screen.getByRole('link');
    expect(link.querySelector('[class*="item-titulo"]')?.textContent ?? link.textContent).toMatch(
      /Almoço\/Alimentação fora/,
    );
  });

  it('item com falha também aparece', () => {
    renderizar([{ ...PADARIA, situacao: 'falhou', motivo: 'registro_invalido' }]);
    expect(screen.getByRole('link', { name: /Padaria/ })).toBeInTheDocument();
  });

  it('sem itens não renderiza nada', () => {
    const { container } = renderizar([]);
    expect(container).toBeEmptyDOMElement();
  });
});
