import type { ReactNode } from 'react';
import type { SituacaoOcorrencia } from '../../comum/enums';
import { formatarMoeda } from '../../formatacao/moeda';
import { SeloSituacao } from '../base/SeloSituacao';
import { textoVencimento } from './textoVencimento';
import estilo from './LinhaFixa.module.css';

interface Props {
  descricao: string;
  /** Aparece antes do vencimento ("Moradia · vence 10/10"). */
  categoria?: string;
  situacao: SituacaoOcorrencia;
  /** 'AAAA-MM-DD' */
  vencimento: string;
  valorCentavos: number;
  /** Substitui o texto padrão do selo (ex.: "Paga por Ana"). */
  textoSelo?: string;
  /** Ação da linha; sem ela a célula fica vazia. */
  acao?: ReactNode;
}

/** `li` de despesa fixa do mês: nome, vencimento, valor, selo da situação e a ação. */
export function LinhaFixa({ descricao, categoria, situacao, vencimento, valorCentavos, textoSelo, acao }: Props) {
  const vencimentoTexto = textoVencimento(situacao, vencimento);
  return (
    <li className={estilo.linha}>
      <div className={estilo['item-info']}>
        <span className={estilo['item-titulo']}>{descricao}</span>
        <span className={estilo['item-sub']}>{categoria ? `${categoria} · ${vencimentoTexto}` : vencimentoTexto}</span>
      </div>
      <span className="valor">{formatarMoeda(valorCentavos)}</span>
      <span>
        <SeloSituacao situacao={situacao} texto={textoSelo} />
      </span>
      {acao ?? <span />}
    </li>
  );
}
