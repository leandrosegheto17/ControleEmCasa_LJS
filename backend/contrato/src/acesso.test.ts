import { describe, expect, it } from 'vitest';
import { entrada, saida, senhaAtendePolitica, VERSAO_PRIVACIDADE, VERSAO_TERMOS } from './index';

/** Critérios: RN-19 (e-mail normalizado, política de senha, aceite obrigatório), G-17 (12 caracteres a 72 bytes). */
const aceite = { termos: VERSAO_TERMOS, privacidade: VERSAO_PRIVACIDADE };

describe('política de senha (RN-19, G-17, CA-19.4)', () => {
  it('11 caracteres é fraca; 12 passa', () => {
    expect(senhaAtendePolitica('a'.repeat(11))).toBe(false);
    expect(senhaAtendePolitica('a'.repeat(12))).toBe(true);
  });

  it('72 bytes UTF-8 passa; 73 bytes é recusada (limite do bcrypt)', () => {
    expect(senhaAtendePolitica('a'.repeat(72))).toBe(true);
    expect(senhaAtendePolitica('a'.repeat(73))).toBe(false);
  });

  it('conta bytes, não caracteres: 24 "ç" (48 bytes) passa; 37 "ç" (74 bytes) é recusada', () => {
    expect(senhaAtendePolitica('ç'.repeat(24))).toBe(true);
    expect(senhaAtendePolitica('ç'.repeat(37))).toBe(false);
  });

  it('12 caracteres contam por ponto de código (emoji conta 1)', () => {
    expect(senhaAtendePolitica('😀'.repeat(11))).toBe(false);
    expect(senhaAtendePolitica('😀'.repeat(12))).toBe(true);
  });
});

describe('entrada.Cadastro', () => {
  it('normaliza o e-mail (trim e minúsculas) e o nome', () => {
    const r = entrada.Cadastro.parse({ nome: '  Ana  ', email: '  Ana@Exemplo.COM ', senha: 'x', aceite });
    expect(r.email).toBe('ana@exemplo.com');
    expect(r.nome).toBe('Ana');
  });

  it('sem aceite é inválido (G-48)', () => {
    expect(entrada.Cadastro.safeParse({ nome: 'Ana', email: 'a@b.co', senha: 'x' }).success).toBe(false);
  });

  it('e-mail malformado, nome vazio ou longo e campo extra são inválidos', () => {
    const base = { nome: 'Ana', email: 'a@b.co', senha: 'x', aceite };
    expect(entrada.Cadastro.safeParse({ ...base, email: 'sem-arroba' }).success).toBe(false);
    expect(entrada.Cadastro.safeParse({ ...base, nome: '   ' }).success).toBe(false);
    expect(entrada.Cadastro.safeParse({ ...base, nome: 'x'.repeat(61) }).success).toBe(false);
    expect(entrada.Cadastro.safeParse({ ...base, papel: 'admin' }).success).toBe(false);
    expect(entrada.Cadastro.safeParse({ ...base, email: `${'a'.repeat(250)}@b.co` }).success).toBe(false);
  });
});

describe('saida.SessaoAtual', () => {
  it('é estrita: uma chave a mais (ex.: token) é recusada (CA-20.8)', () => {
    const ok = {
      usuario: { id: '00000000-0000-4000-8000-000000000001', nome: 'Ana', email: 'a@b.co' },
      membro: null,
      lar: null,
      plano: null,
      termos_pendentes: false,
    };
    expect(saida.SessaoAtual.safeParse(ok).success).toBe(true);
    expect(saida.SessaoAtual.safeParse({ ...ok, token: 'x' }).success).toBe(false);
  });
});
