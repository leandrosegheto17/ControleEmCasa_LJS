import { flushSync } from 'react-dom';
import { useRef, useState, type FormEvent, type KeyboardEvent } from 'react';
import type { SaidaDadosLancamento as DadosLancamento } from '@controle/contrato';
import { ROTULO_ERRO, TEXTO_ERRO_GENERICO } from '../../rotulos/erros';
import { TEXTO_RECEITA_SEM_CONEXAO } from '../../rotulos/textosConexao';
import { focarPrimeiroErro } from '../base/focarPrimeiroErro';
import { montarEntrada } from './montarEntrada';
import type { EntradaFolha, ResultadoFolha } from '../../comum/envio';
import type { EstadoFormulario } from './useFormularioLancar';

interface Entradas {
  dados?: DadosLancamento;
  estado: EstadoFormulario;
  validar: () => boolean;
  limpar: () => void;
  aoLancar?: (entrada: EntradaFolha) => Promise<ResultadoFolha>;
}

function textoDoErro(resultado: ResultadoFolha): string | undefined {
  if (resultado.tipo === 'regra') return ROTULO_ERRO[resultado.codigo].texto;
  if (resultado.tipo === 'erro') return TEXTO_ERRO_GENERICO;
  if (resultado.tipo === 'sem_conexao') return TEXTO_RECEITA_SEM_CONEXAO;
  return undefined;
}

/** Validação, envio e o que a folha faz com o resultado: limpar e focar o valor, ou mostrar o erro no topo. */
export function useEnvioLancar({ dados, estado, validar, limpar, aoLancar }: Entradas) {
  const formulario = useRef<HTMLFormElement>(null);
  const [ocupado, setOcupado] = useState(false);
  const [erroTopo, setErroTopo] = useState<string>();

  async function aoEnviar(evento: FormEvent) {
    evento.preventDefault();
    if (ocupado || !dados) return;
    let valido = false;
    // O foco vai para o campo que acabou de ganhar aria-invalid, então o erro precisa estar no DOM.
    flushSync(() => {
      valido = validar();
    });
    if (!valido) {
      if (formulario.current) focarPrimeiroErro(formulario.current);
      return;
    }
    const entrada = montarEntrada(dados, estado);
    if (!aoLancar || !entrada) return;

    setErroTopo(undefined);
    setOcupado(true);
    const resultado = await aoLancar(entrada).catch((): ResultadoFolha => ({ tipo: 'erro' }));
    setOcupado(false);

    const texto = textoDoErro(resultado);
    if (texto) setErroTopo(texto);
    else {
      limpar();
      formulario.current?.querySelector<HTMLElement>('#valor')?.focus();
    }
  }

  /** Ctrl ou ⌘ + Enter segue o mesmo caminho do botão. */
  function aoTeclar(evento: KeyboardEvent<HTMLFormElement>) {
    if (evento.key !== 'Enter' || !(evento.ctrlKey || evento.metaKey)) return;
    evento.preventDefault();
    evento.currentTarget.requestSubmit();
  }

  return { formulario, ocupado, erroTopo, aoEnviar, aoTeclar };
}
