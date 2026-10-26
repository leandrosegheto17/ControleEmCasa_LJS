import { useCallback } from 'react';
import { useSearchParams } from 'react-router';
import { hojeEmSaoPaulo } from '../formatacao/data';
import { escreverMesNaUrl, lerMesDaUrl } from '../formatacao/mes';

/** Mês da tela em `?mes=AAAA-MM` (padrão: mês corrente de São Paulo) e o setter que mantém os demais parâmetros. */
export function useMesDaUrl(): [string, (mes: string) => void] {
  const [params, definirParams] = useSearchParams();
  const mes = lerMesDaUrl(params) ?? hojeEmSaoPaulo().slice(0, 7);
  const definirMes = useCallback(
    (novo: string) => {
      definirParams((atual) => escreverMesNaUrl(atual, novo), { replace: true });
    },
    [definirParams],
  );
  return [mes, definirMes];
}
