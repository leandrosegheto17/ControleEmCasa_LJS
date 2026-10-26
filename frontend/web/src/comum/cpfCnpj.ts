/**
 * CPF/CNPJ do titular, só para a assinatura (RN-24; CA-24.11). Espelha `cpfCnpjValido` do contrato (um teste confere),
 * para não levar o Zod ao bundle. O valor vive só no estado do formulário: nunca vai a `localStorage`, à fila
 * offline, ao log nem à URL.
 */

/** Só os dígitos, no máximo 14. */
export function digitosCpfCnpj(texto: string): string {
  return texto.replace(/\D/g, '').slice(0, 14);
}

/** Máscara enquanto digita: 000.000.000-00 até 11 dígitos; 00.000.000/0000-00 a partir de 12. */
export function mascararCpfCnpj(texto: string): string {
  const d = digitosCpfCnpj(texto);
  if (d.length <= 11) {
    return d
      .replace(/^(\d{3})(\d)/, '$1.$2')
      .replace(/^(\d{3})\.(\d{3})(\d)/, '$1.$2.$3')
      .replace(/^(\d{3})\.(\d{3})\.(\d{3})(\d)/, '$1.$2.$3-$4');
  }
  return d
    .replace(/^(\d{2})(\d)/, '$1.$2')
    .replace(/^(\d{2})\.(\d{3})(\d)/, '$1.$2.$3')
    .replace(/^(\d{2})\.(\d{3})\.(\d{3})(\d)/, '$1.$2.$3/$4')
    .replace(/^(\d{2})\.(\d{3})\.(\d{3})\/(\d{4})(\d)/, '$1.$2.$3/$4-$5');
}

function digito(numeros: number[], pesos: number[]): number {
  const resto = numeros.reduce((soma, n, i) => soma + n * (pesos[i] as number), 0) % 11;
  return resto < 2 ? 0 : 11 - resto;
}

/** CPF (11) ou CNPJ (14) com os dígitos verificadores certos; sequências repetidas são recusadas. */
export function cpfCnpjValido(texto: string): boolean {
  const d = texto.replace(/[.\-/\s]/g, '');
  if (!/^\d+$/.test(d) || (d.length !== 11 && d.length !== 14) || /^(\d)\1+$/.test(d)) return false;
  const n = [...d].map(Number);
  if (d.length === 11) {
    return (
      digito(n.slice(0, 9), [10, 9, 8, 7, 6, 5, 4, 3, 2]) === n[9] &&
      digito(n.slice(0, 10), [11, 10, 9, 8, 7, 6, 5, 4, 3, 2]) === n[10]
    );
  }
  const p1 = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  return digito(n.slice(0, 12), p1) === n[12] && digito(n.slice(0, 13), [6, ...p1]) === n[13];
}
