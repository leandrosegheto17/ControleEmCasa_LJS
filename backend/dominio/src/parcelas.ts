import type { Centavos } from '@controle/contrato';
import { ehCentavos, validarValorLancamento } from './centavos';
import { diaNoMes, ehDataCalendario, inicioMes, somarMeses, type DataCalendario } from './datas';
import { recusa, sucesso, type Resultado } from './resultado';

/**
 * Parcelas e competência (RN-14, ADR-008). A competência de uma parcela é o mês da sua data.
 * Única fonte de data e valor das parcelas, usada ao lançar e ao editar (as duas nunca divergem).
 */

export type TipoForma = 'pix' | 'debito' | 'credito';

export const MAX_PARCELAS = 24;

export interface Parcela {
  readonly numero: number;
  readonly valorCentavos: Centavos;
  readonly data: DataCalendario;
}

type Invalido = Resultado<never, 'valor_invalido'>;
const INVALIDO: Invalido = recusa('valor_invalido');

/**
 * Parcelas de uma compra no Crédito (RN-14):
 * - parcela k (1…N) no dia de vencimento do mês (mês da compra + k); dia inexistente → último dia;
 * - sem data de fechamento: a 1ª parcela é sempre no mês seguinte, mesmo comprando no dia do
 *   vencimento ou depois dele;
 * - base = ⌊total ÷ N⌋; parcelas 2…N = base; parcela 1 = total − base × (N − 1) (o resto na 1ª);
 * - N de 1 a 24 e total ≥ N (nenhuma parcela zero); dia de vencimento 1–31 (CA-14.4).
 * Origem: F gerar_parcelas.sql:1-31 e F dia_no_mes.sql:1-17.
 */
export function gerarParcelas(entrada: {
  readonly dataCompra: DataCalendario;
  readonly diaVencimento: number | null;
  readonly numParcelas: number;
  readonly totalCentavos: Centavos;
}): Resultado<Parcela[], 'valor_invalido'> {
  const { dataCompra, diaVencimento, numParcelas: n, totalCentavos: total } = entrada;
  if (typeof dataCompra !== 'string' || !ehDataCalendario(dataCompra)) return INVALIDO;
  if (!Number.isInteger(n) || n < 1 || n > MAX_PARCELAS) return INVALIDO;
  if (!ehCentavos(total) || total < n) return INVALIDO;
  if (diaVencimento === null) return INVALIDO;

  const base = Math.floor(total / n);
  const mesCompra = inicioMes(dataCompra);
  const parcelas: Parcela[] = [];
  for (let k = 1; k <= n; k++) {
    let mes: DataCalendario;
    try {
      mes = somarMeses(mesCompra, k);
    } catch {
      // SPEC_DEVIATION: o legado aceitaria uma parcela depois de 9999-12-31; aqui a data fica no formato AAAA-MM-DD.
      return INVALIDO;
    }
    const data = diaNoMes(mes, diaVencimento);
    if (!data.ok) return INVALIDO;
    parcelas.push({ numero: k, valorCentavos: k === 1 ? total - base * (n - 1) : base, data: data.valor });
  }
  return sucesso(parcelas);
}

/**
 * Parcelas pela forma de pagamento (RN-14): Pix e Débito são 1 parcela do total na data da
 * operação; Crédito segue `gerarParcelas`; receita é 1 parcela na data. Nº de parcelas fora da regra
 * da forma → `valor_invalido`. Origem: F calcular_parcelas.sql:1-31.
 */
export function calcularParcelas(entrada: {
  readonly tipo: TipoForma | 'receita';
  readonly data: DataCalendario;
  readonly diaVencimento: number | null;
  readonly numParcelas: number;
  readonly totalCentavos: Centavos;
}): Resultado<Parcela[], 'valor_invalido'> {
  const { tipo, data, diaVencimento, numParcelas, totalCentavos } = entrada;
  if (tipo === 'credito') return gerarParcelas({ dataCompra: data, diaVencimento, numParcelas, totalCentavos });
  if (typeof data !== 'string' || !ehDataCalendario(data)) return INVALIDO;
  if (numParcelas !== 1 || !ehCentavos(totalCentavos) || totalCentavos <= 0) return INVALIDO;
  return sucesso([{ numero: 1, valorCentavos: totalCentavos, data }]);
}

