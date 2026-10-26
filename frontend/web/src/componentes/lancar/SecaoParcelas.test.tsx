import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { SecaoParcelas } from './SecaoParcelas';

type TipoForma = 'pix' | 'debito' | 'credito';

function Controlado({
  tipoForma,
  inicial = 1,
  aoMudar = vi.fn(),
}: {
  tipoForma: TipoForma;
  inicial?: number;
  aoMudar?: (n: number) => void;
}) {
  const [valor, setValor] = useState(inicial);
  return (
    <SecaoParcelas
      tipoForma={tipoForma}
      valor={valor}
      aoMudar={(n: number) => {
        setValor(n);
        aoMudar(n);
      }}
    />
  );
}

function grupo() {
  return screen.getByRole('radiogroup', { name: 'Parcelas' });
}

function numeroDoPasso() {
  const vivo = document.querySelector('[aria-live]');
  if (!vivo) throw new Error('passo a passo sem aria-live');
  return Number((vivo.textContent ?? '').replace(/\D/g, ''));
}

function botaoMenos() {
  return screen.getByRole('button', { name: /diminuir|menos|−/i });
}

function botaoMais() {
  return screen.getByRole('button', { name: /aumentar|^mais|\+/i });
}

describe('SecaoParcelas', () => {
  it.each(['pix', 'debito'] as const)('com %s não aparece', (tipo) => {
    const { container } = render(<Controlado tipoForma={tipo} />);

    expect(screen.queryByRole('radiogroup', { name: 'Parcelas' })).not.toBeInTheDocument();
    expect(container).toBeEmptyDOMElement();
  });

  it('com Crédito: radiogroup "Parcelas" com À vista, 2x a 6x, 10x, 12x e Outro', () => {
    render(<Controlado tipoForma="credito" />);

    const nomes = within(grupo())
      .getAllByRole('radio')
      .map((r) => r.closest('label')?.textContent?.trim());
    expect(nomes).toEqual(['À vista', '2x', '3x', '4x', '5x', '6x', '10x', '12x']);
    expect(within(grupo()).getByRole('button', { name: 'Outro' })).toBeInTheDocument();
  });

  it('"À vista" marcado por padrão', () => {
    render(<Controlado tipoForma="credito" />);

    expect(within(grupo()).getByRole('radio', { name: 'À vista' })).toBeChecked();
  });

  it('mostra o texto de ajuda do cartão', () => {
    render(<Controlado tipoForma="credito" />);

    expect(screen.getByText('Entra a partir do próximo vencimento do cartão.')).toBeInTheDocument();
  });

  it('escolher 3x chama aoMudar(3)', async () => {
    const user = userEvent.setup();
    const aoMudar = vi.fn();
    render(<Controlado tipoForma="credito" aoMudar={aoMudar} />);

    await user.click(within(grupo()).getByRole('radio', { name: '3x' }));

    expect(aoMudar).toHaveBeenLastCalledWith(3);
  });

  it('trocar para Pix e voltar a Crédito fecha o "Outro" e marca À vista', async () => {
    const user = userEvent.setup();
    const { rerender } = render(<Controlado tipoForma="credito" />);
    await user.click(within(grupo()).getByRole('button', { name: 'Outro' }));
    expect(botaoMais()).toBeInTheDocument();

    rerender(<Controlado tipoForma="pix" />);
    rerender(<Controlado tipoForma="credito" />);

    expect(within(grupo()).getByRole('radio', { name: 'À vista' })).toBeChecked();
    expect(screen.queryByRole('button', { name: /aumentar/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /diminuir/i })).not.toBeInTheDocument();
  });

  describe('"Outro": passo a passo de 1 a 24', () => {
    async function abrirOutro(aoMudar = vi.fn()) {
      const user = userEvent.setup();
      render(<Controlado tipoForma="credito" aoMudar={aoMudar} />);
      await user.click(within(grupo()).getByRole('button', { name: 'Outro' }));
      return { user, aoMudar };
    }

    it('− em 1 não desce', async () => {
      const { user, aoMudar } = await abrirOutro();
      expect(numeroDoPasso()).toBe(1);

      await user.click(botaoMenos());

      expect(numeroDoPasso()).toBe(1);
      expect(aoMudar).not.toHaveBeenCalledWith(0);
    });

    it('+ em 24 não sobe', async () => {
      const { user, aoMudar } = await abrirOutro();
      for (let i = 0; i < 30 && numeroDoPasso() < 24; i++) await user.click(botaoMais());
      expect(numeroDoPasso()).toBe(24);

      await user.click(botaoMais());

      expect(numeroDoPasso()).toBe(24);
      expect(aoMudar).not.toHaveBeenCalledWith(25);
    });

    it('chegar em 7 chama aoMudar(7)', async () => {
      const { user, aoMudar } = await abrirOutro();
      for (let i = 0; i < 30 && numeroDoPasso() < 7; i++) await user.click(botaoMais());

      expect(numeroDoPasso()).toBe(7);
      expect(aoMudar).toHaveBeenLastCalledWith(7);
    });
  });
});
