import { describe, expect, it } from 'vitest';
import { inicioDoDiaEmSaoPaulo } from './datas';
import {
  aplicarEvento,
  assinaturaInicial,
  CARENCIA_ATRASO_DIAS,
  planoEfetivo,
  situacaoAoAssinar,
  type EstadoAssinatura,
  type FatoCobranca,
} from './plano';

/**
 * Plano do lar (RN-24, RN-25; CA-24.1 a CA-24.4, CA-24.8 a CA-24.10; SDD 3.4, 8.5; decisão D4; G-29).
 * O plano efetivo não é guardado: sai da situação, das datas e do instante. O webhook é gatilho: a API consulta a
 * cobrança no Asaas e entrega aqui o fato atual; a transição nunca faz o estado regredir.
 */

const HORA = 60 * 60 * 1000;
const DIA = 24 * HORA;
const PRECO = 990;
const CRIADO = new Date('2026-10-24T15:00:00.000Z'); // 12:00 em São Paulo

function estado(parcial: Partial<EstadoAssinatura> = {}): EstadoAssinatura {
  return {
    situacao: 'trial',
    trialAte: new Date(CRIADO.getTime() + 14 * DIA),
    periodoAte: null,
    cobrancaId: null,
    cobrancaVencimento: null,
    cobrancaValorCentavos: null,
    cobrancaSituacao: null,
    ultimoEventoEm: null,
    ...parcial,
  };
}

function fato(parcial: Partial<FatoCobranca> = {}): FatoCobranca {
  return { id: 'pay_1', vencimento: '2026-11-10', valorCentavos: PRECO, situacao: 'pendente', ...parcial };
}

const EXPIRADO = { trialAte: CRIADO };

describe('assinatura inicial (CA-24.1, CA-24.10)', () => {
  it('lar novo de quem nunca teve trial: trial até criação + 14 dias', () => {
    expect(assinaturaInicial(CRIADO, false)).toEqual({
      situacao: 'trial',
      trialAte: new Date('2026-11-07T15:00:00.000Z'),
    });
  });

  it('quem já foi titular com trial: lar nasce free, sem trial (trial_ate = criação)', () => {
    const a = assinaturaInicial(CRIADO, true);
    expect(a).toEqual({ situacao: 'free', trialAte: CRIADO });
    expect(planoEfetivo(estado(a), CRIADO)).toBe('free');
  });
});

describe('plano efetivo (D4; CA-24.1, CA-24.2, CA-24.8, CA-24.9)', () => {
  it('sem assinatura: free (falha fechada)', () => {
    expect(planoEfetivo(null, CRIADO)).toBe('free');
  });

  it('trial vale até trial_ate (exclusivo) e cai para free sem precisar de evento', () => {
    const e = estado();
    expect(planoEfetivo(e, CRIADO)).toBe('pro');
    expect(planoEfetivo(e, new Date(e.trialAte.getTime() - 1))).toBe('pro');
    expect(planoEfetivo(e, e.trialAte)).toBe('free');
    expect(planoEfetivo(e, new Date(e.trialAte.getTime() + 30 * DIA))).toBe('free');
  });

  it('ativa é pro', () => {
    expect(planoEfetivo(estado({ situacao: 'ativa', ...EXPIRADO }), new Date('2027-05-01T00:00:00Z'))).toBe('pro');
  });

  it('cancelada mantém o pro até periodo_ate e só então vira free (CA-24.8)', () => {
    const fim = inicioDoDiaEmSaoPaulo('2026-12-10');
    const e = estado({ situacao: 'cancelada', periodoAte: fim, ...EXPIRADO });
    expect(planoEfetivo(e, new Date(fim.getTime() - 1))).toBe('pro');
    expect(planoEfetivo(e, fim)).toBe('free');
  });

  it('cancelada sem período pago (cancelou antes de pagar) segue o trial', () => {
    expect(planoEfetivo(estado({ situacao: 'cancelada' }), CRIADO)).toBe('pro');
    expect(planoEfetivo(estado({ situacao: 'cancelada', ...EXPIRADO }), CRIADO)).toBe('free');
  });

  it(`atrasada: pro por ${CARENCIA_ATRASO_DIAS} dias após o vencimento (São Paulo), depois free (CA-24.9)`, () => {
    expect(CARENCIA_ATRASO_DIAS).toBe(3);
    const e = estado({
      situacao: 'atrasada',
      ...EXPIRADO,
      cobrancaId: 'pay_1',
      cobrancaVencimento: '2026-11-10',
      cobrancaValorCentavos: PRECO,
      cobrancaSituacao: 'vencida',
    });
    // 13/11 23:59 em SP ainda é carência; 14/11 00:00 em SP já não é.
    expect(planoEfetivo(e, new Date('2026-11-11T12:00:00-03:00'))).toBe('pro');
    expect(planoEfetivo(e, new Date('2026-11-13T23:59:59-03:00'))).toBe('pro');
    expect(planoEfetivo(e, new Date('2026-11-14T00:00:00-03:00'))).toBe('free');
  });

  it('atrasada sem cobrança conhecida não ganha carência', () => {
    expect(planoEfetivo(estado({ situacao: 'atrasada', ...EXPIRADO }), CRIADO)).toBe('free');
  });

  it('free é free, mas um período pago ainda em vigor continua valendo', () => {
    expect(planoEfetivo(estado({ situacao: 'free', ...EXPIRADO }), CRIADO)).toBe('free');
    const fim = inicioDoDiaEmSaoPaulo('2026-12-01');
    expect(planoEfetivo(estado({ situacao: 'free', ...EXPIRADO, periodoAte: fim }), CRIADO)).toBe('pro');
  });
});

