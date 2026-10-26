import { formatarDataCurta } from '../../formatacao/data';
import { linkFixas } from '../../formatacao/linksApp';
import { formatarMoeda } from '../../formatacao/moeda';
import { BotaoLink } from '../base/BotaoLink';
import { CartaoResumo } from '../base/CartaoResumo';
import { LinhaVazia } from '../base/LinhaVazia';
import { LinkMais } from '../base/LinkMais';
import lista from '../base/Lista.module.css';
import { SeloSituacao } from '../base/SeloSituacao';
import estilos from './CasaFixas.module.css';
import info from './ListaPorCategoria.module.css';
import type { PropsCasa } from './tipos';

const MAXIMO_ITENS = 3;

/** Fixas a pagar: as primeiras na ordem da API; a situação (e não a data) decide "venceu"/"vence". */
export function CasaFixas({ conjunto, mes }: PropsCasa) {
  const { fixas_total: total, fixas_pendentes: pendentes } = conjunto;

  if (total === 0) {
    return (
      <CartaoResumo
        titulo="Fixas a pagar"
        bloco="casa"
        estado="vazio"
        textoVazio="Nenhuma despesa fixa cadastrada."
        acaoVazio={
          <LinkMais seta para="/app/fixas/nova">
            Nova despesa fixa
          </LinkMais>
        }
      />
    );
  }

  if (pendentes.length === 0) {
    return (
      <CartaoResumo titulo="Fixas a pagar" bloco="casa" estado="dado" textoVazio="">
        <LinhaVazia>Todas as fixas do mês pagas</LinhaVazia>
        <LinkMais seta para={linkFixas({ mes })}>
          Ver todas as fixas
        </LinkMais>
      </CartaoResumo>
    );
  }

  return (
    <CartaoResumo
      titulo={
        <>
          Fixas a pagar <span className={info['item-sub']}>{`${pendentes.length} de ${total}`}</span>
        </>
      }
      bloco="casa"
      estado="dado"
      textoVazio=""
    >
      <ul className={`${lista.lista} ${estilos.fixas}`}>
        {pendentes.slice(0, MAXIMO_ITENS).map((f) => (
          <li key={f.ocorrencia_id} className={estilos['item-fixa']}>
            <div className={info['item-info']}>
              <span className={info['item-titulo']}>{f.descricao}</span>
              <span className={info['item-sub']}>
                {`${f.situacao === 'atrasada' ? 'venceu' : 'vence'} ${formatarDataCurta(f.vencimento)}`}
              </span>
            </div>
            <span className="valor">{formatarMoeda(f.valor_previsto_centavos)}</span>
            <span>
              <SeloSituacao situacao={f.situacao} />
            </span>
            <BotaoLink
              para={linkFixas({ mes, pagar: f.ocorrencia_id })}
              variante="secundario"
              rotulo={`Marcar como paga: ${f.descricao}`}
            >
              Marcar paga
            </BotaoLink>
          </li>
        ))}
      </ul>
      <LinkMais seta para={linkFixas({ mes })}>
        Ver todas as fixas
      </LinkMais>
    </CartaoResumo>
  );
}
