import { sql } from 'kysely';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Bindings } from './env';
import { bancoDisponivel, chamar } from './testes-suporte';
import { linhasComoOwner } from './testes-suporte-lar';
import {
  assinarOk,
  assinaturaNoBanco,
  DIA,
  eventoCobranca,
  larAtivo,
  larDePlano,
  meuPlano,
  webhook,
  webhookOk,
} from './testes-suporte-plano';

/**
 * Webhook do Asaas (RN-24; SDD 8.5, 10; CA-24.3 a CA-24.5, CA-24.9; G-28, G-29; TM-ASA-01, TM-ASA-02, TM-ASA-04).
 * Decisão do usuário: o evento é GATILHO — idempotente pelo id, ordenado por `dateCreated`, estado nunca regride, e a
 * situação da cobrança vem da consulta ao Asaas (aqui, o Asaas falso).
 */

afterEach(() => vi.restoreAllMocks());

const HORA = 60 * 60 * 1000;

async function eventosNoBanco(eventId: string) {
  return linhasComoOwner(sql<{ tipo: string; resumo: Record<string, unknown>; processado_em: Date | null }>`
    select tipo, resumo, processado_em from app.webhook_evento where event_id = ${eventId}`);
}

describe.skipIf(!bancoDisponivel)('autenticação do webhook (CA-24.5; G-28; TM-ASA-01, TM-ASA-04)', () => {
  it('sem token, com token errado ou de outro tamanho: 401 token_invalido, sem detalhe e sem mudar nada', async () => {
    const l = await larDePlano('wh.token');
    const { primeira } = await assinarOk(l);
    l.asaas.status(primeira.id, 'RECEIVED');
    const corpo = eventoCobranca('PAYMENT_RECEIVED', l.asaas.cobrancas.get(primeira.id)!, l.relogio.agora());
    for (const token of [null, '', 'errado', `${'x'.repeat(43)}`, 'x'.repeat(300)]) {
      const r = await webhook(l.app, corpo, { token });
      expect(r.status, String(token)).toBe(401);
      expect(await r.json()).toEqual({ code: 'token_invalido', message: 'Não autorizado.' });
    }
    expect((await assinaturaNoBanco(l.larId))?.situacao).toBe('trial');
    expect(await eventosNoBanco(corpo.id)).toEqual([]);
    expect(l.asaas.chamadas).not.toContain('buscarCobranca');
  });

  it('o token é conferido antes de tocar o banco: com o banco fora do ar, token errado ainda dá 401', async () => {
    const l = await larDePlano('wh.token.semBanco');
    const r = await webhook(
      l.app,
      { id: 'evt_x', event: 'PAYMENT_RECEIVED', dateCreated: '2026-10-24 12:00:00' },
      { token: 'errado', ajustes: { HYPERDRIVE: { connectionString: 'postgres://x:x@127.0.0.1:1/x' } as Hyperdrive } },
    );
    expect(r.status).toBe(401);
  });

  it('fica fora do CSRF e da sessão: o Asaas não manda cookie nem o cabeçalho do app', async () => {
    const l = await larDePlano('wh.csrf');
    const r = await webhookOk(l.app, {
      id: `evt_${crypto.randomUUID()}`,
      event: 'SUBSCRIPTION_CREATED',
      dateCreated: '2026-10-24 12:00:00',
      subscription: { id: 'sub_desconhecida' },
    });
    expect(r).toBe('ignorado');
  });

  it('passa pelo LIMITE_WEBHOOK: 429 muitas_requisicoes quando o limite nega', async () => {
    const l = await larDePlano('wh.limite');
    const negar = { limit: async () => ({ success: false }) } as unknown as RateLimit;
    const r = await webhook(l.app, {}, { ajustes: { LIMITE_WEBHOOK: negar } as Partial<Bindings> });
    expect(r.status).toBe(429);
    expect(await r.json()).toMatchObject({ code: 'muitas_requisicoes' });
  });

  it('só POST: outro método não existe', async () => {
    const l = await larDePlano('wh.metodo');
    const r = await chamar(l.app, '/api/webhooks/asaas', { method: 'GET' });
    expect(r.status).toBe(404);
  });

  it('corpo que não é um evento do Asaas (com token certo): 400 valor_invalido', async () => {
    const l = await larDePlano('wh.corpo');
    expect((await webhook(l.app, 'não é json')).status).toBe(400);
    expect((await webhook(l.app, { event: 'PAYMENT_RECEIVED' })).status).toBe(400);
  });
});

