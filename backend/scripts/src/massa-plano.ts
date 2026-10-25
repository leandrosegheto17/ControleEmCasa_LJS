/**
 * Plano da massa sintética de 2 anos (PLANO etapa 9; RNF-03, RNF-04; SDD 10 "Medição"): um lar com 2 membros e
 * cerca de 6 mil parcelas em 24 meses, para medir a CPU do Worker com volume real (risco R1). Função pura e
 * determinística (semente fixa): o mesmo plano em toda execução. Quem grava é `massa-dois-anos.ts`.
 * As regras de parcela seguem a RN-14 (Pix/Débito: 1 parcela na data; Crédito: dia do cartão a partir do mês
 * seguinte, último dia se não existir, resto na 1ª) e o pagamento de fixa a RN-28 (1 parcela no vencimento).
 */

export type Quem = 'ana' | 'bruno';
export type TipoForma = 'pix' | 'debito' | 'credito';

export interface ParcelaPlano {
  numero: number;
  valor: number;
  data: string;
}

export interface LancamentoPlano {
  quem: Quem;
  tipo: 'despesa' | 'receita';
  /** Nome da categoria inicial (RN-17). */
  categoria: string;
  escopo: 'conjunto' | 'individual';
  /** Forma do membro (índice em FORMAS); nulo na receita. */
  forma: number | null;
  dataOperacao: string;
  valorTotal: number;
  parcelas: ParcelaPlano[];
  /** Índice da fixa paga por este lançamento, se for pagamento de fixa. */
  fixa: number | null;
}

export interface FixaPlano {
  descricao: string;
  categoria: string;
  previsto: number;
  dia: number;
}

/** Formas de cada membro: índice → tipo e dia (o Pix e o Débito usam a conta 0). */
export const FORMAS: readonly { nome: string; tipo: TipoForma; dia: number | null }[] = [
  { nome: 'Pix', tipo: 'pix', dia: null },
  { nome: 'Débito', tipo: 'debito', dia: null },
  { nome: 'Cartão 10', tipo: 'credito', dia: 10 },
  { nome: 'Cartão 25', tipo: 'credito', dia: 25 },
];

export const FIXAS: readonly FixaPlano[] = [
  { descricao: 'Aluguel', categoria: 'Moradia', previsto: 250_000, dia: 10 },
  { descricao: 'Condomínio', categoria: 'Moradia', previsto: 80_000, dia: 5 },
  { descricao: 'Luz', categoria: 'Contas da casa', previsto: 22_000, dia: 15 },
  { descricao: 'Água', categoria: 'Contas da casa', previsto: 9_000, dia: 20 },
  { descricao: 'Internet', categoria: 'Contas da casa', previsto: 12_000, dia: 25 },
  { descricao: 'Gás', categoria: 'Contas da casa', previsto: 6_000, dia: 28 },
  { descricao: 'Streaming', categoria: 'Outros da casa', previsto: 5_500, dia: 31 },
  { descricao: 'Faxina', categoria: 'Outros da casa', previsto: 40_000, dia: 1 },
];

const CONJUNTAS = ['Mercado', 'Delivery/iFood do casal', 'Almoço/Alimentação fora', 'Outros da casa'];
const INDIVIDUAIS = ['Delivery pessoal', 'Transporte', 'Lazer pessoal', 'Outros'];

/** Gerador congruencial simples, com semente: a massa é reprodutível. */
function aleatorio(semente: number): () => number {
  let s = semente >>> 0;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 0x1_0000_0000;
  };
}

function ultimoDia(ano: number, mes: number): number {
  return new Date(Date.UTC(ano, mes, 0)).getUTCDate();
}

