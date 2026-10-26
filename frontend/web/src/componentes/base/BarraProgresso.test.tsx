import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { BarraProgresso } from './BarraProgresso';

const classe = (nome: string) => new RegExp(`(^|\\s|_)${nome}(_|\\s|$)`);
const preenchimento = (barra: HTMLElement) => barra.querySelector('span') as HTMLElement;

describe('BarraProgresso', () => {
  it.each([
    ['dentro', 'barra-dentro'],
    ['atencao', 'barra-atencao'],
    ['estourado', 'barra-estourado'],
    ['atingida', 'barra-dentro'],
    ['casa', 'barra-casa'],
    ['eu', 'barra-eu'],
  ] as const)('situação %s → classe %s', (situacao, nome) => {
    render(<BarraProgresso percentual={56} situacao={situacao} rotulo="Mercado" topo="56%" />);

    const barra = screen.getByRole('progressbar', { name: 'Mercado' });
    expect(barra.className).toMatch(classe('barra'));
    expect(barra.className).toMatch(classe(nome));
  });

  it('expõe progressbar com valor, mínimo e máximo', () => {
    render(<BarraProgresso percentual={56} situacao="dentro" rotulo="Orçamento da casa" topo="56%" />);

    const barra = screen.getByRole('progressbar', { name: 'Orçamento da casa' });
    expect(barra).toHaveAttribute('aria-valuenow', '56');
    expect(barra).toHaveAttribute('aria-valuemin', '0');
    expect(barra).toHaveAttribute('aria-valuemax', '100');
    expect(preenchimento(barra).style.getPropertyValue('--p')).toBe('56%');
  });

  it('acima de 100%: aria-valuenow fica 111 e a largura para em 100%', () => {
    render(<BarraProgresso percentual={111} situacao="estourado" rotulo="Contas da casa" topo="111%" />);

    const barra = screen.getByRole('progressbar', { name: 'Contas da casa' });
    expect(barra).toHaveAttribute('aria-valuenow', '111');
    expect(preenchimento(barra).style.getPropertyValue('--p')).toBe('100%');
  });

  it('o topo fica visível antes da barra', () => {
    render(
      <BarraProgresso percentual={56} situacao="dentro" rotulo="Orçamento da casa" topo="R$ 2.418,70 de R$ 4.300,00" />,
    );

    const topo = screen.getByText('R$ 2.418,70 de R$ 4.300,00');
    expect(topo).toBeVisible();
    const barra = screen.getByRole('progressbar');
    expect(topo.compareDocumentPosition(barra) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('topoSecundario aparece junto do topo', () => {
    render(
      <BarraProgresso
        percentual={111}
        situacao="estourado"
        rotulo="Contas da casa"
        topo="Contas da casa"
        topoSecundario="R$ 332,50 de R$ 300,00"
      />,
    );

    expect(screen.getByText('R$ 332,50 de R$ 300,00')).toBeVisible();
  });

  it('topoSecundario fica antes da barra por padrão', () => {
    render(<BarraProgresso percentual={50} situacao="dentro" rotulo="x" topo="t" topoSecundario="sec" />);

    const barra = screen.getByRole('progressbar');
    expect(screen.getByText('sec').compareDocumentPosition(barra) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('posicaoSecundario="depois": topo, barra e só então o secundário', () => {
    render(
      <BarraProgresso
        percentual={50}
        situacao="dentro"
        rotulo="x"
        topo="t"
        topoSecundario="sec"
        posicaoSecundario="depois"
      />,
    );

    const barra = screen.getByRole('progressbar');
    expect(screen.getByText('t').compareDocumentPosition(barra) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(screen.getByText('sec').compareDocumentPosition(barra) & Node.DOCUMENT_POSITION_PRECEDING).toBeTruthy();
  });

  it('elemento span para uso dentro de link', () => {
    render(
      <a href="/metas/1">
        <BarraProgresso percentual={62} situacao="casa" rotulo="Reserva de emergência" topo="62%" elemento="span" />
      </a>,
    );

    expect(screen.getByRole('progressbar', { name: 'Reserva de emergência' }).tagName).toBe('SPAN');
  });

  it('decorativa: sem role e com aria-hidden', () => {
    const { container } = render(
      <BarraProgresso percentual={58} situacao="casa" rotulo="Leandro" topo="R$ 1.402,50 · 58%" decorativa />,
    );

    expect(screen.queryByRole('progressbar')).toBeNull();
    const barra = container.querySelector('[aria-hidden="true"]') as HTMLElement;
    expect(barra).not.toBeNull();
    expect(barra).not.toHaveAttribute('role');
    expect(screen.getByText('R$ 1.402,50 · 58%')).toBeVisible();
  });

  it('não usa atributo style estático no HTML', () => {
    const { container } = render(<BarraProgresso percentual={40} situacao="dentro" rotulo="Mercado" topo="40%" />);

    const comStyle = Array.from(container.querySelectorAll('[style]'));
    for (const el of comStyle) expect(el.getAttribute('style')).toMatch(/^--p:\s*40%;?$/);
  });
});

// Teste de tipo: `topo` é obrigatório (verificado pelo typecheck).
function _semTopoNaoCompila() {
  // @ts-expect-error falta a prop obrigatória `topo`
  return <BarraProgresso percentual={10} situacao="dentro" rotulo="x" />;
}
void _semTopoNaoCompila;