describe.skipIf(!bancoDisponivel)('pagamento confirmado e repetido (CA-24.3)', () => {
  it('pagamento confirmado: ativa, período até o vencimento + 1 mês, e-mail ao titular', async () => {
    const l = await larDePlano('wh.pago', { comMembro: true });
    const { primeira } = await assinarOk(l);
    l.asaas.status(primeira.id, 'CONFIRMED');
    const corpo = eventoCobranca('PAYMENT_CONFIRMED', l.asaas.cobrancas.get(primeira.id)!, l.relogio.agora());
    expect(await webhookOk(l.app, corpo)).toBe('aplicado');
    const p = await meuPlano(l.app, l.titular);
    expect(p).toMatchObject({ plano: 'pro', situacao: 'ativa', periodo_ate: '2026-11-24T03:00:00.000Z' });
    expect(p.cobranca).toBeUndefined();
    // Vale para os dois membros na próxima requisição.
    expect(await meuPlano(l.app, l.membro!)).toMatchObject({ plano: 'pro', situacao: 'ativa' });
    const emails = l.caixa.para(l.titular.email).filter((m) => m.assunto.includes('Pagamento confirmado'));
    expect(emails).toHaveLength(1);
    expect(emails[0]!.texto).toContain('R$ 9,90');
    expect(emails[0]!.texto).toContain('https://teste.exemplo.local/app/ajustes/plano');
    expect(l.caixa.para(l.membro!.email).filter((m) => m.assunto.includes('Pagamento'))).toHaveLength(0);
    const [ev] = await eventosNoBanco(corpo.id);
    expect(ev?.tipo).toBe('PAYMENT_CONFIRMED');
    expect(ev?.processado_em).not.toBeNull();
    expect(Object.keys(ev!.resumo).sort()).toEqual(
      ['cobranca_id', 'resultado', 'situacao_cobranca', 'valor_centavos', 'vencimento'].sort(),
    );
  });

  it('o mesmo evento reenviado: 200, sem efeito novo nem e-mail de novo', async () => {
    const l = await larDePlano('wh.repetido');
    const { primeira } = await assinarOk(l);
    l.asaas.status(primeira.id, 'RECEIVED');
    const corpo = eventoCobranca('PAYMENT_RECEIVED', l.asaas.cobrancas.get(primeira.id)!, l.relogio.agora());
    expect(await webhookOk(l.app, corpo)).toBe('aplicado');
    const antes = await assinaturaNoBanco(l.larId);
    const chamadas = l.asaas.chamadas.length;
    expect(await webhookOk(l.app, corpo)).toBe('repetido');
    expect(await webhookOk(l.app, corpo)).toBe('repetido');
    expect(await assinaturaNoBanco(l.larId)).toEqual(antes);
    expect(l.caixa.para(l.titular.email).filter((m) => m.assunto.includes('Pagamento confirmado'))).toHaveLength(1);
    // Repetido não consulta o Asaas de novo.
    expect(l.asaas.chamadas.length).toBe(chamadas);
  });

  it('o mesmo evento chegando duas vezes ao mesmo tempo aplica uma vez só', async () => {
    const l = await larDePlano('wh.corrida');
    const { primeira } = await assinarOk(l);
    l.asaas.status(primeira.id, 'RECEIVED');
    const corpo = eventoCobranca('PAYMENT_RECEIVED', l.asaas.cobrancas.get(primeira.id)!, l.relogio.agora());
    const resultados = await Promise.all([webhookOk(l.app, corpo), webhookOk(l.app, corpo)]);
    expect(resultados.sort()).toEqual(['aplicado', 'repetido']);
    expect(l.caixa.para(l.titular.email).filter((m) => m.assunto.includes('Pagamento confirmado'))).toHaveLength(1);
  });

  it('CONFIRMED e depois RECEIVED da mesma cobrança (Pix): o segundo é sem efeito', async () => {
    const l = await larDePlano('wh.confirmado.recebido');
    const { primeira } = await assinarOk(l);
    l.asaas.status(primeira.id, 'CONFIRMED');
    await webhookOk(l.app, eventoCobranca('PAYMENT_CONFIRMED', l.asaas.cobrancas.get(primeira.id)!, l.relogio.agora()));
    l.asaas.status(primeira.id, 'RECEIVED');
    expect(
      await webhookOk(
        l.app,
        eventoCobranca(
          'PAYMENT_RECEIVED',
          l.asaas.cobrancas.get(primeira.id)!,
          new Date(l.relogio.agora().getTime() + HORA),
        ),
      ),
    ).toBe('ignorado');
    expect(l.caixa.para(l.titular.email).filter((m) => m.assunto.includes('Pagamento confirmado'))).toHaveLength(1);
  });
});

