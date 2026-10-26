import { useCallback } from 'react';
import { useSearchParams } from 'react-router';

/**
 * Valor bruto de um parâmetro de busca que abre uma folha (`?pagar=`, `?movimentar=`, `?pagamento=`)
 * e o setter que o troca (ou remove, com `null`) com `replace`, mantendo os demais parâmetros.
 */
export function useParametroDaFolha(nome: string): [string | null, (valor: string | null) => void] {
  const [params, definirParams] = useSearchParams();
  const definir = useCallback(
    (valor: string | null) =>
      definirParams(
        (atual) => {
          const proximo = new URLSearchParams(atual);
          if (valor === null) proximo.delete(nome);
          else proximo.set(nome, valor);
          return proximo;
        },
        { replace: true },
      ),
    [definirParams, nome],
  );
  return [params.get(nome), definir];
}
