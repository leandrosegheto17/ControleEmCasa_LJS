import pg from 'pg';
import { criarClienteAsaas } from '../../api/src/infraestrutura/asaas/cliente';

/**
 * Purga (RN-26, CA-19.8, CA-23.12, CA-26.3, CA-26.4, CA-26.8, CA-26.10; SDD D-05, E-1, E-2; G-49; ADR-013).
 * Roda no GitHub Actions (`.github/workflows/purga.yml`) com a role OWNER, uma vez por dia. Cada transação grava
 * `app.sistema = 'purga'` como GUC LOCAL: é o que libera as políticas `purga_select`/`purga_delete` do owner nas
 * tabelas com RLS FORCE (migração da etapa 14). Sem o GUC, o owner não-superusuário não enxerga nada.
 *
 * O que apaga, cada unidade na SUA transação (falha de uma não desfaz as outras; reexecutar continua de onde parou):
 * 1. Exclusões confirmadas com `purgar_em` vencido (no máximo `limite` por execução, as mais antigas primeiro):
 *    - todo lar CRIADO pelo usuário (o lar do titular, com ou sem convidado, D1; e os lares descartados no aceite de
 *      convite), por inteiro: tabelas de negócio, convites, assinatura e membros. Antes, se a assinatura do lar ainda
 *      não estiver `cancelada`, cancela no Asaas; se o Asaas falhar (ou não estiver configurado), NADA desse usuário é
 *      apagado e a exclusão fica para a próxima execução (relatada como falha);
 *    - o individual do usuário nos lares em que foi convidado (o lar segue com o titular; CA-23.12);
 *    - o usuário (sessões, tokens e aceites vão em cascata; `membro.usuario_id` vira nulo), o que libera o e-mail
 *      (CA-26.4). A linha de `exclusao_conta` fica, só com ids e datas, marcada `purgada_em`.
 * 2. Ex-membros (saída ou remoção) há 30 dias ou mais com individual ainda no lar (CA-23.12, E-2): contas, formas,
 *    movimentos de conta (inclusive os ligados a movimentos de meta conjunta: pendência da etapa 10), a parte privada
 *    das conjuntas que pagou (pendência da etapa 8: removidos pelo titular), lançamentos, orçamentos e metas
 *    individuais, as categorias individuais e o push do vínculo (aparelhos, preferências e avisos; etapa 15). As
 *    conjuntas, as metas conjuntas e os movimentos delas ficam.
 * 3. Contas nunca confirmadas há 7 dias ou mais (CA-19.8).
 * 4. Poda (RN-26): tentativas de login com mais de 30 dias, tokens de e-mail vencidos há mais de 30 dias, sessões
 *    expiradas há mais de 30 dias e eventos do webhook com mais de 12 meses.
 *
 * O relatório e o log levam só contagens, ids técnicos (uuid de exclusão, de membro e de lar) e motivos. Nunca nome,
 * e-mail, valor, descrição ou token.
 */

const DIA_MS = 24 * 60 * 60 * 1000;
export const PRAZO_PURGA_MS = 30 * DIA_MS;
export const PRAZO_EX_MEMBRO_MS = 30 * DIA_MS;
export const PRAZO_NAO_CONFIRMADA_MS = 7 * DIA_MS;
export const PODA_MS = 30 * DIA_MS;
/** Tamanho do lote de cada DELETE da poda (lotes pequenos: transações curtas). */
const LOTE_PODA = 1000;
/** Teto de lotes por tabela numa execução (o resto fica para o dia seguinte). */
const MAX_LOTES_PODA = 50;
export const LIMITE_PADRAO = 50;

/**
 * Ordem de exclusão das tabelas de um lar (filhas antes das mães, pelas FKs). Toda tabela com `lar_id` precisa estar
 * aqui: o teste de catálogo falha se uma tabela nova ficar de fora (as de push entraram na etapa 15).
 */
export const TABELAS_DO_LAR = [
  'movimento_conta',
  'lancamento_pagamento',
  'ocorrencia_fixa',
  'parcela',
  'lancamento',
  'despesa_fixa',
  'orcamento',
  'movimento_meta',
  'meta',
  'forma_pagamento',
  'conta',
  'categoria',
  'convite',
  'assinatura',
  // Push (etapa 15): avisos, inscrições e preferências apontam o membro (FK composta), então saem antes dele.
  'aviso_push',
  'push_subscription',
  'preferencia_notificacao',
  'membro',
] as const;

