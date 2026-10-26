import type { SaidaLancamentoGravado as LancarDespesa } from '@controle/contrato';
import { formatarDataCurta } from '../../formatacao/data';
import { formatarMoeda } from '../../formatacao/moeda';
import { ROTULO_ESCOPO } from '../../rotulos/escopo';

/** Aviso do que o servidor gravou; a data da 1ª parcela vem da resposta, nunca é calculada aqui. */
export function textoAvisoLancamento(resposta: LancarDespesa): string {
  const escopo = ROTULO_ESCOPO[resposta.escopo].texto;
  if (resposta.num_parcelas <= 1) {
    return `Lançado: ${formatarMoeda(resposta.valor_total_centavos)} · ${resposta.categoria} · ${escopo}`;
  }
  return `Lançado em ${resposta.num_parcelas}x · ${resposta.categoria} · ${escopo} · 1ª parcela em ${formatarDataCurta(resposta.primeira_parcela_data)}`;
}
