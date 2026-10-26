import { saida } from '@controle/contrato';
import { sql } from 'kysely';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { bancoDisponivel } from './testes-suporte';
import { convidarEAceitar, criarLarDe, json, linhasComoOwner, pedir, pessoa } from './testes-suporte-lar';
import {
  AGORA_PLANO,
  assinarOk,
  assinarPlano,
  assinaturaNoBanco,
  cancelarPlano,
  CPF_DIGITOS,
  CPF_TESTE,
  DIA,
  larAtivo,
  larDePlano,
  meuPlano,
} from './testes-suporte-plano';

/**
 * Plano do lar pela API (RN-24; SDD 6.2 "Plano", 8.5; CA-22.1, CA-24.1, CA-24.2, CA-24.6 a CA-24.11; G-31, G-34).
 * Asaas falso injetado: nenhuma chamada sai e nenhuma chave real existe. "Hoje" = 24/10/2026 12:00 em São Paulo.
 */

afterEach(() => vi.restoreAllMocks());

const P = (r: unknown) => saida.MeuPlano.parse(r);

describe.skipIf(!bancoDisponivel)('trial do lar novo (CA-22.1, CA-24.1, CA-24.2, CA-24.10)', () => {
  it('o lar nasce em trial de 14 dias, Pro liberado; os dois membros veem o plano e a validade', async () => {
    const l = await larDePlano('plano.trial', { comMembro: true });
    const doTitular = P(await meuPlano(l.app, l.titular));
    expect(doTitular).toEqual({
      plano: 'pro',
      situacao: 'trial',
      trial_ate: new Date(AGORA_PLANO.getTime() + 14 * DIA).toISOString(),
      periodo_ate: null,
      preco_centavos: 990,
      sou_titular: true,
    });
    const doMembro = P(await meuPlano(l.app, l.membro!));
    expect(doMembro).toEqual({ ...doTitular, sou_titular: false });
    const linha = await assinaturaNoBanco(l.larId);
    expect(linha?.situacao).toBe('trial');
  });

  it('o trial termina sozinho, sem evento: no 14º dia exato o plano efetivo vira free', async () => {
    const l = await larDePlano('plano.trial.fim');
    await l.avancar(14 * DIA - 1000);
    expect((await meuPlano(l.app, l.titular)).plano).toBe('pro');
    await l.avancar(1000);
    const p = await meuPlano(l.app, l.titular);
    expect(p).toMatchObject({ plano: 'free', situacao: 'trial' });
  });

  it('quem já foi titular com trial e vira titular de um lar novo: o lar nasce free (CA-24.10)', async () => {
    const l = await larDePlano('plano.semnovo');
    // O titular (trial já usado) aceita o convite de outro lar: o lar dele, só com as categorias iniciais, é descartado.
    const outro = await pessoa('plano.semnovo.outro', 'Outro titular', l.relogio.agora());
    await criarLarDe(l.app, outro);
    await convidarEAceitar(l.app, l.caixa, outro, l.titular);
    // Removido, ele cai no primeiro acesso e ganha um lar novo: free, sem trial.
    const membros = await json<{ membros: Array<{ id: string; sou_eu: boolean }> }>(
      await pedir(l.app, 'GET', '/api/lar', outro),
    );
    const idDele = membros.membros.find((m) => !m.sou_eu)!.id;
    expect((await pedir(l.app, 'DELETE', `/api/lar/membros/${idDele}`, outro)).status).toBe(204);
    const novoLar = await criarLarDe(l.app, l.titular);
    expect(novoLar).not.toBe(l.larId);
    const p = await meuPlano(l.app, l.titular);
    expect(p).toMatchObject({ plano: 'free', situacao: 'free', trial_ate: l.relogio.agora().toISOString() });
  });

  it('o convidado que nunca foi titular ganha trial quando vira titular de um lar novo', async () => {
    const l = await larDePlano('plano.convidado.trial', { comMembro: true });
    const ids = await json<{ membros: Array<{ id: string; sou_eu: boolean }> }>(
      await pedir(l.app, 'GET', '/api/lar', l.titular),
    );
    const idMembro = ids.membros.find((m) => !m.sou_eu)!.id;
    expect((await pedir(l.app, 'DELETE', `/api/lar/membros/${idMembro}`, l.titular)).status).toBe(204);
    await criarLarDe(l.app, l.membro!);
    expect(await meuPlano(l.app, l.membro!)).toMatchObject({ plano: 'pro', situacao: 'trial', sou_titular: true });
  });

  it('a marca de trial usado fica no usuário (sem CPF nem dado de pagamento)', async () => {
    const l = await larDePlano('plano.marca');
    const [u] = await linhasComoOwner(
      sql<{ trial_usado_em: Date | null }>`select trial_usado_em from app.usuario where id = ${l.titular.id}`,
    );
    expect(u?.trial_usado_em?.toISOString()).toBe(AGORA_PLANO.toISOString());
  });
});

