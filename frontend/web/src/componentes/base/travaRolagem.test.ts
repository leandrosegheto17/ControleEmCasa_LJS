import { describe, it, expect } from 'vitest';
import { travar, liberar } from './travaRolagem';

const html = () => document.documentElement;

describe('travaRolagem', () => {
  it('sem trava o <html> não tem com-folha', () => {
    expect(html()).not.toHaveClass('com-folha');
  });

  it('uma trava põe com-folha e a liberação tira', () => {
    travar();
    expect(html()).toHaveClass('com-folha');
    liberar();
    expect(html()).not.toHaveClass('com-folha');
  });

  it('com duas travas, com-folha só some quando as duas liberam', () => {
    travar();
    travar();
    expect(html()).toHaveClass('com-folha');
    liberar();
    expect(html()).toHaveClass('com-folha');
    liberar();
    expect(html()).not.toHaveClass('com-folha');
  });

  it('não mexe nas outras classes do <html>', () => {
    html().classList.add('outra');
    travar();
    liberar();
    expect(html()).toHaveClass('outra');
    html().classList.remove('outra');
  });
});
