import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { aceitarConvite, aceitarTermos, conviteAtual, criarLar, recusarConvite, removerMembro, sairDoLar } from './lar';

const fetchSimulado = vi.fn<typeof fetch>();
const json = (corpo: unknown, status = 200) =>
  new Response(JSON.stringify(corpo), { status, headers: { 'Content-Type': 'application/json' } });
const ultima = () => {
  const [url, init] = fetchSimulado.mock.calls.at(-1) ?? [];
  return { url: String(url), metodo: init?.method, corpo: init?.body ? JSON.parse(String(init.body)) : undefined };
};

beforeEach(() => {
  fetchSimulado.mockReset();
  vi.stubGlobal('fetch', fetchSimulado);
});
afterEach(() => vi.unstubAllGlobals());

describe('dados/lar', () => {
  it('criarLar: POST /api/lar, com ou sem nome', async () => {
    fetchSimulado.mockResolvedValue(json({ id: '00000000-0000-4000-8000-0000000000b1', nome: 'Casa' }, 201));
    await criarLar('Casa');
    expect(ultima()).toEqual({ url: '/api/lar', metodo: 'POST', corpo: { nome: 'Casa' } });
    await criarLar();
    expect(ultima().corpo).toEqual({});
  });

  it('conviteAtual: GET com o token codificado na consulta e resposta validada pelo contrato', async () => {
    fetchSimulado.mockResolvedValue(
      json({ lar_nome: 'Casa', convidado_por_nome: 'Ana', expira_em: '2026-11-01T00:00:00.000Z' }),
    );
    await expect(conviteAtual('a+b/c=')).resolves.toMatchObject({ lar_nome: 'Casa' });
    expect(ultima().url).toBe('/api/convites/atual?token=a%2Bb%2Fc%3D');
    expect(ultima().metodo).toBe('GET');
  });

  it('conviteAtual: 404 convite_invalido vira regra', async () => {
    fetchSimulado.mockResolvedValue(json({ code: 'convite_invalido', message: 'x' }, 404));
    await expect(conviteAtual('t')).rejects.toEqual({ tipo: 'regra', codigo: 'convite_invalido' });
  });

  it('aceitar e recusar enviam o token no corpo, nunca na URL', async () => {
    fetchSimulado.mockResolvedValue(new Response(null, { status: 204 }));
    await aceitarConvite('tok');
    expect(ultima()).toEqual({ url: '/api/convites/aceitar', metodo: 'POST', corpo: { token: 'tok' } });
    await recusarConvite('tok');
    expect(ultima()).toEqual({ url: '/api/convites/recusar', metodo: 'POST', corpo: { token: 'tok' } });
  });

  it.each(['lar_cheio', 'ja_tem_lar'] as const)('aceitar com %s vira regra (409)', async (code) => {
    fetchSimulado.mockResolvedValue(json({ code, message: 'x' }, 409));
    await expect(aceitarConvite('t')).rejects.toEqual({ tipo: 'regra', codigo: code });
  });

  it('aceitarTermos: POST /api/termos/aceite com as versões', async () => {
    fetchSimulado.mockResolvedValue(new Response(null, { status: 204 }));
    await aceitarTermos({ termos: 'v1', privacidade: 'v2' });
    expect(ultima()).toEqual({
      url: '/api/termos/aceite',
      metodo: 'POST',
      corpo: { termos: 'v1', privacidade: 'v2' },
    });
  });

  it('removerMembro: DELETE /api/lar/membros/:id com o id do membro e sem corpo', async () => {
    const id = '00000000-0000-4000-8000-0000000000c1';
    fetchSimulado.mockResolvedValue(new Response(null, { status: 204 }));
    await expect(removerMembro(id)).resolves.toBeUndefined();
    expect(ultima()).toEqual({ url: `/api/lar/membros/${id}`, metodo: 'DELETE', corpo: undefined });
  });

  it.each(['nao-e-uuid', '', '../convites/x'])(
    'removerMembro(%j): id inválido lança REGISTRO_INVALIDO sem chamar a rede',
    async (id) => {
      await expect(removerMembro(id)).rejects.toEqual({ tipo: 'regra', codigo: 'registro_invalido' });
      expect(fetchSimulado).not.toHaveBeenCalled();
    },
  );

  it('sairDoLar: POST /api/lar/sair sem corpo', async () => {
    fetchSimulado.mockResolvedValue(new Response(null, { status: 204 }));
    await expect(sairDoLar()).resolves.toBeUndefined();
    expect(ultima()).toEqual({ url: '/api/lar/sair', metodo: 'POST', corpo: undefined });
  });

  it.each([
    ['registro_invalido', 400],
    ['sem_lar', 403],
  ] as const)('remover e sair repassam o erro de regra %s intacto', async (code, status) => {
    fetchSimulado.mockImplementation(async () => json({ code, message: 'x' }, status));
    await expect(removerMembro('00000000-0000-4000-8000-0000000000c1')).rejects.toEqual({
      tipo: 'regra',
      codigo: code,
    });
    await expect(sairDoLar()).rejects.toEqual({ tipo: 'regra', codigo: code });
  });

  it('remover e sair repassam a falha de rede como erro rede', async () => {
    fetchSimulado.mockRejectedValue(new TypeError('Failed to fetch'));
    await expect(removerMembro('00000000-0000-4000-8000-0000000000c1')).rejects.toEqual({ tipo: 'rede' });
    await expect(sairDoLar()).rejects.toEqual({ tipo: 'rede' });
  });
});
