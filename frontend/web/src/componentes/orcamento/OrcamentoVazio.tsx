import { formatarMoeda } from '../../formatacao/moeda';
import type { EscopoUrl } from '../../formatacao/escopoUrl';
import { Botao } from '../base/Botao';
import { EstadoVazio } from '../base/EstadoVazio';

interface Props {
  escopo: EscopoUrl;
  /** Nome do mês em minúsculas, sem o ano ("novembro"). */
  nomeMes: string;
  /** Último mês com orçamento; só há "Copiar" quando existe. */
  anterior?: { nomeMes: string; orcadoCentavos: number; categorias: number };
  copiando: boolean;
  aoCopiar: () => void;
  aoDefinir: () => void;
  /** Plano Free (RN-25): explica e não oferece copiar nem definir. */
  somenteLeitura?: boolean;
}

/** Mês sem orçamento: oferece copiar do mês anterior ou definir do zero. */
export function OrcamentoVazio({ escopo, nomeMes, anterior, copiando, aoCopiar, aoDefinir, somenteLeitura }: Props) {
  const titulo = `Sem orçamento ${escopo === 'eu' ? 'seu' : 'da casa'} em ${nomeMes}`;

  if (somenteLeitura) {
    return <EstadoVazio icone="grafico" titulo={titulo} texto="No plano Free não é possível definir orçamento." />;
  }

  if (!anterior) {
    return (
      <EstadoVazio
        icone="grafico"
        titulo={titulo}
        texto="Defina um valor para cada categoria de despesa."
        acao={
          <Botao variante="principal" onClick={aoDefinir}>
            Definir orçamento
          </Botao>
        }
      />
    );
  }

  const categorias = anterior.categorias === 1 ? '1 categoria' : `${anterior.categorias} categorias`;
  return (
    <EstadoVazio
      icone="grafico"
      titulo={titulo}
      texto={`Copie os valores de ${anterior.nomeMes} (${formatarMoeda(anterior.orcadoCentavos)} em ${categorias}) e ajuste o que mudar.`}
      acao={
        <>
          <Botao variante="principal" salvando={copiando} rotuloOcupado="Copiando…" onClick={aoCopiar}>
            {`Copiar de ${anterior.nomeMes}`}
          </Botao>
          <Botao variante="secundario" onClick={aoDefinir}>
            Definir do zero
          </Botao>
        </>
      }
    />
  );
}
