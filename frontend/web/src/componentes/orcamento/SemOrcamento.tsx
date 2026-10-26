import { paraEscopoApi, type EscopoUrl } from '../../formatacao/escopoUrl';
import { linkOrcamento } from '../../formatacao/linksApp';
import { BotaoLink } from '../base/BotaoLink';
import { Icone } from '../base/Icone';
import { LinhaVazia } from '../base/LinhaVazia';
import estilos from './SemOrcamento.module.css';
import type { CategoriaSemOrcamento } from './tipos';

interface Props {
  mes: string;
  /** Nome do mês em minúsculas, sem o ano ("outubro"). */
  nomeMes: string;
  escopo: EscopoUrl;
  categorias: readonly CategoriaSemOrcamento[];
  /** Abre a seção já expandida (depois de "Definir do zero"). */
  aberta?: boolean;
  /** Plano Free (RN-25): lista as categorias sem o botão de definir. */
  somenteLeitura?: boolean;
}

const TODAS_COM_ORCAMENTO = {
  casa: (mes: string) => `Todas as categorias de despesa da casa têm orçamento em ${mes}.`,
  eu: (mes: string) => `Todas as suas categorias de despesa têm orçamento em ${mes}.`,
} as const satisfies Record<EscopoUrl, (mes: string) => string>;

/** Categorias de despesa sem orçamento no mês: seção recolhida com "Definir", ou a linha de tudo orçado. */
export function SemOrcamento({ mes, nomeMes, escopo, categorias, aberta, somenteLeitura }: Props) {
  if (categorias.length === 0) return <LinhaVazia>{TODAS_COM_ORCAMENTO[escopo](nomeMes)}</LinhaVazia>;

  return (
    <details className={estilos['mais-detalhes']} open={aberta}>
      <summary>
        <Icone nome="dir" />
        Sem orçamento ({categorias.length})
      </summary>
      {categorias.map((c) => (
        <div key={c.categoria_id} className={estilos.linha}>
          <span className={estilos.nome}>{c.nome}</span>
          {somenteLeitura ? null : (
            <BotaoLink
              variante="texto"
              para={linkOrcamento({ mes, escopo: paraEscopoApi(escopo), editar: c.categoria_id })}
              rotulo={`Definir orçamento de ${c.nome}`}
            >
              Definir
            </BotaoLink>
          )}
        </div>
      ))}
    </details>
  );
}
