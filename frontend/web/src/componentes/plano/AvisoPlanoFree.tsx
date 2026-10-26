import { LINK_PLANO } from '../../formatacao/linksApp';
import { BotaoLink } from '../base/BotaoLink';
import { Faixa } from '../base/Faixa';

/** Aviso das telas de orçamento e metas no plano Free (RN-25): só consulta, com o caminho para assinar. */
export function AvisoPlanoFree({ recurso }: { recurso: 'orcamento' | 'metas' }) {
  const o = recurso === 'orcamento' ? 'o orçamento' : 'as metas';
  return (
    <Faixa
      variante="plano"
      acoes={
        <BotaoLink para={LINK_PLANO} variante="texto">
          Ver meu plano
        </BotaoLink>
      }
    >
      {`No plano Free ${o} fica só para consulta. Assine o Pro para editar.`}
    </Faixa>
  );
}
