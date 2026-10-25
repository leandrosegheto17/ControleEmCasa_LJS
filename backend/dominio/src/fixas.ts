import {
  compararDatas,
  diaNoMes,
  ehDataCalendario,
  inicioMes,
  mesNaJanela,
  somarDias,
  type DataCalendario,
} from './datas';
import type { Centavos } from '@controle/contrato';
import { validarValorLancamento } from './centavos';
import { recusa, sucesso, type Resultado } from './resultado';
import { normalizarTextoObrigatorio, validarDiaVencimento } from './validacoes';

/**
 * Despesas fixas conjuntas (RN-15): em que meses uma fixa gera ocorrência, o vencimento de cada
 * ocorrência e a situação. A inserção em lote (`INSERT … SELECT … ON CONFLICT DO NOTHING`) é da API.
 */

export type SituacaoOcorrencia = 'paga' | 'atrasada' | 'pendente';

/** Primeira data aceita no pagamento de uma ocorrência (CA-15.6). */
export const DATA_MINIMA_PAGAMENTO = '2000-01-01';
/** Dias depois de hoje aceitos na data do pagamento (CA-15.6). */
export const DIAS_FUTUROS_PAGAMENTO = 30;

/**
 * A fixa gera ocorrência no mês: do mês do início até o mês do encerramento, inclusive
 * (encerrada em outubro ainda gera outubro e para em novembro; CA-15.4).
 * Origem: F fixa_gera_no_mes.sql:1-11.
 */
export function fixaGeraNoMes(entrada: {
  readonly inicio: DataCalendario;
  readonly encerradaEm: DataCalendario | null;
  readonly mes: DataCalendario;
}): boolean {
  const mes = inicioMes(entrada.mes);
  // SPEC_DEVIATION: o legado compara com o `inicio` cru; aqui ele é normalizado para o dia 1 (o modelo grava sempre o dia 1).
  if (compararDatas(mes, inicioMes(entrada.inicio)) < 0) return false;
  return entrada.encerradaEm === null || compararDatas(mes, inicioMes(entrada.encerradaEm)) <= 0;
}

/**
 * A consulta de um mês deve gravar a ocorrência da fixa: o mês está na janela de ±12 meses de hoje
 * (fora dela a leitura vem vazia e nada é gravado; CA-15.2) e a fixa gera naquele mês.
 * Origem: F garantir_ocorrencias.sql:1-30.
 */
export function deveGerarOcorrencia(entrada: {
  readonly inicio: DataCalendario;
  readonly encerradaEm: DataCalendario | null;
  readonly mes: DataCalendario;
  readonly hoje: DataCalendario;
}): boolean {
  return mesNaJanela(entrada.mes, entrada.hoje) && fixaGeraNoMes(entrada);
}

/**
 * Vencimento da ocorrência: o dia do modelo naquele mês, ou o último dia se não existir (CA-15.3).
 * Origem: F garantir_ocorrencias.sql:26.
 */
export function vencimentoDaOcorrencia(
  mes: DataCalendario,
  diaVencimento: number,
): Resultado<DataCalendario, 'valor_invalido'> {
  return diaNoMes(mes, diaVencimento);
}

/**
 * Ao encerrar, a ocorrência é apagada se está pendente num mês em que a fixa deixa de gerar
 * (depois do mês do encerramento). A do mês do encerramento fica; pagas nunca são apagadas (CA-15.4).
 * Origem: A encerrar_despesa_fixa.sql:1-36.
 */
export function apagaAoEncerrar(entrada: {
  readonly mesOcorrencia: DataCalendario;
  readonly encerradaEm: DataCalendario;
  readonly paga: boolean;
}): boolean {
  return !entrada.paga && compararDatas(inicioMes(entrada.mesOcorrencia), inicioMes(entrada.encerradaEm)) > 0;
}

/**
 * Situação: `paga` (há lançamento ligado); `atrasada` (vencimento antes de hoje); senão `pendente`
 * (vencimento hoje é pendente). Origem: F ocorrencias_do_mes.sql:31-35.
 */
export function situacaoOcorrencia(entrada: {
  readonly paga: boolean;
  readonly vencimento: DataCalendario;
  readonly hoje: DataCalendario;
}): SituacaoOcorrencia {
  if (entrada.paga) return 'paga';
  return compararDatas(entrada.vencimento, entrada.hoje) < 0 ? 'atrasada' : 'pendente';
}

const ORDEM_SITUACAO: Record<SituacaoOcorrencia, number> = { atrasada: 1, pendente: 2, paga: 3 };
const colacao = new Intl.Collator('pt-BR');

/**
 * Ordem da lista de ocorrências: atrasadas, pendentes por vencimento crescente, pagas por vencimento
 * decrescente; empate por descrição e id. Origem: F ocorrencias_do_mes.sql:41-46.
 */
