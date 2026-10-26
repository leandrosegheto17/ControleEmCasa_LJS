import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import type { SaidaDadosLancamento as DadosLancamento } from '@controle/contrato';
import { lerResposta } from '../../../test/apoio/fetchSimulado';
import { SecaoCategoria } from './SecaoCategoria';

const categorias = lerResposta<DadosLancamento>('dados-lancamento.json').categorias_despesa;

const OUTROS_DA_CASA = '00000000-0000-4000-8000-000000000405';

function Controlado({ aoMudar }: { aoMudar: (id: string) => void }) {
  const [valor, setValor] = useState<string | null>(null);
  return (
    <SecaoCategoria
      categorias={categorias}
      valor={valor}
      aoMudar={(id: string) => {
        setValor(id);
        aoMudar(id);
      }}
    />
  );
}

function botaoOutras() {
  return screen.getByRole('button', { name: /^Outras…/ });
}

function grupoDaLista(nome: string) {
  return screen.queryByRole('group', { name: nome }) ?? screen.getByRole('region', { name: nome });
}

function itens(raiz: HTMLElement) {
  for (const papel of ['option', 'radio', 'button'] as const) {
    const achados = within(raiz).queryAllByRole(papel);
    if (achados.length > 0) return achados;
  }
  return [];
}

async function abrir() {
  const user = userEvent.setup();
  const aoMudar = vi.fn();
  render(<Controlado aoMudar={aoMudar} />);
  await user.click(botaoOutras());
  return { user, aoMudar };
}

describe('ListaCategorias ("Outras…")', () => {
  it('abre com o foco no campo de busca', async () => {
    await abrir();

    const busca = document.activeElement as HTMLInputElement;
    expect(busca.tagName).toBe('INPUT');
    expect(['text', 'search']).toContain(busca.type);
  });

  it('agrupa todas as categorias em "Casa" (6) e "Minhas" (4)', async () => {
    await abrir();

    expect(itens(grupoDaLista('Casa'))).toHaveLength(6);
    expect(itens(grupoDaLista('Minhas'))).toHaveLength(4);
    expect(within(grupoDaLista('Casa')).getByText('Outros da casa')).toBeInTheDocument();
    expect(within(grupoDaLista('Minhas')).getByText(/^Outros$/)).toBeInTheDocument();
  });

  it('busca "outros" deixa 2 itens, um em cada grupo', async () => {
    const { user } = await abrir();

    await user.keyboard('outros');

    expect(itens(grupoDaLista('Casa'))).toHaveLength(1);
    expect(itens(grupoDaLista('Minhas'))).toHaveLength(1);
  });

  it('grupo sem resultado some', async () => {
    const { user } = await abrir();

    await user.keyboard('merc');

    expect(itens(grupoDaLista('Casa'))).toHaveLength(1);
    expect(screen.queryByRole('group', { name: 'Minhas' })).not.toBeInTheDocument();
    expect(screen.queryByRole('region', { name: 'Minhas' })).not.toBeInTheDocument();
  });

  it('nenhum resultado mostra "Nenhuma categoria encontrada"', async () => {
    const { user } = await abrir();

    await user.keyboard('xyzw');

    expect(screen.getByText('Nenhuma categoria encontrada')).toBeInTheDocument();
  });

  it('escolher "Outros da casa" marca, fecha e mostra a escolhida no 9º chip', async () => {
    const { user, aoMudar } = await abrir();

    await user.click(within(grupoDaLista('Casa')).getByText('Outros da casa'));

    expect(aoMudar).toHaveBeenCalledWith(OUTROS_DA_CASA);
    expect(screen.queryByRole('group', { name: 'Casa' })).not.toBeInTheDocument();
    expect(screen.queryByRole('region', { name: 'Casa' })).not.toBeInTheDocument();
    const grade = screen.getByRole('radiogroup', { name: 'Categoria' });
    expect(within(grade).getAllByRole('radio')).toHaveLength(8);
    expect(within(grade).getByText('Outros da casa')).toBeInTheDocument();
  });

  it('Esc fecha sem mudar e devolve o foco ao "Outras…"', async () => {
    const { user, aoMudar } = await abrir();

    await user.keyboard('{Escape}');

    expect(aoMudar).not.toHaveBeenCalled();
    expect(screen.queryByText('Nenhuma categoria encontrada')).not.toBeInTheDocument();
    expect(document.activeElement).toBe(botaoOutras());
  });
});
