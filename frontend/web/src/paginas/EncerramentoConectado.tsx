import { FaixaEncerramento } from '../componentes/FaixaEncerramento';
import { useSessao } from '../ganchos/useSessao';

/** Liga a faixa de encerramento à sessão: só aparece quando `GET /api/sessao` traz `encerramento` (CA-26.7). */
export function EncerramentoConectado() {
  const estado = useSessao();
  const encerramento = estado.situacao === 'ativa' ? estado.sessao.encerramento : undefined;
  return encerramento ? <FaixaEncerramento purgaEm={encerramento.purga_em} /> : null;
}
