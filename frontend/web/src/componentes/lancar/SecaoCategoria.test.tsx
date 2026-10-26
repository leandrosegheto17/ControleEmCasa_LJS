import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import type { SaidaDadosLancamento as DadosLancamento } from '@controle/contrato';
import { lerResposta } from '../../../test/apoio/fetchSimulado';
import { SecaoCategoria } from './SecaoCategoria';

const categorias = lerResposta<DadosLancamento>('dados-lancamento.json').categorias_despesa;
const poucas = lerResposta<DadosLancamento>('dados-lancamento-sem-formas.json').categorias_despesa;

const ALMOCO = '00000000-0000-4000-8000-000000000411';
const MERCADO = '00000000-0000-4000-8000-000000000401';

function Controlado(props: {
  lista?: typeof categorias;
  inicial?: string | null;
  aoMudar?: (id: string) => void;
  erro?: string;
}) {
  const [valor, setValor] = useState<string | null>(props.inicial ?? null);
  return (
    <SecaoCategoria
      categorias={props.lista ?? categorias}
      valor={valor}
      erro={props.erro}
      aoMudar={(id: string) => {
        setValor(id);
        props.aoMudar?.(id);
      }}
    />
  );
}

function grupo() {
  return screen.getByRole('radiogroup', { name: 'Categoria' });
}

function chipDe(nome: string) {
  return screen
    .getByRole('radio', { name: new RegExp(`^${nome.replace(/[/]/g, '\\/')}`) })
    .closest('label') as HTMLElement;
}

describe('SecaoCategoria: grade', () => {
  it('radiogroup "Categoria" com 8 rádios na ordem recebida e o "Outras…"', () => {
    render(<Controlado />);

    const radios = within(grupo()).getAllByRole('radio');
    expect(radios).toHaveLength(8);
    const nomes = radios.map((r) => r.closest('label')?.querySelector('[class*="chip-nome"]')?.textContent);
    expect(nomes).toEqual([
      'Almoço/Alimentação fora',
      'Mercado',
      'Transporte',
      'Delivery/iFood do casal',
      'Delivery pessoal',
      'Lazer pessoal',
      'Contas da casa',
      'Moradia',
    ]);
    expect(within(grupo()).getByRole('button', { name: 'Outras…' })).toBeInTheDocument();
  });

  it('"Outros da casa" e "Outros" ficam fora da grade', () => {
    render(<Controlado />);

    expect(within(grupo()).queryByText('Outros da casa')).not.toBeInTheDocument();
    expect(within(grupo()).queryByText(/^Outros$/)).not.toBeInTheDocument();
  });

  it('cada chip mostra o selo do escopo da própria categoria', () => {
    render(<Controlado />);

    for (const c of categorias.slice(0, 8)) {
      const esperado = c.escopo === 'conjunto' ? 'Casa' : 'Eu';
      const outro = esperado === 'Casa' ? 'Eu' : 'Casa';
      const chip = chipDe(c.nome);
      expect(within(chip).getByText(esperado)).toBeInTheDocument();
      expect(within(chip).queryByText(outro)).not.toBeInTheDocument();
    }
  });

  it('seta para a direita move e seleciona a próxima (aoMudar)', async () => {
    const user = userEvent.setup();
    const aoMudar = vi.fn();
    render(<Controlado inicial={ALMOCO} aoMudar={aoMudar} />);

    screen.getByRole('radio', { name: /^Almoço/ }).focus();
    await user.keyboard('{ArrowRight}');

    expect(aoMudar).toHaveBeenLastCalledWith(MERCADO);
    expect(screen.getByRole('radio', { name: /^Mercado/ })).toBeChecked();
  });

  it('o chip marcado mostra o ícone de marcado', () => {
    render(<Controlado inicial={MERCADO} />);

    const chip = chipDe('Mercado');
    expect(within(chip).getByRole('radio')).toBeChecked();
    expect(chip.querySelector('svg[class*="chip-marcado"]')).not.toBeNull();
  });

  it('erro ligado ao grupo por aria-describedby', () => {
    render(<Controlado erro="Escolha uma categoria." />);

    expect(grupo()).toHaveAccessibleDescription('Escolha uma categoria.');
  });

  it('com 2 categorias: 2 chips e o "Outras…"', () => {
    render(<Controlado lista={poucas} />);

    expect(within(grupo()).getAllByRole('radio')).toHaveLength(2);
    expect(within(grupo()).getByRole('button', { name: 'Outras…' })).toBeInTheDocument();
  });
});
