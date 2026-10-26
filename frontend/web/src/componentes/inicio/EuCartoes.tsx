import { linkForma } from '../../formatacao/linksApp';
import { formatarMoeda } from '../../formatacao/moeda';
import { CartaoResumo } from '../base/CartaoResumo';
import { ItemLink } from '../base/ItemLink';
import estilos from '../base/Lista.module.css';
import type { PropsEu } from './tipos';

export function EuCartoes({ individual }: PropsEu) {
  const { credito } = individual;
  return (
    <CartaoResumo
      titulo="Cartões"
      bloco="eu"
      estado={credito.length === 0 ? 'vazio' : 'dado'}
      textoVazio="Nenhum cartão de crédito."
    >
      <ul className={estilos.lista}>
        {credito.map((c) => (
          <ItemLink
            key={c.forma_id}
            icone="cartao"
            rotulo={c.nome}
            subtitulo={`vence dia ${c.dia_vencimento}`}
            para={linkForma(c.forma_id)}
            direita={
              <span className={estilos.direita}>
                <span className="valor">Neste mês {formatarMoeda(c.gasto_mes_centavos)}</span>
                <span className={`${estilos.sub} valor`}>
                  Próximos meses {formatarMoeda(c.comprometido_futuro_centavos)}
                </span>
              </span>
            }
          />
        ))}
      </ul>
    </CartaoResumo>
  );
}
