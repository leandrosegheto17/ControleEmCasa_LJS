import { linkLancamentos } from '../../formatacao/linksApp';
import { CartaoResumo } from '../base/CartaoResumo';
import { ListaPorCategoria } from './ListaPorCategoria';
import type { PropsCasa } from './tipos';

export function CasaPorCategoria({ conjunto, mes }: PropsCasa) {
  return (
    <CartaoResumo
      titulo="Por categoria"
      bloco="casa"
      estado={conjunto.por_categoria.length === 0 ? 'vazio' : 'dado'}
      textoVazio="Nenhuma despesa da casa no mês."
    >
      <ListaPorCategoria
        itens={conjunto.por_categoria}
        linkPara={(categoria) => linkLancamentos({ mes, escopo: 'conjunto', categoria })}
      />
    </CartaoResumo>
  );
}
