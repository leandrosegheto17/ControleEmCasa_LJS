import { formatarMesCurto } from './mes';
import { formatarMoeda } from './moeda';

interface PrazoMeta {
  /** 'AAAA-MM' ou 'AAAA-MM-DD' */
  prazo: string;
  mensal_necessario_centavos: number | null;
}

/** "até jul/2027 · R$ 644,45 por mês"; sem o valor mensal da API, só o prazo. */
export function textoPrazoMeta(meta: PrazoMeta, { maiuscula = false }: { maiuscula?: boolean } = {}): string {
  const mensal = meta.mensal_necessario_centavos;
  const texto = `até ${formatarMesCurto(meta.prazo.slice(0, 7))}${
    mensal === null ? '' : ` · ${formatarMoeda(mensal)} por mês`
  }`;
  return maiuscula ? `A${texto.slice(1)}` : texto;
}

/** Meta atingida usa a cor de "dentro"; as demais, a cor do bloco. */
export const situacaoBarraMeta = (atingida: boolean, bloco: 'casa' | 'eu'): 'atingida' | 'casa' | 'eu' =>
  atingida ? 'atingida' : bloco;