describe('situação ao assinar de novo', () => {
  it('mantém trial ou free; cancelada volta a esperar o pagamento (trial se ainda vale, senão free)', () => {
    expect(situacaoAoAssinar(estado(), CRIADO)).toBe('trial');
    expect(situacaoAoAssinar(estado({ situacao: 'free', ...EXPIRADO }), CRIADO)).toBe('free');
    expect(situacaoAoAssinar(estado({ situacao: 'cancelada' }), CRIADO)).toBe('trial');
    expect(situacaoAoAssinar(estado({ situacao: 'cancelada', ...EXPIRADO }), CRIADO)).toBe('free');
  });
});

describe('aplicarEvento: pagamento (CA-24.3, CA-24.4, CA-24.7; G-29)', () => {
  const quando = new Date('2026-10-24T16:00:00Z');

  it('pagamento confirmado: ativa, período até o vencimento + 1 mês, e o e-mail de confirmação', () => {
    const d = aplicarEvento(
      estado({
        cobrancaId: 'pay_1',
        cobrancaVencimento: '2026-10-24',
        cobrancaValorCentavos: PRECO,
        cobrancaSituacao: 'pendente',
      }),
      { tipo: 'PAYMENT_CONFIRMED', ocorridoEm: quando, cobranca: fato({ vencimento: '2026-10-24', situacao: 'paga' }) },
      PRECO,
    );
    expect(d.tipo).toBe('aplicado');
    if (d.tipo !== 'aplicado') return;
    expect(d.estado.situacao).toBe('ativa');
    expect(d.estado.periodoAte).toEqual(inicioDoDiaEmSaoPaulo('2026-11-24'));
    expect(d.estado.cobrancaSituacao).toBe('paga');
    expect(d.estado.ultimoEventoEm).toEqual(quando);
    expect(d.efeitos).toEqual(['pagamento_confirmado']);
  });

  it('confirmado e depois recebido da mesma cobrança: o segundo não tem efeito novo', () => {
    const primeiro = aplicarEvento(
      estado(),
      { tipo: 'PAYMENT_CONFIRMED', ocorridoEm: quando, cobranca: fato({ situacao: 'paga' }) },
      PRECO,
    );
    if (primeiro.tipo !== 'aplicado') throw new Error('esperava aplicado');
    const segundo = aplicarEvento(
      primeiro.estado,
      { tipo: 'PAYMENT_RECEIVED', ocorridoEm: new Date(quando.getTime() + HORA), cobranca: fato({ situacao: 'paga' }) },
      PRECO,
    );
    expect(segundo).toEqual({ tipo: 'ignorado', motivo: 'sem_efeito' });
  });

  it('"cobrança criada" depois de "pagamento recebido" da mesma cobrança: continua ativa (CA-24.4)', () => {
    const pago = aplicarEvento(
      estado(),
      { tipo: 'PAYMENT_RECEIVED', ocorridoEm: quando, cobranca: fato({ situacao: 'paga' }) },
      PRECO,
    );
    if (pago.tipo !== 'aplicado') throw new Error('esperava aplicado');
    // Mais antigo que o último aplicado: fora de ordem.
    expect(
      aplicarEvento(
        pago.estado,
        {
          tipo: 'PAYMENT_CREATED',
          ocorridoEm: new Date(quando.getTime() - HORA),
          cobranca: fato({ situacao: 'paga' }),
        },
        PRECO,
      ),
    ).toEqual({ tipo: 'ignorado', motivo: 'fora_de_ordem' });
    // Mesmo instante ou mais novo: a consulta diz "paga" e nada muda.
    const tardio = aplicarEvento(
      pago.estado,
      { tipo: 'PAYMENT_CREATED', ocorridoEm: quando, cobranca: fato({ situacao: 'paga' }) },
      PRECO,
    );
    expect(tardio).toEqual({ tipo: 'ignorado', motivo: 'sem_efeito' });
  });

  it('valor diferente do preço vigente não ativa (G-29; CA-24.7)', () => {
    expect(
      aplicarEvento(
        estado(),
        { tipo: 'PAYMENT_CONFIRMED', ocorridoEm: quando, cobranca: fato({ situacao: 'paga', valorCentavos: 1 }) },
        PRECO,
      ),
    ).toEqual({ tipo: 'ignorado', motivo: 'valor_divergente' });
  });

  it('o período nunca encolhe e não soma duas vezes a mesma cobrança', () => {
    const fimLonge = inicioDoDiaEmSaoPaulo('2027-03-01');
    const d = aplicarEvento(
      estado({ situacao: 'ativa', periodoAte: fimLonge }),
      { tipo: 'PAYMENT_CONFIRMED', ocorridoEm: quando, cobranca: fato({ situacao: 'paga', vencimento: '2026-11-10' }) },
      PRECO,
    );
    if (d.tipo !== 'aplicado') throw new Error('esperava aplicado');
    expect(d.estado.periodoAte).toEqual(fimLonge);
  });

  it('depois do pagamento, a próxima cobrança em aberto vira a atual', () => {
    const d = aplicarEvento(
      estado({
        cobrancaId: 'pay_1',
        cobrancaVencimento: '2026-10-24',
        cobrancaValorCentavos: PRECO,
        cobrancaSituacao: 'pendente',
      }),
      {
        tipo: 'PAYMENT_RECEIVED',
        ocorridoEm: quando,
        cobranca: fato({ id: 'pay_1', vencimento: '2026-10-24', situacao: 'paga' }),
        proximaAberta: fato({ id: 'pay_2', vencimento: '2026-11-24', situacao: 'pendente' }),
      },
      PRECO,
    );
    if (d.tipo !== 'aplicado') throw new Error('esperava aplicado');
    expect(d.estado).toMatchObject({
      situacao: 'ativa',
      cobrancaId: 'pay_2',
      cobrancaVencimento: '2026-11-24',
      cobrancaSituacao: 'pendente',
    });
  });

  it('pagamento atrasado (dentro ou depois da carência) volta a ativa (CA-24.9)', () => {
    const atrasada = estado({
      situacao: 'atrasada',
      ...EXPIRADO,
      cobrancaId: 'pay_1',
      cobrancaVencimento: '2026-11-10',
      cobrancaValorCentavos: PRECO,
      cobrancaSituacao: 'vencida',
      ultimoEventoEm: new Date('2026-11-11T09:00:00Z'),
    });
    const d = aplicarEvento(
      atrasada,
      { tipo: 'PAYMENT_RECEIVED', ocorridoEm: new Date('2026-11-20T09:00:00Z'), cobranca: fato({ situacao: 'paga' }) },
      PRECO,
    );
    if (d.tipo !== 'aplicado') throw new Error('esperava aplicado');
    expect(d.estado.situacao).toBe('ativa');
    expect(d.estado.periodoAte).toEqual(inicioDoDiaEmSaoPaulo('2026-12-10'));
  });

  it('pagamento atrasado de uma assinatura cancelada só estende o período, não reativa', () => {
    const d = aplicarEvento(
      estado({ situacao: 'cancelada', ...EXPIRADO }),
      { tipo: 'PAYMENT_CONFIRMED', ocorridoEm: quando, cobranca: fato({ situacao: 'paga' }) },
      PRECO,
    );
    if (d.tipo !== 'aplicado') throw new Error('esperava aplicado');
    expect(d.estado.situacao).toBe('cancelada');
    expect(d.estado.periodoAte).toEqual(inicioDoDiaEmSaoPaulo('2026-12-10'));
  });
});

