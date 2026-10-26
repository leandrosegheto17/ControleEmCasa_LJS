import type { SaidaLinhaContas as LinhaContas } from '@controle/contrato';
import { useState } from 'react';
import { useSearchParams } from 'react-router';
import { AvisoErroTopo } from '../../componentes/base/AvisoErroTopo';
import { AcoesEdicao } from '../../componentes/AcoesEdicao';
import { AjusteSaldo } from '../../componentes/AjusteSaldo';
import { CartaoSaldo } from '../../componentes/CartaoSaldo';
import { FormularioConta } from '../../componentes/FormularioConta';
import { usePreviaAjuste } from '../../ganchos/useContas';
import { mensagemErro } from '../../rotulos/mensagensErro';
import estilo from './EdicaoConta.module.css';
import { saldoRealDaUrl } from './saldoRealDaUrl';
import { useAcoesConta } from './useAcoesConta';

const TEXTO_EM_USO =
  'Esta conta tem lançamentos ou formas de pagamento ligados a ela. Arquive para tirá-la das opções; o histórico continua.';

export function EdicaoConta({ conta }: { conta: LinhaContas }) {
  const acoes = useAcoesConta(conta.id);
  const [parametros] = useSearchParams();
  const [saldoReal, setSaldoReal] = useState(() => saldoRealDaUrl(parametros));
  const previa = usePreviaAjuste(conta.id, saldoReal);

  return (
    <>
      {acoes.emUso ? (
        <div className={estilo.erro}>
          <AvisoErroTopo>{TEXTO_EM_USO}</AvisoErroTopo>
        </div>
      ) : (
        <>
          <CartaoSaldo saldoCentavos={conta.saldo_centavos} />
          <AjusteSaldo
            saldoRealCentavos={saldoReal}
            aoMudar={setSaldoReal}
            diferencaCentavos={previa.data}
            erroPrevia={previa.isError && previa.error ? mensagemErro(previa.error) : undefined}
            aoAjustar={() => saldoReal !== undefined && acoes.ajustar(saldoReal, () => setSaldoReal(undefined))}
            ajustando={acoes.ajustando}
          />
        </>
      )}
      <FormularioConta
        nomeInicial={conta.nome}
        saldoInicialCentavos={conta.saldo_inicial_centavos}
        erroSaldoInicial={acoes.erroSaldoInicial}
        aoSalvar={acoes.salvar}
      >
        <AcoesEdicao
          acoes={acoes}
          podeExcluir={conta.pode_excluir}
          rotuloArquivarEmUso="Arquivar conta"
          tituloExclusao="Excluir esta conta?"
          textoExclusao="A conta será excluída de vez e não dá para desfazer."
        />
      </FormularioConta>
    </>
  );
}
