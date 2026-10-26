import { describe, it, expect, vi } from 'vitest';
import { createRef } from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { CampoData } from './CampoData';

function idsDescritos(campo: HTMLElement): string[] {
  return (campo.getAttribute('aria-describedby') ?? '').split(/\s+/).filter(Boolean);
}

describe('CampoData', () => {
  it('é um input type=date achado pelo rótulo', () => {
    render(<CampoData rotulo="Data" value="2026-10-09" onChange={() => {}} />);
    const campo = screen.getByLabelText('Data');
    expect(campo).toHaveAttribute('type', 'date');
    expect(campo).toHaveValue('2026-10-09');
  });

  it('mudança entrega o valor no formato AAAA-MM-DD', () => {
    const aoMudar = vi.fn();
    render(<CampoData rotulo="Data" value="2026-10-09" onChange={(e) => aoMudar(e.target.value)} />);
    fireEvent.change(screen.getByLabelText('Data'), { target: { value: '2026-10-01' } });
    expect(aoMudar).toHaveBeenCalledWith('2026-10-01');
  });

  it('sem erro: sem aria-invalid e descrição só com a ajuda', () => {
    render(<CampoData rotulo="Data" ajuda="Data da compra" value="" onChange={() => {}} />);
    const campo = screen.getByLabelText('Data');
    expect(campo).not.toHaveAttribute('aria-invalid');
    expect(idsDescritos(campo)).toHaveLength(1);
    expect(campo).toHaveAccessibleDescription('Data da compra');
  });

  it('com erro: aria-invalid e aria-describedby = erro, depois ajuda', () => {
    render(<CampoData rotulo="Data" erro="Informe a data." ajuda="Data da compra" value="" onChange={() => {}} />);
    const campo = screen.getByLabelText('Data');
    expect(campo).toHaveAttribute('aria-invalid', 'true');
    const [idErro, idAjuda] = idsDescritos(campo);
    expect(document.getElementById(idErro)).toHaveTextContent('Informe a data.');
    expect(document.getElementById(idAjuda)).toHaveTextContent('Data da compra');
    expect(campo).toHaveAccessibleDescription(/Informe a data\./);
  });

  it('desabilitado aplica disabled', () => {
    render(<CampoData rotulo="Data" desabilitado value="" onChange={() => {}} />);
    expect(screen.getByLabelText('Data')).toBeDisabled();
  });

  it('repassa a ref', () => {
    const ref = createRef<HTMLInputElement>();
    render(<CampoData rotulo="Data" ref={ref} value="" onChange={() => {}} />);
    expect(ref.current).toBe(screen.getByLabelText('Data'));
  });
});
