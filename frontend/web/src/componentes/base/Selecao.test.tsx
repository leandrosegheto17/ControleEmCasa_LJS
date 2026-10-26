import { describe, it, expect, vi } from 'vitest';
import { createRef } from 'react';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { Selecao } from './Selecao';

const opcoes = [
  { valor: 'conta-1', rotulo: 'Nubank' },
  { valor: 'conta-2', rotulo: 'Itaú' },
];

function idsDescritos(campo: HTMLElement): string[] {
  return (campo.getAttribute('aria-describedby') ?? '').split(/\s+/).filter(Boolean);
}

describe('Selecao', () => {
  it('é um select nativo achado pelo rótulo, com as opções na ordem', () => {
    render(<Selecao rotulo="Conta" opcoes={opcoes} value="conta-1" onChange={() => {}} />);
    const campo = screen.getByLabelText('Conta');
    expect(campo.tagName).toBe('SELECT');
    const nomes = within(campo)
      .getAllByRole('option')
      .map((o) => [o.getAttribute('value'), o.textContent]);
    expect(nomes).toEqual([
      ['conta-1', 'Nubank'],
      ['conta-2', 'Itaú'],
    ]);
  });

  it('dispara a mudança com o valor escolhido', () => {
    const aoMudar = vi.fn();
    render(<Selecao rotulo="Conta" opcoes={opcoes} value="conta-1" onChange={(e) => aoMudar(e.target.value)} />);
    fireEvent.change(screen.getByLabelText('Conta'), { target: { value: 'conta-2' } });
    expect(aoMudar).toHaveBeenCalledWith('conta-2');
  });

  it('sem erro: sem aria-invalid e descrição só com a ajuda', () => {
    render(<Selecao rotulo="Conta" ajuda="Conta que paga" opcoes={opcoes} value="conta-1" onChange={() => {}} />);
    const campo = screen.getByLabelText('Conta');
    expect(campo).not.toHaveAttribute('aria-invalid');
    expect(idsDescritos(campo)).toHaveLength(1);
    expect(campo).toHaveAccessibleDescription('Conta que paga');
  });

  it('com erro: aria-invalid e aria-describedby = erro, depois ajuda', () => {
    render(
      <Selecao
        rotulo="Conta"
        erro="Escolha uma conta."
        ajuda="Conta que paga"
        opcoes={opcoes}
        value="conta-1"
        onChange={() => {}}
      />,
    );
    const campo = screen.getByLabelText('Conta');
    expect(campo).toHaveAttribute('aria-invalid', 'true');
    const [idErro, idAjuda] = idsDescritos(campo);
    expect(document.getElementById(idErro)).toHaveTextContent('Escolha uma conta.');
    expect(document.getElementById(idAjuda)).toHaveTextContent('Conta que paga');
    expect(campo).toHaveAccessibleDescription(/Escolha uma conta\./);
  });

  it('desabilitado aplica disabled', () => {
    render(<Selecao rotulo="Conta" desabilitado opcoes={opcoes} value="conta-1" onChange={() => {}} />);
    expect(screen.getByLabelText('Conta')).toBeDisabled();
  });

  it('repassa a ref', () => {
    const ref = createRef<HTMLSelectElement>();
    render(<Selecao rotulo="Conta" ref={ref} opcoes={opcoes} value="conta-1" onChange={() => {}} />);
    expect(ref.current).toBe(screen.getByLabelText('Conta'));
  });
});
