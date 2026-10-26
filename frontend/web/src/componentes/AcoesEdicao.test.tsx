import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { AcoesEdicao } from './AcoesEdicao';

function montar(sobrescrever: { emUso?: boolean; podeExcluir?: boolean } = {}) {
  const acoes = {
    emUso: sobrescrever.emUso ?? false,
    salvando: false,
    arquivando: false,
    arquivar: vi.fn(),
    cancelarEmUso: vi.fn(),
    excluir: vi.fn(),
  };
  render(
    <AcoesEdicao
      acoes={acoes}
      podeExcluir={sobrescrever.podeExcluir ?? false}
      rotuloArquivarEmUso="Arquivar conta"
      tituloExclusao="Excluir esta conta?"
      textoExclusao="Não dá para desfazer."
    />,
  );
  return acoes;
}

describe('AcoesEdicao', () => {
  it('sem podeExcluir não mostra Excluir', () => {
    montar();
    expect(screen.getByRole('button', { name: 'Salvar' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Arquivar' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Excluir' })).toBeNull();
  });

  it('com podeExcluir exige confirmação antes de excluir', () => {
    const acoes = montar({ podeExcluir: true });
    fireEvent.click(screen.getByRole('button', { name: 'Excluir' }));
    expect(acoes.excluir).not.toHaveBeenCalled();
    const dialogo = screen.getByRole('alertdialog');
    expect(dialogo.textContent).toContain('Excluir esta conta?');
    fireEvent.click(screen.getAllByRole('button', { name: 'Excluir' }).at(-1)!);
    expect(acoes.excluir).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('alertdialog')).toBeNull();
  });

  it('cancelar o diálogo não exclui', () => {
    const acoes = montar({ podeExcluir: true });
    fireEvent.click(screen.getByRole('button', { name: 'Excluir' }));
    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }));
    expect(acoes.excluir).not.toHaveBeenCalled();
    expect(screen.queryByRole('alertdialog')).toBeNull();
  });

  it('em uso mostra o arquivar com rótulo e Cancelar, sem Salvar nem Excluir', () => {
    const acoes = montar({ emUso: true, podeExcluir: true });
    fireEvent.click(screen.getByRole('button', { name: 'Arquivar conta' }));
    expect(acoes.arquivar).toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }));
    expect(acoes.cancelarEmUso).toHaveBeenCalled();
    expect(screen.queryByRole('button', { name: 'Salvar' })).toBeNull();
  });
});
