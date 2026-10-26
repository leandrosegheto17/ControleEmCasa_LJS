import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { SeloSituacao } from './SeloSituacao';

const classe = (nome: string) => new RegExp(`(^|\\s|_)${nome}(_|\\s|$)`);
const iconeDe = (el: Element) => el.querySelector('svg use')?.getAttribute('href');

const casos = [
  { situacao: 'pendente', classe: 'selo-pendente', icone: '#i-relogio', texto: 'Pendente' },
  { situacao: 'atrasada', classe: 'selo-atrasada', icone: '#i-alerta', texto: 'Atrasada' },
  { situacao: 'paga', classe: 'selo-paga', icone: '#i-ok', texto: 'Paga' },
  { situacao: 'ajustada', classe: 'selo-ajustada', icone: '#i-calendario', texto: 'data ajustada' },
  { situacao: 'dentro', classe: 'selo-dentro', icone: '#i-ok', texto: 'Dentro' },
  { situacao: 'atencao', classe: 'selo-atencao', icone: '#i-aviso', texto: 'Atenção' },
  { situacao: 'estourado', classe: 'selo-estourado', icone: '#i-alerta', texto: 'Estourado' },
  { situacao: 'atingida', classe: 'selo-dentro', icone: '#i-ok', texto: 'Atingida' },
  { situacao: 'aguardando', classe: 'selo-aguardando', icone: '#i-envio', texto: 'aguardando envio' },
] as const;

describe('SeloSituacao', () => {
  it.each(casos)('$situacao → classe, ícone e texto do mockup', ({ situacao, classe: nome, icone, texto }) => {
    const { container } = render(<SeloSituacao situacao={situacao} />);
    const selo = container.firstElementChild as HTMLElement;

    expect(selo.className).toMatch(classe('selo'));
    expect(selo.className).toMatch(classe(nome));
    expect(iconeDe(selo)).toBe(icone);
    expect(selo).toHaveTextContent(new RegExp(`^${texto}$`));
  });

  it('variavel: classe e texto do mockup, sem ícone (exceção explícita)', () => {
    const { container } = render(<SeloSituacao situacao="variavel" />);
    const selo = container.firstElementChild as HTMLElement;

    expect(selo.className).toMatch(classe('selo'));
    expect(selo.className).toMatch(classe('selo-variavel'));
    expect(selo).toHaveTextContent(/^variável$/);
    expect(iconeDe(selo)).toBeUndefined();
  });

  it('texto "Paga por Ana" mantém a classe selo-paga e o ícone ok', () => {
    const { container } = render(<SeloSituacao situacao="paga" texto="Paga por Ana" />);
    const selo = container.firstElementChild as HTMLElement;

    expect(selo).toHaveTextContent(/^Paga por Ana$/);
    expect(selo.className).toMatch(classe('selo-paga'));
    expect(iconeDe(selo)).toBe('#i-ok');
  });

  it('texto vindo de quem chama é texto, não HTML', () => {
    const { container } = render(<SeloSituacao situacao="paga" texto="<b>Paga</b>" />);

    expect(container.querySelector('b')).toBeNull();
    expect(container).toHaveTextContent('<b>Paga</b>');
  });
});