describe('aplicarEvento: ordem e repetição (G-29; SDD 10)', () => {
  it('evento mais antigo que o último aplicado é ignorado (CONFIRMED depois de OVERDUE com data anterior)', () => {
    const e = estado({ situacao: 'atrasada', ultimoEventoEm: new Date('2026-11-11T10:00:00Z') });
    expect(
      aplicarEvento(
        e,
        {
          tipo: 'PAYMENT_CONFIRMED',
          ocorridoEm: new Date('2026-11-11T09:59:59Z'),
          cobranca: fato({ situacao: 'paga' }),
        },
        PRECO,
      ),
    ).toEqual({ tipo: 'ignorado', motivo: 'fora_de_ordem' });
  });

  it('evento de cobrança sem o fato consultado é ignorado (o evento é só gatilho)', () => {
    expect(aplicarEvento(estado(), { tipo: 'PAYMENT_CONFIRMED', ocorridoEm: CRIADO }, PRECO)).toEqual({
      tipo: 'ignorado',
      motivo: 'sem_efeito',
    });
  });

  it('tipo desconhecido é ignorado', () => {
    expect(aplicarEvento(estado(), { tipo: 'PAYMENT_ANTICIPATED', ocorridoEm: CRIADO }, PRECO)).toEqual({
      tipo: 'ignorado',
      motivo: 'tipo_ignorado',
    });
  });
});

