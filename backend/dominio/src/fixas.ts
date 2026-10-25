import {
  compararDatas,
  diaNoMes,
  ehDataCalendario,
  inicioMes,
  mesNaJanela,
  somarDias,
  type DataCalendario,
} from './datas';
import { recusa, sucesso, type Resultado } from './resultado';

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