/** Forma de pagamento como o domínio a vê: tipo e dia de vencimento (só Crédito tem dia). */
export interface FormaParaParcelas {
  readonly tipo: TipoForma;
  readonly diaVencimento: number | null;
}

/**
 * Dia gravado em `dia_vencimento_aplicado` ao lançar: o dia atual do cartão no Crédito; nulo no
 * Pix/Débito. Esse dia fica **congelado** no lançamento (I-19, CA-03.3).
 * Origem: A lancar_despesa.sql:64-87.
 */
export function diaVencimentoAplicado(forma: FormaParaParcelas): number | null {
  return forma.tipo === 'credito' ? forma.diaVencimento : null;
}

/**
 * Dia usado no recálculo de uma edição (dia congelado, RN-06, CA-06.6): o `dia_vencimento_aplicado`
 * gravado, não o dia atual do cartão, a menos que a forma tenha mudado; aí vale o dia da forma nova
 * (nulo se ela não é Crédito). Origem: A editar_lancamento.sql:125-145.
 */
export function diaParaRecalculo(entrada: {
  readonly diaAplicadoGravado: number | null;
  /** A forma nova, só quando a edição troca a forma; `null` quando a forma não muda. */
  readonly formaNova: FormaParaParcelas | null;
}): number | null {
  return entrada.formaNova === null ? entrada.diaAplicadoGravado : diaVencimentoAplicado(entrada.formaNova);
}

/**
 * Data de cartão do pagamento de uma fixa no Crédito (RN-13, I-20, CA-13.3): o próximo vencimento
 * depois da data da operação, pela regra da compra à vista (`gerarParcelas` com N = 1), com o dia
 * congelado. A parcela da casa continua no vencimento da ocorrência.
 * Origem: F gasto_cartao.sql:26-33.
 */
export function dataDeCartao(
  dataOperacao: DataCalendario,
  diaAplicado: number | null,
): Resultado<DataCalendario, 'valor_invalido'> {
  const r = gerarParcelas({ dataCompra: dataOperacao, diaVencimento: diaAplicado, numParcelas: 1, totalCentavos: 1 });
  return r.ok ? sucesso(r.valor[0]!.data) : INVALIDO;
}

/**
 * Parcela do lançamento de pagamento de uma fixa (I-20, RN-28 — correção P7): sempre 1 parcela,
 * na data de vencimento da ocorrência, qualquer que seja a forma (Pix, Débito ou Crédito) e a data
 * da operação. Nº de parcelas ≠ 1 → `valor_invalido` (CA-28.4).
 * Origem: A pagar_ocorrencia.sql:1-97; correção do defeito de A editar_lancamento.sql:147-194.
 */
export function parcelasDoPagamentoDeFixa(entrada: {
  readonly vencimento: DataCalendario;
  readonly valorCentavos: Centavos;
  readonly numParcelas: number;
}): Resultado<Parcela[], 'valor_invalido'> {
  if (entrada.numParcelas !== 1 || !ehDataCalendario(entrada.vencimento)) return INVALIDO;
  if (!validarValorLancamento(entrada.valorCentavos).ok) return INVALIDO;
  return sucesso([{ numero: 1, valorCentavos: entrada.valorCentavos, data: entrada.vencimento }]);
}

/**
 * Valor novo de um lançamento mantendo número e data de cada parcela (decisão do usuário de 2026-10-25, RN-06
 * revisada): é a edição de valor pelo outro membro, que não lê a parte privada do pagador (data da operação, dia
 * de vencimento aplicado; G-10). Vale a regra de valores da RN-14 (base = ⌊total ÷ N⌋, resto na 1ª) e o total de
 * 1 a 10^11 com total ≥ N. As datas, inclusive as ajustadas à mão, ficam onde estão.
 */
export function redistribuirValor(
  atuais: readonly { readonly numero: number; readonly data: DataCalendario }[],
  totalCentavos: Centavos,
): Resultado<Parcela[], 'valor_invalido'> {
  const n = atuais.length;
  if (n < 1 || n > MAX_PARCELAS) return INVALIDO;
  if (!validarValorLancamento(totalCentavos).ok || totalCentavos < n) return INVALIDO;
  const base = Math.floor(totalCentavos / n);
  const ordenadas = [...atuais].sort((a, b) => a.numero - b.numero);
  return sucesso(
    ordenadas.map((x, i) => ({
      numero: x.numero,
      valorCentavos: i === 0 ? totalCentavos - base * (n - 1) : base,
      data: x.data,
    })),
  );
}
