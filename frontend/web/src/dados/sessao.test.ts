import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { registrarLimpeza } from './aparelho';
import {
  cadastrar,
  confirmar,
  donoLembrado,
  encerrarNoAparelho,
  entrar,
  esqueci,
  obterSessao,
  redefinir,
  reenviar,
  sair,
  sairDeTodos,
} from './sessao';
import { definirAoPerderSessao } from './transporte';

const fetchSimulado = vi.fn<typeof fetch>();
const ID = '00000000-0000-4000-8000-0000000000a1';
const SESSAO = {
  usuario: { id: ID, nome: 'Ana', email: 'ana@exemplo.com' },
  membro: null,
  lar: null,
  plano: null,
  termos_pendentes: false,
};

const json = (corpo: unknown, status = 200) =>
  new Response(JSON.stringify(corpo), { status, headers: { 'Content-Type': 'application/json' } });
const semCorpo = (status = 204) => new Response(null, { status });
const erroApi = (code: string, status: number) => json({ code, message: 'texto do servidor' }, status);

function ultima() {
  const [url, init] = fetchSimulado.mock.calls.at(-1) ?? [];
  return { url: String(url), metodo: init?.method, corpo: init?.body ? JSON.parse(String(init.body)) : undefined };
}

const limpeza = vi.fn();
let desregistrar: () => void;

beforeEach(async () => {
  fetchSimulado.mockReset();
  vi.stubGlobal('fetch', fetchSimulado);
  await encerrarNoAparelho();
  limpeza.mockReset();
  desregistrar = registrarLimpeza(limpeza);
});

afterEach(() => {
  desregistrar();
  definirAoPerderSessao(undefined);
  vi.unstubAllGlobals();
});

describe('obterSessao (GET /api/sessao)', () => {
  it('devolve a sessão do servidor e lembra o dono (usuario.id)', async () => {
    fetchSimulado.mockResolvedValue(json(SESSAO));

    await expect(obterSessao()).resolves.toMatchObject({ usuario: { id: ID } });

    expect(ultima()).toMatchObject({ url: '/api/sessao', metodo: 'GET' });
    expect(donoLembrado()).toBe(ID);
  });

  it('401 é "sem sessão": devolve null e esquece o dono', async () => {
    fetchSimulado.mockResolvedValueOnce(json(SESSAO));
    await obterSessao();
    fetchSimulado.mockResolvedValueOnce(erroApi('sessao_expirada', 401));

    await expect(obterSessao()).resolves.toBeNull();
    expect(donoLembrado()).toBeUndefined();
  });

  it('sem rede lança "rede" e mantém o dono lembrado (a fila segue guardando)', async () => {
    fetchSimulado.mockResolvedValueOnce(json(SESSAO));
    await obterSessao();
    fetchSimulado.mockRejectedValueOnce(new TypeError('Failed to fetch'));

    await expect(obterSessao()).rejects.toEqual({ tipo: 'rede' });
    expect(donoLembrado()).toBe(ID);
  });

  it('o 401 de GET /api/sessao não é tratado como sessão perdida no meio de uma ação', async () => {
    const aviso = vi.fn();
    definirAoPerderSessao(aviso);
    fetchSimulado.mockResolvedValue(erroApi('sessao_expirada', 401));

    await obterSessao();

    expect(aviso).not.toHaveBeenCalled();
  });
});

describe('entrar', () => {
  it('POST /api/sessao/entrar com e-mail e senha', async () => {
    fetchSimulado.mockResolvedValue(semCorpo());
    await entrar('ana@exemplo.com', 'senha-longa-123');
    expect(ultima()).toEqual({
      url: '/api/sessao/entrar',
      metodo: 'POST',
      corpo: { email: 'ana@exemplo.com', senha: 'senha-longa-123' },
    });
  });

  it('credenciais erradas viram regra credenciais_invalidas (mesma resposta para e-mail inexistente)', async () => {
    fetchSimulado.mockResolvedValue(erroApi('credenciais_invalidas', 400));
    await expect(entrar('x@exemplo.com', 'errada')).rejects.toEqual({ tipo: 'regra', codigo: 'credenciais_invalidas' });
  });

  it.each(['email_nao_confirmado', 'conta_em_exclusao', 'muitas_tentativas'] as const)(
    'recusa "%s" chega à tela como regra',
    async (code) => {
      fetchSimulado.mockResolvedValue(erroApi(code, code === 'muitas_tentativas' ? 429 : 403));
      await expect(entrar('x@exemplo.com', 'senha')).rejects.toEqual({ tipo: 'regra', codigo: code });
    },
  );
});

