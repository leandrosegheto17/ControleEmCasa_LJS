import { sql } from 'kysely';
import type { OpcoesDoApp } from './app';
import {
  appDeLar,
  convidarEAceitar,
  criarLarDe,
  json,
  linhasComoOwner,
  pedir,
  pessoa,
  type Pessoa,
} from './testes-suporte-lar';

/** Utilitários dos testes de cadastros (etapa 7). Só para testes: fora da varredura de código de produção. */

export type App = ReturnType<typeof appDeLar>['app'];

export const novoId = () => crypto.randomUUID();

/**
 * Um lar com titular e membro, prontos para cadastrar. As sessões nascem no instante `agora` (relógio do teste):
 * com relógio controlado, passe o mesmo instante para que a sessão seja válida nele.
 */
export async function larParaCadastros(prefixo: string, opcoes: OpcoesDoApp & { agora?: Date } = {}) {
  const { agora, ...resto } = opcoes;
  const { app, caixa } = appDeLar(resto);
  const titular = await pessoa(`${prefixo}.titular`, `Titular ${prefixo}`, agora);
  const membro = await pessoa(`${prefixo}.membro`, `Membro ${prefixo}`, agora);
  const larId = await criarLarDe(app, titular);
  await convidarEAceitar(app, caixa, titular, membro);
  return { app, caixa, titular, membro, larId };
}

/** Cria uma conta pela rota e devolve o id; falha o teste se a criação não for 201. */
export async function criarConta(
  app: App,
  quem: Pessoa,
  corpo: { nome?: string; saldo_inicial_centavos?: number } = {},
  id = novoId(),
): Promise<string> {
  const r = await pedir(app, 'PUT', `/api/contas/${id}`, quem, { nome: corpo.nome ?? 'Itaú', ...corpo });
  if (r.status !== 201) throw new Error(`criar conta falhou: ${r.status} ${await r.text()}`);
  return id;
}

export async function criarForma(
  app: App,
  quem: Pessoa,
  corpo: {
    nome?: string;
    tipo: 'pix' | 'debito' | 'credito';
    conta_id?: string | null;
    dia_vencimento?: number | null;
  },
  id = novoId(),
): Promise<string> {
  const r = await pedir(app, 'PUT', `/api/formas/${id}`, quem, { nome: 'Forma', ...corpo });
  if (r.status !== 201) throw new Error(`criar forma falhou: ${r.status} ${await r.text()}`);
  return id;
}

export async function criarCategoria(
  app: App,
  quem: Pessoa,
  corpo: { nome: string; tipo: 'despesa' | 'receita'; escopo: 'conjunto' | 'individual'; variavel?: boolean | null },
  id = novoId(),
): Promise<string> {
  const r = await pedir(app, 'PUT', `/api/categorias/${id}`, quem, corpo);
  if (r.status !== 201) throw new Error(`criar categoria falhou: ${r.status} ${await r.text()}`);
  return id;
}

export async function listar<T>(app: App, rota: string, quem: Pessoa): Promise<T[]> {
  const r = await pedir(app, 'GET', rota, quem);
  if (r.status !== 200) throw new Error(`listar ${rota} falhou: ${r.status}`);
  return json<T[]>(r);
}

/** Quantas linhas a tabela tem para o id (como owner: enxerga tudo; só para inspeção). */
export async function contarPorId(tabela: 'conta' | 'forma_pagamento' | 'categoria', id: string): Promise<number> {
  const r = await linhasComoOwner(
    sql<{ n: number }>`select count(*)::int as n from ${sql.table(`app.${tabela}`)} where id = ${id}`,
  );
  return r[0]!.n;
}

/** Movimentos da conta, como o owner os vê (inspeção). */
export async function movimentosDaConta(contaId: string) {
  return linhasComoOwner(
    sql<{ tipo: string; sentido: string; valor_centavos: string; data: string }>`
      select tipo, sentido, valor_centavos::text, data::text from app.movimento_conta
       where conta_id = ${contaId} order by criado_em, id`,
  );
}
