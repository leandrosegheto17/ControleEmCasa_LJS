import type { SaidaLinhaMetas as LinhaMetas } from '@controle/contrato';
import type { SaidaMovimentoMeta } from '@controle/contrato';

type MovimentosMeta = SaidaMovimentoMeta[];
import { useLeituraComCache } from '../../ganchos/useLeituraComCache';
import { useMeta } from '../../ganchos/useMetas';
import { useMovimentosMeta } from '../../ganchos/useMovimentosMeta';
import { ehUuid } from '../../comum/uuid';
import type { LeituraComCache } from '../../ganchos/useLeituraComCache';

export interface DetalheMeta {
  meta: LinhaMetas;
  movimentos: MovimentosMeta;
}

/** A meta e seus movimentos como uma só leitura: a tela só sai de "carregando" quando as duas chegam. */
export function useDetalheMeta(id: string) {
  const consultaMeta = useMeta(id);
  const consultaMovimentos = useMovimentosMeta(id);
  const leituraMeta = useLeituraComCache(consultaMeta);
  const leituraMovimentos = useLeituraComCache(consultaMovimentos);

  const semDado = leituraMeta.dados === undefined || leituraMovimentos.dados === undefined;
  const emErro = leituraMeta.situacao === 'erro' || leituraMovimentos.situacao === 'erro';
  const emCache = leituraMeta.situacao === 'cache' || leituraMovimentos.situacao === 'cache';
  const situacao = semDado ? (emErro ? 'erro' : 'carregando') : emCache ? 'cache' : 'pronto';
  const leitura: LeituraComCache<DetalheMeta> = {
    situacao,
    dados: semDado ? undefined : { meta: leituraMeta.dados!, movimentos: leituraMovimentos.dados! },
    atualizadoEm: Math.min(leituraMeta.atualizadoEm, leituraMovimentos.atualizadoEm),
  };

  const naoExiste =
    !ehUuid(id) ||
    [consultaMeta, consultaMovimentos].some(
      (c) => c.data === undefined && c.error?.tipo === 'regra' && c.error.codigo === 'registro_invalido',
    );
  const recarregar = () => {
    void consultaMeta.refetch();
    void consultaMovimentos.refetch();
  };
  return { leitura, naoExiste, recarregar };
}