describe.skipIf(!bancoDisponivel)('eventos fora de ordem: o estado nunca regride (CA-24.4; G-29; TM-ASA-02)', () => {
  it('"pagamento recebido" e depois "cobrança criada" da mesma cobrança: continua ativa (CA-24.4)', async () => {
    const l = await larAtivo('wh.invertido');
    const cobranca = l.asaas.cobrancas.get(l.primeira.id)!;
    // O "criado" chega depois, com a data original (mais velha) e também com a data de agora.
    const criadoAntes = eventoCobranca('PAYMENT_CREATED', { ...cobranca, status: 'PENDING' }, new Date(AGORA() - HORA));
    expect(await webhookOk(l.app, criadoAntes)).toBe('ignorado');
    const criadoAgora = eventoCobranca('PAYMENT_CREATED', { ...cobranca, status: 'PENDING' }, new Date(AGORA() + HORA));
    expect(await webhookOk(l.app, criadoAgora)).toBe('ignorado');
    const p = await meuPlano(l.app, l.titular);
    expect(p).toMatchObject({ plano: 'pro', situacao: 'ativa' });
    expect(p.cobranca).toBeUndefined();
    expect((await eventosNoBanco(criadoAntes.id))[0]?.resumo).toMatchObject({ resultado: 'fora_de_ordem' });
    function AGORA() {
      return l.relogio.agora().getTime();
    }
  });

  it('o nome do evento não manda: um "recebido" de cobrança que o Asaas diz estar pendente não ativa', async () => {
    const l = await larDePlano('wh.forjado');
    const { primeira } = await assinarOk(l);
    const forjado = eventoCobranca('PAYMENT_RECEIVED', { ...primeira, status: 'RECEIVED' }, l.relogio.agora());
    await webhookOk(l.app, forjado);
    expect((await assinaturaNoBanco(l.larId))?.situacao).toBe('trial');
  });

  it('valor diferente do preço vigente não ativa (G-29)', async () => {
    const l = await larDePlano('wh.valor');
    const { primeira } = await assinarOk(l);
    l.asaas.cobrancas.set(primeira.id, { ...primeira, valorCentavos: 1, status: 'RECEIVED' });
    expect(await webhookOk(l.app, eventoCobranca('PAYMENT_RECEIVED', primeira, l.relogio.agora()))).toBe('ignorado');
    expect((await assinaturaNoBanco(l.larId))?.situacao).toBe('trial');
  });

  it('cobrança de outro cliente do Asaas não mexe no lar (G-29)', async () => {
    const l = await larDePlano('wh.cliente');
    const { primeira } = await assinarOk(l);
    l.asaas.cobrancas.set(primeira.id, { ...primeira, clienteId: 'cus_de_outro', status: 'RECEIVED' });
    expect(await webhookOk(l.app, eventoCobranca('PAYMENT_RECEIVED', primeira, l.relogio.agora()))).toBe('ignorado');
    expect((await assinaturaNoBanco(l.larId))?.situacao).toBe('trial');
  });

  it('assinatura desconhecida: 200 e ignora; cobrança que o Asaas não conhece: 200 e ignora', async () => {
    const l = await larDePlano('wh.desconhecida');
    const r = await webhookOk(l.app, {
      id: `evt_${crypto.randomUUID()}`,
      event: 'PAYMENT_RECEIVED',
      dateCreated: '2026-10-24 12:00:00',
      payment: { id: 'pay_inexistente', subscription: 'sub_inexistente' },
    });
    expect(r).toBe('ignorado');
  });

  it('Asaas fora do ar na consulta: 503, nada gravado; o reenvio do mesmo evento depois funciona', async () => {
    const l = await larDePlano('wh.queda');
    const { primeira } = await assinarOk(l);
    l.asaas.status(primeira.id, 'RECEIVED');
    const corpo = eventoCobranca('PAYMENT_RECEIVED', l.asaas.cobrancas.get(primeira.id)!, l.relogio.agora());
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    l.asaas.falhar.add('buscarCobranca');
    const r = await webhook(l.app, corpo);
    expect(r.status).toBe(503);
    expect(await r.json()).toMatchObject({ code: 'indisponivel' });
    expect(await eventosNoBanco(corpo.id)).toEqual([]);
    l.asaas.falhar.delete('buscarCobranca');
    expect(await webhookOk(l.app, corpo)).toBe('aplicado');
    expect((await assinaturaNoBanco(l.larId))?.situacao).toBe('ativa');
  });
});