/** Só o que a purga precisa do módulo do Asaas (o mesmo cancelamento das rotas; 404 lá vale como cancelada). */
export interface CancelamentoAsaas {
  cancelarAssinatura(assinaturaId: string): Promise<unknown>;
}

export interface OpcoesPurga {
  agora: Date;
  /** Nulo quando o Asaas não está configurado: lares com assinatura a cancelar ficam para depois. */
  asaas: CancelamentoAsaas | null;
  /** Máximo de exclusões, de ex-membros e de contas não confirmadas por execução. */
  limite?: number;
  /** Destino das linhas de log (JSON). Padrão: `console.info`/`console.warn`. */
  log?: (linha: string) => void;
}

export interface FalhaPurga {
  unidade: 'exclusao' | 'ex_membro' | 'nao_confirmadas' | 'poda';
  /** Id técnico (uuid da exclusão ou do membro) ou o nome da tabela; nunca dado pessoal. */
  id: string;
  motivo: string;
}

export interface RelatorioPurga {
  exclusoes_purgadas: number;
  lares_apagados: number;
  ex_membros_purgados: number;
  contas_nao_confirmadas: number;
  sessoes: number;
  tokens: number;
  tentativas: number;
  webhook_eventos: number;
  /** Linhas apagadas por tabela (soma de todas as unidades). */
  linhas: Record<string, number>;
  falhas: FalhaPurga[];
}

class FalhaDeUnidade extends Error {
  constructor(readonly motivo: string) {
    super(motivo);
    this.name = 'FalhaDeUnidade';
  }
}

function motivoDe(erro: unknown): string {
  if (erro instanceof FalhaDeUnidade) return erro.motivo;
  const codigo = (erro as { code?: unknown }).code;
  if (typeof codigo === 'string' && /^[0-9A-Z]{5}$/.test(codigo)) return `sqlstate_${codigo}`;
  return erro instanceof Error ? erro.name : 'desconhecido';
}

function novoRelatorio(): RelatorioPurga {
  return {
    exclusoes_purgadas: 0,
    lares_apagados: 0,
    ex_membros_purgados: 0,
    contas_nao_confirmadas: 0,
    sessoes: 0,
    tokens: 0,
    tentativas: 0,
    webhook_eventos: 0,
    linhas: {},
    falhas: [],
  };
}

/** Uma transação no contexto da purga: o GUC é o primeiro comando e some no COMMIT ou no ROLLBACK (G-02). */
async function emPurga<T>(c: pg.Client, fn: () => Promise<T>): Promise<T> {
  await c.query('begin');
  try {
    await c.query(`select set_config('app.sistema', 'purga', true)`);
    const r = await fn();
    await c.query('commit');
    return r;
  } catch (e) {
    await c.query('rollback');
    throw e;
  }
}

/** Executa um DELETE e soma as linhas na contagem da tabela (contagem local, aplicada só depois do COMMIT). */
async function apagar(
  c: pg.Client,
  contagem: Record<string, number>,
  tabela: string,
  sql: string,
  params: unknown[],
): Promise<number> {
  const n = (await c.query(sql, params)).rowCount ?? 0;
  if (n > 0) contagem[tabela] = (contagem[tabela] ?? 0) + n;
  return n;
}

function somar(relatorio: RelatorioPurga, contagem: Record<string, number>): void {
  for (const [t, n] of Object.entries(contagem)) relatorio.linhas[t] = (relatorio.linhas[t] ?? 0) + n;
}

/** Cancela no Asaas a assinatura do lar, se ainda não estiver cancelada. Falha = a unidade inteira volta. */
async function cancelarAssinaturaDoLar(c: pg.Client, larId: string, asaas: CancelamentoAsaas | null): Promise<void> {
  const r = await c.query<{ asaas_assinatura_id: string | null; situacao: string }>(
    // Sem FOR UPDATE: sob RLS ele exigiria política de UPDATE, que o owner não tem (só SELECT e DELETE na purga).
    `select asaas_assinatura_id, situacao from app.assinatura where lar_id = $1`,
    [larId],
  );
  const linha = r.rows[0];
  if (!linha?.asaas_assinatura_id || linha.situacao === 'cancelada') return;
  if (!asaas) throw new FalhaDeUnidade('asaas_sem_configuracao');
  try {
    await asaas.cancelarAssinatura(linha.asaas_assinatura_id);
  } catch {
    throw new FalhaDeUnidade('asaas_indisponivel');
  }
}

