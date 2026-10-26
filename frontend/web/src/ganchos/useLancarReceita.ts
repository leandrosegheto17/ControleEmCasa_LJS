import { useCallback, useRef } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { SaidaLancamentoGravado as LancarReceita } from '@controle/contrato';
import type { ResultadoReceita } from '../comum/envio';
import { lancarReceita } from '../dados/comandos/lancarReceita';
import type { ErroDados } from '../comum/erros';
import { CHAVES, TOTAIS_DO_MES } from './chavesConsulta';

export interface CamposReceita {
  valorCentavos: number;
  categoriaId: string;
  contaId: string;
  data: string;
  descricao: string;
}

export type EstadoEnvioReceita = 'ocioso' | 'enviando' | 'sucesso' | 'sem_conexao' | 'regra' | 'erro';

const INVALIDAR = [CHAVES.dadosLancamento, CHAVES.contas, ...TOTAIS_DO_MES] as const;

const chaveDe = (c: CamposReceita) => JSON.stringify([c.valorCentavos, c.categoriaId, c.contaId, c.data, c.descricao]);

function resultadoDoErro(erro: ErroDados): Exclude<ResultadoReceita, { tipo: 'sucesso' }> {
  if (erro.tipo === 'rede' || erro.tipo === 'indisponivel') return { tipo: 'sem_conexao' };
  if (erro.tipo === 'regra') return { tipo: 'regra', codigo: erro.codigo };
  return { tipo: 'erro' };
}

/**
 * Lança a receita direto no servidor, sem fila nem cópia no aparelho (ADR-007 §1).
 * O `id` é reaproveitado enquanto o membro tenta de novo com os mesmos dados: um reenvio
 * depois de falha de rede não duplica o lançamento (idempotência do servidor).
 */
export function useLancarReceita() {
  const cliente = useQueryClient();
  const ultima = useRef<{ chave: string; id: string } | null>(null);

  const mutacao = useMutation<LancarReceita, ErroDados, { campos: CamposReceita; id: string }>({
    mutationFn: ({ campos, id }) =>
      lancarReceita({
        id,
        valor_centavos: campos.valorCentavos,
        categoria_id: campos.categoriaId,
        conta_id: campos.contaId,
        data: campos.data,
        descricao: campos.descricao || undefined,
      }),
    onSuccess: async () => {
      await Promise.all(INVALIDAR.map((queryKey) => cliente.invalidateQueries({ queryKey })));
    },
  });
  const { mutateAsync } = mutacao;

  const lancar = useCallback(
    async (campos: CamposReceita): Promise<ResultadoReceita> => {
      const chave = chaveDe(campos);
      const id = ultima.current?.chave === chave ? ultima.current.id : crypto.randomUUID();
      ultima.current = { chave, id };
      try {
        const resposta = await mutateAsync({ campos, id });
        ultima.current = null;
        return { tipo: 'sucesso', resposta };
      } catch (erro) {
        return resultadoDoErro(erro as ErroDados);
      }
    },
    [mutateAsync],
  );

  const estado: EstadoEnvioReceita = mutacao.isPending
    ? 'enviando'
    : mutacao.isSuccess
      ? 'sucesso'
      : mutacao.error
        ? resultadoDoErro(mutacao.error).tipo
        : 'ocioso';

  return { lancar, estado, erro: mutacao.error ?? undefined, resposta: mutacao.data };
}
