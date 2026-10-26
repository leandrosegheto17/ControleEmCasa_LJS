import {
  hojeEmSaoPaulo,
  horaEmSaoPaulo,
  inicioDoDiaEmSaoPaulo,
  inicioMes,
  ocorrenciasAGerar,
  somarDias,
  type DataCalendario,
} from '@controle/dominio';
import type { Kysely, Transaction } from 'kysely';
import { fixasQuePodemGerar, inserirOcorrencias } from '../../infraestrutura/db/repositorios/fixas';
import {
  destinatariosDoLar,
  haOcorrenciaPendenteEm,
  inscricoesDosMembros,
  laresComInscricao,
  lancouEntre,
  marcarAviso,
  registrarResultado,
  type Inscricao,
  type TipoAviso,
} from '../../infraestrutura/db/repositorios/push';
import type { DB } from '../../infraestrutura/db/tipos';
import { emTransacaoDeSistema, enxergarLarNoSistema, enxergarMembroNoSistema } from '../../infraestrutura/db/transacao';
import type { AssinaturaPush, CargaPush, ConfigVapid, OpcoesEnvio, ResultadoPush } from '../../infraestrutura/push';
import { logar } from '../../log';

/**
 * Avisos de push (RN-27; SDD 8.6; CA-27.1 a CA-27.8; TM-PUSH-01, TM-PUSH-05, TM-PUSH-06; ADR-014).
 *
 * Cron `0 * * * *` (`rodarAvisosDoCron`), lar a lar, cada lar na sua transação de sistema com o lar fixado (as tabelas
 * de negócio são lidas pelas políticas normais do lar; nada de leitura ampla):
 * - **fixa vencendo**: ocorrência não paga que vence AMANHÃ; **fixa atrasada**: não paga que venceu ONTEM (o 1º dia em
 *   atraso; 1 vez). A partir das 9h de São Paulo; as horas seguintes do mesmo dia só retomam o que não saiu (lote
 *   interrompido), sem repetir. Um aviso por membro e por tipo no dia, para os dois membros (a fixa é do lar);
 * - **lembrete diário**: só para quem ligou o lembrete, na hora escolhida, e se ele não lançou nada no dia.
 * "Meta atingida" não usa o cron: sai depois do COMMIT do aporte (`avisarMetaAtingida`), só para quem vê a meta.
 *
 * Todo aviso passa por `aviso_push` (CA-27.4: no máximo 1 por usuário, tipo, referência e dia) e pela preferência do
 * membro (CA-27.5). O envio é feito FORA da transação; o resultado volta numa transação curta: `expirada` remove a
 * inscrição, `falha` soma (remove na 5ª). A carga é texto fixo, sem valor, nome nem descrição (CA-27.7; G-36).
 */

/** O envio do módulo isolado (`infraestrutura/push`), injetável nos testes. */
export type EnviadorPush = (
  assinatura: AssinaturaPush,
  carga: CargaPush,
  vapid: ConfigVapid,
  opcoes?: OpcoesEnvio,
) => Promise<ResultadoPush>;

export interface DepsAvisos {
  db: Kysely<DB>;
  agora: Date;
  /** Nulo sem VAPID configurado: nada é enviado (e nada é marcado como avisado). */
  vapid: ConfigVapid | null;
  enviar: EnviadorPush;
  /** Lares por página (lotes do cron). */
  tamanhoLote?: number;
}

/** Hora (São Paulo) a partir da qual saem os avisos de fixa (RN-27: 09:00). */
export const HORA_AVISO_FIXAS = 9;
export const TAMANHO_LOTE_PADRAO = 50;
/** Envios simultâneos ao serviço de push dentro de um lar (no máximo 2 membros: poucos aparelhos). */
const ENVIOS_SIMULTANEOS = 10;

interface Mensagem {
  carga: CargaPush;
  ttlSegundos: number;
  topico: string;
}

/** Textos fixos (CA-27.7; E-15): nada de valor, nome, descrição nem dado do outro membro. */
export const MENSAGENS: Record<TipoAviso, Mensagem> = {
  fixa_vencendo: {
    carga: { titulo: 'Conta fixa vencendo', corpo: 'Uma despesa fixa vence amanhã.', url: '/app/fixas' },
    ttlSegundos: 12 * 60 * 60,
    topico: 'fixa-vencendo',
  },
  fixa_atrasada: {
    carga: { titulo: 'Conta fixa atrasada', corpo: 'Uma despesa fixa venceu e ainda não foi paga.', url: '/app/fixas' },
    ttlSegundos: 12 * 60 * 60,
    topico: 'fixa-atrasada',
  },
  lembrete_diario: {
    carga: { titulo: 'Lembrete do dia', corpo: 'Você ainda não lançou nada hoje.', url: '/app/lancar' },
    ttlSegundos: 3 * 60 * 60,
    topico: 'lembrete-diario',
  },
  meta_atingida: {
    carga: { titulo: 'Meta atingida', corpo: 'Uma meta chegou ao valor planejado.', url: '/app/metas' },
    ttlSegundos: 24 * 60 * 60,
    topico: 'meta-atingida',
  },
};

