import { linkLancamentos } from '../../formatacao/linksApp';
import { CartaoResumo } from '../base/CartaoResumo';
import estilos from './EuPorCategoria.module.css';
import { ListaPorCategoria } from './ListaPorCategoria';
import type { PropsEu } from './tipos';

export function EuPorCategoria({ individual, mes }: PropsEu) {
  const vazio = individual.por_categoria.length === 0 && individual.minha_parte_por_categoria.length === 0;
  return (
    <CartaoResumo
      titulo="Por categoria"
      bloco="eu"
      estado={vazio ? 'vazio' : 'dado'}
      textoVazio="Nenhuma despesa sua no mês."
    >
      {individual.por_categoria.length > 0 && (
        <ListaPorCategoria
          itens={individual.por_categoria}
          linkPara={(categoria) => linkLancamentos({ mes, escopo: 'individual', categoria })}
        />
      )}
      {individual.minha_parte_por_categoria.length > 0 && (
        <>
          <p className={estilos['lista-sub']}>Minha parte na casa</p>
          <ListaPorCategoria
            itens={individual.minha_parte_por_categoria}
            linkPara={(categoria) => linkLancamentos({ mes, escopo: 'conjunto', categoria })}
          />
        </>
      )}
    </CartaoResumo>
  );
}