describe.skipIf(!bancoDisponivel)('POST /api/plano/assinar (CA-24.6, CA-24.7, CA-24.11)', () => {
  it('o convidado não assina: registro_invalido, antes de olhar o corpo, e o Asaas nem é chamado (CA-24.6)', async () => {
    const l = await larDePlano('plano.assinar.membro', { comMembro: true });
    for (const corpo of [CPF_TESTE, 'invalido']) {
      const r = await assinarPlano(l.app, l.membro!, corpo);
      expect(r.status).toBe(404);
      expect(await r.json()).toMatchObject({ code: 'registro_invalido' });
    }
    expect(l.asaas.chamadas).toEqual([]);
  });

  it('CPF/CNPJ inválido no formato: 400 valor_invalido, sem chamar o Asaas e sem ecoar o valor', async () => {
    const l = await larDePlano('plano.assinar.cpf');
    for (const cpf of ['52998224724', '123', '', 52998224725, null]) {
      const r = await assinarPlano(l.app, l.titular, cpf);
      expect(r.status, String(cpf)).toBe(400);
      const corpo = await r.text();
      expect(JSON.parse(corpo)).toMatchObject({ code: 'valor_invalido' });
      if (typeof cpf === 'string' && cpf) expect(corpo).not.toContain(cpf);
    }
    expect(l.asaas.chamadas).toEqual([]);
  });

  it('assina: cliente com o CPF só no Asaas, assinatura Pix de 990 centavos vencendo hoje, Pix na resposta', async () => {
    const l = await larDePlano('plano.assinar.ok');
    const r = await assinarPlano(l.app, l.titular);
    expect(r.status).toBe(201);
    const p = P(await r.json());
    // O CPF foi repassado ao Asaas (só os dígitos), com nome e e-mail do titular e a referência do lar.
    expect(l.asaas.clientes).toEqual([
      expect.objectContaining({ cpfCnpj: CPF_DIGITOS, email: l.titular.email, referenciaExterna: l.larId }),
    ]);
    expect(l.asaas.assinaturas).toEqual([
      expect.objectContaining({ valorCentavos: 990, vencimento: '2026-10-24', referenciaExterna: l.larId }),
    ]);
    const assinatura = l.asaas.assinaturas[0]!;
    const primeira = l.asaas.cobrancasDe(assinatura.id)[0]!;
    // Continua em trial até o pagamento; a cobrança em aberto aparece com o Pix.
    expect(p).toMatchObject({ plano: 'pro', situacao: 'trial', sou_titular: true });
    expect(p.cobranca).toEqual({
      vencimento: '2026-10-24',
      valor_centavos: 990,
      situacao: 'pendente',
      pix_copia_cola: `pix-copia-cola-${primeira.id}`,
      qr_png_base64: `qr-${primeira.id}`,
    });
    const linha = await assinaturaNoBanco(l.larId);
    expect(linha).toMatchObject({
      situacao: 'trial',
      asaas_cliente_id: l.asaas.clientes[0]!.id,
      asaas_assinatura_id: assinatura.id,
      cobranca_id: primeira.id,
      cobranca_vencimento: '2026-10-24',
      cobranca_situacao: 'pendente',
    });
  });

  it('o CPF/CNPJ não fica no banco nem nos logs (CA-24.11; G-34)', async () => {
    const espioes = (['info', 'warn', 'error', 'log', 'debug'] as const).map((n) =>
      vi.spyOn(console, n).mockImplementation(() => undefined),
    );
    const l = await larDePlano('plano.assinar.pii');
    // Uma tentativa com o Asaas fora do ar (o caminho de erro também não pode registrar o CPF) e uma que dá certo.
    l.asaas.falhar.add('criarAssinatura');
    expect((await assinarPlano(l.app, l.titular)).status).toBe(503);
    l.asaas.falhar.delete('criarAssinatura');
    expect((await assinarPlano(l.app, l.titular)).status).toBe(201);
    const logs = espioes.flatMap((e) => e.mock.calls.flat().map(String)).join('\n');
    for (const forma of [CPF_DIGITOS, CPF_TESTE, '529982247']) expect(logs).not.toContain(forma);
    const linha = await assinaturaNoBanco(l.larId);
    expect(linha?.linha).not.toContain(CPF_DIGITOS);
    const [u] = await linhasComoOwner(
      sql<{ t: string }>`select row_to_json(u)::text as t from app.usuario u where id = ${l.titular.id}`,
    );
    expect(u?.t).not.toContain(CPF_DIGITOS);
    const [n] = await linhasComoOwner(sql<{ n: number }>`
      select count(*)::int as n from app.webhook_evento w where w.resumo::text like ${`%${CPF_DIGITOS}%`}`);
    expect(n?.n).toBe(0);
  });

  it('é idempotente: assinar de novo enquanto espera o 1º pagamento devolve a mesma cobrança, sem criar outra', async () => {
    const l = await larDePlano('plano.assinar.idem');
    const a = P(await (await assinarPlano(l.app, l.titular)).json());
    const r2 = await assinarPlano(l.app, l.titular);
    expect(r2.status).toBe(201);
    expect(P(await r2.json())).toEqual(a);
    expect(l.asaas.assinaturas).toHaveLength(1);
    expect(l.asaas.clientes).toHaveLength(1);
  });

  it('duas requisições ao mesmo tempo criam uma assinatura só', async () => {
    const l = await larDePlano('plano.assinar.corrida');
    const [r1, r2] = await Promise.all([assinarPlano(l.app, l.titular), assinarPlano(l.app, l.titular)]);
    expect([r1.status, r2.status]).toEqual([201, 201]);
    expect(l.asaas.assinaturas).toHaveLength(1);
  });

  it('com assinatura ativa: 409 assinatura_ativa, sem tocar no Asaas', async () => {
    const l = await larAtivo('plano.assinar.ativa');
    const antes = l.asaas.assinaturas.length;
    const r = await assinarPlano(l.app, l.titular);
    expect(r.status).toBe(409);
    expect(await r.json()).toMatchObject({ code: 'assinatura_ativa' });
    expect(l.asaas.assinaturas).toHaveLength(antes);
  });

  it('Asaas fora do ar ao criar o cliente ou a assinatura: 503 indisponivel e nada gravado', async () => {
    for (const metodo of ['criarCliente', 'criarAssinatura'] as const) {
      const l = await larDePlano(`plano.assinar.queda.${metodo}`);
      vi.spyOn(console, 'warn').mockImplementation(() => undefined);
      l.asaas.falhar.add(metodo);
      const r = await assinarPlano(l.app, l.titular);
      expect(r.status).toBe(503);
      expect(await r.json()).toMatchObject({ code: 'indisponivel' });
      expect(await assinaturaNoBanco(l.larId)).toMatchObject({
        situacao: 'trial',
        asaas_cliente_id: null,
        asaas_assinatura_id: null,
        cobranca_id: null,
      });
    }
  });

  it('assinatura criada mas o Asaas cai depois: grava a assinatura (sem cobrança) e não cria outra no reenvio', async () => {
    const l = await larDePlano('plano.assinar.depois');
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    l.asaas.falhar.add('listarCobrancasDaAssinatura');
    const r = await assinarPlano(l.app, l.titular);
    expect(r.status).toBe(201);
    expect(P(await r.json()).cobranca).toBeUndefined();
    l.asaas.falhar.delete('listarCobrancasDaAssinatura');
    expect((await assinarPlano(l.app, l.titular)).status).toBe(201);
    expect(l.asaas.assinaturas).toHaveLength(1);
  });

  it('Pix indisponível na hora: a cobrança aparece com o Pix nulo', async () => {
    const l = await larDePlano('plano.pix.queda');
    await assinarOk(l);
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    l.asaas.falhar.add('buscarPix');
    const p = await meuPlano(l.app, l.titular);
    expect(p.cobranca).toMatchObject({ situacao: 'pendente', pix_copia_cola: null, qr_png_base64: null });
  });

  it('o convidado vê o plano e a validade, nunca a cobrança nem o Pix', async () => {
    const l = await larDePlano('plano.membro.ve', { comMembro: true });
    await assinarOk(l);
    const chamadasAntes = l.asaas.chamadas.length;
    const p = P(await meuPlano(l.app, l.membro!));
    expect(p.cobranca).toBeUndefined();
    expect(p.sou_titular).toBe(false);
    expect(l.asaas.chamadas.length).toBe(chamadasAntes);
  });
});

