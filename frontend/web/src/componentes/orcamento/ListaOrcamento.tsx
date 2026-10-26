import type { Ref } from 'react';
import { paraEscopoApi, type EscopoUrl } from '../../formatacao/escopoUrl';
import { formatarRealizadoDeOrcado } from '../../formatacao/moeda';
import { linkOrcamento } from '../../formatacao/linksApp';
import { ROTULO_SITUACAO_ORCAMENTO } from '../../rotulos/situacaoOrcamento';
import { CartaoResumo } from '../base/CartaoResumo';
import { LinhaOrcamento } from './LinhaOrcamento';
import type { LinhaOrcamentoMes as DadosLinha } from './tipos';

interface Props {
  mes: string;
  escopo: EscopoUrl;
  linhas: readonly DadosLinha[];
  refTitulo?: Ref<HTMLHeadingElement>;
  /** Plano Free (RN-25): as linhas só mostram, sem abrir a edição. */
  somenteLeitura?: boolean;
}

const rotuloDoLink = (l: DadosLinha) =>
  `Editar orçamento de ${l.nome}: ${formatarRealizadoDeOrcado(l.realizado_centavos, l.orcado_centavos)}, ` +
  `${l.percentual}%, ${ROTULO_SITUACAO_ORCAMENTO[l.situacao].texto.toLowerCase()}`;

/** Categorias com orçamento na ordem da API; cada uma abre a edição do valor. */
export function ListaOrcamento({ mes, escopo, linhas, refTitulo, somenteLeitura }: Props) {
  return (
    <CartaoResumo secao estado="dado" titulo="Por categoria" textoVazio="" refTitulo={refTitulo}>
      {linhas.map((l, i) => (
        <LinhaOrcamento
          key={l.categoria_id}
          nome={l.nome}
          orcadoCentavos={l.orcado_centavos}
          realizadoCentavos={l.realizado_centavos}
          percentual={l.percentual}
          situacao={l.situacao}
          primeira={i === 0}
          href={
            somenteLeitura ? undefined : linkOrcamento({ mes, escopo: paraEscopoApi(escopo), editar: l.categoria_id })
          }
          rotuloLink={somenteLeitura ? undefined : rotuloDoLink(l)}
        />
      ))}
    </CartaoResumo>
  );
}