describe('aplicarEvento: cobrança criada e vencida', () => {
  const quando = new Date('2026-11-01T12:00:00Z');

  it('cobrança nova: guarda como atual, mantém a situação e avisa por e-mail', () => {
    const d = aplicarEvento(
      estado({ situacao: 'ativa', ...EXPIRADO }),
      { tipo: 'PAYMENT_CREATED', ocorridoEm: quando, cobranca: fato() },
      PRECO,
    );
    if (d.tipo !== 'aplicado') throw new Error('esperava aplicado');
    expect(d.estado).toMatchObject({
      situacao: 'ativa',
      cobrancaId: 'pay_1',
      cobrancaVencimento: '2026-11-10',
      cobrancaValorCentavos: PRECO,
      cobrancaSituacao: 'pendente',
    });
    expect(d.efeitos).toEqual(['cobranca_gerada']);
  });

  it('cobrança mais nova não toma o lugar de uma mais antiga ainda em aberto (a dívida vem primeiro)', () => {
    const e = estado({
      situacao: 'atrasada',
      ...EXPIRADO,
      cobrancaId: 'pay_1',
      cobrancaVencimento: '2026-11-10',
      cobrancaValorCentavos: PRECO,
      cobrancaSituacao: 'vencida',
    });
    const d = aplicarEvento(
      e,
      { tipo: 'PAYMENT_CREATED', ocorridoEm: quando, cobranca: fato({ id: 'pay_2', vencimento: '2026-12-10' }) },
      PRECO,
    );
    if (d.tipo !== 'aplicado') throw new Error('esperava aplicado');
    expect(d.estado.cobrancaId).toBe('pay_1');
    expect(d.estado.situacao).toBe('atrasada');
    expect(d.efeitos).toEqual(['cobranca_gerada']);
  });

  it('a cobrança que o assinar já guardou não gera e-mail de novo', () => {
    const e = estado({
      cobrancaId: 'pay_1',
      cobrancaVencimento: '2026-11-10',
      cobrancaValorCentavos: PRECO,
      cobrancaSituacao: 'pendente',
    });
    expect(aplicarEvento(e, { tipo: 'PAYMENT_CREATED', ocorridoEm: quando, cobranca: fato() }, PRECO)).toEqual({
      tipo: 'ignorado',
      motivo: 'sem_efeito',
    });
  });

  it('vencida numa assinatura ativa: atrasada, com o e-mail de atraso', () => {
    const e = estado({
      situacao: 'ativa',
      ...EXPIRADO,
      cobrancaId: 'pay_1',
      cobrancaVencimento: '2026-11-10',
      cobrancaValorCentavos: PRECO,
      cobrancaSituacao: 'pendente',
    });
    const d = aplicarEvento(
      e,
      {
        tipo: 'PAYMENT_OVERDUE',
        ocorridoEm: new Date('2026-11-11T09:00:00Z'),
        cobranca: fato({ situacao: 'vencida' }),
      },
      PRECO,
    );
    if (d.tipo !== 'aplicado') throw new Error('esperava aplicado');
    expect(d.estado.situacao).toBe('atrasada');
    expect(d.estado.cobrancaSituacao).toBe('vencida');
    expect(d.efeitos).toEqual(['atraso']);
  });

  it('vencida antes do primeiro pagamento (trial ou free): não dá carência, só marca a cobrança', () => {
    const d = aplicarEvento(
      estado({
        situacao: 'free',
        ...EXPIRADO,
        cobrancaId: 'pay_1',
        cobrancaVencimento: '2026-11-10',
        cobrancaValorCentavos: PRECO,
        cobrancaSituacao: 'pendente',
      }),
      { tipo: 'PAYMENT_OVERDUE', ocorridoEm: quando, cobranca: fato({ situacao: 'vencida' }) },
      PRECO,
    );
    if (d.tipo !== 'aplicado') throw new Error('esperava aplicado');
    expect(d.estado.situacao).toBe('free');
    expect(d.estado.cobrancaSituacao).toBe('vencida');
    expect(d.efeitos).toEqual([]);
    expect(planoEfetivo(d.estado, new Date('2026-11-11T12:00:00Z'))).toBe('free');
  });

  it('"vencida" de uma cobrança já paga não rebaixa (a consulta manda)', () => {
    const e = estado({
      situacao: 'ativa',
      cobrancaId: 'pay_1',
      cobrancaVencimento: '2026-11-10',
      cobrancaValorCentavos: PRECO,
      cobrancaSituacao: 'paga',
    });
    expect(
      aplicarEvento(e, { tipo: 'PAYMENT_OVERDUE', ocorridoEm: quando, cobranca: fato({ situacao: 'paga' }) }, PRECO),
    ).toEqual({ tipo: 'ignorado', motivo: 'sem_efeito' });
  });

  it('cobrança apagada ou estornada que era a atual em aberto: sai da tela; as outras não mudam nada', () => {
    const e = estado({
      situacao: 'ativa',
      cobrancaId: 'pay_1',
      cobrancaVencimento: '2026-11-10',
      cobrancaValorCentavos: PRECO,
      cobrancaSituacao: 'pendente',
    });
    const d = aplicarEvento(
      e,
      { tipo: 'PAYMENT_DELETED', ocorridoEm: quando, cobranca: fato({ situacao: 'outra' }) },
      PRECO,
    );
    if (d.tipo !== 'aplicado') throw new Error('esperava aplicado');
    expect(d.estado).toMatchObject({ situacao: 'ativa', cobrancaId: null, cobrancaSituacao: null });
    expect(
      aplicarEvento(
        e,
        { tipo: 'PAYMENT_DELETED', ocorridoEm: quando, cobranca: fato({ id: 'pay_9', situacao: 'outra' }) },
        PRECO,
      ),
    ).toEqual({ tipo: 'ignorado', motivo: 'sem_efeito' });
  });
});

