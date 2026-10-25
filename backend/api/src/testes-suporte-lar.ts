import { sql, type RawBuilder, type Transaction } from 'kysely';
import { inject } from 'vitest';
import { criarApp, type OpcoesDoApp } from './app';
import type { Bindings, Vinculo } from './env';
import { criarDb } from './infraestrutura/db/cliente';
import { emTransacaoComo } from './infraestrutura/db/transacao';
import type { DB } from './infraestrutura/db/tipos';
import { paraBase64Url } from './infraestrutura/seguranca/token';
import { chamar, ESCRITA } from './testes-suporte';
import {
  caixaDeEmail,
  comoOwner,
  cookieSid,
  emailAleatorio,
  LIMITE_LIVRE,
  sha256,
  type Caixa,
} from './testes-suporte-acesso';

/** Utilitários dos testes de lar e convite (etapa 6). Só para testes: fora da varredura de código de produção. */

type App = ReturnType<typeof criarApp>;

export interface Pessoa {
  id: string;
  email: string;
  nome: string;
  cookie: string;
}

/** App com a caixa de e-mail em memória e o relógio (real por padrão, ou o controlado do teste). */
export function appDeLar(opcoes: OpcoesDoApp & { caixa?: Caixa } = {}) {
  const caixa = opcoes.caixa ?? caixaDeEmail();
  const app = criarApp({ ...opcoes, transporteEmail: caixa.transporte });
  return { app, caixa };
}

/**
 * Cria um usuário confirmado e uma sessão válida direto no banco (owner), sem bcrypt: os testes de lar não
 * medem o login (etapa 4), só precisam de um cookie real. A sessão nasce no instante dado (relógio do teste).
 */
export async function pessoa(prefixo = 'pessoa', nome = 'Pessoa de teste', agora = new Date()): Promise<Pessoa> {
  const email = emailAleatorio(prefixo);
  const id = await comoOwner(async (db) => {
    const r = await sql<{ id: string }>`
      insert into app.usuario (email, nome, senha_hash, email_confirmado_em)
      values (${email}, ${nome}, 'sem-senha', now()) returning id`.execute(db);
    return r.rows[0]!.id;
  });
  return { id, email, nome, cookie: await novaSessao(id, agora) };
}

/** Sessão nova para o usuário, criada no instante dado (para testes que avançam o relógio). */
export async function novaSessao(usuarioId: string, agora: Date): Promise<string> {
  const token = paraBase64Url(crypto.getRandomValues(new Uint8Array(32)));
  const hash = await sha256(token);
  await comoOwner((db) =>
    sql`insert into app.sessao (token_hash, usuario_id, criada_em, ultimo_uso_em, expira_absoluta_em)
        values (${hash}, ${usuarioId}, ${agora.toISOString()}::timestamptz, ${agora.toISOString()}::timestamptz,
                ${agora.toISOString()}::timestamptz + interval '12 hours')`.execute(db),
  );
  return cookieSid(token);
}

const SEM_LIMITE: Partial<Bindings> = { LIMITE_ENTRAR: LIMITE_LIVRE, LIMITE_PUBLICO: LIMITE_LIVRE };

/** Requisição com o cookie da pessoa e, nas escritas, os cabeçalhos de CSRF. */
export function pedir(
  app: App,
  metodo: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE',
  caminho: string,
  quem: Pessoa | null,
  corpo?: unknown,
): Promise<Response> {
  const headers: Record<string, string> = metodo === 'GET' ? {} : { ...ESCRITA };
  if (corpo !== undefined) headers['Content-Type'] = 'application/json';
  if (quem) headers['Cookie'] = quem.cookie;
  return chamar(
    app,
    caminho,
    { method: metodo, headers, body: corpo === undefined ? undefined : JSON.stringify(corpo) },
    SEM_LIMITE,
  );
}

export async function json<T = Record<string, unknown>>(r: Response): Promise<T> {
  return (await r.json()) as T;
}

/** Cria o lar da pessoa pelo primeiro acesso e devolve o id. */
export async function criarLarDe(app: App, quem: Pessoa): Promise<string> {
  const r = await pedir(app, 'POST', '/api/lar', quem, {});
  if (r.status !== 201 && r.status !== 200) throw new Error(`criar lar falhou: ${r.status}`);
  return (await json<{ id: string }>(r)).id;
}

/** Token do último convite enviado ao e-mail (o link leva o token no fragmento `#t=`). */
export function tokenDoConvite(caixa: Caixa, email: string): string {
  return caixa.ultimoToken(email);
}

/** Titular convida e o convidado aceita (fluxo real). Devolve o token usado. */
export async function convidarEAceitar(app: App, caixa: Caixa, titular: Pessoa, convidado: Pessoa): Promise<string> {
  const c = await pedir(app, 'POST', '/api/lar/convites', titular, { email: convidado.email });
  if (c.status !== 201) throw new Error(`convite falhou: ${c.status}`);
  const token = tokenDoConvite(caixa, convidado.email);
  const a = await pedir(app, 'POST', '/api/convites/aceitar', convidado, { token });
  if (a.status !== 204) throw new Error(`aceite falhou: ${a.status} ${await a.text()}`);
  return token;
}

/** Monta um lar completo (titular + convidado) pelas rotas. */
export async function larComDois(app: App, caixa: Caixa, prefixo: string) {
  const titular = await pessoa(`${prefixo}.titular`, `Titular ${prefixo}`);
  const membro = await pessoa(`${prefixo}.membro`, `Membro ${prefixo}`);
  const larId = await criarLarDe(app, titular);
  await convidarEAceitar(app, caixa, titular, membro);
  return { titular, membro, larId };
}

/**
 * Executa como `controle_app` com a identidade da pessoa, derivando o vínculo EXATAMENTE como a API
 * (emTransacaoComo): serve para inspecionar o que a RLS deixa a pessoa ver. A transação é desfeita no fim.
 */
export async function comoApp<T>(
  quem: { id: string; email: string },
  fn: (trx: Transaction<DB>, vinculo: Vinculo | null) => Promise<T>,
): Promise<T> {
  const db = criarDb(inject('urlBancoApp'));
  let resultado: T | undefined;
  try {
    await emTransacaoComo(db, { usuarioId: quem.id, email: quem.email }, async (trx, vinculo) => {
      resultado = await fn(trx, vinculo);
      throw new Desfazer();
    });
  } catch (e) {
    if (!(e instanceof Desfazer)) throw e;
  } finally {
    await db.destroy();
  }
  return resultado as T;
}

class Desfazer extends Error {}

/** Linhas de uma consulta como owner (superusuário local: enxerga tudo; só para inspeção). */
export async function linhasComoOwner<T>(consulta: RawBuilder<T>): Promise<T[]> {
  return comoOwner(async (db) => (await consulta.execute(db)).rows);
}

export { ESCRITA };
