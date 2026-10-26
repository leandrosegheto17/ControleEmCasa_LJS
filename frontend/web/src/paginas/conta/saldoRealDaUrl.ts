/** `?saldo_real=<centavos>`: só inteiro positivo seguro; qualquer outro valor é ignorado. */
export function saldoRealDaUrl(parametros: URLSearchParams): number | undefined {
  const bruto = parametros.get('saldo_real');
  if (bruto === null || !/^\d+$/.test(bruto)) return undefined;
  const centavos = Number(bruto);
  return Number.isSafeInteger(centavos) && centavos > 0 ? centavos : undefined;
}
