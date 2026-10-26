import { useRef, useState } from 'react';
import { useSearchParams } from 'react-router';
import { AvisoPlanoFree } from '../componentes/plano/AvisoPlanoFree';
import { CabecalhoMes } from '../componentes/CabecalhoMes';
import { Segmentado } from '../componentes/base/Segmentado';
import { useAviso } from '../componentes/base/useAviso';
import { EstadosDeLeitura } from '../componentes/EstadosDeLeitura';
import { CartaoTotalOrcamento } from '../componentes/orcamento/CartaoTotalOrcamento';
import { EsqueletoOrcamento } from '../componentes/orcamento/EsqueletoOrcamento';
import { GradeOrcamento } from '../componentes/orcamento/GradeOrcamento';
import { ListaOrcamento } from '../componentes/orcamento/ListaOrcamento';
import { OrcamentoVazio } from '../componentes/orcamento/OrcamentoVazio';
import { SemOrcamento } from '../componentes/orcamento/SemOrcamento';
import { lerEscopoDaUrl, paraEscopoApi } from '../formatacao/escopoUrl';
import { formatarNomeMes } from '../formatacao/mes';
import { useCopiarOrcamento } from '../ganchos/useCopiarOrcamento';
import { useLeituraComCache } from '../ganchos/useLeituraComCache';
import { useMesDaUrl } from '../ganchos/useMesDaUrl';
import { useOrcamentoMes } from '../ganchos/useOrcamentoMes';
import { useSomenteLeitura } from '../ganchos/usePlano';
import { usePendentes } from '../ganchos/usePendentes';
import { ROTULO_ESCOPO } from '../rotulos/escopo';
import { mensagemErro } from '../rotulos/mensagensErro';
import { ValorOrcamentoConectado } from './orcamento/ValorOrcamentoConectado';
import estilos from './Orcamento.module.css';

const OPCOES = [
  { valor: 'casa', rotulo: ROTULO_ESCOPO.conjunto.texto },
  { valor: 'eu', rotulo: ROTULO_ESCOPO.individual.texto },
];

export function Orcamento() {
  const [mes, definirMes] = useMesDaUrl();
  const [params, definirParams] = useSearchParams();
  const escopo = lerEscopoDaUrl(params);
  const escopoApi = paraEscopoApi(escopo);
  const consulta = useOrcamentoMes(mes, escopoApi);
  const leitura = useLeituraComCache(consulta);
  const { total: pendentes } = usePendentes();
  const [definindoDoZero, setDefinindoDoZero] = useState(false);
  const somenteLeitura = useSomenteLeitura();
  const anterior = consulta.data?.anterior;
  const { mostrar } = useAviso();
  const { copiar, copiando } = useCopiarOrcamento(mes, escopoApi);
  const nomeMesOrigem = anterior ? formatarNomeMes(anterior.mes) : '';
  const carregando = leitura.situacao === 'carregando';
  const tituloCartao = useRef<HTMLHeadingElement>(null);

  function mudarEscopo(valor: string) {
    setDefinindoDoZero(false);
    definirParams(
      (atual) => {
        const proximos = new URLSearchParams(atual);
        proximos.set('escopo', valor);
        return proximos;
      },
      { replace: true },
    );
  }

  return (
    <>
      <CabecalhoMes mes={mes} aoMudarMes={definirMes} pendentes={pendentes} prefixoOculto="Orçamento de " />
      <main aria-busy={carregando}>
        {somenteLeitura ? <AvisoPlanoFree recurso="orcamento" /> : null}
        {leitura.situacao === 'erro' ? null : (
          <div className={estilos.escopo}>
            <Segmentado
              legenda="Escopo do orçamento"
              nome="escopo"
              opcoes={OPCOES}
              valor={escopo}
              aoMudar={mudarEscopo}
            />
          </div>
        )}
        <EstadosDeLeitura
          leitura={leitura}
          esqueleto={<EsqueletoOrcamento />}
          anuncioCarregando="Carregando o orçamento…"
          aoTentarDeNovo={() => void consulta.refetch()}
        >
          {(dados) => {
            const nomeMes = formatarNomeMes(mes);
            if (dados.total === null && !definindoDoZero) {
              return (
                <OrcamentoVazio
                  somenteLeitura={somenteLeitura}
                  escopo={escopo}
                  nomeMes={nomeMes}
                  anterior={
                    dados.pode_copiar_anterior[escopoApi] && dados.anterior
                      ? {
                          nomeMes: formatarNomeMes(dados.anterior.mes),
                          orcadoCentavos: dados.anterior.orcado_centavos,
                          categorias: dados.anterior.categorias,
                        }
                      : undefined
                  }
                  copiando={copiando}
                  aoCopiar={() =>
                    copiar({
                      onSuccess: () => mostrar('sucesso', `Orçamento copiado de ${nomeMesOrigem}`),
                      onError: (erro) =>
                        mostrar(
                          'erro',
                          erro.tipo === 'rede' ? 'Sem conexão. O orçamento não foi copiado.' : mensagemErro(erro),
                        ),
                    })
                  }
                  aoDefinir={() => setDefinindoDoZero(true)}
                />
              );
            }
            return (
              <>
                {dados.total ? (
                  <GradeOrcamento>
                    <CartaoTotalOrcamento escopo={escopo} total={dados.total} />
                    <ListaOrcamento
                      mes={mes}
                      escopo={escopo}
                      linhas={dados.linhas}
                      refTitulo={tituloCartao}
                      somenteLeitura={somenteLeitura}
                    />
                  </GradeOrcamento>
                ) : null}
                <SemOrcamento
                  mes={mes}
                  nomeMes={nomeMes}
                  escopo={escopo}
                  categorias={dados.sem_orcamento}
                  aberta={dados.total === null}
                  somenteLeitura={somenteLeitura}
                />
              </>
            );
          }}
        </EstadosDeLeitura>
        {consulta.data && !somenteLeitura ? (
          <ValorOrcamentoConectado
            mes={mes}
            escopo={escopo}
            linhas={consulta.data.linhas}
            semOrcamento={consulta.data.sem_orcamento}
            tituloCartao={tituloCartao}
          />
        ) : null}
      </main>
    </>
  );
}
