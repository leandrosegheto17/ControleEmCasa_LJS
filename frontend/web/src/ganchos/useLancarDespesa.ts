import { useCallback, useRef } from 'react';
import type { SaidaLancamentoGravado as LancarDespesa } from '@controle/contrato';
import { fila } from '../dados/fila/fila';
import type { EntradaLancar, ResultadoLancar } from '../comum/envio';

/** Depois disso o envio segue em segundo plano e a tela diz que o lançamento está guardado. */
const ESPERA_MAXIMA_MS = 3000;

export type { EntradaLancar, ResultadoLancar };

/** Itens que uma chamada de `lancar` está esperando; quem avisa o resultado é ela, não o aviso de envio em segundo plano. */
const aguardandoResposta = new Set<string>();

export const estaAguardandoLancamento = (id: string) => aguardandoResposta.has(id);

async function enviar(entrada: EntradaLancar): Promise<ResultadoLancar> {
  // A contagem dos 3 s começa no toque, antes de gravar na fila.
  let temporizador: ReturnType<typeof setTimeout> | undefined;
  const limite = new Promise<ResultadoLancar>((resolver) => {
    temporizador = setTimeout(() => resolver({ tipo: 'guardado' }), ESPERA_MAXIMA_MS);
  });

  let item;
  try {
    item = await fila.enfileirar(
      {
        valor_centavos: entrada.valorCentavos,
        categoria_id: entrada.categoriaId,
        forma_id: entrada.formaId,
        parcelas: entrada.parcelas,
        data: entrada.data,
        descricao: entrada.descricao,
      },
      entrada.exibicao,
    );
  } catch {
    clearTimeout(temporizador);
    return { tipo: 'erro' };
  }

  aguardandoResposta.add(item.id);
  let resposta: LancarDespesa | undefined;
  const cancelar = fila.assinar((evento) => {
    if (evento.tipo === 'enviado' && evento.item.id === item.id) resposta = evento.resposta;
  });

  const tentativa = fila
    .esvaziar()
    .then(async (): Promise<ResultadoLancar> => {
      if (resposta) return { tipo: 'sucesso', resposta };
      const atual = (await fila.listar()).find((i) => i.id === item.id);
      if (atual?.situacao === 'falhou' && atual.motivo && atual.motivo !== 'desconhecido') {
        // O formulário continua com os dados: corrigir e lançar de novo não pode deixar um item repetido na fila.
        await fila.descartar(item.id, { confirmado: true });
        return { tipo: 'regra', codigo: atual.motivo };
      }
      return { tipo: 'guardado' };
    })
    .catch((): ResultadoLancar => ({ tipo: 'guardado' }))
    .finally(cancelar);

  try {
    return await Promise.race([tentativa, limite]);
  } finally {
    clearTimeout(temporizador);
    aguardandoResposta.delete(item.id);
  }
}

/** Lança a despesa pela fila: grava no aparelho, tenta enviar e espera até 3 s pelo servidor. */
export function useLancarDespesa() {
  const emCurso = useRef<Promise<ResultadoLancar> | null>(null);

  const lancar = useCallback((entrada: EntradaLancar): Promise<ResultadoLancar> => {
    if (emCurso.current) return emCurso.current;
    const envio = enviar(entrada).finally(() => {
      emCurso.current = null;
    });
    emCurso.current = envio;
    return envio;
  }, []);

  return { lancar };
}