interface Envio {
  tipo: TipoAviso;
  inscricao: Inscricao;
}

export interface ResumoAvisos {
  lares: number;
  enviados: number;
  expiradas: number;
  falhas: number;
  /** Lares cujo processamento falhou (o lote segue). */
  laresComErro: number;
}

const resumoVazio = (): ResumoAvisos => ({ lares: 0, enviados: 0, expiradas: 0, falhas: 0, laresComErro: 0 });

/**
 * Marca os avisos (idempotência) e devolve os envios: um por aparelho de cada membro com aviso marcado AGORA. Membro
 * sem aparelho não é marcado (se inscrever mais tarde no mesmo dia, ainda recebe).
 */
async function marcarEnvios(
  trx: Transaction<DB>,
  dados: {
    larId: string;
    dia: DataCalendario;
    avisos: Array<{ membroId: string; tipo: TipoAviso; referencia: string }>;
  },
): Promise<Envio[]> {
  const membros = [...new Set(dados.avisos.map((a) => a.membroId))];
  const inscricoes = await inscricoesDosMembros(trx, dados.larId, membros);
  const envios: Envio[] = [];
  for (const a of dados.avisos) {
    const seus = inscricoes.filter((i) => i.membroId === a.membroId);
    if (seus.length === 0) continue;
    const primeira = await marcarAviso(trx, { ...a, larId: dados.larId, dia: dados.dia });
    if (primeira) for (const inscricao of seus) envios.push({ tipo: a.tipo, inscricao });
  }
  return envios;
}

/** Envia fora da transação, alguns por vez, e grava os resultados numa transação curta. Nunca lança por um envio. */
async function enviarERegistrar(deps: DepsAvisos, vapid: ConfigVapid, envios: Envio[], resumo: ResumoAvisos) {
  const resultados: Array<{ id: string; resultado: ResultadoPush }> = [];
  for (let i = 0; i < envios.length; i += ENVIOS_SIMULTANEOS) {
    const lote = envios.slice(i, i + ENVIOS_SIMULTANEOS);
    const r = await Promise.all(
      lote.map(async (e) => {
        const m = MENSAGENS[e.tipo];
        let resultado: ResultadoPush;
        try {
          resultado = await deps.enviar(
            { endpoint: e.inscricao.endpoint, p256dh: e.inscricao.p256dh, auth: e.inscricao.auth },
            m.carga,
            vapid,
            { ttlSegundos: m.ttlSegundos, topico: m.topico, urgencia: 'normal', agora: deps.agora },
          );
        } catch {
          resultado = 'falha';
        }
        return { id: e.inscricao.id, resultado };
      }),
    );
    resultados.push(...r);
  }
  for (const r of resultados) {
    if (r.resultado === 'ok') resumo.enviados += 1;
    else if (r.resultado === 'expirada') resumo.expiradas += 1;
    else resumo.falhas += 1;
  }
  if (resultados.length === 0) return;
  await emTransacaoDeSistema(deps.db, 'cron', async (trx) => {
    for (const r of resultados) await registrarResultado(trx, { ...r, agora: deps.agora });
  });
}

/** Gera (como a API faz ao abrir o mês) as ocorrências do mês da data, para o aviso enxergar a fixa do dia. */
async function garantirOcorrenciasDoMes(
  trx: Transaction<DB>,
  larId: string,
  data: DataCalendario,
  hoje: DataCalendario,
) {
  const mes = inicioMes(data);
  const fixas = await fixasQuePodemGerar(trx, { larId, mes });
  const novas = ocorrenciasAGerar(
    fixas.map((f) => ({
      id: f.id,
      inicio: f.inicio,
      encerradaEm: f.encerrada_em,
      diaVencimento: f.dia_vencimento,
      valorPrevistoCentavos: f.valor_previsto_centavos,
    })),
    mes,
    hoje,
  );
  await inserirOcorrencias(trx, { larId, ocorrencias: novas });
}

