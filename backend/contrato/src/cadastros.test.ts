import { describe, expect, it } from 'vitest';
import { entrada, entradaCadastros, saida, saidaCadastros } from './index';

/**
 * Contrato dos cadastros (SDD 6.1; RN-03, RN-12, RN-17, RN-18; G-11 chaves omitidas, G-52 aditivo).
 * Os casos nascem dos critérios de aceite: CA-03.1, CA-03.2, CA-17.1, CA-18.1, CA-12.2.
 */
const ID = '00000000-0000-4000-8000-000000000001';

describe('SalvarConta', () => {
  it('nome aparado, saldo inicial opcional (pode ser negativo)', () => {
    expect(entradaCadastros.SalvarConta.parse({ nome: '  Itaú ' })).toEqual({ nome: 'Itaú' });
    expect(entradaCadastros.SalvarConta.parse({ nome: 'x', saldo_inicial_centavos: -1500 })).toEqual({
      nome: 'x',
      saldo_inicial_centavos: -1500,
    });
  });

  it('nome vazio, só espaços ou acima de 80 caracteres é recusado', () => {
    for (const nome of ['', '   ', 'a'.repeat(81)]) {
      expect(entradaCadastros.SalvarConta.safeParse({ nome }).success, nome).toBe(false);
    }
    expect(entradaCadastros.SalvarConta.safeParse({ nome: 'a'.repeat(80) }).success).toBe(true);
  });

  it('o teto conta caracteres reais, não unidades UTF-16 (80 emojis passam; 81 não)', () => {
    expect(entradaCadastros.SalvarConta.safeParse({ nome: '😀'.repeat(80) }).success).toBe(true);
    expect(entradaCadastros.SalvarConta.safeParse({ nome: '😀'.repeat(81) }).success).toBe(false);
  });

  it('saldo inicial fora de ±10^11, fracionário ou como texto é recusado; lar e dono do cliente também', () => {
    for (const saldo of [100_000_000_001, -100_000_000_001, 1.5, '10', Number.MAX_SAFE_INTEGER + 2]) {
      expect(entradaCadastros.SalvarConta.safeParse({ nome: 'x', saldo_inicial_centavos: saldo }).success).toBe(false);
    }
    expect(entradaCadastros.SalvarConta.safeParse({ nome: 'x', lar_id: ID }).success).toBe(false);
    expect(entradaCadastros.SalvarConta.safeParse({ nome: 'x', dono_id: ID }).success).toBe(false);
  });
});

describe('AjustarSaldo', () => {
  it('saldo real inteiro, inclusive negativo; simular opcional', () => {
    expect(entradaCadastros.AjustarSaldo.parse({ saldo_real_centavos: -250 })).toEqual({ saldo_real_centavos: -250 });
    expect(entradaCadastros.AjustarSaldo.parse({ saldo_real_centavos: 0, simular: true })).toEqual({
      saldo_real_centavos: 0,
      simular: true,
    });
  });

  it('saldo real ausente, fracionário ou texto é recusado', () => {
    for (const corpo of [
      {},
      { saldo_real_centavos: 1.5 },
      { saldo_real_centavos: '10' },
      { saldo_real_centavos: null },
    ]) {
      expect(entradaCadastros.AjustarSaldo.safeParse(corpo).success).toBe(false);
    }
  });
});

describe('SalvarForma', () => {
  it('Pix com conta, Débito com conta e Crédito com dia (conta opcional)', () => {
    expect(entradaCadastros.SalvarForma.safeParse({ nome: 'Pix', tipo: 'pix', conta_id: ID }).success).toBe(true);
    expect(entradaCadastros.SalvarForma.safeParse({ nome: 'Déb', tipo: 'debito', conta_id: ID }).success).toBe(true);
    expect(entradaCadastros.SalvarForma.safeParse({ nome: 'Nu', tipo: 'credito', dia_vencimento: 10 }).success).toBe(
      true,
    );
    expect(
      entradaCadastros.SalvarForma.safeParse({ nome: 'Nu', tipo: 'credito', dia_vencimento: 10, conta_id: null })
        .success,
    ).toBe(true);
  });

  it('tipo desconhecido, dia fora de 1 a 31, conta que não é uuid e nome acima de 120 são recusados', () => {
    const base = { nome: 'x', tipo: 'credito', dia_vencimento: 10 };
    expect(entradaCadastros.SalvarForma.safeParse({ ...base, tipo: 'boleto' }).success).toBe(false);
    for (const dia of [0, 32, 1.5, '10']) {
      expect(entradaCadastros.SalvarForma.safeParse({ ...base, dia_vencimento: dia }).success, String(dia)).toBe(false);
    }
    expect(entradaCadastros.SalvarForma.safeParse({ ...base, conta_id: 'nao-e-uuid' }).success).toBe(false);
    expect(entradaCadastros.SalvarForma.safeParse({ ...base, nome: 'a'.repeat(121) }).success).toBe(false);
    expect(entradaCadastros.SalvarForma.safeParse({ ...base, nome: '😀'.repeat(120) }).success).toBe(true);
  });

  it('não aceita lar, dono, preferida nem arquivada vindos do cliente', () => {
    const base = { nome: 'x', tipo: 'credito', dia_vencimento: 10 };
    for (const extra of [{ lar_id: ID }, { dono_id: ID }, { preferida: true }, { arquivada: true }]) {
      expect(entradaCadastros.SalvarForma.safeParse({ ...base, ...extra }).success).toBe(false);
    }
  });
});

