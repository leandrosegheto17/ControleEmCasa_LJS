import { describe, it, expect, expectTypeOf } from 'vitest';
import type { Escopo, TipoForma, SituacaoOrcamento, SituacaoOcorrencia, TipoMovimentoMeta } from '../comum/enums';
import { ROTULO_ESCOPO, ORDEM_ESCOPO } from './escopo';
import { ROTULO_TIPO_FORMA, ORDEM_TIPO_FORMA } from './tipoForma';
import { ROTULO_SITUACAO_ORCAMENTO, ORDEM_SITUACAO_ORCAMENTO } from './situacaoOrcamento';
import { ROTULO_SITUACAO_OCORRENCIA, ORDEM_SITUACAO_OCORRENCIA } from './situacaoOcorrencia';
import { ROTULO_TIPO_MOVIMENTO, ORDEM_TIPO_MOVIMENTO } from './tipoMovimento';
import type { Exaustiva } from './exaustividade';

type Rotulo = { texto: string; icone?: string };

const dominios: [string, Record<string, Rotulo>, readonly string[]][] = [
  ['escopo', ROTULO_ESCOPO, ORDEM_ESCOPO],
  ['tipo de forma', ROTULO_TIPO_FORMA, ORDEM_TIPO_FORMA],
  ['situação de orçamento', ROTULO_SITUACAO_ORCAMENTO, ORDEM_SITUACAO_ORCAMENTO],
  ['situação de ocorrência', ROTULO_SITUACAO_OCORRENCIA, ORDEM_SITUACAO_OCORRENCIA],
  ['tipo de movimento', ROTULO_TIPO_MOVIMENTO, ORDEM_TIPO_MOVIMENTO],
];

// o nome do ícone pode vir com ou sem o prefixo "i-" do sprite
function icone(rotulo: Rotulo): string | undefined {
  return rotulo.icone?.replace(/^i-/, '');
}

describe.each(dominios)('rótulos de %s', (_nome, rotulos, ordem) => {
  it('a ordem tem os mesmos valores do Record, sem repetir', () => {
    expect(new Set(ordem).size).toBe(ordem.length);
    expect([...ordem].sort()).toEqual(Object.keys(rotulos).sort());
  });

  it('todo rótulo tem texto não vazio', () => {
    for (const valor of ordem) expect(rotulos[valor]?.texto.trim()).not.toBe('');
  });
});

describe('textos e ícones do mockup', () => {
  it('escopo: Casa (casa) e Eu (pessoa), nessa ordem', () => {
    expect(ORDEM_ESCOPO).toEqual(['conjunto', 'individual']);
    expect(ROTULO_ESCOPO.conjunto.texto).toBe('Casa');
    expect(icone(ROTULO_ESCOPO.conjunto)).toBe('casa');
    expect(ROTULO_ESCOPO.individual.texto).toBe('Eu');
    expect(icone(ROTULO_ESCOPO.individual)).toBe('pessoa');
  });

  it('escopo: rótulo de grupo "Da casa" e "Minhas"', () => {
    expect(ROTULO_ESCOPO.conjunto.grupo).toBe('Da casa');
    expect(ROTULO_ESCOPO.individual.grupo).toBe('Minhas');
  });

  it('tipo de forma: Pix, Débito, Crédito, nessa ordem', () => {
    expect(ORDEM_TIPO_FORMA).toEqual(['pix', 'debito', 'credito']);
    expect(ORDEM_TIPO_FORMA.map((v) => ROTULO_TIPO_FORMA[v].texto)).toEqual(['Pix', 'Débito', 'Crédito']);
  });

  it('situação de orçamento: Estourado, Atenção, Dentro, com ícones alerta, aviso, ok', () => {
    expect(ORDEM_SITUACAO_ORCAMENTO).toEqual(['estourado', 'atencao', 'dentro']);
    expect(ROTULO_SITUACAO_ORCAMENTO.dentro).toMatchObject({ texto: 'Dentro' });
    expect(ROTULO_SITUACAO_ORCAMENTO.atencao).toMatchObject({ texto: 'Atenção' });
    expect(ROTULO_SITUACAO_ORCAMENTO.estourado).toMatchObject({ texto: 'Estourado' });
    expect(icone(ROTULO_SITUACAO_ORCAMENTO.dentro)).toBe('ok');
    expect(icone(ROTULO_SITUACAO_ORCAMENTO.atencao)).toBe('aviso');
    expect(icone(ROTULO_SITUACAO_ORCAMENTO.estourado)).toBe('alerta');
  });

  it('situação de ocorrência: Atrasada, Pendente, Paga, com ícones alerta, relogio, ok', () => {
    expect(ORDEM_SITUACAO_OCORRENCIA).toEqual(['atrasada', 'pendente', 'paga']);
    expect(ROTULO_SITUACAO_OCORRENCIA.pendente.texto).toBe('Pendente');
    expect(ROTULO_SITUACAO_OCORRENCIA.atrasada.texto).toBe('Atrasada');
    expect(ROTULO_SITUACAO_OCORRENCIA.paga.texto).toBe('Paga');
    expect(icone(ROTULO_SITUACAO_OCORRENCIA.pendente)).toBe('relogio');
    expect(icone(ROTULO_SITUACAO_OCORRENCIA.atrasada)).toBe('alerta');
    expect(icone(ROTULO_SITUACAO_OCORRENCIA.paga)).toBe('ok');
  });

  it('tipo de movimento: Aporte e Retirada', () => {
    expect(ORDEM_TIPO_MOVIMENTO).toEqual(['aporte', 'retirada']);
    expect(ROTULO_TIPO_MOVIMENTO.aporte.texto).toBe('Aporte');
    expect(ROTULO_TIPO_MOVIMENTO.retirada.texto).toBe('Retirada');
  });

  it('situação (escopo, orçamento, ocorrência) sempre tem ícone + texto', () => {
    const comIcone = [
      ...ORDEM_ESCOPO.map((v) => ROTULO_ESCOPO[v]),
      ...ORDEM_SITUACAO_ORCAMENTO.map((v) => ROTULO_SITUACAO_ORCAMENTO[v]),
      ...ORDEM_SITUACAO_OCORRENCIA.map((v) => ROTULO_SITUACAO_OCORRENCIA[v]),
    ];
    for (const rotulo of comIcone) expect(icone(rotulo)).toBeTruthy();
  });
});

