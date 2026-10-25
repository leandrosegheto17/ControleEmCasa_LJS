import { describe, expect, it } from 'vitest';
import {
  CATEGORIAS_INICIAIS_CONJUNTAS,
  CATEGORIAS_INICIAIS_INDIVIDUAIS,
  avaliarConvite,
  decidirAceite,
  INTERVALO_REENVIO_CONVITE_MS,
  LIMITE_CONVITES_POR_DIA,
  NOME_EX_MEMBRO,
  nomeLarPadrao,
  soCategoriasIniciais,
  VALIDADE_CONVITE_MS,
  type LinhaCategoriaLar,
} from './lar';

/**
 * Lar, membros e convite (RN-17, RN-22, RN-23; CA-17.4, CA-22.1, CA-23.7, CA-23.9 a CA-23.11, CA-11.1, CA-11.2).
 * Regras puras: a API lê o estado dentro da transação (sob RLS) e pede a decisão aqui.
 */

const MINUTO = 60 * 1000;
const DIA = 24 * 60 * MINUTO;

describe('categorias iniciais (RN-17, CA-22.1)', () => {
  it('6 conjuntas de despesa, com Almoço/Alimentação fora conjunta (o código do legado vence)', () => {
    expect(CATEGORIAS_INICIAIS_CONJUNTAS).toEqual([
      { tipo: 'despesa', nome: 'Mercado', variavel: true },
      { tipo: 'despesa', nome: 'Delivery/iFood do casal', variavel: true },
      { tipo: 'despesa', nome: 'Moradia', variavel: false },
      { tipo: 'despesa', nome: 'Contas da casa', variavel: false },
      { tipo: 'despesa', nome: 'Outros da casa', variavel: false },
      { tipo: 'despesa', nome: 'Almoço/Alimentação fora', variavel: true },
    ]);
  });

  it('7 individuais por membro: 4 de despesa e 3 de receita (receita sem a marca variável)', () => {
    expect(CATEGORIAS_INICIAIS_INDIVIDUAIS).toEqual([
      { tipo: 'despesa', nome: 'Delivery pessoal', variavel: true },
      { tipo: 'despesa', nome: 'Transporte', variavel: true },
      { tipo: 'despesa', nome: 'Lazer pessoal', variavel: true },
      { tipo: 'despesa', nome: 'Outros', variavel: false },
      { tipo: 'receita', nome: 'Salário', variavel: null },
      { tipo: 'receita', nome: 'Extra', variavel: null },
      { tipo: 'receita', nome: 'Outros', variavel: null },
    ]);
  });
});

const iniciais = (): LinhaCategoriaLar[] => [
  ...CATEGORIAS_INICIAIS_CONJUNTAS.map((c) => ({ ...c, escopo: 'conjunto' as const, arquivada: false })),
  ...CATEGORIAS_INICIAIS_INDIVIDUAIS.map((c) => ({ ...c, escopo: 'individual' as const, arquivada: false })),
];

describe('lar só com as categorias iniciais (CA-23.9, CA-23.10)', () => {
  it('as 13 iniciais intactas, em qualquer ordem: descartável', () => {
    expect(soCategoriasIniciais(iniciais())).toBe(true);
    expect(soCategoriasIniciais(iniciais().reverse())).toBe(true);
  });

  it('uma categoria criada a mais: tem dado', () => {
    expect(
      soCategoriasIniciais([
        ...iniciais(),
        { tipo: 'despesa', escopo: 'individual', nome: 'Academia', variavel: false, arquivada: false },
      ]),
    ).toBe(false);
  });

  it('uma inicial renomeada, arquivada, com a marca variável trocada ou excluída: tem dado', () => {
    const renomeada = iniciais().map((c) => (c.nome === 'Mercado' ? { ...c, nome: 'Feira' } : c));
    const arquivada = iniciais().map((c) => (c.nome === 'Moradia' ? { ...c, arquivada: true } : c));
    const variavel = iniciais().map((c) => (c.nome === 'Transporte' ? { ...c, variavel: false } : c));
    const excluida = iniciais().filter((c) => c.nome !== 'Extra');
    for (const caso of [renomeada, arquivada, variavel, excluida]) expect(soCategoriasIniciais(caso)).toBe(false);
  });

  it('a mesma categoria com o escopo trocado não conta como inicial', () => {
    const trocada = iniciais().map((c) => (c.nome === 'Lazer pessoal' ? { ...c, escopo: 'conjunto' as const } : c));
    expect(soCategoriasIniciais(trocada)).toBe(false);
  });

  it('uma inicial repetida no lugar de outra não engana a contagem', () => {
    const lista = iniciais();
    const semMoradia = lista.filter((c) => c.nome !== 'Moradia');
    const comMercadoDuplicado = [...semMoradia, { ...lista[0]! }];
    expect(soCategoriasIniciais(comMercadoDuplicado)).toBe(false);
  });

  it('lar sem nenhuma categoria (todas excluídas pelo titular) também tem dado alterado por ele', () => {
    expect(soCategoriasIniciais([])).toBe(false);
  });
});

