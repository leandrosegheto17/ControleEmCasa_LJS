import type { SituacaoOcorrencia } from '../../comum/enums';
import { formatarDataCurta } from '../../formatacao/data';

/** "venceu 05/10" para a atrasada, "vence 10/10" nas demais; `vencimento` é 'AAAA-MM-DD'. */
export function textoVencimento(situacao: SituacaoOcorrencia, vencimento: string): string {
  return `${situacao === 'atrasada' ? 'venceu' : 'vence'} ${formatarDataCurta(vencimento)}`;
}
