import { entradaCadastros, LIMITES_CADASTRO } from '@controle/contrato';
import { describe, expect, it } from 'vitest';
import {
  calcularAjusteDeSaldo,
  categoriaPodeMudar,
  contaDaFormaPodeSer,
  formaPodeSerPreferida,
  normalizarCategoria,
  normalizarConta,
  normalizarForma,
  tipoDaFormaPodeMudar,
} from './cadastros';
import { SALDO_INICIAL_MAXIMO_CENTAVOS } from './centavos';
import { NOME_CONTA_MAX_CARACTERES, TEXTO_LIVRE_MAX_CARACTERES } from './validacoes';
import { CATEGORIAS_INICIAIS_CONJUNTAS, CATEGORIAS_INICIAIS_INDIVIDUAIS, decidirAceite } from './lar';

/**
 * Cadastros (RN-03, RN-12, RN-17, RN-18; CA-03.1, CA-03.2, CA-12.2, CA-12.3, CA-17.1, CA-18.1).
 * Casos escritos a partir dos critérios de aceite e dos pgTAP de cadastros/ do legado.
 */

const CONTA = '11111111-1111-4111-8111-111111111111';

describe('conta (RN-03, RN-18)', () => {
  it('nome aparado de 1 a 80 caracteres; saldo inicial ausente vira 0', () => {
    expect(normalizarConta({ nome: '  Itaú  ' })).toEqual({
      ok: true,
      valor: { nome: 'Itaú', saldoInicialCentavos: 0 },
    });
  });

  it('nome vazio, só espaços ou acima de 80 caracteres reais é valor_invalido', () => {
    expect(normalizarConta({ nome: '' })).toEqual({ ok: false, erro: 'valor_invalido' });
    expect(normalizarConta({ nome: '   ' })).toEqual({ ok: false, erro: 'valor_invalido' });
    expect(normalizarConta({ nome: 'a'.repeat(81) })).toEqual({ ok: false, erro: 'valor_invalido' });
    expect(normalizarConta({ nome: 'a'.repeat(80) }).ok).toBe(true);
  });

  it('conta caracteres reais, não unidades UTF-16: 80 emojis passam, 81 não', () => {
    expect(normalizarConta({ nome: '😀'.repeat(80) }).ok).toBe(true);
    expect(normalizarConta({ nome: '😀'.repeat(81) }).ok).toBe(false);
  });

  it('saldo inicial pode ser negativo, de −10^11 a 10^11; fora disso ou fracionário é valor_invalido', () => {
    expect(normalizarConta({ nome: 'x', saldoInicialCentavos: -5000 }).ok).toBe(true);
    expect(normalizarConta({ nome: 'x', saldoInicialCentavos: 100_000_000_000 }).ok).toBe(true);
    expect(normalizarConta({ nome: 'x', saldoInicialCentavos: -100_000_000_000 }).ok).toBe(true);
    expect(normalizarConta({ nome: 'x', saldoInicialCentavos: 100_000_000_001 }).ok).toBe(false);
    expect(normalizarConta({ nome: 'x', saldoInicialCentavos: -100_000_000_001 }).ok).toBe(false);
    expect(normalizarConta({ nome: 'x', saldoInicialCentavos: 10.5 }).ok).toBe(false);
  });
});

describe('ajuste de saldo (RN-12)', () => {
  it('CA-12.2: saldo real 1000 sobre 1250 calculado grava saída de 250 e devolve −250', () => {
    expect(calcularAjusteDeSaldo(1000, 1250)).toEqual({
      ok: true,
      valor: { diferencaCentavos: -250, movimento: { sentido: 'saida', valorCentavos: 250 } },
    });
  });

  it('diferença positiva é entrada', () => {
    expect(calcularAjusteDeSaldo(1500, 1000)).toEqual({
      ok: true,
      valor: { diferencaCentavos: 500, movimento: { sentido: 'entrada', valorCentavos: 500 } },
    });
  });

  it('CA-12.3: o mesmo saldo real devolve 0 e não grava', () => {
    expect(calcularAjusteDeSaldo(1250, 1250)).toEqual({ ok: true, valor: { diferencaCentavos: 0, movimento: null } });
  });

  it('saldo real negativo é aceito (conta no vermelho)', () => {
    expect(calcularAjusteDeSaldo(-300, 200)).toEqual({
      ok: true,
      valor: { diferencaCentavos: -500, movimento: { sentido: 'saida', valorCentavos: 500 } },
    });
  });

  it('saldo real não inteiro ou ausente é valor_invalido', () => {
    expect(calcularAjusteDeSaldo(1.5, 0)).toEqual({ ok: false, erro: 'valor_invalido' });
    expect(calcularAjusteDeSaldo(null, 0)).toEqual({ ok: false, erro: 'valor_invalido' });
    expect(calcularAjusteDeSaldo('10', 0)).toEqual({ ok: false, erro: 'valor_invalido' });
  });
});

