import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import type { SaidaDadosLancamento as DadosLancamento } from '@controle/contrato';
import { lerResposta } from '../../../test/apoio/fetchSimulado';
import { SecaoForma } from './SecaoForma';

const formas = lerResposta<DadosLancamento>('dados-lancamento.json').formas;

const PIX = '00000000-0000-4000-8000-000000000301';
const XP = '00000000-0000-4000-8000-000000000303';

function Controlado({ aoMudar }: { aoMudar: (id: string) => void }) {
  const [valor, setValor] = useState(PIX);
  return (
    <SecaoForma
      formas={formas}
      valor={valor}
      aoMudar={(id: string) => {
        setValor(id);
        aoMudar(id);
      }}
    />
  );
}

function opcao(nome: RegExp) {
  const radios = screen.queryAllByRole('radio');
  const lista = radios.length > 0 ? radios : screen.getAllByRole('option');
  const achada = lista.find((o) => nome.test(o.closest('label')?.textContent ?? o.textContent ?? ''));
  if (!achada) throw new Error(`opção ${nome} não encontrada`);
  return achada;
}

function textoDe(el: HTMLElement) {
  return el.closest('label')?.textContent ?? el.textContent ?? '';
}

describe('SecaoForma', () => {
  it('mostra o botão "Pix Nubank · Pix" com o rótulo da forma', () => {
    render(<Controlado aoMudar={vi.fn()} />);

    const botao = screen.getByRole('button', { name: /^Forma de pagamento/ });
    expect(botao).toHaveAccessibleName('Forma de pagamento Pix Nubank · Pix');
    expect(document.getElementById('forma-rotulo')).toBeInTheDocument();
    expect(document.getElementById('forma-atual')).toBeInTheDocument();
  });

  it('o tipo vem dos rótulos: Débito e Crédito', async () => {
    const user = userEvent.setup();
    render(<Controlado aoMudar={vi.fn()} />);

    await user.click(screen.getByRole('button', { name: /^Forma de pagamento/ }));

    expect(textoDe(opcao(/Débito Itaú/))).toMatch(/Débito Itaú.*Débito/);
    expect(textoDe(opcao(/Cartão de crédito XP/))).toMatch(/Cartão de crédito XP.*Crédito/);
  });

  it('escolher "Cartão de crédito XP" em 2 toques chama aoMudar', async () => {
    const user = userEvent.setup();
    const aoMudar = vi.fn();
    render(<Controlado aoMudar={aoMudar} />);

    await user.click(screen.getByRole('button', { name: /^Forma de pagamento/ }));
    await user.click(opcao(/Cartão de crédito XP/));

    expect(aoMudar).toHaveBeenCalledTimes(1);
    expect(aoMudar).toHaveBeenCalledWith(XP);
    expect(screen.getByRole('button', { name: /^Forma de pagamento/ })).toHaveAccessibleName(
      'Forma de pagamento Cartão de crédito XP · Crédito',
    );
  });
});
