import type { SaidaLancamentoGravado as LancarDespesa } from '@controle/contrato';
import { formatarDataCurta, hojeEmSaoPaulo } from '../../formatacao/data';
import { formatarTituloLancamento } from '../../formatacao/lancamento';
import { formatarMoeda } from '../../formatacao/moeda';
import { ROTULO_ERRO, TEXTO_ERRO_GENERICO } from '../../rotulos/erros';
import type { ItemFila } from '../../comum/fila';

/** Falhas em que a folha de envios orienta o próximo passo além do que o rótulo de erro diz. */
const DETALHE_FALHA: Partial<Record<string, string>> = {
  categoria_arquivada: 'a categoria foi arquivada. Corrija a categoria ou descarte.',
};

const minuscula = (texto: string) => texto.charAt(0).toLowerCase() + texto.slice(1);

function motivoEmTexto(motivo: string): string {
  const texto = motivo in ROTULO_ERRO ? ROTULO_ERRO[motivo as keyof typeof ROTULO_ERRO].texto : TEXTO_ERRO_GENERICO;
  return minuscula(texto);
}

export function tituloEnvio(item: ItemFila): string {
  return formatarTituloLancamento(item.args.descricao ?? null, item.exibicao.categoria_nome, 1, 1);
}

export function subtituloEnvio(item: ItemFila): string {
  return `${item.exibicao.categoria_nome} · ${formatarDataCurta(item.args.data ?? hojeEmSaoPaulo())} · ${item.exibicao.forma_nome}`;
}

/** Situação do item; a falha traz o motivo em português, nunca o código. */
export function situacaoEnvio(item: ItemFila): string {
  if (item.situacao === 'aguardando') return 'aguardando envio';
  const motivo = item.motivo ?? 'desconhecido';
  return `Falhou: ${DETALHE_FALHA[motivo] ?? motivoEmTexto(motivo)}`;
}

/** Aviso de item enviado em segundo plano; a data da 1ª parcela vem da resposta do servidor. */
export function textoEnviado(resposta: LancarDespesa): string {
  if (resposta.num_parcelas > 1) return `Enviado: 1ª parcela em ${formatarDataCurta(resposta.primeira_parcela_data)}`;
  return `Enviado: ${formatarMoeda(resposta.valor_total_centavos)} · ${resposta.categoria}`;
}