/** Apaga o lar inteiro (CA-26.3, CA-26.8): todas as tabelas com `lar_id`, depois o lar. */
async function apagarLar(c: pg.Client, contagem: Record<string, number>, larId: string): Promise<void> {
  for (const tabela of TABELAS_DO_LAR) {
    await apagar(c, contagem, tabela, `delete from app.${tabela} where lar_id = $1`, [larId]);
  }
  await apagar(c, contagem, 'lar', `delete from app.lar where id = $1`, [larId]);
}

/**
 * Apaga o individual de um membro que saiu (ou do convidado que excluiu a conta), deixando o conjunto do lar
 * (CA-23.12): a conjunta que ele pagou fica, sem a parte privada; a meta conjunta e os movimentos dela ficam, sem a
 * conta (o movimento de conta é dele e sai). Devolve as linhas apagadas.
 */
async function apagarIndividual(c: pg.Client, contagem: Record<string, number>, membroId: string): Promise<number> {
  const m = [membroId];
  let n = 0;
  n += await apagar(c, contagem, 'movimento_conta', `delete from app.movimento_conta where dono_id = $1`, m);
  n += await apagar(c, contagem, 'lancamento_pagamento', `delete from app.lancamento_pagamento where dono_id = $1`, m);
  // A parcela vai em cascata; a ocorrência de fixa só aponta lançamento conjunto.
  n += await apagar(
    c,
    contagem,
    'lancamento',
    `delete from app.lancamento where dono_id = $1 and escopo = 'individual'`,
    m,
  );
  n += await apagar(c, contagem, 'orcamento', `delete from app.orcamento where dono_id = $1`, m);
  n += await apagar(
    c,
    contagem,
    'movimento_meta',
    `delete from app.movimento_meta where meta_id in (select id from app.meta where dono_id = $1 and escopo = 'individual')`,
    m,
  );
  n += await apagar(c, contagem, 'meta', `delete from app.meta where dono_id = $1 and escopo = 'individual'`, m);
  n += await apagar(c, contagem, 'forma_pagamento', `delete from app.forma_pagamento where dono_id = $1`, m);
  n += await apagar(c, contagem, 'conta', `delete from app.conta where dono_id = $1`, m);
  n += await apagar(c, contagem, 'categoria', `delete from app.categoria where dono_id = $1`, m);
  // Push do vínculo (etapa 15; G-49): aparelhos, preferências e avisos do ex-membro naquele lar.
  n += await apagar(c, contagem, 'aviso_push', `delete from app.aviso_push where membro_id = $1`, m);
  n += await apagar(c, contagem, 'push_subscription', `delete from app.push_subscription where membro_id = $1`, m);
  n += await apagar(
    c,
    contagem,
    'preferencia_notificacao',
    `delete from app.preferencia_notificacao where membro_id = $1`,
    m,
  );
  return n;
}

/** Uma exclusão vencida: Asaas, lares criados, individual nos lares de outros e o usuário. */
async function purgarExclusao(
  c: pg.Client,
  exclusaoId: string,
  opcoes: OpcoesPurga,
  relatorio: RelatorioPurga,
): Promise<void> {
  const contagem: Record<string, number> = {};
  const lares = await emPurga(c, async () => {
    // Outra execução com a mesma exclusão travada? Pula (skip locked); já purgada ou não vencida? Pula.
    const r = await c.query<{ usuario_id: string }>(
      `select usuario_id from app.exclusao_conta
        where id = $1 and confirmada_em is not null and cancelada_em is null and purgada_em is null and purgar_em <= $2
        for update skip locked`,
      [exclusaoId, opcoes.agora.toISOString()],
    );
    const usuarioId = r.rows[0]?.usuario_id;
    if (!usuarioId) return null;

    const criados = await c.query<{ id: string }>(`select id from app.lar where criado_por = $1 order by id`, [
      usuarioId,
    ]);
    for (const { id } of criados.rows) await cancelarAssinaturaDoLar(c, id, opcoes.asaas);
    for (const { id } of criados.rows) await apagarLar(c, contagem, id);

    const vinculos = await c.query<{ id: string }>(`select id from app.membro where usuario_id = $1`, [usuarioId]);
    for (const { id } of vinculos.rows) await apagarIndividual(c, contagem, id);

    await apagar(c, contagem, 'usuario', `delete from app.usuario where id = $1`, [usuarioId]);
    await c.query(`update app.exclusao_conta set purgada_em = $2 where id = $1`, [
      exclusaoId,
      opcoes.agora.toISOString(),
    ]);
    return criados.rows.length;
  });
  if (lares === null) return;
  relatorio.exclusoes_purgadas += 1;
  relatorio.lares_apagados += lares;
  somar(relatorio, contagem);
}

