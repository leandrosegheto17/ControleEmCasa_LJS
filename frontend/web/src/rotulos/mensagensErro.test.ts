import { describe, expect, it } from 'vitest';
import { mensagemErro } from './mensagensErro';

describe('mensagemErro', () => {
  it('rede usa o texto da UX-SPEC', () => {
    expect(mensagemErro({ tipo: 'rede' })).toBe('Sem conexão. Tente de novo');
  });

  it.each([
    { tipo: 'indisponivel' as const },
    { tipo: 'desconhecido' as const },
    { tipo: 'regra' as const, codigo: 'valor_invalido' as const },
    { tipo: 'regra' as const, codigo: 'registro_invalido' as const },
  ])('todo caso genérico tem texto pt-BR próprio: %o', (erro) => {
    const texto = mensagemErro(erro);
    expect(texto.trim().length).toBeGreaterThan(0);
    expect(texto).not.toMatch(/_/);
  });

  it('os textos genéricos são distintos entre si', () => {
    const textos = [
      mensagemErro({ tipo: 'rede' }),
      mensagemErro({ tipo: 'indisponivel' }),
      mensagemErro({ tipo: 'regra', codigo: 'valor_invalido' }),
      mensagemErro({ tipo: 'regra', codigo: 'registro_invalido' }),
    ];
    expect(new Set(textos).size).toBe(textos.length);
  });

  it('nunca repassa o código ou a mensagem crua do servidor', () => {
    const erroComTexto = { tipo: 'regra', codigo: 'sem_permissao', message: 'permission denied for table conta' };
    const texto = mensagemErro(erroComTexto as never);
    expect(texto.trim().length).toBeGreaterThan(0);
    expect(texto).not.toContain('sem_permissao');
    expect(texto).not.toContain('permission denied');
  });
});
