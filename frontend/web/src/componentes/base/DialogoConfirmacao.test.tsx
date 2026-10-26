import { describe, it, expect, vi } from 'vitest';
import { useState } from 'react';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { DialogoConfirmacao } from './DialogoConfirmacao';
import { Folha } from './Folha';

const TITULO = 'Excluir este lançamento?';
const TEXTO = 'Esta ação não pode ser desfeita.';

type Opcoes = {
  variante?: 'destrutiva' | 'neutra';
  iconeConfirmar?: 'lixo' | 'sair';
  aoConfirmar?: () => void;
  aoCancelar?: () => void;
};

function renderizarAberto(opcoes: Opcoes = {}) {
  const aoConfirmar = opcoes.aoConfirmar ?? vi.fn();
  const aoCancelar = opcoes.aoCancelar ?? vi.fn();
  render(
    <DialogoConfirmacao
      aberto
      titulo={TITULO}
      texto={TEXTO}
      rotuloConfirmar="Excluir"
      variante={opcoes.variante ?? 'destrutiva'}
      iconeConfirmar={opcoes.iconeConfirmar}
      aoConfirmar={aoConfirmar}
      aoCancelar={aoCancelar}
    />,
  );
  return { aoConfirmar, aoCancelar, dialogo: screen.getByRole('alertdialog') };
}

function ComGatilho({ aoConfirmar = () => {} }: { aoConfirmar?: () => void }) {
  const [aberto, setAberto] = useState(false);
  return (
    <>
      <button type="button" onClick={() => setAberto(true)}>
        Excluir lançamento
      </button>
      <DialogoConfirmacao
        aberto={aberto}
        titulo={TITULO}
        texto={TEXTO}
        rotuloConfirmar="Excluir"
        variante="destrutiva"
        iconeConfirmar="lixo"
        aoConfirmar={() => {
          aoConfirmar();
          setAberto(false);
        }}
        aoCancelar={() => setAberto(false)}
      />
    </>
  );
}

describe('DialogoConfirmacao: papel e textos', () => {
  it('tem role=alertdialog, aria-modal, nome = título e descrição = texto, exatos', () => {
    const { dialogo } = renderizarAberto();
    expect(dialogo).toHaveAttribute('aria-modal', 'true');
    expect(dialogo).toHaveAccessibleName(TITULO);
    expect(dialogo).toHaveAccessibleDescription(TEXTO);
    expect(within(dialogo).getByRole('heading', { level: 2 })).toHaveTextContent(TITULO);
  });

  it('fechado não renderiza o diálogo', () => {
    render(
      <DialogoConfirmacao
        aberto={false}
        titulo={TITULO}
        texto={TEXTO}
        rotuloConfirmar="Excluir"
        variante="destrutiva"
        aoConfirmar={vi.fn()}
        aoCancelar={vi.fn()}
      />,
    );
    expect(screen.queryByRole('alertdialog')).toBeNull();
  });

  it('o rótulo de cancelar padrão é "Cancelar"', () => {
    const { dialogo } = renderizarAberto();
    expect(within(dialogo).getByRole('button', { name: 'Cancelar' })).toBeInTheDocument();
  });

  it('título e texto são renderizados como texto, sem interpretar HTML', () => {
    render(
      <DialogoConfirmacao
        aberto
        titulo="<b>t</b>"
        texto="<img src=x>"
        rotuloConfirmar="Ok"
        variante="neutra"
        aoConfirmar={vi.fn()}
        aoCancelar={vi.fn()}
      />,
    );
    const dialogo = screen.getByRole('alertdialog');
    expect(dialogo).toHaveAccessibleName('<b>t</b>');
    expect(dialogo.querySelector('img')).toBeNull();
  });
});

describe('DialogoConfirmacao: variantes', () => {
  it('destrutiva: botão de perigo com o ícone pedido', () => {
    const { dialogo } = renderizarAberto({ variante: 'destrutiva', iconeConfirmar: 'lixo' });
    const confirmar = within(dialogo).getByRole('button', { name: 'Excluir' });
    expect(confirmar.className).toMatch(/perigo/);
    expect(confirmar.querySelector('use')?.getAttribute('href')).toBe('#i-lixo');
  });

  it('destrutiva com ícone sair', () => {
    const { dialogo } = renderizarAberto({ variante: 'destrutiva', iconeConfirmar: 'sair' });
    const confirmar = within(dialogo).getByRole('button', { name: 'Excluir' });
    expect(confirmar.querySelector('use')?.getAttribute('href')).toBe('#i-sair');
  });

  it('neutra: botão principal, sem perigo', () => {
    const { dialogo } = renderizarAberto({ variante: 'neutra' });
    const confirmar = within(dialogo).getByRole('button', { name: 'Excluir' });
    expect(confirmar.className).toMatch(/principal/);
    expect(confirmar.className).not.toMatch(/perigo/);
  });

  it('cancelar é sempre secundário', () => {
    const { dialogo } = renderizarAberto();
    expect(within(dialogo).getByRole('button', { name: 'Cancelar' }).className).toMatch(/secundario/);
  });
});

