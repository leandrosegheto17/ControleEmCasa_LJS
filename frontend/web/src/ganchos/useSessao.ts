import { useQuery } from '@tanstack/react-query';
import { donoLembrado, obterSessao, type SessaoAtual } from '../dados/sessao';
import type { EstadoSessao } from './guardas';

export const CHAVE_SESSAO = ['sessao'] as const;

const PRESUMIDA = 'presumida' as const;
type Resultado = SessaoAtual | null | typeof PRESUMIDA;

/**
 * Pergunta ao servidor (`GET /api/sessao`). Sem rede (ou com o servidor fora do ar) não é erro da consulta:
 * com um usuário lembrado neste aparelho a sessão é "presumida" e o app abre para lançar offline; sem usuário
 * lembrado vale "sem sessão". Assim o estado não pisca para "carregando" a cada nova tentativa.
 */
async function consultar(): Promise<Resultado> {
  try {
    return await obterSessao();
  } catch (e) {
    const tipo = (e as { tipo?: unknown } | null)?.tipo;
    if (tipo === 'rede' || tipo === 'indisponivel') return donoLembrado() ? PRESUMIDA : null;
    throw e;
  }
}

/** Estado da sessão, sempre a partir de `GET /api/sessao` (o cookie é HttpOnly e o front não o lê). */
export function useSessao(): EstadoSessao {
  const consulta = useQuery({
    queryKey: CHAVE_SESSAO,
    queryFn: consultar,
    retry: false,
    retryOnMount: false,
    staleTime: 60_000,
    refetchOnWindowFocus: true,
  });
  if (consulta.data === PRESUMIDA) return { situacao: 'presumida' };
  if (consulta.data) return { situacao: 'ativa', sessao: consulta.data };
  if (consulta.data === null) return { situacao: 'sem-sessao' };
  if (consulta.isError) return { situacao: 'sem-sessao' };
  return { situacao: 'carregando' };
}
