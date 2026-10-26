import { sql, type Kysely } from 'kysely';
import type { DB } from '../tipos';

/**
 * Assinatura do lar e eventos do webhook (SDD 3.3, 3.4, 8.5; RN-24; G-29, G-31, G-50). Nas rotas de usuário, a
 * leitura e a escrita passam pela RLS do lar e filtram por `app.lar_atual()`. No webhook, a transação é de sistema
 * (`app.sistema = 'webhook'`) e a assinatura é achada pelo id do Asaas. O CPF/CNPJ nunca chega aqui (CA-24.11).
 */

export type SituacaoAssinaturaBanco = 'trial' | 'ativa' | 'atrasada' | 'cancelada' | 'free';
export type SituacaoCobrancaBanco = 'pendente' | 'paga' | 'vencida';

export interface LinhaAssinatura {
  larId: string;
  situacao: SituacaoAssinaturaBanco;
  trialAte: Date;
  periodoAte: Date | null;
  asaasClienteId: string | null;
  asaasAssinaturaId: string | null;
  cobrancaId: string | null;
  cobrancaVencimento: string | null;
  cobrancaValorCentavos: number | null;
  cobrancaSituacao: SituacaoCobrancaBanco | null;
  ultimoEventoEm: Date | null;
}

interface LinhaBruta {
  lar_id: string;
  situacao: SituacaoAssinaturaBanco;
  trial_ate: Date;
  periodo_ate: Date | null;
  asaas_cliente_id: string | null;
  asaas_assinatura_id: string | null;
  cobranca_id: string | null;
  cobranca_vencimento: string | null;
  cobranca_valor_centavos: number | null;
  cobranca_situacao: SituacaoCobrancaBanco | null;
  ultimo_evento_em: Date | null;
}

const COLUNAS = sql`lar_id, situacao, trial_ate, periodo_ate, asaas_cliente_id, asaas_assinatura_id, cobranca_id,
  cobranca_vencimento::text as cobranca_vencimento, cobranca_valor_centavos::int as cobranca_valor_centavos,
  cobranca_situacao, ultimo_evento_em`;

function deBruta(b: LinhaBruta): LinhaAssinatura {
  return {
    larId: b.lar_id,
    situacao: b.situacao,
    trialAte: b.trial_ate,
    periodoAte: b.periodo_ate,
    asaasClienteId: b.asaas_cliente_id,
    asaasAssinaturaId: b.asaas_assinatura_id,
    cobrancaId: b.cobranca_id,
    cobrancaVencimento: b.cobranca_vencimento,
    cobrancaValorCentavos: b.cobranca_valor_centavos,
    cobrancaSituacao: b.cobranca_situacao,
    ultimoEventoEm: b.ultimo_evento_em,
  };
}

const iso = (d: Date | null) => (d ? d.toISOString() : null);

/** `true` se o usuário já foi titular de um lar com trial (CA-24.10). */
export async function trialJaUsado(db: Kysely<DB>, usuarioId: string): Promise<boolean> {
  const r = await sql<{ usado: boolean }>`
    select trial_usado_em is not null as usado from app.usuario where id = ${usuarioId}`.execute(db);
  return r.rows[0]?.usado ?? false;
}

/** Marca o trial do usuário como usado (só a primeira vez). */
export async function marcarTrialUsado(db: Kysely<DB>, usuarioId: string, agora: Date): Promise<void> {
  await sql`
    update app.usuario set trial_usado_em = ${agora.toISOString()}::timestamptz
     where id = ${usuarioId} and trial_usado_em is null`.execute(db);
}

/** Cria a assinatura do lar atual (a política só deixa o titular). */
export async function inserirAssinatura(
  db: Kysely<DB>,
  dados: { larId: string; situacao: 'trial' | 'free'; trialAte: Date; agora: Date },
): Promise<void> {
  await sql`
    insert into app.assinatura (lar_id, situacao, trial_ate, criado_em, atualizado_em)
    values (${dados.larId}, ${dados.situacao}, ${dados.trialAte.toISOString()}::timestamptz,
            ${dados.agora.toISOString()}::timestamptz, ${dados.agora.toISOString()}::timestamptz)`.execute(db);
}

