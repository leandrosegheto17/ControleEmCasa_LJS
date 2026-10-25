import { sql, type Kysely } from 'kysely';
import type { DB } from '../infraestrutura/db/tipos';

/**
 * Saldo das contas (RN-12): agregação em SQL (ADR-003; SDD 10), nunca em JS.
 * saldo(conta, até) = saldo inicial + Σ movimentos de conta (entrada − saída) com `data <= até`.
 * SPEC_DEVIATION: a RN-12 também soma as receitas com destino na conta e subtrai as despesas Pix/Débito
 * pagas por ela; `lancamento` e `lancamento_pagamento` nascem na etapa 8, que acrescenta esses dois termos
 * aqui (mesma função, mesma data de corte).
 * `ate` é o "hoje" de São Paulo, passado pela API (nunca `current_date` do banco; RT-04).
 * O filtro por dono repete a RLS (CA-T1.4: as duas camadas).
 */

const SOMA_MOVIMENTOS = (ate: string) => sql`coalesce((
  select sum(case m.sentido when 'entrada' then m.valor_centavos else -m.valor_centavos end)
    from app.movimento_conta m
   where m.conta_id = c.id and m.dono_id = c.dono_id and m.data <= ${ate}::date
), 0)`;

export interface ContaComSaldo {
  id: string;
  nome: string;
  saldo_inicial_centavos: number;
  saldo_centavos: number;
  arquivada: boolean;
  pode_excluir: boolean;
}

/** Contas do dono com o saldo até a data; arquivadas entram (campo `arquivada`). */
export async function listarContasComSaldo(db: Kysely<DB>, donoId: string, ate: string): Promise<ContaComSaldo[]> {
  const r = await sql<{
    id: string;
    nome: string;
    saldo_inicial: string;
    saldo: string;
    arquivada: boolean;
    pode_excluir: boolean;
  }>`
    select c.id, c.nome, c.saldo_inicial_centavos::text as saldo_inicial,
           (c.saldo_inicial_centavos + ${SOMA_MOVIMENTOS(ate)})::text as saldo,
           c.arquivada,
           (not exists (select 1 from app.movimento_conta m where m.conta_id = c.id)
            and not exists (select 1 from app.forma_pagamento f where f.conta_id = c.id)) as pode_excluir
      from app.conta c
     where c.dono_id = ${donoId}
     order by c.criado_em, c.id`.execute(db);
  return r.rows.map((l) => ({
    id: l.id,
    nome: l.nome,
    saldo_inicial_centavos: Number(l.saldo_inicial),
    saldo_centavos: Number(l.saldo),
    arquivada: l.arquivada,
    pode_excluir: l.pode_excluir,
  }));
}

/** Saldo de uma conta do dono até a data (nulo se a conta não existe ou não é do dono). */
export async function saldoDaConta(
  db: Kysely<DB>,
  donoId: string,
  contaId: string,
  ate: string,
): Promise<number | null> {
  const r = await sql<{ saldo: string }>`
    select (c.saldo_inicial_centavos + ${SOMA_MOVIMENTOS(ate)})::text as saldo
      from app.conta c
     where c.id = ${contaId} and c.dono_id = ${donoId}`.execute(db);
  const linha = r.rows[0];
  return linha ? Number(linha.saldo) : null;
}