async function avisosDoLar(deps: DepsAvisos, vapid: ConfigVapid, larId: string, resumo: ResumoAvisos) {
  const hoje = hojeEmSaoPaulo(deps.agora);
  const hora = horaEmSaoPaulo(deps.agora);
  const envios = await emTransacaoDeSistema(deps.db, 'cron', async (trx) => {
    await enxergarLarNoSistema(trx, larId);
    const destinatarios = await destinatariosDoLar(trx, larId);
    const avisos: Array<{ membroId: string; tipo: TipoAviso; referencia: string }> = [];

    const comFixas = destinatarios.filter((d) => d.preferencias.fixas);
    if (hora >= HORA_AVISO_FIXAS && comFixas.length > 0) {
      const amanha = somarDias(hoje, 1);
      const ontem = somarDias(hoje, -1);
      for (const mes of new Set([inicioMes(amanha), inicioMes(ontem)])) {
        await garantirOcorrenciasDoMes(trx, larId, mes, hoje);
      }
      if (await haOcorrenciaPendenteEm(trx, larId, amanha)) {
        for (const d of comFixas) avisos.push({ membroId: d.membroId, tipo: 'fixa_vencendo', referencia: '' });
      }
      if (await haOcorrenciaPendenteEm(trx, larId, ontem)) {
        for (const d of comFixas) avisos.push({ membroId: d.membroId, tipo: 'fixa_atrasada', referencia: '' });
      }
    }

    const comLembrete = destinatarios.filter(
      (d) => d.preferencias.lembrete_diario && d.preferencias.lembrete_hora === hora,
    );
    for (const d of comLembrete) {
      await enxergarMembroNoSistema(trx, d.membroId);
      const lancou = await lancouEntre(trx, {
        larId,
        membroId: d.membroId,
        desde: inicioDoDiaEmSaoPaulo(hoje),
        ate: inicioDoDiaEmSaoPaulo(somarDias(hoje, 1)),
      });
      if (!lancou) avisos.push({ membroId: d.membroId, tipo: 'lembrete_diario', referencia: '' });
    }

    return marcarEnvios(trx, { larId, dia: hoje, avisos });
  });
  await enviarERegistrar(deps, vapid, envios, resumo);
}

/**
 * Cron de push (SDD 8.6), em páginas de lares com aparelho inscrito. Um lar que falha não derruba os outros: vai ao
 * log só com o nome do erro (G-46) e o lote segue.
 */
export async function rodarAvisosDoCron(deps: DepsAvisos): Promise<ResumoAvisos> {
  const resumo = resumoVazio();
  const vapid = deps.vapid;
  if (!vapid) {
    logar('warn', 'push_sem_configuracao');
    return resumo;
  }
  const limite = deps.tamanhoLote ?? TAMANHO_LOTE_PADRAO;
  let depoisDe: string | null = null;
  for (;;) {
    const cursor: string | null = depoisDe;
    const lares: string[] = await emTransacaoDeSistema(deps.db, 'cron', (trx) =>
      laresComInscricao(trx, { depoisDe: cursor, limite }),
    );
    for (const larId of lares) {
      resumo.lares += 1;
      try {
        await avisosDoLar(deps, vapid, larId, resumo);
      } catch (erro) {
        resumo.laresComErro += 1;
        logar('warn', 'push_lar_falhou', { lar: larId, erro: erro instanceof Error ? erro.name : 'desconhecido' });
      }
    }
    if (lares.length < limite) break;
    depoisDe = lares[lares.length - 1] ?? null;
  }
  logar('info', 'push_cron_concluido', { ...resumo });
  return resumo;
}

/**
 * "Meta atingida" (RN-27; CA-27.3; TM-PUSH-05): depois do COMMIT do aporte que marcou `atingida_em`, para os
 * destinatários calculados na transação do usuário pela regra de visibilidade (conjunta: os membros ativos;
 * individual: só o dono). Aqui só se lê preferência e aparelho desses membros, no lar da meta.
 */
export async function avisarMetaAtingida(
  deps: DepsAvisos,
  dados: { larId: string; metaId: string; destinatarios: string[] },
): Promise<ResumoAvisos> {
  const resumo = resumoVazio();
  const vapid = deps.vapid;
  if (!vapid || dados.destinatarios.length === 0) return resumo;
  const hoje = hojeEmSaoPaulo(deps.agora);
  const envios = await emTransacaoDeSistema(deps.db, 'cron', async (trx) => {
    await enxergarLarNoSistema(trx, dados.larId);
    const ativos = await destinatariosDoLar(trx, dados.larId);
    const avisos = ativos
      .filter((d) => dados.destinatarios.includes(d.membroId) && d.preferencias.metas)
      .map((d) => ({ membroId: d.membroId, tipo: 'meta_atingida' as const, referencia: dados.metaId }));
    return marcarEnvios(trx, { larId: dados.larId, dia: hoje, avisos });
  });
  resumo.lares = 1;
  await enviarERegistrar(deps, vapid, envios, resumo);
  return resumo;
}