/** A assinatura do lar atual (nula se o lar não tiver). `travar` segura a linha até o fim da transação. */
export async function buscarAssinaturaAtual(db: Kysely<DB>, travar = false): Promise<LinhaAssinatura | null> {
  const r = await sql<LinhaBruta>`
    select ${COLUNAS} from app.assinatura where lar_id = app.lar_atual() ${travar ? sql`for update` : sql``}`.execute(
    db,
  );
  const b = r.rows[0];
  return b ? deBruta(b) : null;
}

/** Webhook (sistema): a assinatura pelo id do Asaas, travada até o fim da transação. */
export async function buscarPorAssinaturaAsaas(
  db: Kysely<DB>,
  asaasAssinaturaId: string,
): Promise<LinhaAssinatura | null> {
  const r = await sql<LinhaBruta>`
    select ${COLUNAS} from app.assinatura where asaas_assinatura_id = ${asaasAssinaturaId} for update`.execute(db);
  const b = r.rows[0];
  return b ? deBruta(b) : null;
}

/** Grava o estado inteiro da assinatura do lar (rotas: o lar atual; webhook: o lar da linha travada). */
export async function gravarAssinatura(db: Kysely<DB>, linha: LinhaAssinatura, agora: Date): Promise<void> {
  const r = await sql`
    update app.assinatura set
      situacao = ${linha.situacao},
      trial_ate = ${linha.trialAte.toISOString()}::timestamptz,
      periodo_ate = ${iso(linha.periodoAte)}::timestamptz,
      asaas_cliente_id = ${linha.asaasClienteId},
      asaas_assinatura_id = ${linha.asaasAssinaturaId},
      cobranca_id = ${linha.cobrancaId},
      cobranca_vencimento = ${linha.cobrancaVencimento}::date,
      cobranca_valor_centavos = ${linha.cobrancaValorCentavos},
      cobranca_situacao = ${linha.cobrancaSituacao},
      ultimo_evento_em = ${iso(linha.ultimoEventoEm)}::timestamptz,
      atualizado_em = ${agora.toISOString()}::timestamptz
    where lar_id = ${linha.larId}`.execute(db);
  if (Number(r.numAffectedRows ?? 0) !== 1) throw new Error('assinatura_nao_gravada');
}

/** Webhook: o evento já foi registrado (repetido)? */
export async function eventoRegistrado(db: Kysely<DB>, eventId: string): Promise<boolean> {
  const r = await sql`select 1 from app.webhook_evento where event_id = ${eventId}`.execute(db);
  return r.rows.length > 0;
}

/**
 * Registra o evento já processado. Devolve `false` se o id já existia (repetido, inclusive em corrida: o segundo
 * espera o primeiro terminar e não grava). O resumo leva só ids, situação, valor e datas (G-50).
 */
export async function registrarEvento(
  db: Kysely<DB>,
  dados: {
    eventId: string;
    tipo: string;
    asaasAssinaturaId: string | null;
    ocorridoEm: Date;
    agora: Date;
    resumo: Record<string, string | number | null>;
  },
): Promise<boolean> {
  const agora = dados.agora.toISOString();
  const r = await sql`
    insert into app.webhook_evento (event_id, tipo, asaas_assinatura_id, ocorrido_em, recebido_em, processado_em, resumo)
    values (${dados.eventId}, ${dados.tipo}, ${dados.asaasAssinaturaId}, ${dados.ocorridoEm.toISOString()}::timestamptz,
            ${agora}::timestamptz, ${agora}::timestamptz, ${JSON.stringify(dados.resumo)}::jsonb)
    on conflict (event_id) do nothing`.execute(db);
  return Number(r.numAffectedRows ?? 0) === 1;
}

/** Nome e e-mail do titular do lar atual (para os e-mails de cobrança). */
export async function titularDoLarAtual(db: Kysely<DB>): Promise<{ nome: string; email: string } | null> {
  const r = await sql<{ nome: string; email: string }>`
    select u.nome, u.email::text as email
      from app.membro m join app.usuario u on u.id = m.usuario_id
     where m.lar_id = app.lar_atual() and m.papel = 'titular' and m.saiu_em is null`.execute(db);
  return r.rows[0] ?? null;
}