describe('DefinirPreferida', () => {
  it('exige o booleano', () => {
    expect(entradaCadastros.DefinirPreferida.parse({ preferida: false })).toEqual({ preferida: false });
    expect(entradaCadastros.DefinirPreferida.safeParse({}).success).toBe(false);
    expect(entradaCadastros.DefinirPreferida.safeParse({ preferida: 'sim' }).success).toBe(false);
  });
});

describe('SalvarCategoria', () => {
  it('despesa conjunta com a marca, receita individual; variável opcional', () => {
    expect(
      entradaCadastros.SalvarCategoria.parse({
        nome: ' Mercado ',
        tipo: 'despesa',
        escopo: 'conjunto',
        variavel: true,
      }),
    ).toEqual({ nome: 'Mercado', tipo: 'despesa', escopo: 'conjunto', variavel: true });
    expect(
      entradaCadastros.SalvarCategoria.safeParse({ nome: 'Bônus', tipo: 'receita', escopo: 'individual' }).success,
    ).toBe(true);
  });

  it('CA-17.1: receita conjunta passa pelo contrato (o domínio a grava como individual)', () => {
    expect(
      entradaCadastros.SalvarCategoria.safeParse({ nome: 'Bônus', tipo: 'receita', escopo: 'conjunto' }).success,
    ).toBe(true);
  });

  it('nome vazio, acima de 120 caracteres, tipo ou escopo desconhecidos e dono do cliente são recusados', () => {
    const base = { nome: 'x', tipo: 'despesa', escopo: 'conjunto' };
    expect(entradaCadastros.SalvarCategoria.safeParse({ ...base, nome: '  ' }).success).toBe(false);
    expect(entradaCadastros.SalvarCategoria.safeParse({ ...base, nome: 'a'.repeat(121) }).success).toBe(false);
    expect(entradaCadastros.SalvarCategoria.safeParse({ ...base, tipo: 'outro' }).success).toBe(false);
    expect(entradaCadastros.SalvarCategoria.safeParse({ ...base, escopo: 'casal' }).success).toBe(false);
    expect(entradaCadastros.SalvarCategoria.safeParse({ ...base, dono_id: ID }).success).toBe(false);
    expect(entradaCadastros.SalvarCategoria.safeParse({ ...base, arquivada: true }).success).toBe(false);
  });
});

describe('saídas (chaves privadas omitidas, G-11)', () => {
  it('LinhaContas não leva lar nem dono; CA-12.2 devolve a diferença com sinal', () => {
    const linha = {
      id: ID,
      nome: 'Itaú',
      saldo_inicial_centavos: 0,
      saldo_centavos: -250,
      arquivada: false,
      pode_excluir: true,
    };
    expect(saidaCadastros.LinhaContas.safeParse(linha).success).toBe(true);
    expect(saidaCadastros.LinhaContas.safeParse({ ...linha, dono_id: ID }).success).toBe(false);
    expect(saidaCadastros.LinhaContas.safeParse({ ...linha, lar_id: ID }).success).toBe(false);
    expect(saidaCadastros.Ajuste.parse({ diferenca_centavos: -250 })).toEqual({ diferenca_centavos: -250 });
  });

  it('LinhaFormasPagamento: conta em objeto {id, nome}, sem conta_id solto nem dono', () => {
    const linha = {
      id: ID,
      nome: 'Nubank',
      tipo: 'credito',
      conta: { id: ID, nome: 'Itaú' },
      dia_vencimento: 10,
      preferida: false,
      arquivada: false,
      pode_excluir: true,
      gasto_mes_centavos: 0,
      comprometido_futuro_centavos: 0,
    };
    expect(saidaCadastros.LinhaFormasPagamento.safeParse(linha).success).toBe(true);
    expect(saidaCadastros.LinhaFormasPagamento.safeParse({ ...linha, conta: null }).success).toBe(true);
    expect(saidaCadastros.LinhaFormasPagamento.safeParse({ ...linha, conta_id: ID }).success).toBe(false);
    expect(saidaCadastros.LinhaFormasPagamento.safeParse({ ...linha, dono_id: ID }).success).toBe(false);
  });

  it('LinhaCategorias não leva lar nem dono', () => {
    const linha = {
      id: ID,
      nome: 'Mercado',
      tipo: 'despesa',
      escopo: 'conjunto',
      variavel: true,
      arquivada: false,
      pode_excluir: true,
    };
    expect(saidaCadastros.LinhaCategorias.safeParse(linha).success).toBe(true);
    expect(saidaCadastros.LinhaCategorias.safeParse({ ...linha, dono_id: ID }).success).toBe(false);
  });

  it('os schemas aparecem em entrada.* e saida.* (SDD 6: entrada.X / saida.X)', () => {
    expect(entrada.SalvarConta).toBe(entradaCadastros.SalvarConta);
    expect(saida.LinhaContas).toBe(saidaCadastros.LinhaContas);
  });
});
