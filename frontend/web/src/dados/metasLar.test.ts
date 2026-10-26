import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { lerResposta } from '../../test/apoio/fetchSimulado';
import { movimentarMeta, salvarMeta } from './comandos/metas';
import { buscarLocaisGuardados } from './consultas/locaisGuardados';
import { buscarMeta, buscarMetas } from './consultas/metas';
import { buscarMovimentosMeta } from './consultas/movimentosMeta';
import { buscarLar, convidarMembro, revogarConvite } from './lar';

/**
 * Camada de dados de metas, movimentos, locais e lar sobre `fetch('/api/…')` (SDD 6.1 #37 a #41; SDD 6.2). A resposta é
 * conferida com o contrato Zod pelo transporte (fixture fora do contrato faz o teste falhar); aqui se confere a rota, o
 * método, o corpo, o cabeçalho CSRF e o tratamento de erro.
 */

const ID_META = '00000000-0000-4000-8000-000000000902';
const ID_MOVIMENTO = '00000000-0000-4000-8000-000000000b99';
const ID_CONTA = '00000000-0000-4000-8000-000000000201';
const ID_CONVITE = '00000000-0000-4000-8000-000000000c01';

const fetchSimulado = vi.fn<typeof fetch>();
const resposta = (status: number, corpo?: unknown) =>
  Promise.resolve(
    new Response(corpo === undefined ? null : JSON.stringify(corpo), {
      status,
      headers: { 'Content-Type': 'application/json' },
    }),
  );
const ultima = () => {
  const [url, init] = fetchSimulado.mock.calls.at(-1)!;
  return {
    url: String(url),
    metodo: init?.method,
    cabecalhos: init?.headers as Record<string, string>,
    corpo: init?.body ? (JSON.parse(String(init.body)) as unknown) : undefined,
  };
};

beforeEach(() => {
  fetchSimulado.mockReset();
  vi.stubGlobal('fetch', fetchSimulado);
});
afterEach(() => vi.unstubAllGlobals());

describe('metas: leituras', () => {
  it('GET /api/metas devolve a lista como veio, na ordem do servidor', async () => {
    const lista = lerResposta<unknown[]>('metas.json');
    fetchSimulado.mockImplementation(() => resposta(200, lista));

    await expect(buscarMetas()).resolves.toEqual(lista);

    expect(ultima()).toMatchObject({ url: '/api/metas', metodo: 'GET' });
    expect(ultima().cabecalhos['X-Controle-Em-Casa']).toBeUndefined();
  });

  it('GET /api/metas/:id devolve a meta com por_local', async () => {
    const meta = lerResposta<{ por_local: unknown[] }>('meta-detalhe.json');
    fetchSimulado.mockImplementation(() => resposta(200, meta));

    await expect(buscarMeta(ID_META)).resolves.toEqual(meta);

    expect(ultima()).toMatchObject({ url: `/api/metas/${ID_META}`, metodo: 'GET' });
  });

  it('id malformado vale como inexistente e não chama a API (RT-01)', async () => {
    await expect(buscarMeta('abc')).rejects.toEqual({ tipo: 'regra', codigo: 'registro_invalido' });
    await expect(buscarMovimentosMeta('abc')).rejects.toEqual({ tipo: 'regra', codigo: 'registro_invalido' });
    expect(fetchSimulado).not.toHaveBeenCalled();
  });

  it('meta inexistente ou alheia (404 registro_invalido) vira erro de regra', async () => {
    fetchSimulado.mockImplementation(() => resposta(404, { code: 'registro_invalido', message: 'x' }));

    await expect(buscarMeta(ID_META)).rejects.toEqual({ tipo: 'regra', codigo: 'registro_invalido' });
  });

  it('GET /api/metas/:id/movimentos devolve a lista intacta (a conta só nas linhas do autor)', async () => {
    const lista = lerResposta<unknown[]>('movimentos-meta.json');
    fetchSimulado.mockImplementation(() => resposta(200, lista));

    await expect(buscarMovimentosMeta(ID_META)).resolves.toEqual(lista);

    expect(ultima()).toMatchObject({ url: `/api/metas/${ID_META}/movimentos`, metodo: 'GET' });
  });

  it('GET /api/metas/locais devolve os locais já usados', async () => {
    fetchSimulado.mockImplementation(() => resposta(200, lerResposta('locais-guardados.json')));

    await expect(buscarLocaisGuardados()).resolves.toEqual(['Caixinha Nubank', 'CDB Banco Inter']);

    expect(ultima()).toMatchObject({ url: '/api/metas/locais', metodo: 'GET' });
  });

  it('uma resposta fora do contrato derruba a leitura (percentual como texto)', async () => {
    const lista = lerResposta<Array<Record<string, unknown>>>('metas.json');
    lista[0] = { ...lista[0]!, percentual: '40' };
    fetchSimulado.mockImplementation(() => resposta(200, lista));

    await expect(buscarMetas()).rejects.toBeDefined();
  });
});

