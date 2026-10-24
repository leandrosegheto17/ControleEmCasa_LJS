import type { Centavos } from '@controle/contrato';

/** Soma valores em centavos. Função pura, sem relógio nem I/O. */
export function somarCentavos(valores: readonly Centavos[]): Centavos {
  return valores.reduce((total, valor) => total + valor, 0);
}
