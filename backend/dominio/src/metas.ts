import type { Centavos } from '@controle/contrato';
import { divisaoParaCima, ehCentavos, percentualArredondado, validarValorLancamento } from './centavos';
import { ehDataCalendario, inicioMes, mesesEntre, type DataCalendario } from './datas';
import { recusa, sucesso, type Resultado } from './resultado';
import { LOCAL_META_MAX_CARACTERES, normalizarTextoObrigatorio } from './validacoes';

/**
 * Progresso da meta (RN-08), sempre em inteiros. O guardado (Σ aportes − Σ retiradas) chega já
 * somado do SQL (ADR-003); "por local" também é consulta SQL.
 */

/** O percentual nunca mostra 100 antes de a meta ser atingida. */
export const PERCENTUAL_MAXIMO_NAO_ATINGIDA = 99;

export interface ProgressoMeta {
  readonly guardadoCentavos: Centavos;
  readonly faltaCentavos: Centavos;
  readonly percentual: number;
  /** Nulo sem prazo ou quando não falta nada. */
  readonly mensalNecessarioCentavos: Centavos | null;
  readonly atingida: boolean;
}

/**
 * - falta = max(0, alvo − guardado);
 * - percentual = guardado < alvo ? min(99, round(100 × guardado ÷ alvo)) : 100;
 * - meses = max(1, (ano×12+mês do prazo) − (ano×12+mês de hoje)) — prazo no mês corrente ou vencido
 *   pede a falta inteira;
 * - mensal necessário = há prazo e falta > 0 ? ⌈falta ÷ meses⌉ : nulo;
 * - atingida = guardado ≥ alvo.
 * Origem: F progresso_meta.sql:1-56.
 */
export function progressoMeta(entrada: {
  readonly alvoCentavos: Centavos;
  readonly guardadoCentavos: Centavos;
  /** Qualquer data do mês do prazo (gravado como dia 1), ou nulo. */
  readonly prazo: DataCalendario | null;
  readonly hoje: DataCalendario;
}): ProgressoMeta {
  const { alvoCentavos: alvo, guardadoCentavos: guardado, prazo, hoje } = entrada;
  if (!ehCentavos(alvo) || alvo <= 0 || !ehCentavos(guardado)) throw new RangeError('meta inválida');
  if (!ehDataCalendario(hoje) || (prazo !== null && !ehDataCalendario(prazo))) throw new RangeError('data inválida');

  const falta = Math.max(0, alvo - guardado);
  const atingida = guardado >= alvo;
  const percentual = atingida
    ? 100
    : Math.min(PERCENTUAL_MAXIMO_NAO_ATINGIDA, percentualArredondado(guardado, alvo) ?? 0);
  const meses = prazo === null ? null : Math.max(1, mesesEntre(hoje, prazo));
  const mensal = meses === null || falta === 0 ? null : divisaoParaCima(falta, meses);
  return { guardadoCentavos: guardado, faltaCentavos: falta, percentual, mensalNecessarioCentavos: mensal, atingida };
}

/**
 * Novo `atingida_em` (CA-08.3, CA-08.4): marca com hoje quando a meta passa a estar atingida,
 * mantém a data original se já estava marcada, e desmarca quando deixa de estar. Reavaliado a cada
 * movimento e a cada edição do alvo. Origem: F sincronizar_atingida_meta.sql:1-16.
 */
export function atingidaEm(entrada: {
  readonly atingidaEmAtual: DataCalendario | null;
  readonly atingida: boolean;
  readonly hoje: DataCalendario;
}): DataCalendario | null {
  if (!entrada.atingida) return null;
  return entrada.atingidaEmAtual ?? entrada.hoje;
}

/** Meta já validada (RN-08, RN-18). */
export interface MetaNormalizada {
  readonly nome: string;
  readonly alvoCentavos: Centavos;
  /** Primeiro dia do mês do prazo, ou nulo sem prazo. */
  readonly prazo: DataCalendario | null;
}

/**
 * Valida a meta (RN-08, RN-18): nome obrigatório (aparado, até 120 caracteres), alvo de 1 a 10^11 centavos e prazo
 * opcional, gravado como dia 1 do mês. Fora disso `valor_invalido`.
 * SPEC_DEVIATION: a RN-18 pede só alvo > 0 (o legado não tem teto); aqui o teto é o do lançamento (10^11, G-23),
 * o mesmo da fixa, para a soma dos movimentos nunca estourar o bigint. Origem: A salvar_meta.sql:29-33.
 */
export function normalizarMeta(entrada: {
  readonly nome: string | null;
  readonly alvoCentavos: unknown;
  readonly prazo: DataCalendario | null | undefined;
}): Resultado<MetaNormalizada, 'valor_invalido'> {
  const nome = normalizarTextoObrigatorio(entrada.nome);
  const alvo = validarValorLancamento(entrada.alvoCentavos);
  const prazo = entrada.prazo ?? null;
  if (!nome.ok || !alvo.ok || (prazo !== null && !ehDataCalendario(prazo))) return recusa('valor_invalido');
  return sucesso({
    nome: nome.valor,
    alvoCentavos: alvo.valor,
    prazo: prazo === null ? null : inicioMes(prazo),
  });
}

export type TipoMovimentoMeta = 'aporte' | 'retirada';

/** Movimento de meta já validado (RN-09, RN-18). */
export interface MovimentoMetaNormalizado {
  readonly tipo: TipoMovimentoMeta;
  readonly valorCentavos: Centavos;
  readonly local: string;
}

/**
 * Valida o movimento (RN-09; CA-09.4): tipo aporte ou retirada, valor de 1 a 10^11 centavos e local aparado de 1 a
 * 60 caracteres. Fora disso `valor_invalido`. Origem: A movimentar_meta.sql:23-34; T movimento_meta.sql:10.
 */
export function normalizarMovimentoMeta(entrada: {
  readonly tipo: unknown;
  readonly valorCentavos: unknown;
  readonly local: string | null;
}): Resultado<MovimentoMetaNormalizado, 'valor_invalido'> {
  const local = normalizarTextoObrigatorio(entrada.local, LOCAL_META_MAX_CARACTERES);
  const valor = validarValorLancamento(entrada.valorCentavos);
  if (entrada.tipo !== 'aporte' && entrada.tipo !== 'retirada') return recusa('valor_invalido');
  if (!local.ok || !valor.ok) return recusa('valor_invalido');
  return sucesso({ tipo: entrada.tipo, valorCentavos: valor.valor, local: local.valor });
}

/**
 * A retirada é limitada ao guardado **naquele local** (RN-09; CA-09.1), mesmo que haja saldo em outros locais.
 * Aporte nunca é limitado. Origem: A movimentar_meta.sql:76-86.
 */
export function movimentoCabeNoLocal(entrada: {
  readonly tipo: TipoMovimentoMeta;
  readonly valorCentavos: Centavos;
  readonly guardadoNoLocalCentavos: Centavos;
}): boolean {
  return entrada.tipo === 'aporte' || entrada.valorCentavos <= entrada.guardadoNoLocalCentavos;
}