describe('aplicarEvento: assinatura removida ou inativada', () => {
  it('vira cancelada, mantém o período pago e tira a cobrança em aberto', () => {
    const fim = inicioDoDiaEmSaoPaulo('2026-12-10');
    const e = estado({
      situacao: 'ativa',
      periodoAte: fim,
      cobrancaId: 'pay_2',
      cobrancaVencimento: '2026-12-10',
      cobrancaValorCentavos: PRECO,
      cobrancaSituacao: 'pendente',
    });
    for (const tipo of ['SUBSCRIPTION_DELETED', 'SUBSCRIPTION_INACTIVATED']) {
      const d = aplicarEvento(e, { tipo, ocorridoEm: CRIADO }, PRECO);
      if (d.tipo !== 'aplicado') throw new Error('esperava aplicado');
      expect(d.estado).toMatchObject({ situacao: 'cancelada', periodoAte: fim, cobrancaId: null });
    }
  });

  it('já cancelada: sem efeito', () => {
    expect(
      aplicarEvento(estado({ situacao: 'cancelada' }), { tipo: 'SUBSCRIPTION_DELETED', ocorridoEm: CRIADO }, PRECO),
    ).toEqual({
      tipo: 'ignorado',
      motivo: 'sem_efeito',
    });
  });
});

describe('inicioDoDiaEmSaoPaulo', () => {
  it('é a meia-noite civil de São Paulo (UTC−3 hoje)', () => {
    expect(inicioDoDiaEmSaoPaulo('2026-11-24').toISOString()).toBe('2026-11-24T03:00:00.000Z');
  });

  it('no horário de verão histórico (UTC−2) também acerta', () => {
    expect(inicioDoDiaEmSaoPaulo('2018-01-10').toISOString()).toBe('2018-01-10T02:00:00.000Z');
  });

  it('data inválida lança', () => {
    expect(() => inicioDoDiaEmSaoPaulo('2026-02-30')).toThrow(RangeError);
  });
});
