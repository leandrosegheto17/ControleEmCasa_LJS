import { useId, type Ref } from 'react';
import type { SaidaOcorrenciasMes as OcorrenciasMes } from '@controle/contrato';
import { linkFixas } from '../../formatacao/linksApp';
import { formatarMoeda } from '../../formatacao/moeda';
import { Botao } from '../base/Botao';
import { BotaoLink } from '../base/BotaoLink';
import lista from '../base/Lista.module.css';
import { LinhaFixa } from './LinhaFixa';
import estilo from './CartaoOcorrencias.module.css';

export type Ocorrencia = OcorrenciasMes['ocorrencias'][number];

interface Props {
  mes: string;
  resumo: Pick<OcorrenciasMes, 'pagas' | 'total' | 'previsto_a_pagar_centavos'>;
  ocorrencias: readonly Ocorrencia[];
  aoDesfazer: (ocorrencia: Ocorrencia) => void;
  /** Alvo do foco depois de marcar uma ocorrência como paga (o botão que abriu a folha some). */
  refTitulo?: Ref<HTMLHeadingElement>;
}

function textoSelo(o: Ocorrencia): string | undefined {
  if (!o.pagador) return undefined;
  return `Paga por ${o.pagador.sou_eu ? 'você' : o.pagador.nome}`;
}

function valorMostrado(o: Ocorrencia): number {
  if (o.situacao !== 'paga') return o.valor_previsto_centavos;
  return o.valor_pago_centavos ?? o.valor_previsto_centavos;
}

/** A ordem e os totais vêm prontos da API; a tela só mostra. Só quem pagou desfaz (RN-06). */
export function CartaoOcorrencias({ mes, resumo, ocorrencias, aoDesfazer, refTitulo }: Props) {
  const idTitulo = useId();

  function acao(o: Ocorrencia) {
    if (o.situacao !== 'paga') {
      return (
        <BotaoLink
          para={linkFixas({ mes, pagar: o.id })}
          variante="secundario"
          rotulo={`Marcar como paga: ${o.descricao}`}
        >
          Marcar como paga
        </BotaoLink>
      );
    }
    if (!o.pagador?.sou_eu) return undefined;
    return (
      <Botao variante="texto" aria-label={`Desfazer pagamento: ${o.descricao}`} onClick={() => aoDesfazer(o)}>
        Desfazer pagamento
      </Botao>
    );
  }

  return (
    <section className={estilo.cartao} aria-labelledby={idTitulo}>
      <h2 id={idTitulo} ref={refTitulo} tabIndex={-1} className={estilo.titulo}>
        Pagas: {resumo.pagas} de {resumo.total}
        <span className={estilo.previsto}>
          Previsto a pagar <span className="valor">{formatarMoeda(resumo.previsto_a_pagar_centavos)}</span>
        </span>
      </h2>
      <ul className={lista.lista}>
        {ocorrencias.map((o) => (
          <LinhaFixa
            key={o.id}
            descricao={o.descricao}
            categoria={o.categoria}
            situacao={o.situacao}
            vencimento={o.vencimento}
            valorCentavos={valorMostrado(o)}
            textoSelo={textoSelo(o)}
            acao={acao(o)}
          />
        ))}
      </ul>
    </section>
  );
}
