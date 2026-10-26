import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { GrupoChips } from './GrupoChips';

const classe = (nome: string) => new RegExp(`(^|\\s|_)${nome}(_|\\s|$)`);

const parcelas = [
  { valor: '1', conteudo: 'À vista' },
  { valor: '2', conteudo: '2x' },
  { valor: '3', conteudo: '3x' },
];

function montar(variante: 'grade' | 'linha', valor = '3') {
  return render(
    <GrupoChips
      nome="parcelas"
      rotulo="Parcelas"
      variante={variante}
      opcoes={parcelas}
      valor={valor}
      aoMudar={vi.fn()}
    />,
  );
}

const chipDe = (nome: string) => screen.getByRole('radio', { name: nome }).closest('label') as HTMLElement;

describe('ChipOpcao', () => {
  it('é um label.chip que envolve o rádio nativo', () => {
    montar('grade');

    const chip = chipDe('3x');
    expect(chip.className).toMatch(classe('chip'));
    expect(chip.querySelector('input[type="radio"]')).not.toBeNull();
  });

  it('o ícone de marcado aparece só no chip marcado', () => {
    montar('grade', '3');

    expect(screen.getByRole('radio', { name: '3x' })).toBeChecked();
    const marcado = chipDe('3x').querySelector('svg use[href="#i-marcado"]');
    expect(marcado).not.toBeNull();
    expect(marcado?.closest('svg')).toHaveAttribute('aria-hidden', 'true');
    expect(marcado?.closest('svg')?.getAttribute('class') ?? '').toMatch(classe('chip-marcado'));

    expect(chipDe('À vista').querySelector('use[href="#i-marcado"]')).toBeNull();
    expect(chipDe('2x').querySelector('use[href="#i-marcado"]')).toBeNull();
  });

  it('variante grade usa o contêiner .chips (chip de 64 px)', () => {
    montar('grade');

    const conteiner = chipDe('3x').parentElement as HTMLElement;
    expect(conteiner.className).toMatch(classe('chips'));
    expect(conteiner.className).not.toMatch(classe('chips-linha'));
  });

  it('variante linha usa o contêiner .chips-linha (chip de 44 px)', () => {
    montar('linha');

    const conteiner = chipDe('3x').parentElement as HTMLElement;
    expect(conteiner.className).toMatch(classe('chips-linha'));
  });

  it('sem atributo style inline', () => {
    const { container } = montar('grade');

    expect(container.querySelector('[style]')).toBeNull();
  });
});
