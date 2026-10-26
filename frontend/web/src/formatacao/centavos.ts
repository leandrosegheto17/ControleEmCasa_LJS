/** Só os dígitos contam: "4590" e "R$ 45,90" viram 4590; sem dígitos, 0. */
export function digitosParaCentavos(texto: string): number {
  const digitos = texto.replace(/\D/g, '');
  if (digitos === '') return 0;
  const valor = Number(digitos);
  if (!Number.isSafeInteger(valor)) {
    throw new RangeError('Valor acima do inteiro seguro');
  }
  return valor;
}