describe('sair e sairDeTodos (G-39)', () => {
  it('sair chama POST /api/sessao/sair, esquece o dono e limpa o aparelho', async () => {
    fetchSimulado.mockResolvedValueOnce(json(SESSAO));
    await obterSessao();
    fetchSimulado.mockResolvedValueOnce(semCorpo());

    await sair();

    expect(ultima()).toMatchObject({ url: '/api/sessao/sair', metodo: 'POST' });
    expect(donoLembrado()).toBeUndefined();
    expect(limpeza).toHaveBeenCalledTimes(1);
  });

  it('sair sem rede lança "rede" e mantém tudo (a sessão continua valendo)', async () => {
    fetchSimulado.mockResolvedValueOnce(json(SESSAO));
    await obterSessao();
    fetchSimulado.mockRejectedValueOnce(new TypeError('Failed to fetch'));

    await expect(sair()).rejects.toEqual({ tipo: 'rede' });
    expect(donoLembrado()).toBe(ID);
    expect(limpeza).not.toHaveBeenCalled();
  });

  it('sairDeTodos chama POST /api/sessao/sair-de-todos e limpa o aparelho', async () => {
    fetchSimulado.mockResolvedValue(semCorpo());
    await sairDeTodos();
    expect(ultima()).toMatchObject({ url: '/api/sessao/sair-de-todos', metodo: 'POST' });
    expect(limpeza).toHaveBeenCalledTimes(1);
  });

  it('sairDeTodos com 401 conta como "já sem sessão": limpa o aparelho e não falha', async () => {
    fetchSimulado.mockResolvedValue(erroApi('sessao_expirada', 401));
    await expect(sairDeTodos()).resolves.toBeUndefined();
    expect(limpeza).toHaveBeenCalledTimes(1);
  });

  it('sairDeTodos sem rede lança "rede" e não limpa nada', async () => {
    fetchSimulado.mockRejectedValue(new TypeError('Failed to fetch'));
    await expect(sairDeTodos()).rejects.toEqual({ tipo: 'rede' });
    expect(limpeza).not.toHaveBeenCalled();
  });

  it('uma limpeza que falha não impede as outras nem a saída', async () => {
    const outra = vi.fn();
    const desfazer = registrarLimpeza(outra);
    limpeza.mockRejectedValue(new Error('falhou'));
    fetchSimulado.mockResolvedValue(semCorpo());

    await expect(sair()).resolves.toBeUndefined();

    expect(outra).toHaveBeenCalled();
    desfazer();
  });
});

describe('recuperação de senha', () => {
  it('esqueci: POST /api/senha/esqueci com o e-mail', async () => {
    fetchSimulado.mockResolvedValue(semCorpo(202));
    await esqueci('ana@exemplo.com');
    expect(ultima()).toEqual({ url: '/api/senha/esqueci', metodo: 'POST', corpo: { email: 'ana@exemplo.com' } });
  });

  it('esqueci sem rede lança "rede"', async () => {
    fetchSimulado.mockRejectedValue(new TypeError('Failed to fetch'));
    await expect(esqueci('ana@exemplo.com')).rejects.toEqual({ tipo: 'rede' });
  });

  it('redefinir: POST /api/senha/redefinir com token e senha, e limpa o aparelho (o servidor revogou as sessões)', async () => {
    fetchSimulado.mockResolvedValue(semCorpo());
    await redefinir('tok123', 'nova-senha-bem-longa');
    expect(ultima()).toEqual({
      url: '/api/senha/redefinir',
      metodo: 'POST',
      corpo: { token: 'tok123', senha: 'nova-senha-bem-longa' },
    });
    expect(limpeza).toHaveBeenCalledTimes(1);
  });

  it.each(['link_expirado', 'senha_fraca'] as const)('redefinir com "%s" não limpa o aparelho', async (code) => {
    fetchSimulado.mockResolvedValue(erroApi(code, 400));
    await expect(redefinir('t', 's')).rejects.toEqual({ tipo: 'regra', codigo: code });
    expect(limpeza).not.toHaveBeenCalled();
  });
});

describe('cadastro', () => {
  it('cadastrar: POST /api/cadastro com nome, e-mail, senha e as versões aceitas', async () => {
    fetchSimulado.mockResolvedValue(semCorpo(202));
    const dados = {
      nome: 'Ana',
      email: 'ana@exemplo.com',
      senha: 'senha-bem-longa-1',
      aceite: { termos: '2026-10-24', privacidade: '2026-10-24' },
    };
    await cadastrar(dados);
    expect(ultima()).toEqual({ url: '/api/cadastro', metodo: 'POST', corpo: dados });
  });

  it('confirmar: POST /api/cadastro/confirmar com o token; link vencido vira link_expirado', async () => {
    fetchSimulado.mockResolvedValueOnce(semCorpo());
    await confirmar('tok');
    expect(ultima()).toEqual({ url: '/api/cadastro/confirmar', metodo: 'POST', corpo: { token: 'tok' } });

    fetchSimulado.mockResolvedValueOnce(erroApi('link_expirado', 400));
    await expect(confirmar('velho')).rejects.toEqual({ tipo: 'regra', codigo: 'link_expirado' });
  });

  it('reenviar: POST /api/cadastro/reenviar com o e-mail', async () => {
    fetchSimulado.mockResolvedValue(semCorpo(202));
    await reenviar('ana@exemplo.com');
    expect(ultima()).toEqual({ url: '/api/cadastro/reenviar', metodo: 'POST', corpo: { email: 'ana@exemplo.com' } });
  });

  it('senha fraca no cadastro chega como regra senha_fraca', async () => {
    fetchSimulado.mockResolvedValue(erroApi('senha_fraca', 400));
    await expect(
      cadastrar({ nome: 'A', email: 'a@b.co', senha: 'x', aceite: { termos: 'v', privacidade: 'v' } }),
    ).rejects.toEqual({ tipo: 'regra', codigo: 'senha_fraca' });
  });
});