describe.skipIf(!bancoDisponivel)('atraso e carência de 3 dias (CA-24.9)', () => {
  it('cobrança vencida: atrasada, e-mail de atraso, Pro por 3 dias e depois free; CONFIRMED mais velho é ignorado; pagar volta a ativa', async () => {
    const l = await larAtivo('wh.atraso');
    // A próxima cobrança (vence 24/11) é criada: e-mail de cobrança gerada.
    const segunda = l.asaas.novaCobranca(l.assinaturaId, '2026-11-24');
    expect(
      await webhookOk(l.app, eventoCobranca('PAYMENT_CREATED', l.asaas.cobrancas.get(segunda)!, l.relogio.agora())),
    ).toBe('aplicado');
    expect(l.caixa.para(l.titular.email).filter((m) => m.assunto.includes('Sua cobrança'))).toHaveLength(1);
    expect((await meuPlano(l.app, l.titular)).cobranca).toMatchObject({
      vencimento: '2026-11-24',
      situacao: 'pendente',
    });

    // 25/11: venceu sem pagamento.
    await l.avancar(new Date('2026-11-25T12:00:00-03:00').getTime() - l.relogio.agora().getTime());
    l.asaas.status(segunda, 'OVERDUE');
    const vencida = eventoCobranca('PAYMENT_OVERDUE', l.asaas.cobrancas.get(segunda)!, l.relogio.agora());
    expect(await webhookOk(l.app, vencida)).toBe('aplicado');
    expect(await meuPlano(l.app, l.titular)).toMatchObject({ plano: 'pro', situacao: 'atrasada' });
    expect((await meuPlano(l.app, l.titular)).cobranca).toMatchObject({ situacao: 'vencida' });
    expect(l.caixa.para(l.titular.email).filter((m) => m.assunto.includes('atraso'))).toHaveLength(1);

    // Um CONFIRMED com data anterior ao OVERDUE já aplicado é ignorado (SDD 10).
    l.asaas.status(segunda, 'CONFIRMED');
    const velho = eventoCobranca(
      'PAYMENT_CONFIRMED',
      l.asaas.cobrancas.get(segunda)!,
      new Date(l.relogio.agora().getTime() - HORA),
    );
    expect(await webhookOk(l.app, velho)).toBe('ignorado');
    expect((await assinaturaNoBanco(l.larId))?.situacao).toBe('atrasada');
    l.asaas.status(segunda, 'OVERDUE');

    // Carência: até o fim de 27/11 (vencimento 24/11 + 3 dias) em São Paulo.
    await l.avancar(new Date('2026-11-27T23:59:00-03:00').getTime() - l.relogio.agora().getTime());
    expect((await meuPlano(l.app, l.titular)).plano).toBe('pro');
    await l.avancar(new Date('2026-11-28T00:00:00-03:00').getTime() - l.relogio.agora().getTime());
    expect((await meuPlano(l.app, l.titular)).plano).toBe('free');

    // Pagou depois da carência: volta a ativa, período até 24/12.
    l.asaas.status(segunda, 'RECEIVED');
    const pago = eventoCobranca('PAYMENT_RECEIVED', l.asaas.cobrancas.get(segunda)!, l.relogio.agora());
    expect(await webhookOk(l.app, pago)).toBe('aplicado');
    expect(await meuPlano(l.app, l.titular)).toMatchObject({
      plano: 'pro',
      situacao: 'ativa',
      periodo_ate: '2026-12-24T03:00:00.000Z',
    });
  });

  it('remoção da assinatura no Asaas: cancelada, mantendo o período pago', async () => {
    const l = await larAtivo('wh.removida');
    await l.avancar(DIA);
    const r = await webhookOk(l.app, {
      id: `evt_${crypto.randomUUID()}`,
      event: 'SUBSCRIPTION_DELETED',
      dateCreated: '2026-10-25 12:00:00',
      subscription: { id: l.assinaturaId },
    });
    expect(r).toBe('aplicado');
    expect(await meuPlano(l.app, l.titular)).toMatchObject({
      plano: 'pro',
      situacao: 'cancelada',
      periodo_ate: '2026-11-24T03:00:00.000Z',
    });
  });
});