describe('forma de pagamento (RN-03)', () => {
  it('CA-03.1: Pix e Débito sem conta é valor_invalido', () => {
    expect(normalizarForma({ nome: 'Pix', tipo: 'pix' })).toEqual({ ok: false, erro: 'valor_invalido' });
    expect(normalizarForma({ nome: 'Déb', tipo: 'debito', contaId: null })).toEqual({
      ok: false,
      erro: 'valor_invalido',
    });
  });

  it('Pix e Débito com conta ignoram o dia (gravado nulo)', () => {
    expect(normalizarForma({ nome: 'Pix', tipo: 'pix', contaId: CONTA, diaVencimento: 10 })).toEqual({
      ok: true,
      valor: { nome: 'Pix', tipo: 'pix', contaId: CONTA, diaVencimento: null },
    });
  });

  it('CA-03.2: Crédito sem dia ou com dia fora de 1 a 31 é valor_invalido', () => {
    for (const dia of [undefined, null, 0, 32, -1, 1.5, '10']) {
      expect(normalizarForma({ nome: 'Cartão', tipo: 'credito', diaVencimento: dia }), String(dia)).toEqual({
        ok: false,
        erro: 'valor_invalido',
      });
    }
    expect(normalizarForma({ nome: 'Cartão', tipo: 'credito', diaVencimento: 1 }).ok).toBe(true);
    expect(normalizarForma({ nome: 'Cartão', tipo: 'credito', diaVencimento: 31 }).ok).toBe(true);
  });

  it('Crédito aceita conta opcional', () => {
    expect(normalizarForma({ nome: 'Nubank', tipo: 'credito', diaVencimento: 10 })).toEqual({
      ok: true,
      valor: { nome: 'Nubank', tipo: 'credito', contaId: null, diaVencimento: 10 },
    });
    expect(normalizarForma({ nome: 'Nubank', tipo: 'credito', diaVencimento: 10, contaId: CONTA }).ok).toBe(true);
  });

  it('tipo desconhecido e nome vazio ou acima de 120 caracteres são valor_invalido', () => {
    expect(normalizarForma({ nome: 'x', tipo: 'boleto', contaId: CONTA }).ok).toBe(false);
    expect(normalizarForma({ nome: ' ', tipo: 'pix', contaId: CONTA }).ok).toBe(false);
    expect(normalizarForma({ nome: 'a'.repeat(121), tipo: 'pix', contaId: CONTA }).ok).toBe(false);
    expect(normalizarForma({ nome: 'a'.repeat(120), tipo: 'pix', contaId: CONTA }).ok).toBe(true);
  });

  it('o tipo não muda depois de criada', () => {
    expect(tipoDaFormaPodeMudar('pix', 'pix')).toBe(true);
    expect(tipoDaFormaPodeMudar('pix', 'debito')).toBe(false);
    expect(tipoDaFormaPodeMudar('credito', 'pix')).toBe(false);
  });

  it('conta arquivada só é recusada quando a conta da forma muda para ela', () => {
    expect(contaDaFormaPodeSer({ id: 'a', arquivada: true }, 'b')).toBe(false);
    expect(contaDaFormaPodeSer({ id: 'a', arquivada: true }, null)).toBe(false);
    expect(contaDaFormaPodeSer({ id: 'a', arquivada: true }, 'a')).toBe(true);
    expect(contaDaFormaPodeSer({ id: 'a', arquivada: false }, 'b')).toBe(true);
  });

  it('forma arquivada não vira preferida; desligar a preferência é sempre aceito', () => {
    expect(formaPodeSerPreferida(true, true)).toBe(false);
    expect(formaPodeSerPreferida(true, false)).toBe(true);
    expect(formaPodeSerPreferida(false, true)).toBe(true);
  });
});