describe('metas: escritas', () => {
  it('salvarMeta envia PUT /api/metas/:id com o prazo no dia 1 e o cabeçalho CSRF, e devolve { id }', async () => {
    fetchSimulado.mockImplementation(() => resposta(201, { id: ID_META }));

    await expect(
      salvarMeta({ id: ID_META, nome: 'Viagem', alvoCentavos: 1200000, prazo: '2027-07', escopo: 'conjunto' }),
    ).resolves.toEqual({ id: ID_META });

    expect(ultima()).toMatchObject({
      url: `/api/metas/${ID_META}`,
      metodo: 'PUT',
      corpo: { nome: 'Viagem', alvo_centavos: 1200000, prazo: '2027-07-01', escopo: 'conjunto' },
    });
    expect(ultima().cabecalhos['X-Controle-Em-Casa']).toBe('1');
  });

  it('salvarMeta sem prazo e sem escopo (edição) não envia essas chaves', async () => {
    fetchSimulado.mockImplementation(() => resposta(200, { id: ID_META }));

    await salvarMeta({ id: ID_META, nome: 'Viagem', alvoCentavos: 1200000, prazo: null });

    expect(ultima().corpo).toEqual({ nome: 'Viagem', alvo_centavos: 1200000 });
  });

  it('salvarMeta com id malformado rejeita sem chamar a API', async () => {
    await expect(salvarMeta({ id: 'x', nome: 'a', alvoCentavos: 1 })).rejects.toEqual({
      tipo: 'regra',
      codigo: 'registro_invalido',
    });
    expect(fetchSimulado).not.toHaveBeenCalled();
  });

  it('salvarMeta com valor_invalido (400) vira erro de regra', async () => {
    fetchSimulado.mockImplementation(() => resposta(400, { code: 'valor_invalido', message: 'x' }));

    await expect(salvarMeta({ id: ID_META, nome: 'a', alvoCentavos: 1 })).rejects.toEqual({
      tipo: 'regra',
      codigo: 'valor_invalido',
    });
  });

  it('movimentarMeta envia POST /api/metas/:id/movimentos; sem conta, a chave não vai', async () => {
    fetchSimulado.mockImplementation(() => resposta(201, { id: ID_MOVIMENTO }));

    await expect(
      movimentarMeta({
        id: ID_MOVIMENTO,
        metaId: ID_META,
        tipo: 'aporte',
        valorCentavos: 50000,
        data: '2026-10-09',
        local: 'Cofre',
      }),
    ).resolves.toEqual({ id: ID_MOVIMENTO });

    expect(ultima()).toMatchObject({
      url: `/api/metas/${ID_META}/movimentos`,
      metodo: 'POST',
      corpo: { id: ID_MOVIMENTO, tipo: 'aporte', valor_centavos: 50000, local: 'Cofre', data: '2026-10-09' },
    });
    expect(ultima().corpo).not.toHaveProperty('conta_id');
    expect(ultima().cabecalhos['X-Controle-Em-Casa']).toBe('1');
  });

  it('movimentarMeta com conta envia conta_id', async () => {
    fetchSimulado.mockImplementation(() => resposta(201, { id: ID_MOVIMENTO }));

    await movimentarMeta({
      id: ID_MOVIMENTO,
      metaId: ID_META,
      tipo: 'retirada',
      valorCentavos: 30000,
      data: '2026-10-09',
      local: 'Cofre',
      contaId: ID_CONTA,
    });

    expect(ultima().corpo).toMatchObject({ tipo: 'retirada', conta_id: ID_CONTA });
  });

  it('retirada acima do guardado (422) vira erro de regra com o código', async () => {
    fetchSimulado.mockImplementation(() => resposta(422, { code: 'retirada_maior_que_guardado', message: 'x' }));

    await expect(
      movimentarMeta({
        id: ID_MOVIMENTO,
        metaId: ID_META,
        tipo: 'retirada',
        valorCentavos: 1,
        data: '2026-10-09',
        local: 'Cofre',
      }),
    ).rejects.toEqual({ tipo: 'regra', codigo: 'retirada_maior_que_guardado' });
  });

  it('movimentarMeta sem rede lança "rede"', async () => {
    fetchSimulado.mockRejectedValue(new TypeError('Failed to fetch'));

    await expect(
      movimentarMeta({
        id: ID_MOVIMENTO,
        metaId: ID_META,
        tipo: 'aporte',
        valorCentavos: 1,
        data: '2026-10-09',
        local: 'Cofre',
      }),
    ).rejects.toEqual({ tipo: 'rede' });
  });
});