function data(ano: number, mes: number, dia: number): string {
  // mes de 1 a 12, com transbordo para o ano seguinte/anterior
  const a = ano + Math.floor((mes - 1) / 12);
  const m = ((((mes - 1) % 12) + 12) % 12) + 1;
  const d = Math.min(dia, ultimoDia(a, m));
  return `${a}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

/** Parcelas pela RN-14 (as mesmas regras de `calcularParcelas` do domínio). */
export function parcelasDaCompra(
  tipo: TipoForma,
  dataCompra: string,
  dia: number | null,
  n: number,
  total: number,
): ParcelaPlano[] {
  if (tipo !== 'credito') return [{ numero: 1, valor: total, data: dataCompra }];
  const [ano, mes] = dataCompra.split('-').map(Number) as [number, number];
  const base = Math.floor(total / n);
  return Array.from({ length: n }, (_, i) => ({
    numero: i + 1,
    valor: i === 0 ? total - base * (n - 1) : base,
    data: data(ano, mes + i + 1, dia ?? 1),
  }));
}

/**
 * Lançamentos dos 24 meses que terminam no mês de `hoje` (inclusive), sem datas futuras além das parcelas do
 * Crédito. Por mês e membro: ~85 despesas de Pix/Débito (conjuntas e individuais), 10 compras de 3x no Crédito e
 * 2 receitas; mais o pagamento das 8 fixas (alternando o pagador) nos meses da janela de 12 meses, exceto as
 * ainda não vencidas do mês corrente.
 */
export function planejarMassa(hoje: string, semente = 20261026): LancamentoPlano[] {
  const r = aleatorio(semente);
  const [anoHoje, mesHoje, diaHoje] = hoje.split('-').map(Number) as [number, number, number];
  const escolher = <T>(xs: readonly T[]): T => xs[Math.floor(r() * xs.length)]!;
  const lancs: LancamentoPlano[] = [];
  for (let k = 23; k >= 0; k--) {
    const mes = mesHoje - k;
    const dias =
      k === 0 ? diaHoje : ultimoDia(anoHoje + Math.floor((mes - 1) / 12), ((((mes - 1) % 12) + 12) % 12) + 1);
    for (const quem of ['ana', 'bruno'] as const) {
      for (let i = 0; i < 85; i++) {
        const conjunta = r() < 0.5;
        const forma = r() < 0.7 ? 0 : 1;
        const d = data(anoHoje, mes, 1 + Math.floor(r() * dias));
        const valor = 500 + Math.floor(r() * 30_000);
        lancs.push({
          quem,
          tipo: 'despesa',
          categoria: conjunta ? escolher(CONJUNTAS) : escolher(INDIVIDUAIS),
          escopo: conjunta ? 'conjunto' : 'individual',
          forma,
          dataOperacao: d,
          valorTotal: valor,
          parcelas: parcelasDaCompra(FORMAS[forma]!.tipo, d, null, 1, valor),
          fixa: null,
        });
      }
      for (let i = 0; i < 10; i++) {
        const forma = r() < 0.5 ? 2 : 3;
        const conjunta = r() < 0.5;
        const d = data(anoHoje, mes, 1 + Math.floor(r() * dias));
        const valor = 3_000 + Math.floor(r() * 120_000);
        lancs.push({
          quem,
          tipo: 'despesa',
          categoria: conjunta ? escolher(CONJUNTAS) : escolher(INDIVIDUAIS),
          escopo: conjunta ? 'conjunto' : 'individual',
          forma,
          dataOperacao: d,
          valorTotal: valor,
          parcelas: parcelasDaCompra('credito', d, FORMAS[forma]!.dia, 3, valor),
          fixa: null,
        });
      }
      for (const [categoria, valor, dia] of [
        ['Salário', 800_000, 5],
        ['Extra', 50_000 + Math.floor(r() * 100_000), 20],
      ] as const) {
        const d = data(anoHoje, mes, Math.min(dia, dias));
        lancs.push({
          quem,
          tipo: 'receita',
          categoria,
          escopo: 'individual',
          forma: null,
          dataOperacao: d,
          valorTotal: valor,
          parcelas: [{ numero: 1, valor, data: d }],
          fixa: null,
        });
      }
    }
    if (k <= 12) {
      FIXAS.forEach((f, i) => {
        const vencimento = data(anoHoje, mes, f.dia);
        if (vencimento > hoje) return;
        const quem: Quem = (i + k) % 2 === 0 ? 'ana' : 'bruno';
        const forma = i % 3 === 0 ? 2 : 0;
        lancs.push({
          quem,
          tipo: 'despesa',
          categoria: f.categoria,
          escopo: 'conjunto',
          forma,
          dataOperacao: vencimento,
          valorTotal: f.previsto,
          parcelas: [{ numero: 1, valor: f.previsto, data: vencimento }],
          fixa: i,
        });
      });
    }
  }
  return lancs;
}