async function purgarExMembro(c: pg.Client, membroId: string, relatorio: RelatorioPurga): Promise<void> {
  const contagem: Record<string, number> = {};
  const n = await emPurga(c, () => apagarIndividual(c, contagem, membroId));
  if (n > 0) relatorio.ex_membros_purgados += 1;
  somar(relatorio, contagem);
}

/** Apaga em lotes; devolve o total. Cada lote é uma transação curta. */
async function podar(
  c: pg.Client,
  tabela: string,
  chave: string,
  condicao: string,
  params: unknown[],
): Promise<number> {
  let total = 0;
  for (let i = 0; i < MAX_LOTES_PODA; i += 1) {
    const n = await emPurga(c, async () => {
      const r = await c.query(
        `delete from app.${tabela} where ${chave} in (select ${chave} from app.${tabela} where ${condicao} limit ${LOTE_PODA})`,
        params,
      );
      return r.rowCount ?? 0;
    });
    total += n;
    if (n < LOTE_PODA) break;
  }
  return total;
}

function registrar(opcoes: OpcoesPurga, nivel: 'info' | 'warn', evento: string, campos: Record<string, unknown>): void {
  const linha = JSON.stringify({ nivel, evento, ...campos });
  if (opcoes.log) opcoes.log(linha);
  else if (nivel === 'warn') console.warn(linha);
  else console.info(linha);
}