describe('lar e convite', () => {
  it('GET /api/lar devolve os membros e o convite pendente', async () => {
    const lar = lerResposta<{ convite_pendente: { email: string } }>('lar-convite-pendente.json');
    fetchSimulado.mockImplementation(() => resposta(200, lar));

    await expect(buscarLar()).resolves.toEqual(lar);

    expect(ultima()).toMatchObject({ url: '/api/lar', metodo: 'GET' });
  });

  it('convidarMembro envia POST /api/lar/convites com o e-mail e devolve o convite sem token', async () => {
    const criado = { id: ID_CONVITE, email: 'beatriz@exemplo.com', expira_em: '2026-10-16T15:00:00.000Z' };
    fetchSimulado.mockImplementation(() => resposta(201, criado));

    await expect(convidarMembro('beatriz@exemplo.com')).resolves.toEqual(criado);

    expect(ultima()).toMatchObject({
      url: '/api/lar/convites',
      metodo: 'POST',
      corpo: { email: 'beatriz@exemplo.com' },
    });
    expect(ultima().cabecalhos['X-Controle-Em-Casa']).toBe('1');
  });

  it.each([
    [409, 'lar_cheio'],
    [409, 'convite_pendente'],
    [400, 'valor_invalido'],
  ])('convidarMembro com %s %s vira erro de regra', async (status, code) => {
    fetchSimulado.mockImplementation(() => resposta(status, { code, message: 'x' }));

    await expect(convidarMembro('b@exemplo.com')).rejects.toEqual({ tipo: 'regra', codigo: code });
  });

  it('revogarConvite envia DELETE /api/lar/convites/:id (204)', async () => {
    fetchSimulado.mockImplementation(() => resposta(204));

    await expect(revogarConvite(ID_CONVITE)).resolves.toBeUndefined();

    expect(ultima()).toMatchObject({ url: `/api/lar/convites/${ID_CONVITE}`, metodo: 'DELETE' });
    expect(ultima().cabecalhos['X-Controle-Em-Casa']).toBe('1');
  });

  it('revogarConvite com id malformado rejeita sem chamar a API', async () => {
    await expect(revogarConvite('x')).rejects.toEqual({ tipo: 'regra', codigo: 'registro_invalido' });
    expect(fetchSimulado).not.toHaveBeenCalled();
  });
});