describe('DialogoConfirmacao: confirmação explícita', () => {
  it('o foco inicial fica em "Cancelar"', () => {
    const { dialogo } = renderizarAberto();
    expect(within(dialogo).getByRole('button', { name: 'Cancelar' })).toHaveFocus();
  });

  it('Esc chama só aoCancelar', async () => {
    const usuario = userEvent.setup();
    const { aoConfirmar, aoCancelar } = renderizarAberto();
    await usuario.keyboard('{Escape}');
    expect(aoCancelar).toHaveBeenCalledTimes(1);
    expect(aoConfirmar).not.toHaveBeenCalled();
  });

  it('clique em Cancelar chama só aoCancelar', async () => {
    const usuario = userEvent.setup();
    const { aoConfirmar, aoCancelar, dialogo } = renderizarAberto();
    await usuario.click(within(dialogo).getByRole('button', { name: 'Cancelar' }));
    expect(aoCancelar).toHaveBeenCalledTimes(1);
    expect(aoConfirmar).not.toHaveBeenCalled();
  });

  it('Enter com o foco em Cancelar não confirma', async () => {
    const usuario = userEvent.setup();
    const { aoConfirmar } = renderizarAberto();
    await usuario.keyboard('{Enter}');
    expect(aoConfirmar).not.toHaveBeenCalled();
  });

  it('clique em confirmar chama aoConfirmar uma vez', async () => {
    const usuario = userEvent.setup();
    const { aoConfirmar, aoCancelar, dialogo } = renderizarAberto();
    await usuario.click(within(dialogo).getByRole('button', { name: 'Excluir' }));
    expect(aoConfirmar).toHaveBeenCalledTimes(1);
    expect(aoCancelar).not.toHaveBeenCalled();
  });

  it('Enter com o foco no botão de confirmar confirma', async () => {
    const usuario = userEvent.setup();
    const { aoConfirmar, dialogo } = renderizarAberto();
    within(dialogo).getByRole('button', { name: 'Excluir' }).focus();
    await usuario.keyboard('{Enter}');
    expect(aoConfirmar).toHaveBeenCalledTimes(1);
  });

  it('clicar no véu não confirma nem cancela', async () => {
    const usuario = userEvent.setup();
    const { aoConfirmar, aoCancelar } = renderizarAberto();
    const veu = document.querySelector('[class*="veu"]');
    if (veu) await usuario.click(veu);
    expect(aoConfirmar).not.toHaveBeenCalled();
    expect(aoCancelar).not.toHaveBeenCalled();
  });

  it('Tab circula entre os 2 botões', async () => {
    const usuario = userEvent.setup();
    const { dialogo } = renderizarAberto();
    const cancelar = within(dialogo).getByRole('button', { name: 'Cancelar' });
    const confirmar = within(dialogo).getByRole('button', { name: 'Excluir' });
    expect(cancelar).toHaveFocus();
    await usuario.tab();
    expect(confirmar).toHaveFocus();
    await usuario.tab();
    expect(cancelar).toHaveFocus();
    await usuario.tab({ shift: true });
    expect(confirmar).toHaveFocus();
  });

  it('ao fechar, o foco volta ao gatilho', async () => {
    const usuario = userEvent.setup();
    render(<ComGatilho />);
    await usuario.click(screen.getByRole('button', { name: 'Excluir lançamento' }));
    expect(screen.getByRole('alertdialog')).toBeInTheDocument();
    await usuario.keyboard('{Escape}');
    expect(screen.queryByRole('alertdialog')).toBeNull();
    expect(screen.getByRole('button', { name: 'Excluir lançamento' })).toHaveFocus();
  });
});

