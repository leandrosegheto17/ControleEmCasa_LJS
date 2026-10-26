import type { SaidaLancamento as DadosDoLancamento } from '@controle/contrato';
import { useLocation, useParams } from 'react-router';
import { CabecalhoPagina } from '../componentes/base/CabecalhoPagina';
import { DialogoConfirmacao } from '../componentes/base/DialogoConfirmacao';
import { EstadosDeLeitura } from '../componentes/EstadosDeLeitura';
import { EsqueletoLancamento } from '../componentes/lancamento/EsqueletoLancamento';
import { ExcluirLancamento } from '../componentes/lancamento/ExcluirLancamento';
import { FormularioLancamento } from '../componentes/lancamento/FormularioLancamento';
import { LancamentoNaoExiste } from '../componentes/lancamento/LancamentoNaoExiste';
import { ListaParcelas } from '../componentes/lancamento/ListaParcelas';
import { ResumoLancamento } from '../componentes/lancamento/ResumoLancamento';
import { pagamentoDe } from '../componentes/lancamento/privados';
import { textoDescarte } from '../componentes/lancamento/textoDescarte';
import { useContexto } from '../ganchos/useContexto';
import { useDadosLancamento } from '../ganchos/useDadosLancamento';
import { useLancamento } from '../ganchos/useLancamento';
import { useLeituraComCache } from '../ganchos/useLeituraComCache';
import { useAlterarDataParcela } from './lancamento/useAlterarDataParcela';
import { useExcluirLancamento } from './lancamento/useExcluirLancamento';
import { destinoDaVolta, useSalvarLancamento } from './lancamento/useSalvarLancamento';

function DetalheLancamento({ lancamento }: { lancamento: DadosDoLancamento }) {
  const contexto = useContexto();
  const dados = useDadosLancamento().data?.dados;
  const salvar = useSalvarLancamento(lancamento.id);
  const exclusao = useExcluirLancamento(lancamento.id, salvar.destino);
  const ajuste = useAlterarDataParcela(lancamento.id);
  if (salvar.naoExiste || exclusao.naoExiste) return <LancamentoNaoExiste />;

  const categorias = (lancamento.tipo === 'receita' ? dados?.categorias_receita : dados?.categorias_despesa) ?? [];
  return (
    <>
      <ResumoLancamento lancamento={lancamento} membroAtual={{ nome: contexto.data?.membro.nome ?? '' }} />
      <FormularioLancamento
        lancamento={lancamento}
        categorias={categorias}
        formas={dados?.formas ?? []}
        aoSalvar={salvar.salvar}
        salvando={salvar.salvando}
        erro={salvar.erro ?? exclusao.erro ?? ajuste.erro}
        acoes={<ExcluirLancamento lancamento={lancamento} aoExcluir={exclusao.excluir} />}
      >
        <ListaParcelas
          parcelas={lancamento.parcelas}
          numParcelas={lancamento.num_parcelas}
          editavel={lancamento.pagador.sou_eu && pagamentoDe(lancamento)?.forma?.tipo === 'credito'}
          onAlterarData={ajuste.alterar}
        />
      </FormularioLancamento>
      <DialogoConfirmacao
        aberto={salvar.aConfirmar !== null}
        titulo="Descartar ajuste de data?"
        texto={textoDescarte(lancamento.parcelas, salvar.aConfirmar)}
        rotuloConfirmar="Recalcular e salvar"
        variante="neutra"
        aoConfirmar={salvar.confirmarDescarte}
        aoCancelar={salvar.cancelarDescarte}
      />
    </>
  );
}

export function Lancamento() {
  const { id = '' } = useParams();
  const consulta = useLancamento(id);
  const leitura = useLeituraComCache(consulta);
  const sumiu =
    consulta.data === undefined && consulta.error?.tipo === 'regra' && consulta.error.codigo === 'registro_invalido';

  return (
    <>
      <CabecalhoPagina
        titulo="Lançamento"
        voltarPara={destinoDaVolta(useLocation().state)}
        rotuloVoltar="Voltar para Lançamentos"
      />
      <main>
        {sumiu ? (
          <LancamentoNaoExiste />
        ) : (
          <EstadosDeLeitura
            leitura={leitura}
            esqueleto={<EsqueletoLancamento />}
            anuncioCarregando="Carregando o lançamento…"
            aoTentarDeNovo={() => void consulta.refetch()}
          >
            {(lancamento) => <DetalheLancamento lancamento={lancamento} />}
          </EstadosDeLeitura>
        )}
      </main>
    </>
  );
}
