import type { SaidaDadosLancamento as DadosLancamento } from '@controle/contrato';
import { hojeEmSaoPaulo } from '../../formatacao/data';
import { formatarTituloLancamento } from '../../formatacao/lancamento';
import { linkEnvios } from '../../formatacao/linksApp';
import type { ItemFila } from '../../comum/fila';
import { LinhaLancamento } from '../LinhaLancamento';
import { GrupoDia } from './GrupoDia';

interface Props {
  itens: ItemFila[];
  categorias: DadosLancamento['categorias_despesa'];
  /** 'AAAA-MM' da tela, para o link da folha de envios (padrão: mês corrente). */
  mes?: string;
}

/** Itens da fila de envio, fora do total: a tela só os lista, nunca os soma. */
export function RodapeFila({ itens, categorias, mes }: Props) {
  if (itens.length === 0) return null;
  const href = linkEnvios(mes ?? hojeEmSaoPaulo().slice(0, 7));
  return (
    <GrupoDia id="fila" titulo="Aguardando envio (fora do total)">
      {itens.map((item) => {
        const categoriaId = item.args.categoria_id;
        const categoria = categorias.find((c) => c.id === categoriaId);
        return (
          <div role="listitem" key={item.id}>
            <LinhaLancamento
              href={href}
              escopo={categoria?.escopo ?? item.exibicao.escopo ?? 'individual'}
              titulo={formatarTituloLancamento(item.args.descricao ?? null, item.exibicao.categoria_nome, 1, 1)}
              categoria={item.exibicao.categoria_nome}
              variavel={false}
              tipo="despesa"
              valorCentavos={item.args.valor_centavos}
              data={item.args.data ?? hojeEmSaoPaulo()}
              pagador={{ nome: '', souEu: true }}
              aguardando
            />
          </div>
        );
      })}
    </GrupoDia>
  );
}