describe.skipIf(!bancoDisponivel)('POST /api/plano/cancelar (CA-24.6, CA-24.8)', () => {
  it('o convidado não cancela: registro_invalido', async () => {
    const l = await larAtivo('plano.cancelar.membro', { comMembro: true });
    const r = await cancelarPlano(l.app, l.membro!);
    expect(r.status).toBe(404);
    expect(await r.json()).toMatchObject({ code: 'registro_invalido' });
    expect(l.asaas.canceladas).toEqual([]);
    expect((await assinaturaNoBanco(l.larId))?.situacao).toBe('ativa');
  });

  it('sem assinatura no Asaas (trial puro): 409 sem_assinatura', async () => {
    const l = await larDePlano('plano.cancelar.sem');
    const r = await cancelarPlano(l.app, l.titular);
    expect(r.status).toBe(409);
    expect(await r.json()).toMatchObject({ code: 'sem_assinatura' });
  });

  it('cancela: Pro até o fim do período pago e só então free; cancelar de novo é sem_assinatura (CA-24.8)', async () => {
    const l = await larAtivo('plano.cancelar.ok');
    expect((await cancelarPlano(l.app, l.titular)).status).toBe(204);
    expect(l.asaas.canceladas).toEqual([l.assinaturaId]);
    const p = await meuPlano(l.app, l.titular);
    // Pago em 24/10 com vencimento 24/10: período até 24/11 00:00 em São Paulo.
    expect(p).toMatchObject({ plano: 'pro', situacao: 'cancelada', periodo_ate: '2026-11-24T03:00:00.000Z' });
    expect((await cancelarPlano(l.app, l.titular)).status).toBe(409);
    await l.avancar(new Date('2026-11-24T02:59:00.000Z').getTime() - l.relogio.agora().getTime());
    expect((await meuPlano(l.app, l.titular)).plano).toBe('pro');
    await l.avancar(60 * 1000);
    expect((await meuPlano(l.app, l.titular)).plano).toBe('free');
  });

  it('Asaas fora do ar: 503 indisponivel e a assinatura segue ativa', async () => {
    const l = await larAtivo('plano.cancelar.queda');
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    l.asaas.falhar.add('cancelarAssinatura');
    const r = await cancelarPlano(l.app, l.titular);
    expect(r.status).toBe(503);
    expect(await r.json()).toMatchObject({ code: 'indisponivel' });
    expect((await assinaturaNoBanco(l.larId))?.situacao).toBe('ativa');
  });

  it('cancelada pode assinar de novo: assinatura nova, esperando o pagamento', async () => {
    const l = await larAtivo('plano.reassinar');
    expect((await cancelarPlano(l.app, l.titular)).status).toBe(204);
    const r = await assinarPlano(l.app, l.titular);
    expect(r.status).toBe(201);
    expect(l.asaas.assinaturas).toHaveLength(2);
    // Reaproveita o cliente do Asaas (o CPF não é pedido de novo ao Asaas).
    expect(l.asaas.clientes).toHaveLength(1);
    const p = P(await r.json());
    // Trial já vencido? Não: o lar foi criado hoje; continua dentro do trial, e o período pago também vale.
    expect(p).toMatchObject({ plano: 'pro', situacao: 'trial' });
  });
});
