import type { SaidaLinhaFormasPagamento as LinhaFormasPagamento } from '@controle/contrato';
import { AcoesEdicao } from '../../componentes/AcoesEdicao';
import { AvisoErroTopo } from '../../componentes/base/AvisoErroTopo';
import { FormularioForma } from '../../componentes/FormularioForma';
import { QuadroCartao } from '../../componentes/QuadroCartao';
import { useContas } from '../../ganchos/useContas';
import { useContexto } from '../../ganchos/useContexto';
import { formatarNomeMes } from '../../formatacao/mes';
import { PagamentoCartaoConectada } from '../formas/PagamentoCartaoConectada';
import estilo from './EdicaoForma.module.css';
import { useAcoesForma } from './useAcoesForma';

const TEXTO_EM_USO = 'Esta forma tem lançamentos ligados a ela. Arquive para tirá-la das opções; o histórico continua.';

export function EdicaoForma({ forma }: { forma: LinhaFormasPagamento }) {
  const acoes = useAcoesForma(forma.id, forma.preferida);
  const contas = useContas();
  const contexto = useContexto();
  const mesCorrente = contexto.data?.mes_corrente;

  return (
    <>
      {acoes.emUso ? (
        <div className={estilo.erro}>
          <AvisoErroTopo>{TEXTO_EM_USO}</AvisoErroTopo>
        </div>
      ) : null}
      {forma.tipo === 'credito' && forma.gasto_mes_centavos !== null && forma.comprometido_futuro_centavos !== null ? (
        <QuadroCartao
          nome={forma.nome}
          gastoMesCentavos={forma.gasto_mes_centavos}
          comprometidoFuturoCentavos={forma.comprometido_futuro_centavos}
          mes={mesCorrente ? formatarNomeMes(mesCorrente) : undefined}
          destinoPagamento="?pagamento=1"
        />
      ) : null}
      <FormularioForma
        inicial={{
          nome: forma.nome,
          tipo: forma.tipo,
          dia: forma.dia_vencimento === null ? '' : String(forma.dia_vencimento),
          contaId: forma.conta?.id ?? '',
          preferida: forma.preferida,
        }}
        tipoFixo
        contas={contas.data ?? []}
        aoSalvar={acoes.salvar}
      >
        <AcoesEdicao
          acoes={acoes}
          podeExcluir={forma.pode_excluir}
          rotuloArquivarEmUso="Arquivar forma"
          tituloExclusao="Excluir esta forma?"
          textoExclusao="A forma será excluída de vez e não dá para desfazer."
        />
      </FormularioForma>
      <PagamentoCartaoConectada forma={forma} />
    </>
  );
}
