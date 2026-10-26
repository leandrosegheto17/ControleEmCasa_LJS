import { TRIAL_DIAS } from '@controle/contrato';
import {
  compararDatas,
  hojeEmSaoPaulo,
  inicioDoDiaEmSaoPaulo,
  somarDias,
  somarMeses,
  type DataCalendario,
} from './datas';

/**
 * Plano do lar (RN-24, RN-25; SDD 3.4 e 8.5; decisão D4; G-29, G-31). Regras puras: a API lê a assinatura dentro da
 * transação e pede a decisão aqui. O instante entra por parâmetro.
 *
 * O plano EFETIVO (free ou pro) nunca é guardado: sai da situação, das datas e do instante.
 * O webhook do Asaas é só GATILHO (decisão do usuário, etapa 13): a API consulta a cobrança no Asaas e entrega aqui
 * o fato atual (`FatoCobranca`); a transição é idempotente, respeita a ordem dos eventos e nunca faz o estado regredir.
 */

export type SituacaoAssinatura = 'trial' | 'ativa' | 'atrasada' | 'cancelada' | 'free';
export type PlanoEfetivo = 'free' | 'pro';
export type SituacaoCobranca = 'pendente' | 'paga' | 'vencida';

/** Carência do atraso (D4; CA-24.9): o Pro continua até o fim do 3º dia depois do vencimento, em São Paulo. */
export const CARENCIA_ATRASO_DIAS = 3;

const DIA_MS = 24 * 60 * 60 * 1000;

export interface EstadoAssinatura {
  situacao: SituacaoAssinatura;
  trialAte: Date;
  /** Fim do período pago (exclusivo). */
  periodoAte: Date | null;
  cobrancaId: string | null;
  cobrancaVencimento: DataCalendario | null;
  cobrancaValorCentavos: number | null;
  cobrancaSituacao: SituacaoCobranca | null;
  ultimoEventoEm: Date | null;
}

/** O que basta para o plano efetivo (o `exigePlano` lê só isto). */
export type EstadoPlano = Pick<EstadoAssinatura, 'situacao' | 'trialAte' | 'periodoAte' | 'cobrancaVencimento'>;

/**
 * Assinatura de um lar novo (RN-22, CA-24.1, CA-24.10): trial de 14 dias a partir da criação; quem já foi titular
 * com trial ganha o lar em `free`, com `trial_ate` = criação (o trial já começa vencido).
 */
export function assinaturaInicial(
  criadoEm: Date,
  trialJaUsado: boolean,
): { situacao: 'trial' | 'free'; trialAte: Date } {
  if (trialJaUsado) return { situacao: 'free', trialAte: new Date(criadoEm) };
  return { situacao: 'trial', trialAte: new Date(criadoEm.getTime() + TRIAL_DIAS * DIA_MS) };
}

/**
 * Plano efetivo (D4; E-4). Pro quando qualquer uma vale:
 * - o trial concedido ainda não acabou (`agora < trial_ate`), seja qual for a situação: assinar ou cancelar durante o
 *   trial não tira os dias que faltam;
 * - a situação é `ativa`;
 * - há período pago em vigor (`agora < periodo_ate`): é o que mantém a `cancelada` até o fim do período (CA-24.8);
 * - `atrasada` dentro da carência: até o fim do 3º dia depois do vencimento da cobrança (CA-24.9).
 * Sem assinatura: free (falha fechada).
 */
export function planoEfetivo(estado: EstadoPlano | null, agora: Date): PlanoEfetivo {
  if (!estado) return 'free';
  if (agora.getTime() < estado.trialAte.getTime()) return 'pro';
  if (estado.situacao === 'ativa') return 'pro';
  if (estado.periodoAte && agora.getTime() < estado.periodoAte.getTime()) return 'pro';
  if (estado.situacao === 'atrasada' && estado.cobrancaVencimento) {
    const ultimoDia = somarDias(estado.cobrancaVencimento, CARENCIA_ATRASO_DIAS);
    if (compararDatas(hojeEmSaoPaulo(agora), ultimoDia) <= 0) return 'pro';
  }
  return 'free';
}

/**
 * Situação gravada quando o titular assina sem assinatura vigente (trial, free ou cancelada): espera o 1º pagamento
 * em `trial` (se o trial ainda vale) ou em `free`. Sair de `cancelada` aqui distingue a assinatura nova da antiga: um
 * pagamento atrasado da antiga não reativa (ver `aplicarEvento`).
 */
export function situacaoAoAssinar(estado: Pick<EstadoAssinatura, 'trialAte'>, agora: Date): 'trial' | 'free' {
  return agora.getTime() < estado.trialAte.getTime() ? 'trial' : 'free';
}

