import { formatarMoeda } from '../../formatacao/moeda';
import lista from '../base/Lista.module.css';
import { BarraProgresso } from '../base/BarraProgresso';
import { CartaoResumo } from '../base/CartaoResumo';
import estilos from './ListaPorCategoria.module.css';
import type { PropsCasa } from './tipos';

/** Só despesas conjuntas; o texto "valor · %" é o dado acessível, a barra é ilustração. */
export function CasaQuemPagou({ conjunto }: PropsCasa) {
  const membros = conjunto.pago_por_membro;
  return (
    <CartaoResumo
      titulo="Quem pagou"
      bloco="casa"
      estado={membros.length === 0 ? 'vazio' : 'dado'}
      textoVazio="Nenhuma despesa conjunta paga no mês."
    >
      <ul className={lista.lista}>
        {membros.map((m) => (
          <li key={m.membro_id}>
            <div className={estilos['item-info']}>
              <BarraProgresso
                decorativa
                rotulo={m.nome}
                percentual={m.percentual}
                situacao="casa"
                topo={
                  <>
                    <span className={estilos['item-titulo']}>{m.nome}</span>
                    <span className="valor">{`${formatarMoeda(m.valor_centavos)} · ${m.percentual}%`}</span>
                  </>
                }
              />
            </div>
          </li>
        ))}
      </ul>
    </CartaoResumo>
  );
}