describe('exaustividade (checada pelo typecheck)', () => {
  it('cada Record cobre exatamente a união do contrato', () => {
    expectTypeOf<keyof typeof ROTULO_ESCOPO>().toEqualTypeOf<Escopo>();
    expectTypeOf<keyof typeof ROTULO_TIPO_FORMA>().toEqualTypeOf<TipoForma>();
    expectTypeOf<keyof typeof ROTULO_SITUACAO_ORCAMENTO>().toEqualTypeOf<SituacaoOrcamento>();
    expectTypeOf<keyof typeof ROTULO_SITUACAO_OCORRENCIA>().toEqualTypeOf<SituacaoOcorrencia>();
    expectTypeOf<keyof typeof ROTULO_TIPO_MOVIMENTO>().toEqualTypeOf<TipoMovimentoMeta>();
  });

  it('cada ORDEM tem elementos só da união', () => {
    expectTypeOf(ORDEM_ESCOPO).items.toMatchTypeOf<Escopo>();
    expectTypeOf(ORDEM_TIPO_FORMA).items.toMatchTypeOf<TipoForma>();
    expectTypeOf(ORDEM_SITUACAO_ORCAMENTO).items.toMatchTypeOf<SituacaoOrcamento>();
    expectTypeOf(ORDEM_SITUACAO_OCORRENCIA).items.toMatchTypeOf<SituacaoOcorrencia>();
    expectTypeOf(ORDEM_TIPO_MOVIMENTO).items.toMatchTypeOf<TipoMovimentoMeta>();
  });

  it('Exaustiva resolve para never quando falta valor na ordem', () => {
    type Local = 'a' | 'b' | 'teste';
    expectTypeOf<Exaustiva<Local, readonly ['a', 'b']>>().toBeNever();
    expectTypeOf<Exaustiva<Local, readonly ['a', 'b', 'teste']>>().not.toBeNever();
    expectTypeOf<Exaustiva<'a' | 'b', readonly ['a', 'b']>>().not.toBeNever();
  });

  it('um Record sem uma chave da união não compila', () => {
    type Local = 'a' | 'b' | 'teste';
    // @ts-expect-error falta a chave 'teste'
    const incompleto = { a: { texto: 'A' }, b: { texto: 'B' } } as const satisfies Record<Local, Rotulo>;
    expect(Object.keys(incompleto)).toHaveLength(2);
  });
});