/** Fim do período pago por uma cobrança: o início (em SP) do dia do vencimento + 1 mês (SDD 8.5). */
export function fimDoPeriodoPago(vencimento: DataCalendario): Date {
  return inicioDoDiaEmSaoPaulo(somarMeses(vencimento, 1));
}

/** A cobrança como o Asaas diz que ela está AGORA (consultada pela API; o evento é só gatilho). */
export interface FatoCobranca {
  id: string;
  vencimento: DataCalendario;
  valorCentavos: number;
  /** `outra`: apagada, estornada ou qualquer situação que não paga nem abre cobrança. */
  situacao: SituacaoCobranca | 'outra';
}

export interface EventoPlano {
  /** Tipo do evento do Asaas (ex.: `PAYMENT_CONFIRMED`). */
  tipo: string;
  ocorridoEm: Date;
  /** Fato consultado da cobrança do evento (eventos `PAYMENT_*`). */
  cobranca?: FatoCobranca;
  /** Depois de um pagamento: a cobrança em aberto mais antiga da assinatura, que passa a ser a atual. */
  proximaAberta?: FatoCobranca;
}

export type EfeitoPlano = 'cobranca_gerada' | 'pagamento_confirmado' | 'atraso';

export type DecisaoEvento =
  | { tipo: 'aplicado'; estado: EstadoAssinatura; efeitos: EfeitoPlano[] }
  | { tipo: 'ignorado'; motivo: 'fora_de_ordem' | 'sem_efeito' | 'valor_divergente' | 'tipo_ignorado' };

const EVENTOS_DE_COBRANCA = new Set([
  'PAYMENT_CREATED',
  'PAYMENT_UPDATED',
  'PAYMENT_CONFIRMED',
  'PAYMENT_RECEIVED',
  'PAYMENT_OVERDUE',
  'PAYMENT_DELETED',
  'PAYMENT_RESTORED',
  'PAYMENT_REFUNDED',
]);
const EVENTOS_DE_FIM = new Set(['SUBSCRIPTION_DELETED', 'SUBSCRIPTION_INACTIVATED']);

function comCobranca(estado: EstadoAssinatura, c: FatoCobranca | null, situacao?: SituacaoCobranca): EstadoAssinatura {
  if (!c) {
    return {
      ...estado,
      cobrancaId: null,
      cobrancaVencimento: null,
      cobrancaValorCentavos: null,
      cobrancaSituacao: null,
    };
  }
  return {
    ...estado,
    cobrancaId: c.id,
    cobrancaVencimento: c.vencimento,
    cobrancaValorCentavos: c.valorCentavos,
    cobrancaSituacao: situacao ?? (c.situacao === 'outra' ? 'pendente' : c.situacao),
  };
}

const aberta = (s: SituacaoCobranca | null) => s === 'pendente' || s === 'vencida';

function aplicado(estado: EstadoAssinatura, ocorridoEm: Date, efeitos: EfeitoPlano[] = []): DecisaoEvento {
  const ultimo = estado.ultimoEventoEm && estado.ultimoEventoEm > ocorridoEm ? estado.ultimoEventoEm : ocorridoEm;
  return { tipo: 'aplicado', estado: { ...estado, ultimoEventoEm: new Date(ultimo) }, efeitos };
}

const SEM_EFEITO: DecisaoEvento = { tipo: 'ignorado', motivo: 'sem_efeito' };

/** Pagamento confirmado (consultado como pago). */
function aplicarPagamento(
  estado: EstadoAssinatura,
  evento: EventoPlano,
  c: FatoCobranca,
  preco: number,
): DecisaoEvento {
  if (c.valorCentavos !== preco) return { tipo: 'ignorado', motivo: 'valor_divergente' };
  if (estado.cobrancaId === c.id && estado.cobrancaSituacao === 'paga') return SEM_EFEITO;
  const fim = fimDoPeriodoPago(c.vencimento);
  const periodoAte = estado.periodoAte && estado.periodoAte > fim ? estado.periodoAte : fim;
  // Cancelada só estende o período: um pagamento atrasado da assinatura removida não a reativa.
  const situacao: SituacaoAssinatura = estado.situacao === 'cancelada' ? 'cancelada' : 'ativa';
  let novo: EstadoAssinatura = { ...estado, situacao, periodoAte };
  const proxima = evento.proximaAberta && evento.proximaAberta.id !== c.id ? evento.proximaAberta : null;
  novo = proxima && situacao !== 'cancelada' ? comCobranca(novo, proxima) : comCobranca(novo, c, 'paga');
  return aplicado(novo, evento.ocorridoEm, ['pagamento_confirmado']);
}