/** Executa a purga inteira com a conexão de owner dada e devolve o relatório. Nunca lança por falha de uma unidade. */
export async function purgar(c: pg.Client, opcoes: OpcoesPurga): Promise<RelatorioPurga> {
  const relatorio = novoRelatorio();
  const limite = opcoes.limite ?? LIMITE_PADRAO;
  const agora = opcoes.agora.getTime();
  const iso = (ms: number) => new Date(ms).toISOString();
  const falhar = (unidade: FalhaPurga['unidade'], id: string, erro: unknown) => {
    const falha = { unidade, id, motivo: motivoDe(erro) };
    relatorio.falhas.push(falha);
    registrar(opcoes, 'warn', 'purga_falhou', { ...falha });
  };

  // 1. Exclusões vencidas.
  const exclusoes = await emPurga(c, () =>
    c.query<{ id: string }>(
      `select id from app.exclusao_conta
        where confirmada_em is not null and cancelada_em is null and purgada_em is null and purgar_em <= $1
        order by purgar_em, id limit $2`,
      [opcoes.agora.toISOString(), limite],
    ),
  );
  for (const { id } of exclusoes.rows) {
    try {
      await purgarExclusao(c, id, opcoes, relatorio);
    } catch (erro) {
      falhar('exclusao', id, erro);
    }
  }

  // 2. Ex-membros com individual ainda no lar, 30 dias depois da saída.
  const exMembros = await emPurga(c, () =>
    c.query<{ id: string }>(
      `select m.id from app.membro m
        where m.saiu_em is not null and m.saiu_em <= $1
          and (exists (select 1 from app.conta x where x.dono_id = m.id)
            or exists (select 1 from app.forma_pagamento x where x.dono_id = m.id)
            or exists (select 1 from app.movimento_conta x where x.dono_id = m.id)
            or exists (select 1 from app.lancamento_pagamento x where x.dono_id = m.id)
            or exists (select 1 from app.lancamento x where x.dono_id = m.id and x.escopo = 'individual')
            or exists (select 1 from app.orcamento x where x.dono_id = m.id)
            or exists (select 1 from app.meta x where x.dono_id = m.id and x.escopo = 'individual')
            or exists (select 1 from app.categoria x where x.dono_id = m.id)
            or exists (select 1 from app.push_subscription x where x.membro_id = m.id)
            or exists (select 1 from app.preferencia_notificacao x where x.membro_id = m.id)
            or exists (select 1 from app.aviso_push x where x.membro_id = m.id))
        order by m.saiu_em, m.id limit $2`,
      [iso(agora - PRAZO_EX_MEMBRO_MS), limite],
    ),
  );
  for (const { id } of exMembros.rows) {
    try {
      await purgarExMembro(c, id, relatorio);
    } catch (erro) {
      falhar('ex_membro', id, erro);
    }
  }

  // 3. Contas nunca confirmadas (CA-19.8). Não têm lar (não entram); a checagem protege a FK de `lar.criado_por`.
  try {
    const r = await emPurga(c, () =>
      c.query(
        `delete from app.usuario where id in (
           select u.id from app.usuario u
            where u.email_confirmado_em is null and u.criado_em <= $1
              and not exists (select 1 from app.lar l where l.criado_por = u.id)
            order by u.criado_em limit $2)`,
        [iso(agora - PRAZO_NAO_CONFIRMADA_MS), limite],
      ),
    );
    relatorio.contas_nao_confirmadas = r.rowCount ?? 0;
    if (relatorio.contas_nao_confirmadas > 0) {
      relatorio.linhas['usuario'] = (relatorio.linhas['usuario'] ?? 0) + relatorio.contas_nao_confirmadas;
    }
  } catch (erro) {
    falhar('nao_confirmadas', 'usuario', erro);
  }

  // 4. Poda.
  const corte = iso(agora - PODA_MS);
  const podas: Array<[keyof RelatorioPurga & string, string, string, string, unknown[]]> = [
    ['tentativas', 'tentativa_login', 'id', 'momento < $1', [corte]],
    ['tokens', 'token_email', 'id', 'expira_em < $1', [corte]],
    ['sessoes', 'sessao', 'id', `least(expira_absoluta_em, ultimo_uso_em + interval '15 minutes') < $1`, [corte]],
    [
      'webhook_eventos',
      'webhook_evento',
      'event_id',
      `recebido_em < $1::timestamptz - interval '12 months'`,
      [opcoes.agora.toISOString()],
    ],
  ];
  for (const [campo, tabela, chave, condicao, params] of podas) {
    try {
      const n = await podar(c, tabela, chave, condicao, params);
      (relatorio as unknown as Record<string, number>)[campo] = n;
      if (n > 0) relatorio.linhas[tabela] = (relatorio.linhas[tabela] ?? 0) + n;
    } catch (erro) {
      falhar('poda', tabela, erro);
    }
  }

  registrar(opcoes, 'info', 'purga_concluida', {
    exclusoes_purgadas: relatorio.exclusoes_purgadas,
    lares_apagados: relatorio.lares_apagados,
    ex_membros_purgados: relatorio.ex_membros_purgados,
    contas_nao_confirmadas: relatorio.contas_nao_confirmadas,
    sessoes: relatorio.sessoes,
    tokens: relatorio.tokens,
    tentativas: relatorio.tentativas,
    webhook_eventos: relatorio.webhook_eventos,
    linhas: relatorio.linhas,
    falhas: relatorio.falhas.length,
  });
  return relatorio;
}

/**
 * Linha de comando (`pnpm --filter @controle/scripts purgar`). Lê `DATABASE_URL_OWNER` e, se houver,
 * `ASAAS_API_URL` e `ASAAS_API_KEY`; `PURGA_LIMITE` muda o limite por execução. Sai com código 1 se alguma unidade
 * falhou (o workflow fica vermelho; a próxima execução tenta de novo) e 2 sem a URL do banco.
 */
async function principal(): Promise<number> {
  const url = process.env['DATABASE_URL_OWNER'];
  if (!url) {
    console.error(JSON.stringify({ nivel: 'error', evento: 'purga_sem_banco', variavel: 'DATABASE_URL_OWNER' }));
    return 2;
  }
  const urlAsaas = process.env['ASAAS_API_URL'];
  const chaveAsaas = process.env['ASAAS_API_KEY'];
  const asaas = urlAsaas && chaveAsaas ? criarClienteAsaas({ urlBase: urlAsaas, chaveApi: chaveAsaas }) : null;
  const limite = Number(process.env['PURGA_LIMITE'] ?? LIMITE_PADRAO);
  const c = new pg.Client({ connectionString: url });
  await c.connect();
  try {
    const relatorio = await purgar(c, {
      agora: new Date(),
      asaas,
      limite: Number.isInteger(limite) && limite > 0 ? limite : LIMITE_PADRAO,
    });
    return relatorio.falhas.length > 0 ? 1 : 0;
  } finally {
    await c.end();
  }
}

if (import.meta.main) {
  process.exitCode = await principal();
}
