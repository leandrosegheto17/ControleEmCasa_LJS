import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { AvisoErroTopo } from './AvisoErroTopo';

const classe = (nome: string) => new RegExp(`(^|\\s|_)${nome}(_|\\s|$)`);

describe('AvisoErroTopo', () => {
  it('p com role=alert, ícone alerta e o texto exato', () => {
    render(<AvisoErroTopo>E-mail ou senha incorretos.</AvisoErroTopo>);

    const aviso = screen.getByRole('alert');
    expect(aviso.tagName).toBe('P');
    expect(aviso.className).toMatch(classe('aviso-erro-topo'));
    expect(aviso).toHaveTextContent(/^E-mail ou senha incorretos\.$/);
    const icone = aviso.querySelector('svg');
    expect(icone).toHaveAttribute('aria-hidden', 'true');
    expect(icone?.querySelector('use')?.getAttribute('href')).toBe('#i-alerta');
  });

  it('mensagem é texto, não HTML', () => {
    render(<AvisoErroTopo>{'<b>x</b>'}</AvisoErroTopo>);

    expect(screen.getByRole('alert').querySelector('b')).toBeNull();
  });
});