export function compararOcorrencias(
  a: {
    readonly situacao: SituacaoOcorrencia;
    readonly vencimento: DataCalendario;
    readonly descricao: string;
    readonly id: string;
  },
  b: {
    readonly situacao: SituacaoOcorrencia;
    readonly vencimento: DataCalendario;
    readonly descricao: string;
    readonly id: string;
  },
): number {
  const porSituacao = ORDEM_SITUACAO[a.situacao] - ORDEM_SITUACAO[b.situacao];
  if (porSituacao !== 0) return porSituacao;
  const porVencimento = compararDatas(a.vencimento, b.vencimento);
  if (porVencimento !== 0) return a.situacao === 'paga' ? -porVencimento : porVencimento;
  return colacao.compare(a.descricao, b.descricao) || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
}

/**
 * Data da operação do pagamento de uma ocorrência (e da edição desse pagamento, RN-28): de
 * 01/01/2000 até hoje + 30 dias, inclusive; fora disso `valor_invalido` (CA-15.6).
 * Origem: A pagar_ocorrencia.sql:66-68.
 */
export function validarDataPagamentoFixa(
  data: DataCalendario,
  hoje: DataCalendario,
): Resultado<DataCalendario, 'valor_invalido'> {
  if (typeof data !== 'string' || !ehDataCalendario(data)) return recusa('valor_invalido');
  if (compararDatas(data, DATA_MINIMA_PAGAMENTO) < 0) return recusa('valor_invalido');
  if (compararDatas(data, somarDias(hoje, DIAS_FUTUROS_PAGAMENTO)) > 0) return recusa('valor_invalido');
  return sucesso(data);
}

/** Modelo da fixa já validado (RN-15, RN-18). */
export interface ModeloFixa {
  readonly descricao: string;
  readonly valorPrevistoCentavos: Centavos;
  readonly diaVencimento: number;
}

/**
 * Valida o modelo da fixa (RN-15, RN-18): descrição obrigatória (aparada, até 120 caracteres), previsto de 1 a
 * 10^11 centavos e dia de 1 a 31; fora disso `valor_invalido`.
 * SPEC_DEVIATION: a RN-18 pede só previsto > 0 (o legado não tem teto). Aqui o teto é o do lançamento (10^11,
 * G-23), porque pagar pelo valor padrão cria um lançamento com o previsto: acima do teto a fixa nunca seria paga.
 * Origem: A salvar_despesa_fixa.sql:27-32.
 */
export function normalizarFixa(entrada: {
  readonly descricao: string | null;
  readonly valorPrevistoCentavos: unknown;
  readonly diaVencimento: unknown;
}): Resultado<ModeloFixa, 'valor_invalido'> {
  const descricao = normalizarTextoObrigatorio(entrada.descricao);
  const valor = validarValorLancamento(entrada.valorPrevistoCentavos);
  const dia = validarDiaVencimento(entrada.diaVencimento);
  if (!descricao.ok || !valor.ok || !dia.ok) return recusa('valor_invalido');
  return sucesso({ descricao: descricao.valor, valorPrevistoCentavos: valor.valor, diaVencimento: dia.valor });
}

/** Fixa encerrada não é editada: `valor_invalido` (RN-15). Origem: A salvar_despesa_fixa.sql:46-49. */
export function fixaPodeSerEditada(encerradaEm: DataCalendario | null): Resultado<void, 'valor_invalido'> {
  return encerradaEm === null ? sucesso(undefined) : recusa('valor_invalido');
}

/** O que a API sabe de cada fixa do lar para gerar as ocorrências do mês. */
export interface FixaParaGerar {
  readonly id: string;
  readonly inicio: DataCalendario;
  readonly encerradaEm: DataCalendario | null;
  readonly diaVencimento: number;
  readonly valorPrevistoCentavos: Centavos;
}

export interface OcorrenciaAGerar {
  readonly fixaId: string;
  readonly mes: DataCalendario;
  readonly vencimento: DataCalendario;
  readonly valorPrevistoCentavos: Centavos;
}

/**
 * Ocorrências que a consulta de um mês deve garantir (RN-15; CA-15.1 a CA-15.4): 1 por fixa que gera no mês, só
 * dentro da janela de ±12 meses de hoje, com o vencimento do modelo naquele mês (último dia se não existir) e o
 * previsto do modelo. A API grava em lote com `ON CONFLICT DO NOTHING` (idempotente sob concorrência) e nunca
 * corrige ocorrência já gerada. Origem: F garantir_ocorrencias.sql:1-30.
 */
export function ocorrenciasAGerar(
  fixas: readonly FixaParaGerar[],
  mes: DataCalendario,
  hoje: DataCalendario,
): OcorrenciaAGerar[] {
  const inicio = inicioMes(mes);
  const resultado: OcorrenciaAGerar[] = [];
  for (const f of fixas) {
    if (!deveGerarOcorrencia({ inicio: f.inicio, encerradaEm: f.encerradaEm, mes: inicio, hoje })) continue;
    const vencimento = vencimentoDaOcorrencia(inicio, f.diaVencimento);
    if (!vencimento.ok) continue;
    resultado.push({
      fixaId: f.id,
      mes: inicio,
      vencimento: vencimento.valor,
      valorPrevistoCentavos: f.valorPrevistoCentavos,
    });
  }
  return resultado;
}
