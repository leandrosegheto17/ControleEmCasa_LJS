const NOMES_MES = [
  'janeiro',
  'fevereiro',
  'março',
  'abril',
  'maio',
  'junho',
  'julho',
  'agosto',
  'setembro',
  'outubro',
  'novembro',
  'dezembro',
];

const MES_URL = /^\d{4}-(0[1-9]|1[0-2])$/;

function partesDoMes(mes: string): { ano: string; nome: string } {
  const nome = NOMES_MES[Number(mes.slice(5, 7)) - 1];
  if (nome === undefined) throw new RangeError(`Mês inválido: ${mes}`);
  return { ano: mes.slice(0, 4), nome };
}

/** 'AAAA-MM' (ou 'AAAA-MM-01') → "Outubro de 2026"; com `minuscula`, "outubro de 2026". */
export function formatarMes(mes: string, opcoes: { minuscula?: boolean } = {}): string {
  const { ano, nome } = partesDoMes(mes);
  const inicial = opcoes.minuscula ? nome : nome.charAt(0).toUpperCase() + nome.slice(1);
  return `${inicial} de ${ano}`;
}

/** 'AAAA-MM' (ou 'AAAA-MM-01') → "jul/2027". */
export function formatarMesCurto(mes: string): string {
  const { ano, nome } = partesDoMes(mes);
  return `${nome.slice(0, 3)}/${ano}`;
}

/** Lê `?mes=AAAA-MM`; qualquer outro formato é `null` (quem chama decide o padrão). */
export function lerMesDaUrl(params: URLSearchParams): string | null {
  const mes = params.get('mes');
  return mes !== null && MES_URL.test(mes) ? mes : null;
}

/** Cópia dos parâmetros com `mes` trocado, preservando os demais. */
export function escreverMesNaUrl(params: URLSearchParams, mes: string): URLSearchParams {
  const copia = new URLSearchParams(params);
  copia.set('mes', mes);
  return copia;
}

function deslocarMes(mes: string, delta: number): string {
  const indice = Number(mes.slice(0, 4)) * 12 + (Number(mes.slice(5, 7)) - 1) + delta;
  const ano = Math.floor(indice / 12);
  const numero = (indice % 12) + 1;
  return `${String(ano).padStart(4, '0')}-${String(numero).padStart(2, '0')}`;
}

/** 'AAAA-MM' → mês anterior, atravessando a virada de ano. */
export function mesAnterior(mes: string): string {
  return deslocarMes(mes, -1);
}

/** 'AAAA-MM' → mês seguinte, atravessando a virada de ano. */
export function mesSeguinte(mes: string): string {
  return deslocarMes(mes, 1);
}

/** Caminho (com ou sem query) com `mes` trocado ou acrescentado, preservando os demais parâmetros. */
export function comMes(caminho: string, mes: string): string {
  const [base, busca = ''] = caminho.split('?');
  return `${base}?${escreverMesNaUrl(new URLSearchParams(busca), mes).toString()}`;
}

/** 'AAAA-MM' (ou 'AAAA-MM-01') → "outubro", sem o ano. */
export function formatarNomeMes(mes: string): string {
  return partesDoMes(mes).nome;
}
