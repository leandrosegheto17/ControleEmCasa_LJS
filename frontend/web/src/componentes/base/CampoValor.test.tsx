import { describe, it, expect, vi } from 'vitest';
import { createRef, useState } from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CampoValor } from './CampoValor';

type Props = {
  inicial?: number;
  erro?: string;
  ajuda?: string;
  desabilitado?: boolean;
  rotulo?: string;
  aoMudar?: (centavos: number) => void;
};

function Controlado({ inicial = 0, aoMudar, ...resto }: Props) {
  const [centavos, setCentavos] = useState(inicial);
  return (
    <CampoValor
      centavos={centavos}
      aoMudar={(novo) => {
        setCentavos(novo);
        aoMudar?.(novo);
      }}
      {...resto}
    />
  );
}

function renderizar(props: Props = {}) {
  const aoMudar = props.aoMudar ?? vi.fn();
  const usuario = userEvent.setup();
  render(<Controlado {...props} aoMudar={aoMudar} />);
  const campo = screen.getByLabelText(props.rotulo ?? 'Valor') as HTMLInputElement;
  return { usuario, campo, aoMudar: aoMudar as ReturnType<typeof vi.fn> };
}

function ultimoValor(aoMudar: ReturnType<typeof vi.fn>): number | undefined {
  return aoMudar.mock.calls.at(-1)?.[0] as number | undefined;
}

describe('CampoValor: entrada de centavos', () => {
  it('zero inicial exibe "R$ 0,00"', () => {
    const { campo } = renderizar();
    expect(campo).toHaveValue('R$ 0,00');
  });

  it('digitar "4590" exibe "R$ 45,90" e termina em 4590', async () => {
    const { usuario, campo, aoMudar } = renderizar();
    await usuario.type(campo, '4590');
    expect(campo).toHaveValue('R$ 45,90');
    expect(ultimoValor(aoMudar)).toBe(4590);
  });

  it('os dígitos entram pela direita', async () => {
    const { usuario, campo } = renderizar();
    await usuario.type(campo, '4');
    expect(campo).toHaveValue('R$ 0,04');
    await usuario.type(campo, '5');
    expect(campo).toHaveValue('R$ 0,45');
    await usuario.type(campo, '9');
    expect(campo).toHaveValue('R$ 4,59');
  });

  it('apagar uma vez em 4590 deixa 459 ("R$ 4,59")', async () => {
    const { usuario, campo, aoMudar } = renderizar({ inicial: 4590 });
    await usuario.type(campo, '{Backspace}');
    expect(ultimoValor(aoMudar)).toBe(459);
    expect(campo).toHaveValue('R$ 4,59');
  });

  it('apagar tudo volta a 0', async () => {
    const { usuario, campo, aoMudar } = renderizar({ inicial: 4590 });
    await usuario.clear(campo);
    expect(ultimoValor(aoMudar)).toBe(0);
    expect(campo).toHaveValue('R$ 0,00');
  });

  it('colar "R$ 1.234,56" dá 123456', async () => {
    const { usuario, campo, aoMudar } = renderizar();
    await usuario.click(campo);
    await usuario.paste('R$ 1.234,56');
    expect(ultimoValor(aoMudar)).toBe(123456);
    expect(campo).toHaveValue('R$ 1.234,56');
  });

  it('colar "4590" dá 4590', async () => {
    const { usuario, campo, aoMudar } = renderizar();
    await usuario.click(campo);
    await usuario.paste('4590');
    expect(ultimoValor(aoMudar)).toBe(4590);
  });

  it('colar "abc" não muda o valor', async () => {
    const { usuario, campo, aoMudar } = renderizar({ inicial: 4590 });
    await usuario.click(campo);
    await usuario.paste('abc');
    expect(campo).toHaveValue('R$ 45,90');
    const ultimo = ultimoValor(aoMudar);
    if (ultimo !== undefined) expect(ultimo).toBe(4590);
  });

  it('letras digitadas são ignoradas', async () => {
    const { usuario, campo, aoMudar } = renderizar();
    await usuario.type(campo, 'a1b2');
    expect(campo).toHaveValue('R$ 0,12');
    expect(ultimoValor(aoMudar)).toBe(12);
  });

  it('o resultado é sempre inteiro e nunca passa de inteiro seguro (16 dígitos)', async () => {
    const { usuario, campo, aoMudar } = renderizar();
    await usuario.type(campo, '9'.repeat(16));
    for (const [valor] of aoMudar.mock.calls) {
      expect(Number.isSafeInteger(valor)).toBe(true);
    }
    expect(ultimoValor(aoMudar)).toBe(999_999_999_999_999);
  });

  it('depois de mudar, o cursor fica no fim', async () => {
    const { usuario, campo } = renderizar();
    await usuario.type(campo, '45');
    expect(campo.selectionStart).toBe(campo.value.length);
    expect(campo.selectionEnd).toBe(campo.value.length);
  });
});

describe('CampoValor: acessibilidade e estados', () => {
  it('é achado pelo rótulo "Valor" por padrão', () => {
    renderizar();
    expect(screen.getByText('Valor').tagName).toBe('LABEL');
  });

  it('aceita outro rótulo', () => {
    const { campo } = renderizar({ rotulo: 'Valor pago' });
    expect(campo).toBeInTheDocument();
  });

  it('usa inputmode numeric, type text e autocomplete off', () => {
    const { campo } = renderizar();
    expect(campo).toHaveAttribute('inputmode', 'numeric');
    expect(campo).toHaveAttribute('type', 'text');
    expect(campo).toHaveAttribute('autocomplete', 'off');
  });

  it('a descrição acessível contém o valor formatado', async () => {
    const { usuario, campo } = renderizar();
    await usuario.type(campo, '4590');
    expect(campo).toHaveAccessibleDescription(/R\$ 45,90/);
  });

  it('com erro: aria-invalid e a mensagem na descrição', () => {
    const { campo } = renderizar({ erro: 'Informe um valor maior que zero.' });
    expect(campo).toHaveAttribute('aria-invalid', 'true');
    expect(campo).toHaveAccessibleDescription(/Informe um valor maior que zero\./);
    expect(campo).toHaveAccessibleDescription(/R\$ 0,00/);
  });

  it('sem erro: sem aria-invalid', () => {
    const { campo } = renderizar();
    expect(campo).not.toHaveAttribute('aria-invalid');
  });

  it('com ajuda: a ajuda entra na descrição', () => {
    const { campo } = renderizar({ ajuda: 'Valor de cada mês' });
    expect(campo).toHaveAccessibleDescription(/Valor de cada mês/);
  });

  it('desabilitado aplica disabled', () => {
    const { campo } = renderizar({ desabilitado: true });
    expect(campo).toBeDisabled();
  });

  it('ref.current.focus() põe o foco no campo', () => {
    const ref = createRef<HTMLInputElement>();
    render(<CampoValor ref={ref} centavos={0} aoMudar={() => {}} />);
    ref.current?.focus();
    expect(screen.getByLabelText('Valor')).toHaveFocus();
  });

  it('não move o foco sozinho ao montar', () => {
    renderizar();
    expect(screen.getByLabelText('Valor')).not.toHaveFocus();
  });
});
