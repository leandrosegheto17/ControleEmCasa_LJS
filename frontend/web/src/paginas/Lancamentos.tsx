import { useRef } from 'react';
import { PuxarParaAtualizar } from '../componentes/base/PuxarParaAtualizar';
import { EstadoVazio } from '../componentes/base/EstadoVazio';
import { CabecalhoMes } from '../componentes/CabecalhoMes';
import { EstadosDeLeitura } from '../componentes/EstadosDeLeitura';
import { EsqueletoLancamentos } from '../componentes/lancamentos/EsqueletoLancamentos';
import { FiltrosLancamentos } from '../componentes/lancamentos/FiltrosLancamentos';
import { ListaLancamentosMes } from '../componentes/lancamentos/ListaLancamentosMes';
import { RodapeFila } from '../componentes/lancamentos/RodapeFila';
import { TotalFiltrado } from '../componentes/lancamentos/TotalFiltrado';
import { VazioFiltrado } from '../componentes/lancamentos/VazioFiltrado';
import { haFiltroAtivo, paraFiltrosApi, textoVazioFiltrado } from '../formatacao/filtrosLancamentos';
import { formatarNomeMes } from '../formatacao/mes';
import { useMembroId } from '../ganchos/useMembroId';
import { useDadosLancamento } from '../ganchos/useDadosLancamento';
import { useFiltrosDaUrl } from '../ganchos/useFiltrosDaUrl';
import { useLancamentosMes } from '../ganchos/useLancamentosMes';
import { useLeituraComCache } from '../ganchos/useLeituraComCache';
import { useMesDaUrl } from '../ganchos/useMesDaUrl';
import { usePendentes } from '../ganchos/usePendentes';
import { useRevalidarPagina } from '../ganchos/useRevalidarPagina';

export function Lancamentos() {
  const [mes, definirMes] = useMesDaUrl();
  const [filtros, definirFiltros, limparFiltros] = useFiltrosDaUrl();
  const principalRef = useRef<HTMLElement>(null);
  const consulta = useLancamentosMes(mes, paraFiltrosApi(filtros));
  const leitura = useLeituraComCache(consulta);
  const membroId = useMembroId();
  const dadosLancamento = useDadosLancamento().data?.dados;
  const { total: pendentes, itens: itensFila } = usePendentes();
  const revalidar = useRevalidarPagina();
  const carregando = leitura.situacao === 'carregando';
  const erroSemCache = leitura.situacao === 'erro';

  const categorias = dadosLancamento?.categorias_despesa ?? [];
  const filtrosAtivos = (
    <FiltrosLancamentos
      filtros={filtros}
      aoMudar={definirFiltros}
      categorias={categorias}
      formas={dadosLancamento?.formas ?? []}
    />
  );

  function limparEFocar() {
    limparFiltros();
    principalRef.current?.querySelector<HTMLElement>('[role="group"] button')?.focus();
  }

  const principal = (
    <main ref={principalRef} aria-busy={carregando}>
      {erroSemCache ? null : filtrosAtivos}
      <EstadosDeLeitura
        leitura={leitura}
        esqueleto={<EsqueletoLancamentos />}
        anuncioCarregando="Carregando os lançamentos…"
        aoTentarDeNovo={() => void consulta.refetch()}
      >
        {(lista) => (
          <>
            <TotalFiltrado totalCentavos={lista.total_filtrado_centavos} quantidade={lista.quantidade} />
            {lista.itens.length > 0 ? (
              <ListaLancamentosMes itens={lista.itens} membroAtualId={membroId} />
            ) : haFiltroAtivo(filtros) ? (
              <VazioFiltrado
                texto={textoVazioFiltrado(
                  filtros,
                  formatarNomeMes(mes),
                  dadosLancamento?.formas.find((f) => f.id === filtros.forma)?.nome,
                )}
                aoLimpar={limparEFocar}
              />
            ) : (
              <EstadoVazio icone="busca" titulo={`Nenhum lançamento em ${formatarNomeMes(mes)}`} />
            )}
            <RodapeFila itens={itensFila} categorias={categorias} mes={mes} />
          </>
        )}
      </EstadosDeLeitura>
    </main>
  );

  return (
    <>
      <CabecalhoMes mes={mes} aoMudarMes={definirMes} pendentes={pendentes} prefixoOculto="Lançamentos de " />
      {/* O gesto só vale com a página pronta: a região viva dele competiria com o anúncio de carregamento. */}
      {carregando ? principal : <PuxarParaAtualizar aoAtualizar={revalidar}>{principal}</PuxarParaAtualizar>}
    </>
  );
}