/** Cobrança em aberto (pendente): passa a ser a atual se não houver outra mais antiga em aberto. */
function aplicarAberta(estado: EstadoAssinatura, evento: EventoPlano, c: FatoCobranca): DecisaoEvento {
  const nova = estado.cobrancaId !== c.id;
  const efeitos: EfeitoPlano[] = nova && evento.tipo === 'PAYMENT_CREATED' ? ['cobranca_gerada'] : [];
  if (!nova) {
    if (estado.cobrancaSituacao === 'paga') return SEM_EFEITO;
    const igual =
      estado.cobrancaVencimento === c.vencimento &&
      estado.cobrancaValorCentavos === c.valorCentavos &&
      estado.cobrancaSituacao === c.situacao;
    return igual ? SEM_EFEITO : aplicado(comCobranca(estado, c), evento.ocorridoEm);
  }
  const atualEmAberto = aberta(estado.cobrancaSituacao) && estado.cobrancaVencimento !== null;
  const substitui =
    estado.cobrancaId === null ||
    (atualEmAberto
      ? compararDatas(c.vencimento, estado.cobrancaVencimento as string) < 0
      : compararDatas(c.vencimento, estado.cobrancaVencimento as string) > 0);
  const novo = substitui ? comCobranca(estado, c) : estado;
  if (!substitui && efeitos.length === 0) return SEM_EFEITO;
  return aplicado(novo, evento.ocorridoEm, efeitos);
}

/** Cobrança vencida (consultada como vencida). Só a `ativa` vira `atrasada`; antes do 1º pagamento não há carência. */
function aplicarVencida(estado: EstadoAssinatura, evento: EventoPlano, c: FatoCobranca): DecisaoEvento {
  if (estado.cobrancaId === c.id && estado.cobrancaSituacao === 'paga') return SEM_EFEITO;
  const outraMaisAntigaEmAberto =
    estado.cobrancaId !== null &&
    estado.cobrancaId !== c.id &&
    aberta(estado.cobrancaSituacao) &&
    compararDatas(estado.cobrancaVencimento as string, c.vencimento) < 0;
  if (outraMaisAntigaEmAberto) return SEM_EFEITO;
  if (estado.situacao === 'ativa') {
    return aplicado({ ...comCobranca(estado, c, 'vencida'), situacao: 'atrasada' }, evento.ocorridoEm, ['atraso']);
  }
  if (estado.cobrancaId === c.id && estado.cobrancaSituacao === 'vencida') return SEM_EFEITO;
  return aplicado(comCobranca(estado, c, 'vencida'), evento.ocorridoEm);
}

/**
 * Aplica um evento do webhook à assinatura (SDD 8.5; RN-24; G-29). Ordem das checagens:
 * 1. evento mais antigo que o último aplicado → ignorado (`fora_de_ordem`);
 * 2. `SUBSCRIPTION_DELETED`/`_INACTIVATED` → `cancelada` (o período pago fica; a cobrança em aberto sai);
 * 3. `PAYMENT_*` → decide pelo fato consultado (paga, vencida, pendente ou outra), não pelo nome do evento;
 * 4. qualquer outro tipo → ignorado.
 * Um evento que não muda nada é `sem_efeito` (o mesmo evento repetido também: a idempotência por id fica na API).
 */
export function aplicarEvento(estado: EstadoAssinatura, evento: EventoPlano, precoCentavos: number): DecisaoEvento {
  if (estado.ultimoEventoEm && evento.ocorridoEm.getTime() < estado.ultimoEventoEm.getTime()) {
    return { tipo: 'ignorado', motivo: 'fora_de_ordem' };
  }
  if (EVENTOS_DE_FIM.has(evento.tipo)) {
    if (estado.situacao === 'cancelada') return SEM_EFEITO;
    const base: EstadoAssinatura = { ...estado, situacao: 'cancelada' };
    return aplicado(aberta(estado.cobrancaSituacao) ? comCobranca(base, null) : base, evento.ocorridoEm);
  }
  if (!EVENTOS_DE_COBRANCA.has(evento.tipo)) return { tipo: 'ignorado', motivo: 'tipo_ignorado' };
  const c = evento.cobranca;
  if (!c) return SEM_EFEITO;
  switch (c.situacao) {
    case 'paga':
      return aplicarPagamento(estado, evento, c, precoCentavos);
    case 'vencida':
      return aplicarVencida(estado, evento, c);
    case 'pendente':
      return aplicarAberta(estado, evento, c);
    case 'outra':
      if (estado.cobrancaId === c.id && aberta(estado.cobrancaSituacao)) {
        return aplicado(comCobranca(estado, null), evento.ocorridoEm);
      }
      return SEM_EFEITO;
  }
}
