import { readFileSync } from 'node:fs';
import { render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { describe, expect, it, vi } from 'vitest';
import { FormularioLancamento } from './FormularioLancamento';

const RESPOSTAS = new URL('../../../test/fixtures/respostas/', import.meta.url);
const ler = (nome: string): Record<string, unknown> =>
  JSON.parse(readFileSync(new URL(nome, RESPOSTAS), 'utf8')) as Record<string, unknown>;

const PAGADOR = ler('lancamento-pagador.json');
const OUTRO = ler('lancamento-outro-membro.json');
const DADOS = ler('dados-lancamento.json') as { categorias_despesa: unknown[]; formas: unknown[] };

function renderizar(lancamento: Record<string, unknown>) {
  const aoSalvar = vi.fn();
  const resultado = render(
    <MemoryRouter>
      <FormularioLancamento
        lancamento={lancamento as never}
        categorias={DADOS.categorias_despesa as never}
        formas={DADOS.formas as never}
        aoSalvar={aoSalvar}
      />
    </MemoryRouter>,
  );
  return { ...resultado, aoSalvar };
}

const NOTA = 'Forma de pagamento e parcelas: só quem pagou pode alterar.';
const AJUDA = 'Trocar para uma categoria "Eu" tira a despesa da Casa (só quem lançou pode).';

describe('FormularioLancamento: pagador', () => {
  it('mostra os 6 campos com os valores atuais', () => {
    const { container } = renderizar(PAGADOR);
    expect(container.querySelector('#valor-total')).toHaveValue('R$ 1.950,00');
    expect(container.querySelector('#categoria')).not.toBeNull();
    expect(container.querySelector('#descricao')).toHaveValue('Geladeira nova');
    expect(container.querySelector('#data-compra')).toHaveValue('2026-08-20');
    expect(container.querySelector('#parcelas')).not.toBeNull();
    expect(screen.getByRole('button', { name: /Forma de pagamento.*Cartão de crédito XP/ })).toBeInTheDocument();
  });

  it('rótulos do mockup', () => {
    renderizar(PAGADOR);
    expect(screen.getByLabelText('Valor total da compra')).toBeInTheDocument();
    expect(screen.getByLabelText('Categoria')).toBeInTheDocument();
    expect(screen.getByLabelText('Descrição')).toBeInTheDocument();
    expect(screen.getByLabelText('Data da compra')).toBeInTheDocument();
    expect(screen.getByLabelText('Parcelas')).toBeInTheDocument();
  });

  it('parcelas de 1x a 24x com 3x selecionado', () => {
    renderizar(PAGADOR);
    const parcelas = screen.getByLabelText('Parcelas') as HTMLSelectElement;
    const opcoes = within(parcelas).getAllByRole('option');
    expect(opcoes).toHaveLength(24);
    expect(opcoes[0]).toHaveTextContent('1x');
    expect(opcoes[23]).toHaveTextContent('24x');
    expect((parcelas.selectedOptions[0] as HTMLOptionElement).textContent).toBe('3x');
  });

  it('todas as categorias de despesa e a atual selecionada', () => {
    renderizar(PAGADOR);
    const categoria = screen.getByLabelText('Categoria') as HTMLSelectElement;
    expect(within(categoria).getAllByRole('option')).toHaveLength(DADOS.categorias_despesa.length);
    expect(categoria.value).toBe('00000000-0000-4000-8000-000000000403');
  });

  it('ajuda da categoria só na conjunta, e nenhuma nota de campos restritos', () => {
    renderizar(PAGADOR);
    expect(screen.getByText(AJUDA)).toBeInTheDocument();
    expect(screen.queryByText(NOTA)).toBeNull();
  });

  it('fora do crédito, o campo de parcelas não é renderizado', () => {
    const pix = {
      ...PAGADOR,
      num_parcelas: 1,
      pagamento: {
        forma: { id: '00000000-0000-4000-8000-000000000301', nome: 'Pix Nubank', tipo: 'pix' },
        conta: { id: '00000000-0000-4000-8000-000000000201', nome: 'Nubank' },
        data_operacao: '2026-10-08',
        dia_vencimento_aplicado: null,
      },
    };
    const { container } = renderizar(pix);
    expect(container.querySelector('#parcelas')).toBeNull();
    expect(container.querySelector('#data-compra')).not.toBeNull();
  });

  it('botão "Salvar alterações"', () => {
    renderizar(PAGADOR);
    expect(screen.getByRole('button', { name: 'Salvar alterações' })).toBeInTheDocument();
  });
});

describe('FormularioLancamento: outro membro', () => {
  it('data, parcelas e forma não existem no DOM (nem desabilitados)', () => {
    const { container } = renderizar(OUTRO);
    expect(container.querySelector('#data-compra')).toBeNull();
    expect(container.querySelector('#parcelas')).toBeNull();
    expect(screen.queryByRole('button', { name: /Forma de pagamento/ })).toBeNull();
    expect(screen.queryByLabelText('Data da compra')).toBeNull();
    expect(screen.queryByLabelText('Parcelas')).toBeNull();
    expect(container.querySelector('[disabled]')).toBeNull();
  });

  it('valor, categoria e descrição continuam editáveis', () => {
    const { container } = renderizar(OUTRO);
    expect(container.querySelector('#valor-total')).toHaveValue('R$ 1.950,00');
    expect(container.querySelector('#categoria')).not.toBeNull();
    expect(container.querySelector('#descricao')).toHaveValue('Geladeira nova');
  });

  it('a nota de campos restritos é texto', () => {
    renderizar(OUTRO);
    const nota = screen.getByText(NOTA);
    expect(nota.tagName).toBe('P');
  });

  it('categorias só da casa (6 opções) e sem a ajuda de trocar para "Eu"', () => {
    renderizar(OUTRO);
    const categoria = screen.getByLabelText('Categoria') as HTMLSelectElement;
    const opcoes = within(categoria)
      .getAllByRole('option')
      .map((o) => o.textContent);
    expect(opcoes).toHaveLength(6);
    for (const texto of opcoes) expect(texto).toMatch(/Casa/);
    expect(opcoes.join()).not.toMatch(/Lazer pessoal/);
    expect(screen.queryByText(AJUDA)).toBeNull();
  });

  it('não mostra nada sobre forma, conta ou data da compra', () => {
    const { container } = renderizar(OUTRO);
    expect(container).not.toHaveTextContent(/Cartão de crédito XP|Nubank|20\/08|Crédito/);
  });
});
