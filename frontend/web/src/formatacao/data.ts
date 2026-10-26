import { formatarNomeMes } from './mes';

const formatadorSaoPaulo = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'America/Sao_Paulo',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

/** 'YYYY-MM-DD' → 'dd/mm/aaaa', por fatiamento: `new Date('YYYY-MM-DD')` é UTC e pode cair no dia anterior. */
export function formatarData(iso: string): string {
  return `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}`;
}

/** 'YYYY-MM-DD' → 'dd/mm'. */
export function formatarDataCurta(iso: string): string {
  return `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;
}

/** 'YYYY-MM-DD' → "12 de outubro" (dia sem zero à esquerda), para o nome acessível. */
export function formatarDataPorExtenso(iso: string): string {
  return `${Number(iso.slice(8, 10))} de ${formatarNomeMes(iso)}`;
}

const DIAS_SEMANA = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];

/** 'YYYY-MM-DD' → "Sábado, 10 de outubro". O dia da semana usa UTC para não depender do fuso da máquina. */
export function formatarDiaSemana(iso: string): string {
  const dia = new Date(Date.UTC(Number(iso.slice(0, 4)), Number(iso.slice(5, 7)) - 1, Number(iso.slice(8, 10))));
  return `${DIAS_SEMANA[dia.getUTCDay()]}, ${formatarDataPorExtenso(iso)}`;
}

/** Data de hoje em America/Sao_Paulo como 'YYYY-MM-DD', independente do fuso da máquina. */
export function hojeEmSaoPaulo(agora: Date = new Date()): string {
  const partes = Object.fromEntries(formatadorSaoPaulo.formatToParts(agora).map((p) => [p.type, p.value]));
  return `${partes.year}-${partes.month}-${partes.day}`;
}

const PRIMEIRA_DATA_DE_PAGAMENTO = '2000-01-01';
const DIAS_A_FRENTE_DO_PAGAMENTO = 30;

/** Período que o servidor aceita para a data de um pagamento: de 2000-01-01 até hoje + 30 dias (São Paulo). */
export function periodoDePagamento(agora: Date = new Date()): { min: string; max: string } {
  const hoje = hojeEmSaoPaulo(agora);
  const limite = new Date(Date.UTC(Number(hoje.slice(0, 4)), Number(hoje.slice(5, 7)) - 1, Number(hoje.slice(8, 10))));
  limite.setUTCDate(limite.getUTCDate() + DIAS_A_FRENTE_DO_PAGAMENTO);
  return { min: PRIMEIRA_DATA_DE_PAGAMENTO, max: limite.toISOString().slice(0, 10) };
}

const formatadorHora = new Intl.DateTimeFormat('pt-BR', {
  timeZone: 'America/Sao_Paulo',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
});

/** Instante (epoch ms) → 'HH:mm' em America/Sao_Paulo. */
export function formatarHora(epochMs: number): string {
  return formatadorHora.format(epochMs);
}
