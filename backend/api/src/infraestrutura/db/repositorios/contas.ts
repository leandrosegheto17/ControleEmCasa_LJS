import { sql, type Kysely } from 'kysely';
import type { DB } from '../tipos';

/**
 * Contas (SDD 3.5; RN-03, RN-12). Toda consulta filtra por `dono_id` além da RLS (CA-T1.4: as duas camadas).
 * O dono e o lar vêm do vínculo derivado no banco, nunca do cliente (G-03).
 */

export interface ContaDoDono {
  id: string;
  nome: string;
  saldo_inicial_centavos: number;
  arquivada: boolean;
}

interface LinhaConta {
  id: string;
  nome: string;
  saldo_inicial: string;
  arquivada: boolean;
}

const paraConta = (l: LinhaConta): ContaDoDono => ({
  id: l.id,
  nome: l.nome,
  saldo_inicial_centavos: Number(l.saldo_inicial),
  arquivada: l.arquivada,
});

/** A conta do dono (nula se não existe ou é de outro membro: a RLS esconde, o filtro repete). */
export async function buscarContaDoDono(
  db: Kysely<DB>,
  dados: { id: string; donoId: string; travar?: boolean },
): Promise<ContaDoDono | null> {
  const r = await sql<LinhaConta>`
    select id, nome, saldo_inicial_centavos::text as saldo_inicial, arquivada
      from app.conta where id = ${dados.id} and dono_id = ${dados.donoId}
      ${dados.travar ? sql`for update` : sql``}`.execute(db);
  const linha = r.rows[0];
  return linha ? paraConta(linha) : null;
}

/**
 * Cria a conta se o id está livre. Devolve `false` quando o id já existe (do mesmo dono, em corrida, ou de
 * outro membro ou lar: a RLS não deixa ver, o índice único não esquece). A decisão fica com o chamador.
 */
export async function inserirContaSeLivre(
  db: Kysely<DB>,
  dados: { id: string; larId: string; donoId: string; nome: string; saldoInicialCentavos: number; agora: Date },
): Promise<boolean> {
  const r = await sql`
    insert into app.conta (id, lar_id, dono_id, nome, saldo_inicial_centavos, criado_em)
    values (${dados.id}, ${dados.larId}, ${dados.donoId}, ${dados.nome}, ${dados.saldoInicialCentavos},
            ${dados.agora.toISOString()}::timestamptz)
    on conflict (id) do nothing`.execute(db);
  return Number(r.numAffectedRows ?? 0) === 1;
}

export async function atualizarConta(
  db: Kysely<DB>,
  dados: { id: string; donoId: string; nome: string; saldoInicialCentavos: number },
): Promise<void> {
  await sql`
    update app.conta set nome = ${dados.nome}, saldo_inicial_centavos = ${dados.saldoInicialCentavos}
     where id = ${dados.id} and dono_id = ${dados.donoId}`.execute(db);
}

/** Arquiva (idempotente). Devolve as linhas afetadas: 0 = não existe ou não é do dono. */
export async function arquivarConta(db: Kysely<DB>, dados: { id: string; donoId: string }): Promise<number> {
  const r =
    await sql`update app.conta set arquivada = true where id = ${dados.id} and dono_id = ${dados.donoId}`.execute(db);
  return Number(r.numAffectedRows ?? 0);
}

/** Exclui. Com movimento ou forma ligados, o Postgres recusa com 23503 (a API traduz em `em_uso`). */
export async function excluirConta(db: Kysely<DB>, dados: { id: string; donoId: string }): Promise<number> {
  const r = await sql`delete from app.conta where id = ${dados.id} and dono_id = ${dados.donoId}`.execute(db);
  return Number(r.numAffectedRows ?? 0);
}

/** Grava o movimento `ajuste` da conta (imutável: a app só insere). */
export async function inserirAjusteDeSaldo(
  db: Kysely<DB>,
  dados: {
    larId: string;
    donoId: string;
    contaId: string;
    sentido: 'entrada' | 'saida';
    valorCentavos: number;
    data: string;
    agora: Date;
  },
): Promise<void> {
  await sql`
    insert into app.movimento_conta (lar_id, dono_id, conta_id, tipo, sentido, valor_centavos, data, criado_em)
    values (${dados.larId}, ${dados.donoId}, ${dados.contaId}, 'ajuste', ${dados.sentido}, ${dados.valorCentavos},
            ${dados.data}::date, ${dados.agora.toISOString()}::timestamptz)`.execute(db);
}

/** `true` se o movimento de conta com o id é do dono (a RLS esconde o dos outros; o filtro repete). */
export async function movimentoEhDoDono(db: Kysely<DB>, dados: { id: string; donoId: string }): Promise<boolean> {
  const r = await sql`select 1 from app.movimento_conta where id = ${dados.id} and dono_id = ${dados.donoId}`.execute(
    db,
  );
  return r.rows.length === 1;
}

/**
 * Grava o pagamento de cartão (RN-13): saída na conta de origem, ligada à forma de Crédito. O id vem do cliente
 * (ADR-010); `false` se o id já existe (de quem a RLS esconde, ou do próprio dono em corrida já tratada pela trava).
 */
export async function inserirPagamentoCartaoSeLivre(
  db: Kysely<DB>,
  dados: {
    id: string;
    larId: string;
    donoId: string;
    contaId: string;
    formaId: string;
    valorCentavos: number;
    data: string;
    agora: Date;
  },
): Promise<boolean> {
  const r = await sql`
    insert into app.movimento_conta (id, lar_id, dono_id, conta_id, tipo, sentido, valor_centavos, data,
                                     forma_credito_id, criado_em)
    values (${dados.id}, ${dados.larId}, ${dados.donoId}, ${dados.contaId}, 'pagamento_cartao', 'saida',
            ${dados.valorCentavos}, ${dados.data}::date, ${dados.formaId}, ${dados.agora.toISOString()}::timestamptz)
    on conflict (id) do nothing`.execute(db);
  return Number(r.numAffectedRows ?? 0) === 1;
}