describe('aceite do convite por quem já tem lar (CA-23.9 a CA-23.11, CA-11.2)', () => {
  it('sem lar: livre para entrar', () => {
    expect(decidirAceite(null)).toEqual({ ok: true, valor: 'livre' });
  });

  it('membro (não titular) de outro lar: ja_tem_lar', () => {
    expect(decidirAceite({ papel: 'membro', outrosMembrosNoLar: 1, categorias: iniciais() })).toEqual({
      ok: false,
      erro: 'ja_tem_lar',
    });
  });

  it('titular sozinho, só com as iniciais: o lar é descartado', () => {
    expect(decidirAceite({ papel: 'titular', outrosMembrosNoLar: 0, categorias: iniciais() })).toEqual({
      ok: true,
      valor: 'descartar',
    });
  });

  it('titular com membro (ativo ou que já saiu): ja_tem_lar, mesmo só com as iniciais', () => {
    expect(decidirAceite({ papel: 'titular', outrosMembrosNoLar: 1, categorias: iniciais() })).toEqual({
      ok: false,
      erro: 'ja_tem_lar',
    });
  });

  it('titular sozinho com qualquer dado: ja_tem_lar', () => {
    const comDado = [
      ...iniciais(),
      { tipo: 'receita' as const, escopo: 'individual' as const, nome: 'Bônus', variavel: null, arquivada: false },
    ];
    expect(decidirAceite({ papel: 'titular', outrosMembrosNoLar: 0, categorias: comDado })).toEqual({
      ok: false,
      erro: 'ja_tem_lar',
    });
  });
});

describe('convidar (RN-23; CA-23.7, CA-11.1; TM-API-16)', () => {
  const agora = new Date('2026-10-24T12:00:00.000Z');
  const base = {
    emailConvidado: 'bruno@exemplo.com',
    emailTitular: 'ana@exemplo.com',
    membrosAtivos: 1,
    convitesNasUltimas24h: 0,
    ultimoConviteMesmoEmailEm: null,
    agora,
  };

  it('titular sozinho convida outro e-mail: ok', () => {
    expect(avaliarConvite(base)).toEqual({ ok: true, valor: undefined });
  });

  it('CA-23.7: convidar o próprio e-mail (com outra caixa ou espaços) é valor_invalido', () => {
    expect(avaliarConvite({ ...base, emailConvidado: ' ANA@Exemplo.com ' })).toEqual({
      ok: false,
      erro: 'valor_invalido',
    });
  });

  it('CA-11.1: lar com 2 membros ativos → lar_cheio', () => {
    expect(avaliarConvite({ ...base, membrosAtivos: 2 })).toEqual({ ok: false, erro: 'lar_cheio' });
  });

  it('o próprio e-mail é recusado antes do lar cheio (valor_invalido vem antes das demais regras, RT-02)', () => {
    expect(avaliarConvite({ ...base, emailConvidado: base.emailTitular, membrosAtivos: 2 })).toEqual({
      ok: false,
      erro: 'valor_invalido',
    });
  });

  it('até 5 convites por lar em 24 h: o 6º é muitas_tentativas', () => {
    expect(avaliarConvite({ ...base, convitesNasUltimas24h: LIMITE_CONVITES_POR_DIA - 1 })).toEqual({
      ok: true,
      valor: undefined,
    });
    expect(avaliarConvite({ ...base, convitesNasUltimas24h: LIMITE_CONVITES_POR_DIA })).toEqual({
      ok: false,
      erro: 'muitas_tentativas',
    });
  });

  it('reenvio ao mesmo e-mail: antes de 2 min é convite_pendente; com 2 min, passa', () => {
    const ha = (ms: number) => new Date(agora.getTime() - ms);
    expect(avaliarConvite({ ...base, ultimoConviteMesmoEmailEm: ha(INTERVALO_REENVIO_CONVITE_MS - 1) })).toEqual({
      ok: false,
      erro: 'convite_pendente',
    });
    expect(avaliarConvite({ ...base, ultimoConviteMesmoEmailEm: ha(INTERVALO_REENVIO_CONVITE_MS) })).toEqual({
      ok: true,
      valor: undefined,
    });
  });

  it('constantes: validade de 7 dias, 5 convites por dia, reenvio a cada 2 min', () => {
    expect(VALIDADE_CONVITE_MS).toBe(7 * DIA);
    expect(LIMITE_CONVITES_POR_DIA).toBe(5);
    expect(INTERVALO_REENVIO_CONVITE_MS).toBe(2 * MINUTO);
  });
});

describe('nomes (RN-22, CA-22.4; CA-23.12)', () => {
  it('nome padrão do lar a partir do nome do cadastro, sem passar de 60 caracteres', () => {
    expect(nomeLarPadrao('Ana')).toBe('Lar de Ana');
    expect(nomeLarPadrao('  Ana  ')).toBe('Lar de Ana');
    const longo = nomeLarPadrao('x'.repeat(60));
    expect(longo.length).toBe(60);
    expect(longo.startsWith('Lar de ')).toBe(true);
  });

  it('o membro que sai vira "Ex-membro"', () => {
    expect(NOME_EX_MEMBRO).toBe('Ex-membro');
  });
});
