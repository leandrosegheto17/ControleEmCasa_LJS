import { describe, it, expect, vi } from 'vitest';
import { useRef, useState } from 'react';
import { flushSync } from 'react-dom';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Folha } from './Folha';

const FOCAVEIS =
  'a[href], button:not([disabled]), input:not([disabled]), select, textarea, [tabindex]:not([tabindex="-1"])';

function focaveis(raiz: HTMLElement): HTMLElement[] {
  return Array.from(raiz.querySelectorAll<HTMLElement>(FOCAVEIS));
}

function ComGatilho({ montadaOculta = false, aoFechar }: { montadaOculta?: boolean; aoFechar?: () => void }) {
  const [aberta, setAberta] = useState(false);
  return (
    <>
      <button type="button" onClick={() => setAberta(true)}>
        Abrir
      </button>
      <Folha
        aberta={aberta}
        aoFechar={() => {
          aoFechar?.();
          setAberta(false);
        }}
        titulo="Marcar como paga"
        montadaOculta={montadaOculta}
        rodape={<button type="button">Confirmar</button>}
      >
        <label>
          Valor pago
          <input inputMode="numeric" />
        </label>
      </Folha>
    </>
  );
}

function AbreEFocaNoMesmoHandler({ montadaOculta }: { montadaOculta: boolean }) {
  const [aberta, setAberta] = useState(false);
  const campo = useRef<HTMLInputElement>(null);
  return (
    <>
      <button
        type="button"
        onClick={() => {
          flushSync(() => setAberta(true));
          campo.current?.focus();
        }}
      >
        Lançar
      </button>
      <Folha aberta={aberta} aoFechar={() => setAberta(false)} titulo="Lançar" montadaOculta={montadaOculta}>
        <button type="button">Antes do valor</button>
        <label>
          Valor
          <input ref={campo} inputMode="numeric" />
        </label>
      </Folha>
    </>
  );
}

async function abrir(usuario: ReturnType<typeof userEvent.setup>) {
  await usuario.click(screen.getByRole('button', { name: 'Abrir' }));
  return screen.getByRole('dialog');
}

describe('Folha: papel e nome', () => {
  it('aberta tem role=dialog, aria-modal="true" e nome acessível = título', () => {
    render(
      <Folha aberta aoFechar={vi.fn()} titulo="Marcar como paga">
        <p>Corpo</p>
      </Folha>,
    );
    const dialogo = screen.getByRole('dialog', { name: 'Marcar como paga' });
    expect(dialogo).toHaveAttribute('aria-modal', 'true');
    expect(within(dialogo).getByRole('heading', { level: 2, name: 'Marcar como paga' })).toBeInTheDocument();
  });

  it('renderiza o corpo e o rodapé', () => {
    render(
      <Folha aberta aoFechar={vi.fn()} titulo="T" rodape={<button type="button">Confirmar</button>}>
        <p>Corpo da folha</p>
      </Folha>,
    );
    const dialogo = screen.getByRole('dialog');
    expect(within(dialogo).getByText('Corpo da folha')).toBeInTheDocument();
    expect(within(dialogo).getByRole('button', { name: 'Confirmar' })).toBeInTheDocument();
  });
});

describe('Folha: fechar', () => {
  it('Esc chama aoFechar', async () => {
    const usuario = userEvent.setup();
    const aoFechar = vi.fn();
    render(
      <Folha aberta aoFechar={aoFechar} titulo="T">
        <input aria-label="Campo" />
      </Folha>,
    );
    await usuario.keyboard('{Escape}');
    expect(aoFechar).toHaveBeenCalledTimes(1);
  });

  it('o X "Fechar" chama aoFechar', async () => {
    const usuario = userEvent.setup();
    const aoFechar = vi.fn();
    render(
      <Folha aberta aoFechar={aoFechar} titulo="T">
        <p>Corpo</p>
      </Folha>,
    );
    await usuario.click(screen.getByRole('button', { name: 'Fechar' }));
    expect(aoFechar).toHaveBeenCalledTimes(1);
  });

  it('clicar no véu não fecha', async () => {
    const usuario = userEvent.setup();
    const aoFechar = vi.fn();
    render(
      <Folha aberta aoFechar={aoFechar} titulo="T">
        <p>Corpo</p>
      </Folha>,
    );
    const veu = document.querySelector('[class*="veu"]');
    if (veu) await usuario.click(veu);
    expect(aoFechar).not.toHaveBeenCalled();
  });
});

