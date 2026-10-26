import type { ComponentProps, Ref } from 'react';
import { useAviso } from '../../componentes/base/useAviso';
import { FolhaLancar } from '../../componentes/lancar/FolhaLancar';
import { textoAvisoLancamento } from '../../componentes/lancar/textoAvisoLancamento';
import { useConectado } from '../../ganchos/useConectado';
import { useDadosLancamento } from '../../ganchos/useDadosLancamento';
import { useLancarDespesa } from '../../ganchos/useLancarDespesa';
import { useLancarReceita } from '../../ganchos/useLancarReceita';
import type { EntradaFolha, ResultadoFolha } from '../../comum/envio';

interface Props {
  aberta: boolean;
  aoFechar: () => void;
  refValor: Ref<HTMLInputElement>;
  /** Abre a folha já preenchida (correção de um envio que falhou). */
  correcao?: ComponentProps<typeof FolhaLancar>['correcao'];
  /** O lançamento foi aceito (enviado ou guardado na fila). */
  aoAceitar?: () => void;
}

const TEXTO_GUARDADO = 'Guardado no aparelho. Será enviado quando houver conexão.';

/** Liga a folha de lançamento aos dados de `dados_lancamento`, à fila de envio e aos avisos. */
export function LancarConectado({ aberta, aoFechar, refValor, correcao, aoAceitar }: Props) {
  const { data } = useDadosLancamento();
  const { lancar } = useLancarDespesa();
  const { lancar: lancarReceita } = useLancarReceita();
  const { mostrar } = useAviso();
  const conectado = useConectado();

  async function aoLancar(entrada: EntradaFolha): Promise<ResultadoFolha> {
    if (entrada.tipo === 'receita') {
      // Sem rede a receita nem é tentada: ela não vai para a fila.
      if (!conectado) return { tipo: 'sem_conexao' };
      const { tipo: _tipo, ...campos } = entrada;
      const resultado = await lancarReceita(campos);
      if (resultado.tipo === 'sucesso') {
        mostrar('sucesso', textoAvisoLancamento(resultado.resposta));
        aoAceitar?.();
      }
      return resultado;
    }
    const { tipo: _tipo, ...despesa } = entrada;
    const resultado = await lancar(despesa);
    if (resultado.tipo === 'sucesso') mostrar('sucesso', textoAvisoLancamento(resultado.resposta));
    if (resultado.tipo === 'guardado') mostrar('guardado', TEXTO_GUARDADO);
    if (resultado.tipo === 'sucesso' || resultado.tipo === 'guardado') aoAceitar?.();
    return resultado;
  }

  return (
    <FolhaLancar
      aberta={aberta}
      aoFechar={aoFechar}
      refValor={refValor}
      correcao={correcao}
      dados={data?.dados}
      aoLancar={aoLancar}
      offline={!conectado}
    />
  );
}
