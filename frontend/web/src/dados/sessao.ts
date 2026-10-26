import type { EntradaCadastro, SaidaSessaoAtual } from '@controle/contrato';
import { limparAparelho } from './aparelho';
import { chamar } from './transporte';

export type SessaoAtual = SaidaSessaoAtual;

const CHAVE_DONO = 'controle.dono-da-sessao';
let donoEmMemoria: string | undefined;

function lerArmazenado(): string | undefined {
  try {
    return globalThis.localStorage?.getItem(CHAVE_DONO) ?? undefined;
  } catch {
    return undefined;
  }
}

function gravarDono(id: string | undefined): void {
  donoEmMemoria = id;
  try {
    if (id) globalThis.localStorage?.setItem(CHAVE_DONO, id);
    else globalThis.localStorage?.removeItem(CHAVE_DONO);
  } catch {
    // Sem armazenamento local, o dono vale só enquanto a página estiver aberta.
  }
}

/**
 * `usuario.id` da última sessão confirmada pelo servidor. É o dono dos itens da fila offline (G-38): sem rede não há
 * como perguntar ao servidor, mas o lançamento precisa ser guardado. Só `GET /api/sessao` o define; sair e um 401 o apagam.
 */
export function donoLembrado(): string | undefined {
  return donoEmMemoria ?? lerArmazenado();
}

/** Ponto único de leitura da sessão: `GET /api/sessao`. Sem sessão (401) devolve `null`; sem rede lança `rede`. */
export async function obterSessao(): Promise<SessaoAtual | null> {
  try {
    const sessao = await chamar<SessaoAtual>('GET', '/api/sessao', undefined, {
      saida: 'SessaoAtual',
      semAvisoDeSessao: true,
    });
    gravarDono(sessao.usuario.id);
    return sessao;
  } catch (e) {
    if ((e as { tipo?: unknown } | null)?.tipo === 'autenticacao') {
      gravarDono(undefined);
      return null;
    }
    throw e;
  }
}

/** A sessão acabou (saída, redefinição de senha ou 401): esquece o dono e limpa o aparelho (G-39). */
export async function encerrarNoAparelho(): Promise<void> {
  gravarDono(undefined);
  await limparAparelho();
}

export async function entrar(email: string, senha: string): Promise<void> {
  await chamar('POST', '/api/sessao/entrar', { email, senha });
}

async function aceitarSemSessao(operacao: Promise<unknown>): Promise<void> {
  try {
    await operacao;
  } catch (e) {
    // 401: o servidor já não reconhece a sessão; não há o que revogar, só limpar o aparelho.
    if ((e as { tipo?: unknown } | null)?.tipo !== 'autenticacao') throw e;
  }
}

/** Encerra só esta sessão. Sem rede lança `rede` e mantém sessão e dados locais. */
export async function sair(): Promise<void> {
  await aceitarSemSessao(chamar('POST', '/api/sessao/sair', undefined, { semAvisoDeSessao: true }));
  await encerrarNoAparelho();
}

/** Revoga todas as sessões. 401 conta como "já sem sessão"; sem rede lança `rede` e mantém tudo. */
export async function sairDeTodos(): Promise<void> {
  await aceitarSemSessao(chamar('POST', '/api/sessao/sair-de-todos', undefined, { semAvisoDeSessao: true }));
  await encerrarNoAparelho();
}

/** Pedido do link de redefinição: resposta neutra (202) para e-mail de conta ou desconhecido (G-19). */
export async function esqueci(email: string): Promise<void> {
  await chamar('POST', '/api/senha/esqueci', { email });
}

/** Troca a senha com o token do link. O servidor revoga todas as sessões; o aparelho também é limpo. */
export async function redefinir(token: string, senha: string): Promise<void> {
  await chamar('POST', '/api/senha/redefinir', { token, senha });
  await encerrarNoAparelho();
}

export async function cadastrar(dados: EntradaCadastro): Promise<void> {
  await chamar('POST', '/api/cadastro', dados);
}

export async function confirmar(token: string): Promise<void> {
  await chamar('POST', '/api/cadastro/confirmar', { token });
}

export async function reenviar(email: string): Promise<void> {
  await chamar('POST', '/api/cadastro/reenviar', { email });
}
