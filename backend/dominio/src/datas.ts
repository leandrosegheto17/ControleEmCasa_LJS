import { recusa, sucesso, type Resultado } from './resultado';

/**
 * Datas de negócio (RT-04, ADR-007): datas de calendário, sem hora, no formato `AAAA-MM-DD`
 * (o mesmo texto do `date` do Postgres e do JSON). "Hoje" é a data civil em America/Sao_Paulo,
 * calculada a partir de um instante recebido por parâmetro: o domínio nunca lê o relógio.
 * A aritmética é feita em inteiros (ano, mês, dia), sem `Date` local, para não depender do fuso
 * do processo.
 */
export type DataCalendario = string;

export const FUSO_NEGOCIO = 'America/Sao_Paulo';

/** Janela de geração e escrita por mês (RN-15, G-24): de hoje − 12 a hoje + 12 meses, inclusive. */
export const JANELA_MESES = 12;

const FORMATO = /^(\d{4})-(\d{2})-(\d{2})$/;

const formatadorSaoPaulo = new Intl.DateTimeFormat('en-US', {
  timeZone: FUSO_NEGOCIO,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

interface Partes {
  readonly ano: number;
  readonly mes: number;
  readonly dia: number;
}

function ehBissexto(ano: number): boolean {
  return (ano % 4 === 0 && ano % 100 !== 0) || ano % 400 === 0;
}

/** Quantidade de dias do mês (1 = janeiro). */
export function ultimoDiaDoMes(ano: number, mes: number): number {
  if (mes === 2) return ehBissexto(ano) ? 29 : 28;
  return mes === 4 || mes === 6 || mes === 9 || mes === 11 ? 30 : 31;
}

function partes(data: DataCalendario): Partes | null {
  const m = FORMATO.exec(data);
  if (!m) return null;
  const ano = Number(m[1]);
  const mes = Number(m[2]);
  const dia = Number(m[3]);
  if (ano < 1 || mes < 1 || mes > 12 || dia < 1 || dia > ultimoDiaDoMes(ano, mes)) return null;
  return { ano, mes, dia };
}

function partesOuErro(data: DataCalendario): Partes {
  const p = partes(data);
  if (!p) throw new RangeError('data de calendário inválida');
  return p;
}

function formatar({ ano, mes, dia }: Partes): DataCalendario {
  return `${String(ano).padStart(4, '0')}-${String(mes).padStart(2, '0')}-${String(dia).padStart(2, '0')}`;
}

/** `true` se o texto é uma data de calendário real no formato `AAAA-MM-DD` (anos 0001 a 9999). */
export function ehDataCalendario(texto: string): boolean {
  return partes(texto) !== null;
}

/**
 * "Hoje" do negócio: a data civil em America/Sao_Paulo do instante informado (RT-04, CA-T4.1).
 * Origem: F hoje.sql:10 (`p_instante at time zone 'America/Sao_Paulo'`). Usa a base de fusos do
 * runtime (Intl), que conhece o horário de verão histórico; nunca um deslocamento fixo de −3 h.
 */
export function hojeEmSaoPaulo(instante: Date): DataCalendario {
  if (Number.isNaN(instante.getTime())) throw new RangeError('instante inválido');
  const p = Object.fromEntries(formatadorSaoPaulo.formatToParts(instante).map((x) => [x.type, x.value]));
  return `${p.year}-${p.month}-${p.day}`;
}

const formatadorHoraSaoPaulo = new Intl.DateTimeFormat('en-US', {
  timeZone: FUSO_NEGOCIO,
  hour: '2-digit',
  hourCycle: 'h23',
});

/**
 * Hora civil (0 a 23) em America/Sao_Paulo do instante (RN-27: os avisos de push saem em horários de São Paulo, como o
 * lembrete às 20h e as fixas às 9h). Usa a base de fusos do runtime, como `hojeEmSaoPaulo`.
 */
export function horaEmSaoPaulo(instante: Date): number {
  if (Number.isNaN(instante.getTime())) throw new RangeError('instante inválido');
  const hora = formatadorHoraSaoPaulo.formatToParts(instante).find((x) => x.type === 'hour')?.value;
  return Number(hora) % 24;
}

/**
 * Instante em que a data começa em São Paulo (a primeira hora cheia cuja data civil em SP é `data`). Procura de hora
 * em hora a partir da meia-noite UTC: cobre UTC−3, o horário de verão histórico (UTC−2) e o dia que começa à 01:00.
 */
export function inicioDoDiaEmSaoPaulo(data: DataCalendario): Date {
  const p = partesOuErro(data);
  const base = Date.UTC(p.ano, p.mes - 1, p.dia);
  for (let hora = 0; hora <= 6; hora += 1) {
    const candidato = new Date(base + hora * 60 * 60 * 1000);
    if (hojeEmSaoPaulo(candidato) === data) return candidato;
  }
  throw new RangeError('início do dia não encontrado');
}

/** Dia 1 do mês da data (CA-T4.2). Origem: F inicio_mes.sql. */
export function inicioMes(data: DataCalendario): DataCalendario {
  const p = partesOuErro(data);
  return formatar({ ano: p.ano, mes: p.mes, dia: 1 });
}

/** Índice absoluto do mês (ano × 12 + mês − 1): base das contas de mês. */
function indiceMes(p: Partes): number {
  return p.ano * 12 + (p.mes - 1);
}

function deIndiceMes(indice: number, dia: number): Partes {
  const ano = Math.floor(indice / 12);
  const mes = indice - ano * 12 + 1;
  return { ano, mes, dia: Math.min(dia, ultimoDiaDoMes(ano, mes)) };
}

/** Quantos meses de calendário vão do mês de `de` ao mês de `ate` (pode ser negativo). */
export function mesesEntre(de: DataCalendario, ate: DataCalendario): number {
  return indiceMes(partesOuErro(ate)) - indiceMes(partesOuErro(de));
}

/** Soma `n` meses; se o dia não existe no mês de destino, vale o último dia do mês. */
export function somarMeses(data: DataCalendario, n: number): DataCalendario {
  const p = partesOuErro(data);
  const r = deIndiceMes(indiceMes(p) + n, p.dia);
  if (r.ano < 1 || r.ano > 9999) throw new RangeError('data fora da faixa');
  return formatar(r);
}

/** Dias desde 1970-01-01 (algoritmo civil proléptico gregoriano, só inteiros). */
function diasDesdeEpoca({ ano, mes, dia }: Partes): number {
  const a = mes <= 2 ? ano - 1 : ano;
  const era = Math.floor(a / 400);
  const anoDaEra = a - era * 400;
  const diaDoAno = Math.floor((153 * (mes + (mes > 2 ? -3 : 9)) + 2) / 5) + dia - 1;
  const diaDaEra = anoDaEra * 365 + Math.floor(anoDaEra / 4) - Math.floor(anoDaEra / 100) + diaDoAno;
  return era * 146097 + diaDaEra - 719468;
}

function deDiasDesdeEpoca(z0: number): Partes {
  const z = z0 + 719468;
  const era = Math.floor(z / 146097);
  const diaDaEra = z - era * 146097;
  const anoDaEra = Math.floor(
    (diaDaEra - Math.floor(diaDaEra / 1460) + Math.floor(diaDaEra / 36524) - Math.floor(diaDaEra / 146096)) / 365,
  );
  const diaDoAno = diaDaEra - (365 * anoDaEra + Math.floor(anoDaEra / 4) - Math.floor(anoDaEra / 100));
  const mp = Math.floor((5 * diaDoAno + 2) / 153);
  const dia = diaDoAno - Math.floor((153 * mp + 2) / 5) + 1;
  const mes = mp < 10 ? mp + 3 : mp - 9;
  return { ano: anoDaEra + era * 400 + (mes <= 2 ? 1 : 0), mes, dia };
}

/** Soma `n` dias de calendário. */
export function somarDias(data: DataCalendario, n: number): DataCalendario {
  const r = deDiasDesdeEpoca(diasDesdeEpoca(partesOuErro(data)) + n);
  if (r.ano < 1 || r.ano > 9999) throw new RangeError('data fora da faixa');
  return formatar(r);
}

/** Compara duas datas de calendário: negativo, zero ou positivo. */
export function compararDatas(a: DataCalendario, b: DataCalendario): number {
  // O formato fixo AAAA-MM-DD ordena como texto.
  partesOuErro(a);
  partesOuErro(b);
  return a < b ? -1 : a > b ? 1 : 0;
}

/**
 * Dia `dia` do mês de `mes` (qualquer data do mês serve); se o dia não existe no mês, vale o
 * último dia (RN-14). Dia nulo, fracionário ou fora de 1–31 → `valor_invalido`.
 * Origem: F dia_no_mes.sql:1-17.
 */
export function diaNoMes(mes: DataCalendario, dia: number): Resultado<DataCalendario, 'valor_invalido'> {
  const p = partes(mes);
  if (!p || !Number.isInteger(dia) || dia < 1 || dia > 31) return recusa('valor_invalido');
  return sucesso(formatar({ ano: p.ano, mes: p.mes, dia: Math.min(dia, ultimoDiaDoMes(p.ano, p.mes)) }));
}

/**
 * O mês terminou: o dia 1 do mês seguinte é hoje ou já passou (CA-T4.3). Enquanto o mês está
 * aberto (corrente ou futuro), os resultados são parciais (RN-16d). Origem: F mes_fechado.sql:10.
 */
export function mesFechado(mes: DataCalendario, hoje: DataCalendario): boolean {
  return compararDatas(somarMeses(inicioMes(mes), 1), hoje) <= 0;
}

/**
 * O mês está na janela de geração e escrita: de hoje − 12 a hoje + 12 meses, inclusive
 * (RN-15, CA-15.2, G-24). Origem: F garantir_ocorrencias.sql:20-24.
 */
export function mesNaJanela(mes: DataCalendario, hoje: DataCalendario): boolean {
  return Math.abs(mesesEntre(hoje, mes)) <= JANELA_MESES;
}
