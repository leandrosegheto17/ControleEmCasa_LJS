import type { SaidaSessaoAtual } from '@controle/contrato';
import { useMemo } from 'react';
import { hojeEmSaoPaulo } from '../formatacao/data';
import { useSessao } from './useSessao';

export interface Contexto {
  membro: { nome: string; email: string };
  /** Mês de hoje em São Paulo, 'AAAA-MM'. */
  mes_corrente: string;
}

/**
 * Contexto da tela montado a partir da sessão (`GET /api/sessao`) e do relógio de São Paulo: a API não tem rota de
 * contexto (SDD 6.1). Sem sessão ativa (ex.: presumida, sem rede) não há contexto.
 */
export function montarContexto(sessao: SaidaSessaoAtual | null, agora: Date = new Date()): Contexto | undefined {
  if (!sessao) return undefined;
  return {
    membro: { nome: sessao.usuario.nome, email: sessao.usuario.email },
    mes_corrente: hojeEmSaoPaulo(agora).slice(0, 7),
  };
}

/** Quem está logado e o mês corrente. Vem da sessão já carregada pela guarda; não faz outra chamada. */
export function useContexto() {
  const estado = useSessao();
  const sessao = estado.situacao === 'ativa' ? estado.sessao : null;
  return useMemo(() => ({ data: montarContexto(sessao) }), [sessao]);
}
