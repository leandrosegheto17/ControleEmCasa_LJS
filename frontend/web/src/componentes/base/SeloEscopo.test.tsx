import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { SeloEscopo } from './SeloEscopo';

// Aceita o nome cru e o nome gerado pelo CSS Module (_nome_hash).
const classe = (nome: string) => new RegExp(`(^|\\s|_)${nome}(_|\\s|$)`);
const iconeDe = (el: Element) => el.querySelector('svg use')?.getAttribute('href');

describe('SeloEscopo', () => {
  it('conjunto → selo da casa com ícone casa e texto "Casa"', () => {
    const { container } = render(<SeloEscopo escopo="conjunto" />);
    const selo = container.firstElementChild as HTMLElement;

    expect(selo.className).toMatch(classe('selo'));
    expect(selo.className).toMatch(classe('selo-escopo'));
    expect(selo.className).toMatch(classe('casa'));
    expect(iconeDe(selo)).toBe('#i-casa');
    expect(selo).toHaveTextContent(/^Casa$/);
  });

  it('individual → selo "Eu" com ícone pessoa', () => {
    const { container } = render(<SeloEscopo escopo="individual" />);
    const selo = container.firstElementChild as HTMLElement;

    expect(selo.className).toMatch(classe('eu'));
    expect(selo.className).not.toMatch(classe('casa'));
    expect(iconeDe(selo)).toBe('#i-pessoa');
    expect(selo).toHaveTextContent(/^Eu$/);
  });

  it('texto sobrescrito mantém o ícone e a classe do escopo', () => {
    const { container } = render(<SeloEscopo escopo="conjunto" texto="Da casa" />);
    const selo = container.firstElementChild as HTMLElement;

    expect(selo).toHaveTextContent(/^Da casa$/);
    expect(selo.className).toMatch(classe('casa'));
    expect(iconeDe(selo)).toBe('#i-casa');
  });

  it('o ícone é decorativo: o nome vem só do texto', () => {
    const { container } = render(<SeloEscopo escopo="individual" texto="Minha meta" />);
    const svg = container.querySelector('svg');

    expect(svg).toHaveAttribute('aria-hidden', 'true');
  });
});
