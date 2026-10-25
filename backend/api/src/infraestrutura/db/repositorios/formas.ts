import { sql, type Kysely } from 'kysely';
import type { DB } from '../tipos';

/**
 * Formas de pagamento (SDD 3.5; RN-03). Toda consulta filtra por `dono_id` além da RLS (CA-T1.4).
 * O dono e o lar vêm do vínculo derivado no banco, nunca do cliente (G-03).
 */

export interface FormaDoDono {
  id: string;
  nome: string;
  tipo: 'pix' | 'debito' | 'credito';
  conta_id: string | null;
  dia_vencimento: number | null;
  preferida: boolean;
  arquivada: boolean;
}

export async function buscarFormaDoDono(
  db: Kysely<DB>,
  dados: { id: string; donoId: string; travar?: boolean },
): Promise<FormaDoDono | null> {
  const r = await sql<FormaDoDono>`
    select id, nome, tipo, conta_id, dia_vencimento::int as dia_vencimento, preferida, arquivada
      from app.forma_pagamento where id = ${dados.id} and dono_id = ${dados.donoId}
      ${dados.travar ? sql`for update` : sql``}`.execute(db);
  return r.rows[0] ?? null;
}

/** Cria a forma se o id está livre; `false` se o id já existe (ver `inserirContaSeLivre`). */
export async function inserirFormaSeLivre(
  db: Kysely<DB>,
  dados: {
    id: string;
    larId: string;
    donoId: string;
    nome: string;
    tipo: string;
    contaId: string | null;
    diaVencimento: number | null;
    agora: Date;
  },
): Promise<boolean> {
  const r = await sql`
    insert into app.forma_pagamento (id, lar_id, dono_id, nome, tipo, conta_id, dia_vencimento, criado_em)
    values (${dados.id}, ${dados.larId}, ${dados.donoId}, ${dados.nome}, ${dados.tipo}, ${dados.contaId},
            ${dados.diaVencimento}, ${dados.agora.toISOString()}::timestamptz)
    on conflict (id) do nothing`.execute(db);
  return Number(r.numAffectedRows ?? 0) === 1;
}

/** Atualiza nome, conta e dia. Não mexe em tipo (imutável), preferida nem arquivada. */
export async function atualizarForma(
  db: Kysely<DB>,
  dados: { id: string; donoId: string; nome: string; contaId: string | null; diaVencimento: number | null },
): Promise<void> {
  await sql`
    update app.forma_pagamento set nome = ${dados.nome}, conta_id = ${dados.contaId}, dia_vencimento = ${dados.diaVencimento}
     where id = ${dados.id} and dono_id = ${dados.donoId}`.execute(db);
}

/** Arquiva e tira a preferência (para o padrão do lançamento não apontar para forma fora das opções). */
export async function arquivarForma(db: Kysely<DB>, dados: { id: string; donoId: string }): Promise<number> {
  const r = await sql`
    update app.forma_pagamento set arquivada = true, preferida = false
     where id = ${dados.id} and dono_id = ${dados.donoId}`.execute(db);
  return Number(r.numAffectedRows ?? 0);
}

export async function excluirForma(db: Kysely<DB>, dados: { id: string; donoId: string }): Promise<number> {
  const r = await sql`delete from app.forma_pagamento where id = ${dados.id} and dono_id = ${dados.donoId}`.execute(db);
  return Number(r.numAffectedRows ?? 0);
}

/**
 * Trava todas as formas do dono até o fim da transação: duas trocas de preferida simultâneas se serializam
 * (o índice único parcial `forma_pagamento_uma_preferida` continua como rede de segurança).
 */
export async function travarFormasDoDono(db: Kysely<DB>, donoId: string): Promise<void> {
  await sql`select 1 from app.forma_pagamento where dono_id = ${donoId} for update`.execute(db);
}

/** Troca a preferida: a anterior do dono deixa de ser (CA-03.4) e só então a nova passa a ser. */
export async function definirPreferidaDoDono(
  db: Kysely<DB>,
  dados: { id: string; donoId: string; preferida: boolean },
): Promise<void> {
  if (dados.preferida) {
    await sql`
      update app.forma_pagamento set preferida = false where dono_id = ${dados.donoId} and preferida and id <> ${dados.id}`.execute(
      db,
    );
    await sql`
      update app.forma_pagamento set preferida = true where id = ${dados.id} and dono_id = ${dados.donoId} and not preferida`.execute(
      db,
    );
  } else {
    await sql`
      update app.forma_pagamento set preferida = false where id = ${dados.id} and dono_id = ${dados.donoId} and preferida`.execute(
      db,
    );
  }
}

export interface FormaListada {
  id: string;
  nome: string;
  tipo: 'pix' | 'debito' | 'credito';
  conta: { id: string; nome: string } | null;
  dia_vencimento: number | null;
  preferida: boolean;
  arquivada: boolean;
  pode_excluir: boolean;
}

/**
 * Formas do dono com a conta em objeto {id, nome}; arquivadas entram. `pode_excluir`: sem movimento de conta
 * (pagamento de cartão) nem lançamento ligado (`lancamento_pagamento`, etapa 8).
 */
export async function listarFormasDoDono(db: Kysely<DB>, donoId: string): Promise<FormaListada[]> {
  const r = await sql<{
    id: string;
    nome: string;
    tipo: 'pix' | 'debito' | 'credito';
    conta_id: string | null;
    conta_nome: string | null;
    dia_vencimento: number | null;
    preferida: boolean;
    arquivada: boolean;
    pode_excluir: boolean;
  }>`
    select f.id, f.nome, f.tipo, c.id as conta_id, c.nome as conta_nome, f.dia_vencimento::int as dia_vencimento,
           f.preferida, f.arquivada,
           (not exists (select 1 from app.movimento_conta m where m.forma_credito_id = f.id)
            and not exists (select 1 from app.lancamento_pagamento lp
                             where lp.forma_pagamento_id = f.id and lp.dono_id = f.dono_id)) as pode_excluir
      from app.forma_pagamento f
      left join app.conta c on c.id = f.conta_id and c.dono_id = f.dono_id
     where f.dono_id = ${donoId}
     order by f.criado_em, f.id`.execute(db);
  return r.rows.map((l) => ({
    id: l.id,
    nome: l.nome,
    tipo: l.tipo,
    conta: l.conta_id && l.conta_nome !== null ? { id: l.conta_id, nome: l.conta_nome } : null,
    dia_vencimento: l.dia_vencimento,
    preferida: l.preferida,
    arquivada: l.arquivada,
    pode_excluir: l.pode_excluir,
  }));
}
