import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { ListaMembros } from './ListaMembros';

/**
 * Botões de remover o membro e sair da casa (etapa 18). Spec: remover, critérios 1 e 8; sair, critérios 1 e 8;
 * sem conexão, critério 1; caso limite do titular sozinho. A lista só avisa o pai: nenhuma chamada de API aqui.
 */

const TITULAR_EU = { id: '00000000-0000-4000-8000-0000000000a1', nome: 'Ana', papel: 'titular', sou_eu: true } as const;
const MEMBRO_OUTRO = {
  id: '00000000-0000-4000-8000-0000000000b2',
  nome: 'Bia',
  papel: 'membro',
  sou_eu: false,
} as const;
const TITULAR_OUTRO = { ...TITULAR_EU, sou_eu: false } as const;
const MEMBRO_EU = { ...MEMBRO_OUTRO, sou_eu: true } as const;

const AVISO = 'Precisa de conexão para esta ação';

function montar(membros: Parameters<typeof ListaMembros>[0]['membros'], conectado = true) {
  const aoRemover = vi.fn();
  const aoSair = vi.fn();
  render(<ListaMembros membros={membros} conectado={conectado} aoRemover={aoRemover} aoSair={aoSair} />);
  const itens = within(screen.getByRole('region', { name: 'Membros' })).getAllByRole('listitem');
  return { aoRemover, aoSair, itens };
}

describe('ListaMembros: titular', () => {
  it('vê "Remover" só no outro membro e nunca "Sair da casa"; o toque avisa o pai com o id do membro', async () => {
    const { aoRemover, aoSair, itens } = montar([TITULAR_EU, MEMBRO_OUTRO]);

    expect(within(itens[0] as HTMLElement).queryByRole('button')).not.toBeInTheDocument();
    const remover = within(itens[1] as HTMLElement).getByRole('button', { name: 'Remover' });
    expect(screen.getAllByRole('button', { name: 'Remover' })).toHaveLength(1);
    expect(screen.queryByRole('button', { name: 'Sair da casa' })).not.toBeInTheDocument();

    await userEvent.click(remover);

    expect(aoRemover).toHaveBeenCalledExactlyOnceWith(MEMBRO_OUTRO.id);
    expect(aoSair).not.toHaveBeenCalled();
  });

  it('sozinho na casa não vê botão nenhum nem o aviso de conexão', () => {
    montar([TITULAR_EU], false);

    expect(screen.queryByRole('button')).not.toBeInTheDocument();
    expect(screen.queryByText(AVISO)).not.toBeInTheDocument();
  });
});

describe('ListaMembros: membro não titular', () => {
  it('vê "Sair da casa" só na própria linha e nunca "Remover"; o toque avisa o pai', async () => {
    const { aoRemover, aoSair, itens } = montar([TITULAR_OUTRO, MEMBRO_EU]);

    expect(within(itens[0] as HTMLElement).queryByRole('button')).not.toBeInTheDocument();
    const sair = within(itens[1] as HTMLElement).getByRole('button', { name: 'Sair da casa' });
    expect(screen.getAllByRole('button')).toHaveLength(1);
    expect(screen.queryByRole('button', { name: 'Remover' })).not.toBeInTheDocument();

    await userEvent.click(sair);

    expect(aoSair).toHaveBeenCalledTimes(1);
    expect(aoRemover).not.toHaveBeenCalled();
  });
});

describe('ListaMembros: sem conexão', () => {
  it('com conexão o aviso não aparece e os botões estão ativos', () => {
    montar([TITULAR_EU, MEMBRO_OUTRO]);

    expect(screen.getByRole('button', { name: 'Remover' })).toBeEnabled();
    expect(screen.queryByText(AVISO)).not.toBeInTheDocument();
  });

  it.each([
    ['titular', [TITULAR_EU, MEMBRO_OUTRO], 'Remover'],
    ['membro', [TITULAR_OUTRO, MEMBRO_EU], 'Sair da casa'],
  ] as const)('%s: o botão fica desativado, o aviso aparece e o toque não avisa o pai', async (_, membros, rotulo) => {
    const { aoRemover, aoSair } = montar(membros, false);

    const botao = screen.getByRole('button', { name: rotulo });
    expect(botao).toBeDisabled();
    expect(screen.getByText(AVISO)).toBeInTheDocument();
    expect(botao).toHaveAccessibleDescription(AVISO);

    await userEvent.click(botao);

    expect(aoRemover).not.toHaveBeenCalled();
    expect(aoSair).not.toHaveBeenCalled();
  });
});