describe('Folha: foco', () => {
  it('ao abrir, o foco vai ao 1º focável da folha', async () => {
    const usuario = userEvent.setup();
    render(<ComGatilho />);
    const dialogo = await abrir(usuario);
    expect(document.activeElement).toBe(focaveis(dialogo)[0]);
  });

  it('com focoInicial, o foco vai ao elemento do seletor; sem achá-lo, ao 1º focável', () => {
    const { rerender } = render(
      <Folha aberta aoFechar={vi.fn()} titulo="T" focoInicial="#alvo">
        <button type="button">Primeiro</button>
        <input id="alvo" aria-label="Alvo" />
      </Folha>,
    );
    expect(screen.getByLabelText('Alvo')).toHaveFocus();

    rerender(
      <Folha aberta={false} aoFechar={vi.fn()} titulo="T" focoInicial="#nao-existe">
        <button type="button">Primeiro</button>
      </Folha>,
    );
    rerender(
      <Folha aberta aoFechar={vi.fn()} titulo="T" focoInicial="#nao-existe">
        <button type="button">Primeiro</button>
      </Folha>,
    );
    expect(screen.getByRole('button', { name: 'Fechar' })).toHaveFocus();
  });

  it('ao fechar com Esc, o foco volta ao gatilho', async () => {
    const usuario = userEvent.setup();
    render(<ComGatilho />);
    await abrir(usuario);
    await usuario.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(screen.getByRole('button', { name: 'Abrir' })).toHaveFocus();
  });

  it('ao fechar pelo X, o foco volta ao gatilho', async () => {
    const usuario = userEvent.setup();
    render(<ComGatilho />);
    await abrir(usuario);
    await usuario.click(screen.getByRole('button', { name: 'Fechar' }));
    expect(screen.getByRole('button', { name: 'Abrir' })).toHaveFocus();
  });

  it('Tab no último focável volta ao 1º e Shift+Tab no 1º vai ao último', async () => {
    const usuario = userEvent.setup();
    render(<ComGatilho />);
    const dialogo = await abrir(usuario);
    const lista = focaveis(dialogo);
    const primeiro = lista[0];
    const ultimo = lista[lista.length - 1];
    ultimo.focus();
    await usuario.tab();
    expect(primeiro).toHaveFocus();
    await usuario.tab({ shift: true });
    expect(ultimo).toHaveFocus();
  });

  it.each([true, false])(
    'abrir e focar um campo interno no mesmo handler deixa o foco nele (montadaOculta=%s)',
    async (montadaOculta) => {
      const usuario = userEvent.setup();
      render(<AbreEFocaNoMesmoHandler montadaOculta={montadaOculta} />);
      await usuario.click(screen.getByRole('button', { name: 'Lançar' }));
      const dialogo = screen.getByRole('dialog', { name: 'Lançar' });
      const valor = within(dialogo).getByLabelText('Valor');
      expect(valor).toHaveFocus();
      await new Promise((r) => setTimeout(r, 0));
      expect(valor).toHaveFocus();
    },
  );
});

describe('Folha: montada e oculta', () => {
  it('fechada com montadaOculta continua no DOM, hidden e fora da árvore de acessibilidade', () => {
    render(
      <Folha aberta={false} montadaOculta aoFechar={vi.fn()} titulo="Lançar">
        <input aria-label="Valor" />
      </Folha>,
    );
    expect(screen.queryByRole('dialog')).toBeNull();
    const campo = document.querySelector('input[aria-label="Valor"]') as HTMLElement;
    expect(campo).not.toBeNull();
    expect(campo.closest('[hidden]')).not.toBeNull();
    expect(screen.queryByRole('textbox', { name: 'Valor' })).toBeNull();
  });

  it('fechada sem a opção não fica no DOM', () => {
    render(
      <Folha aberta={false} aoFechar={vi.fn()} titulo="Lançar">
        <input aria-label="Valor" />
      </Folha>,
    );
    expect(document.querySelector('input[aria-label="Valor"]')).toBeNull();
  });

  it('montadaOculta preserva o estado interno entre aberturas', async () => {
    const usuario = userEvent.setup();
    const { rerender } = render(
      <Folha aberta montadaOculta aoFechar={vi.fn()} titulo="Lançar">
        <input aria-label="Descrição" />
      </Folha>,
    );
    await usuario.type(screen.getByLabelText('Descrição'), 'Mercado');
    rerender(
      <Folha aberta={false} montadaOculta aoFechar={vi.fn()} titulo="Lançar">
        <input aria-label="Descrição" />
      </Folha>,
    );
    rerender(
      <Folha aberta montadaOculta aoFechar={vi.fn()} titulo="Lançar">
        <input aria-label="Descrição" />
      </Folha>,
    );
    expect(screen.getByLabelText('Descrição')).toHaveValue('Mercado');
  });
});

describe('Folha: trava de rolagem', () => {
  it('põe com-folha no <html> enquanto aberta e tira ao fechar', async () => {
    const usuario = userEvent.setup();
    render(<ComGatilho />);
    expect(document.documentElement).not.toHaveClass('com-folha');
    await abrir(usuario);
    expect(document.documentElement).toHaveClass('com-folha');
    await usuario.keyboard('{Escape}');
    expect(document.documentElement).not.toHaveClass('com-folha');
  });

  it('montada e oculta não trava a rolagem', () => {
    render(
      <Folha aberta={false} montadaOculta aoFechar={vi.fn()} titulo="T">
        <p>Corpo</p>
      </Folha>,
    );
    expect(document.documentElement).not.toHaveClass('com-folha');
  });

  it('desmontar aberta libera a trava', () => {
    const { unmount } = render(
      <Folha aberta aoFechar={vi.fn()} titulo="T">
        <p>Corpo</p>
      </Folha>,
    );
    expect(document.documentElement).toHaveClass('com-folha');
    unmount();
    expect(document.documentElement).not.toHaveClass('com-folha');
  });
});