describe('categoria (RN-17)', () => {
  it('CA-17.1: receita conjunta é gravada como individual, sem a marca variável', () => {
    expect(normalizarCategoria({ nome: 'Bônus', tipo: 'receita', escopo: 'conjunto', variavel: true })).toEqual({
      ok: true,
      valor: { nome: 'Bônus', tipo: 'receita', escopo: 'individual', variavel: null },
    });
  });

  it('despesa mantém o escopo; variável ausente vira falso', () => {
    expect(normalizarCategoria({ nome: 'Mercado', tipo: 'despesa', escopo: 'conjunto' })).toEqual({
      ok: true,
      valor: { nome: 'Mercado', tipo: 'despesa', escopo: 'conjunto', variavel: false },
    });
    expect(normalizarCategoria({ nome: 'Academia', tipo: 'despesa', escopo: 'individual', variavel: true })).toEqual({
      ok: true,
      valor: { nome: 'Academia', tipo: 'despesa', escopo: 'individual', variavel: true },
    });
  });

  it('nome vazio, acima de 120 caracteres, tipo ou escopo desconhecido são valor_invalido', () => {
    expect(normalizarCategoria({ nome: '  ', tipo: 'despesa', escopo: 'conjunto' }).ok).toBe(false);
    expect(normalizarCategoria({ nome: 'a'.repeat(121), tipo: 'despesa', escopo: 'conjunto' }).ok).toBe(false);
    expect(normalizarCategoria({ nome: 'x', tipo: 'outro', escopo: 'conjunto' }).ok).toBe(false);
    expect(normalizarCategoria({ nome: 'x', tipo: 'despesa', escopo: 'casal' }).ok).toBe(false);
  });

  it('tipo e escopo não mudam depois de criada', () => {
    const base = { tipo: 'despesa', escopo: 'conjunto' } as const;
    expect(categoriaPodeMudar(base, base)).toBe(true);
    expect(categoriaPodeMudar(base, { tipo: 'receita', escopo: 'conjunto' })).toBe(false);
    expect(categoriaPodeMudar(base, { tipo: 'despesa', escopo: 'individual' })).toBe(false);
  });
});

describe('decidirAceite com os cadastros (CA-23.10; ADR-009)', () => {
  const iniciais = [
    ...CATEGORIAS_INICIAIS_CONJUNTAS.map((c) => ({ ...c, escopo: 'conjunto' as const, arquivada: false })),
    ...CATEGORIAS_INICIAIS_INDIVIDUAIS.map((c) => ({ ...c, escopo: 'individual' as const, arquivada: false })),
  ];

  it('titular sozinho com as iniciais e sem nenhum cadastro: o lar é descartado', () => {
    expect(
      decidirAceite({ papel: 'titular', outrosMembrosNoLar: 0, categorias: iniciais, registrosDeNegocio: 0 }),
    ).toEqual({
      ok: true,
      valor: 'descartar',
    });
  });

  it('titular sozinho com as iniciais, mas com uma conta, forma ou movimento: ja_tem_lar', () => {
    expect(
      decidirAceite({ papel: 'titular', outrosMembrosNoLar: 0, categorias: iniciais, registrosDeNegocio: 1 }),
    ).toEqual({
      ok: false,
      erro: 'ja_tem_lar',
    });
  });
});

describe('contrato e domínio concordam nos tetos (risco registrado na etapa 5)', () => {
  it('os limites do contrato são os do domínio', () => {
    expect(LIMITES_CADASTRO.nomeContaCaracteres).toBe(NOME_CONTA_MAX_CARACTERES);
    expect(LIMITES_CADASTRO.nomeFormaCaracteres).toBe(TEXTO_LIVRE_MAX_CARACTERES);
    expect(LIMITES_CADASTRO.nomeCategoriaCaracteres).toBe(TEXTO_LIVRE_MAX_CARACTERES);
    expect(LIMITES_CADASTRO.saldoInicialMaxCentavos).toBe(SALDO_INICIAL_MAXIMO_CENTAVOS);
  });

  it('um nome de emojis no teto passa nos dois; um acima do teto falha nos dois', () => {
    const noTeto = '😀'.repeat(NOME_CONTA_MAX_CARACTERES);
    expect(entradaCadastros.SalvarConta.safeParse({ nome: noTeto }).success).toBe(true);
    expect(normalizarConta({ nome: noTeto }).ok).toBe(true);
    const acima = noTeto + '😀';
    expect(entradaCadastros.SalvarConta.safeParse({ nome: acima }).success).toBe(false);
    expect(normalizarConta({ nome: acima }).ok).toBe(false);
  });
});
