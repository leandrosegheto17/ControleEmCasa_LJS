import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { useInstalar } from './ContextoInstalar';
import { ProvedorInstalar } from './ProvedorInstalar';

type Props = Partial<Omit<Parameters<typeof ProvedorInstalar>[0], 'children'>>;

function Consumidor() {
  const { faixa, instalar } = useInstalar();
  return (
    <>
      {faixa}
      <button type="button" onClick={instalar}>
        Abrir de fora
      </button>
    </>
  );
}

function montar(props: Props = {}, url = '/') {
  const aoPedirPrompt = vi.fn();
  const aoDispensar = vi.fn();
  render(
    <MemoryRouter initialEntries={[url]}>
      <ProvedorInstalar
        plataforma="ios"
        instalado={false}
        temPrompt={false}
        mostrarFaixa
        aoPedirPrompt={aoPedirPrompt}
        aoDispensar={aoDispensar}
        {...props}
      >
        <Consumidor />
      </ProvedorInstalar>
    </MemoryRouter>,
  );
  return { aoPedirPrompt, aoDispensar };
}

describe('ProvedorInstalar', () => {
  it('iOS: "Instalar" da faixa abre a folha com os passos', () => {
    montar();
    fireEvent.click(screen.getByRole('button', { name: 'Instalar' }));
    expect(screen.getByRole('dialog', { name: 'Instalar no iPhone' })).toBeInTheDocument();
  });

  it('Android com prompt: "Instalar" chama o prompt direto, sem folha', () => {
    const { aoPedirPrompt } = montar({ plataforma: 'android', temPrompt: true });
    fireEvent.click(screen.getByRole('button', { name: 'Instalar' }));
    expect(aoPedirPrompt).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('Android sem prompt: abre a folha com os passos manuais', () => {
    montar({ plataforma: 'android' });
    fireEvent.click(screen.getByRole('button', { name: 'Instalar' }));
    expect(screen.getByRole('dialog', { name: 'Instalar no Android' })).toBeInTheDocument();
  });

  it('sem mostrarFaixa não há faixa, mas a ação de fora ainda abre a folha', () => {
    montar({ mostrarFaixa: false });
    expect(screen.queryByRole('region', { name: 'Instalar o app' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Abrir de fora' }));
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('"Dispensar instalação" chama aoDispensar; "Agora não" só fecha a folha', () => {
    const { aoDispensar } = montar();
    fireEvent.click(screen.getByRole('button', { name: 'Dispensar instalação' }));
    expect(aoDispensar).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole('button', { name: 'Instalar' }));
    fireEvent.click(screen.getByRole('button', { name: 'Agora não' }));
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(aoDispensar).toHaveBeenCalledTimes(1);
  });

  it('?instalar=1 abre a folha', () => {
    montar({}, '/ajustes?instalar=1');
    expect(screen.getByRole('dialog', { name: 'Instalar no iPhone' })).toBeInTheDocument();
  });

  it('?instalar=1 com o app instalado não abre nada', () => {
    montar({ instalado: true, mostrarFaixa: false }, '/ajustes?instalar=1');
    expect(screen.queryByRole('dialog')).toBeNull();
  });
});
