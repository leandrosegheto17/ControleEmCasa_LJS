import { hojeEmSaoPaulo } from '../../formatacao/data';
import type { ItemFila } from '../../comum/fila';
import type { EstadoLancar } from '../lancar/useFormularioLancar';

/** Valores da folha de lançamento que reproduzem o item guardado, para o membro corrigi-lo. */
export function correcaoDoItem(item: ItemFila): EstadoLancar {
  return {
    valorCentavos: item.args.valor_centavos,
    categoriaId: item.args.categoria_id,
    formaId: item.args.forma_id,
    parcelas: item.args.parcelas ?? 1,
    data: item.args.data ?? hojeEmSaoPaulo(),
    descricao: item.args.descricao ?? '',
  };
}