describe('DialogoConfirmacao: ocupado', () => {
  function renderizarOcupado() {
    const aoConfirmar = vi.fn();
    const aoCancelar = vi.fn();
    render(
      <DialogoConfirmacao
        aberto
        ocupado
        titulo={TITULO}
        texto={TEXTO}
        rotuloConfirmar="Excluir"
        variante="destrutiva"
        aoConfirmar={aoConfirmar}
        aoCancelar={aoCancelar}
      />,
    );
    return { aoConfirmar, aoCancelar, dialogo: screen.getByRole('alertdialog') };
  }

  it('confirmar fica inerte com o mesmo nome acessível; cancelar desabilitado', async () => {
    const usuario = userEvent.setup();
    const { aoConfirmar, aoCancelar, dialogo } = renderizarOcupado();
    const confirmar = within(dialogo).getByRole('button', { name: 'Excluir' });
    expect(confirmar).toHaveAttribute('aria-disabled', 'true');
    expect(within(dialogo).getByRole('button', { name: 'Cancelar' })).toBeDisabled();
    await usuario.click(confirmar);
    await usuario.click(within(dialogo).getByRole('button', { name: 'Cancelar' }));
    expect(aoConfirmar).not.toHaveBeenCalled();
    expect(aoCancelar).not.toHaveBeenCalled();
  });

  it('Esc não cancela enquanto ocupado', async () => {
    const usuario = userEvent.setup();
    const { aoCancelar } = renderizarOcupado();
    await usuario.keyboard('{Escape}');
    expect(aoCancelar).not.toHaveBeenCalled();
  });
});

describe('DialogoConfirmacao sobre a Folha', () => {
  function FolhaComDialogo() {
    const [dialogo, setDialogo] = useState(false);
    return (
      <Folha aberta aoFechar={() => {}} titulo="Lançamento">
        <button type="button" onClick={() => setDialogo(true)}>
          Sair sem salvar
        </button>
        <DialogoConfirmacao
          aberto={dialogo}
          titulo="Descartar alterações?"
          texto="As alterações feitas serão perdidas."
          rotuloConfirmar="Descartar"
          variante="neutra"
          aoConfirmar={() => setDialogo(false)}
          aoCancelar={() => setDialogo(false)}
        />
      </Folha>
    );
  }

  it('Tab fica preso no diálogo enquanto ele está aberto', async () => {
    const usuario = userEvent.setup();
    render(<FolhaComDialogo />);
    await usuario.click(screen.getByRole('button', { name: 'Sair sem salvar' }));
    const dialogo = screen.getByRole('alertdialog');
    for (let i = 0; i < 4; i++) {
      await usuario.tab();
      expect(dialogo.contains(document.activeElement)).toBe(true);
    }
  });

  it('Esc com o diálogo aberto não fecha a folha por baixo', async () => {
    const usuario = userEvent.setup();
    const aoFecharFolha = vi.fn();
    function Pilha() {
      const [aberto, setAberto] = useState(false);
      return (
        <Folha aberta aoFechar={aoFecharFolha} titulo="Lançamento">
          <button type="button" onClick={() => setAberto(true)}>
            Abrir
          </button>
          <DialogoConfirmacao
            aberto={aberto}
            titulo="T"
            texto="X"
            rotuloConfirmar="Ok"
            variante="neutra"
            aoConfirmar={() => setAberto(false)}
            aoCancelar={() => setAberto(false)}
          />
        </Folha>
      );
    }
    render(<Pilha />);
    await usuario.click(screen.getByRole('button', { name: 'Abrir' }));
    expect(screen.getByRole('alertdialog')).toBeInTheDocument();
    await usuario.keyboard('{Escape}');
    expect(screen.queryByRole('alertdialog')).toBeNull();
    expect(aoFecharFolha).not.toHaveBeenCalled();
  });

  it('fechar o diálogo mantém a folha aberta, com-folha no <html> e o foco no gatilho dentro da folha', async () => {
    const usuario = userEvent.setup();
    render(<FolhaComDialogo />);
    const gatilho = screen.getByRole('button', { name: 'Sair sem salvar' });
    await usuario.click(gatilho);
    expect(screen.getByRole('alertdialog')).toBeInTheDocument();
    await usuario.keyboard('{Escape}');
    expect(screen.queryByRole('alertdialog')).toBeNull();
    expect(screen.getByRole('dialog', { name: 'Lançamento' })).toBeInTheDocument();
    expect(document.documentElement).toHaveClass('com-folha');
    expect(gatilho).toHaveFocus();
  });
});
