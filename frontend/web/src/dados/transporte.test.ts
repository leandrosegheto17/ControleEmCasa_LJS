import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CABECALHO_CSRF, PRAZO_MS, chamar, definirAoPerderSessao } from './transporte';

const fetchSimulado = vi.fn<typeof fetch>();

function json(corpo: unknown, status = 200): Response {
  return new Response(JSON.stringify(corpo), { status, headers: { 'Content-Type': 'application/json' } });
}

function ultimaChamada() {
  const [url, init] = fetchSimulado.mock.calls.at(-1) ?? [];
  return { url: String(url), init: init ?? {}, cabecalhos: (init?.headers ?? {}) as Record<string, string> };
}

beforeEach(() => {
  fetchSimulado.mockReset();
  vi.stubGlobal('fetch', fetchSimulado);
});

afterEach(() => {
  definirAoPerderSessao(undefined);
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('chamar: cookie e cabeçalhos', () => {
  it('envia o cookie da sessão só ao próprio site (credentials same-origin) e nunca lê document.cookie', async () => {
    const lerCookie = vi.spyOn(document, 'cookie', 'get');
    fetchSimulado.mockResolvedValue(json({ ok: true }));

    await chamar('GET', '/api/sessao');

    expect(ultimaChamada().init.credentials).toBe('same-origin');
    expect(lerCookie).not.toHaveBeenCalled();
    lerCookie.mockRestore();
  });

  it('leitura (GET) não leva o cabeçalho de CSRF', async () => {
    fetchSimulado.mockResolvedValue(json({}));
    await chamar('GET', '/api/sessao');
    expect(ultimaChamada().cabecalhos[CABECALHO_CSRF]).toBeUndefined();
  });

  it.each(['POST', 'PUT', 'PATCH', 'DELETE'] as const)('escrita (%s) leva X-Controle-Em-Casa: 1', async (metodo) => {
    fetchSimulado.mockResolvedValue(new Response(null, { status: 204 }));
    await chamar(metodo, '/api/qualquer');
    expect(ultimaChamada().cabecalhos['X-Controle-Em-Casa']).toBe('1');
  });

  it('não define Origin (o navegador o envia sozinho) nem Cookie', async () => {
    fetchSimulado.mockResolvedValue(new Response(null, { status: 204 }));
    await chamar('POST', '/api/qualquer', { a: 1 });
    const nomes = Object.keys(ultimaChamada().cabecalhos).map((n) => n.toLowerCase());
    expect(nomes).not.toContain('origin');
    expect(nomes).not.toContain('cookie');
  });

  it('o corpo vai em JSON, com Content-Type; sem corpo não há Content-Type', async () => {
    fetchSimulado.mockResolvedValue(new Response(null, { status: 204 }));
    await chamar('POST', '/api/a', { email: 'a@b.co' });
    expect(ultimaChamada().init.body).toBe('{"email":"a@b.co"}');
    expect(ultimaChamada().cabecalhos['Content-Type']).toBe('application/json');

    await chamar('POST', '/api/b');
    expect(ultimaChamada().init.body).toBeUndefined();
    expect(ultimaChamada().cabecalhos['Content-Type']).toBeUndefined();
  });

  it('recusa rota fora de /api/ (nunca uma URL de fora)', async () => {
    await expect(chamar('GET', 'https://outro.exemplo/api/x')).rejects.toThrow();
    await expect(chamar('GET', '//outro.exemplo/api/x')).rejects.toThrow();
    await expect(chamar('GET', '/outra-coisa')).rejects.toThrow();
    expect(fetchSimulado).not.toHaveBeenCalled();
  });
});

describe('chamar: respostas', () => {
  it('devolve o JSON da resposta', async () => {
    fetchSimulado.mockResolvedValue(json({ a: 1 }));
    await expect(chamar('GET', '/api/x')).resolves.toEqual({ a: 1 });
  });

  it('204 e 202 sem corpo devolvem undefined', async () => {
    fetchSimulado.mockResolvedValueOnce(new Response(null, { status: 204 }));
    await expect(chamar('POST', '/api/x')).resolves.toBeUndefined();
    fetchSimulado.mockResolvedValueOnce(new Response(null, { status: 202 }));
    await expect(chamar('POST', '/api/x')).resolves.toBeUndefined();
  });

  it('erro com code vira regra, sem texto do servidor', async () => {
    fetchSimulado.mockResolvedValue(
      json({ code: 'credenciais_invalidas', message: 'E-mail ou senha incorretos.' }, 400),
    );
    await expect(chamar('POST', '/api/sessao/entrar', {})).rejects.toEqual({
      tipo: 'regra',
      codigo: 'credenciais_invalidas',
    });
  });

  it('falha de rede vira "rede"', async () => {
    fetchSimulado.mockRejectedValue(new TypeError('Failed to fetch'));
    await expect(chamar('GET', '/api/x')).rejects.toEqual({ tipo: 'rede' });
  });

  it('5xx com HTML (proxy) vira indisponível', async () => {
    fetchSimulado.mockResolvedValue(new Response('<html>Bad gateway</html>', { status: 502 }));
    await expect(chamar('GET', '/api/x')).rejects.toEqual({ tipo: 'indisponivel' });
  });

  it('passados 10 s sem resposta aborta a chamada e conta como rede', async () => {
    vi.useFakeTimers();
    fetchSimulado.mockImplementation(
      (_url, init) =>
        new Promise((_resolver, rejeitar) => {
          init?.signal?.addEventListener('abort', () => rejeitar(new DOMException('abortado', 'AbortError')));
        }),
    );

    const resultado = chamar('GET', '/api/x');
    const verificado = expect(resultado).rejects.toEqual({ tipo: 'rede' });
    await vi.advanceTimersByTimeAsync(PRAZO_MS);

    await verificado;
    expect(PRAZO_MS).toBe(10_000);
  });
});

describe('chamar: 401 global', () => {
  it('um 401 avisa o ouvinte de sessão perdida e lança "autenticacao"', async () => {
    const ouvinte = vi.fn();
    definirAoPerderSessao(ouvinte);
    fetchSimulado.mockResolvedValue(json({ code: 'sessao_expirada', message: 'x' }, 401));

    await expect(chamar('GET', '/api/lancamentos')).rejects.toEqual({ tipo: 'autenticacao' });
    expect(ouvinte).toHaveBeenCalledTimes(1);
  });

  it('um 401 esperado (semAvisoDeSessao) não aciona o aviso', async () => {
    const ouvinte = vi.fn();
    definirAoPerderSessao(ouvinte);
    fetchSimulado.mockResolvedValue(json({ code: 'sessao_expirada', message: 'x' }, 401));

    await expect(chamar('GET', '/api/sessao', undefined, { semAvisoDeSessao: true })).rejects.toEqual({
      tipo: 'autenticacao',
    });
    expect(ouvinte).not.toHaveBeenCalled();
  });

  it('outros erros não acionam o aviso', async () => {
    const ouvinte = vi.fn();
    definirAoPerderSessao(ouvinte);
    fetchSimulado.mockResolvedValue(json({ code: 'sem_permissao', message: 'x' }, 403));
    await expect(chamar('GET', '/api/x')).rejects.toBeDefined();
    expect(ouvinte).not.toHaveBeenCalled();
  });
});

describe('chamar: validação da resposta com o schema do contrato (só em dev e teste)', () => {
  it('resposta fora do contrato falha no teste', async () => {
    fetchSimulado.mockResolvedValue(json({ usuario: 'forma errada' }));
    await expect(chamar('GET', '/api/sessao', undefined, { saida: 'SessaoAtual' })).rejects.toBeDefined();
  });

  it('resposta conforme passa', async () => {
    fetchSimulado.mockResolvedValue(
      json({
        usuario: { id: '00000000-0000-4000-8000-0000000000a1', nome: 'Ana', email: 'ana@exemplo.com' },
        membro: null,
        lar: null,
        plano: null,
        termos_pendentes: false,
      }),
    );
    await expect(chamar('GET', '/api/sessao', undefined, { saida: 'SessaoAtual' })).resolves.toMatchObject({
      termos_pendentes: false,
    });
  });
});
