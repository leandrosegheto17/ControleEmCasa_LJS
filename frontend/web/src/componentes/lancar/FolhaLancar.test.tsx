import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createRef } from 'react';
import { MemoryRouter } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { SaidaDadosLancamento as DadosLancamento } from '@controle/contrato';
import { lerResposta } from '../../../test/apoio/fetchSimulado';
import { FolhaLancar } from './FolhaLancar';
import { SecaoCategoria } from './SecaoCategoria';
import { SecaoForma } from './SecaoForma';
import { SecaoParcelas } from './SecaoParcelas';
import { MaisDetalhes } from './MaisDetalhes';

vi.mock('./SecaoCategoria', () => ({ SecaoCategoria: vi.fn(() => null) }));
vi.mock('./SecaoForma', () => ({ SecaoForma: vi.fn(() => null) }));
vi.mock('./SecaoParcelas', () => ({ SecaoParcelas: vi.fn(() => null) }));
vi.mock('./MaisDetalhes', () => ({ MaisDetalhes: vi.fn(() => null) }));

const dados = lerResposta<DadosLancamento>('dados-lancamento.json');

type Props = Partial<React.ComponentProps<typeof FolhaLancar>>;

function montar(props: Props = {}) {
  const aoFechar = vi.fn();
  const refValor = createRef<HTMLInputElement>();
  render(
    <MemoryRouter>
      <FolhaLancar aberta aoFechar={aoFechar} refValor={refValor} {...(props as object)} />
    </MemoryRouter>,
  );
  return { aoFechar, refValor };
}

function ultimasProps(componente: unknown) {
  const chamadas = vi.mocked(componente as (p: unknown) => null).mock.calls;
  return chamadas[chamadas.length - 1]?.[0] as Record<string, unknown>;
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-10-09T15:00:00Z'));
});

afterEach(() => {
  vi.useRealTimers();
  vi.clearAllMocks();
});

describe('FolhaLancar: estrutura', () => {
  it('é um diálogo modal com nome "Lançar"', () => {
    montar({ dados });

    const folha = screen.getByRole('dialog', { name: 'Lançar' });
    expect(folha).toHaveAttribute('aria-modal', 'true');
  });

  it('ao abrir, o foco inicial fica no valor', () => {
    montar({ dados });

    expect(screen.getByLabelText('Valor')).toHaveFocus();
  });

  it('segmentado com Despesa marcada e Receita habilitada', () => {
    montar({ dados });

    const tipo = screen.getByRole('group', { name: 'Tipo de lançamento' });
    expect(within(tipo).getByRole('radio', { name: 'Despesa' })).toBeChecked();
    expect(within(tipo).getByRole('radio', { name: 'Receita' })).toBeEnabled();
  });

  it('não interfere no grupo de rádios "tipo" de outra tela montada ao lado', () => {
    render(
      <MemoryRouter>
        <fieldset>
          <input type="radio" name="tipo" value="despesa" aria-label="Despesas" defaultChecked />
          <input type="radio" name="tipo" value="receita" aria-label="Receitas" />
        </fieldset>
        <FolhaLancar aberta={false} aoFechar={vi.fn()} refValor={createRef<HTMLInputElement>()} dados={dados} />
      </MemoryRouter>,
    );

    const radios = document.querySelectorAll<HTMLInputElement>('input[type="radio"][name="tipo"]');
    expect(Array.from(radios).map((r) => r.checked)).toEqual([true, false]);
    expect(document.querySelector('input[name="tipo-lancamento"][value="despesa"]')).toBeChecked();
  });

  it('o X "Fechar" chama aoFechar', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    const { aoFechar } = montar({ dados });

    await user.click(screen.getByRole('button', { name: 'Fechar' }));

    expect(aoFechar).toHaveBeenCalledTimes(1);
  });

  it('o campo de valor tem id "valor" e recebe o ref', () => {
    const { refValor } = montar({ dados });

    const valor = screen.getByLabelText('Valor');
    expect(valor).toHaveAttribute('id', 'valor');
    expect(refValor.current).toBe(valor);
  });

  it('fechada continua montada e oculta', () => {
    render(
      <MemoryRouter>
        <FolhaLancar aberta={false} aoFechar={vi.fn()} refValor={createRef()} dados={dados} />
      </MemoryRouter>,
    );

    const folha = document.querySelector('[role="dialog"]');
    expect(folha).toBeInTheDocument();
    expect(folha).toHaveAttribute('hidden');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});

describe('FolhaLancar: arquivos-filho', () => {
  it('recebem as props definitivas, na ordem do mockup', () => {
    montar({ dados });

    expect(ultimasProps(SecaoCategoria)).toMatchObject({
      categorias: dados.categorias_despesa,
      valor: null,
      aoMudar: expect.any(Function),
    });
    expect(ultimasProps(SecaoForma)).toMatchObject({
      formas: dados.formas,
      aoMudar: expect.any(Function),
    });
    expect(ultimasProps(SecaoParcelas)).toMatchObject({
      valor: 1,
      aoMudar: expect.any(Function),
    });
    expect(ultimasProps(SecaoParcelas)).toHaveProperty('tipoForma');
    expect(ultimasProps(MaisDetalhes)).toMatchObject({
      data: '2026-10-09',
      aoMudarData: expect.any(Function),
    });
    expect(document.getElementById('descricao')).toHaveValue('');
  });

  it('sem dados, só o valor aparece', () => {
    montar({ dados: undefined });

    expect(document.getElementById('valor')).toBeInTheDocument();
    expect(SecaoCategoria).not.toHaveBeenCalled();
    expect(SecaoForma).not.toHaveBeenCalled();
    expect(SecaoParcelas).not.toHaveBeenCalled();
    expect(MaisDetalhes).not.toHaveBeenCalled();
  });
});
