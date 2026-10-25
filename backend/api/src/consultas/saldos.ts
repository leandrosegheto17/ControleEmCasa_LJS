import { sql, type Kysely } from 'kysely';
import type { DB } from '../infraestrutura/db/tipos';

/**
 * Saldo das contas (RN-12): agregação em SQL (ADR-003; SDD 10), nunca em JS.
 * saldo(conta, até) = saldo inicial
 *                   + Σ receitas com destino na conta − Σ despesas Pix/Débito pagas pela conta
 *                   ± Σ movimentos de conta (entrada − saída),
 * contando só o que tem data da operação (ou do movimento) `<= até`. O valor de cada lançamento é a soma das
 * suas parcelas (G-51: nunca o cabeçalho). Crédito nunca entra: a parte privada do Crédito não tem conta (RN-13).
 * A data é a `data_operacao` da parte privada, que é do dono: só ele a enxerga (G-10).
 * `ate` é o "hoje" de São Paulo, passado pela API (nunca `current_date` do banco; RT-04).
 * O filtro por dono repete a RLS (CA-T1.4: as duas camadas).
 */

const SOMA_MOVIMENTOS = (ate: string) => sql`coalesce((
  select sum(case m.sentido when 'entrada' then m.valor_centavos else -m.valor_centavos end)
    from app.movimento_conta m
   where m.conta_id = c.id and m.dono_id = c.dono_id and m.data <= ${ate}::date
), 0)`;

const SOMA_LANCAMENTOS = (ate: string) => sql`coalesce((
  select sum(case l.tipo when 'receita' then p.valor_centavos else -p.valor_centavos end)
    from app.lancamento_pagamento lp
    join app.lancamento l on l.id = lp.lancamento_id and l.dono_id = lp.dono_id
    join app.parcela p on p.lancamento_id = lp.lancamento_id
   where lp.conta_id = c.id and lp.dono_id = c.dono_id and lp.data_operacao <= ${ate}::date
), 0)`;

const SALDO = (ate: string) => sql`(c.saldo_inicial_centavos + ${SOMA_MOVIMENTOS(ate)} + ${SOMA_LANCAMENTOS(ate)})`;

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
           ${SALDO(ate)}::text as saldo,
           c.arquivada,
           (not exists (select 1 from app.movimento_conta m where m.conta_id = c.id)
            and not exists (select 1 from app.forma_pagamento f where f.conta_id = c.id)
            and not exists (select 1 from app.lancamento_pagamento lp where lp.conta_id = c.id)) as pode_excluir
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
    select ${SALDO(ate)}::text as saldo
      from app.conta c
     where c.id = ${contaId} and c.dono_id = ${donoId}`.execute(db);
  const linha = r.rows[0];
  return linha ? Number(linha.saldo) : null;
}
