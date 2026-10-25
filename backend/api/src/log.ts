/**
 * Logger único (G-46). Único lugar autorizado a usar `console`.
 * Só aceita campos escalares escolhidos pelo chamador: nunca e-mail, valor, token, corpo nem IP completo.
 */
export type CamposDeLog = Record<string, string | number | boolean>;

export function logar(nivel: 'info' | 'warn' | 'error', evento: string, campos: CamposDeLog = {}): void {
  const linha = JSON.stringify({ nivel, evento, ...campos });
  if (nivel === 'error') console.error(linha);
  else if (nivel === 'warn') console.warn(linha);
  else console.info(linha);
}
