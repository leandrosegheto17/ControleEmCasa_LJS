/** Política de senha espelhada do contrato (RN-19, G-17): de 12 caracteres a 72 bytes UTF-8. Um teste confere com o contrato. */
export const SENHA_MIN_CARACTERES = 12;
export const SENHA_MAX_BYTES = 72;

export type ProblemaDeSenha = 'curta' | 'longa' | null;

export function problemaDaSenha(senha: string): ProblemaDeSenha {
  if ([...senha].length < SENHA_MIN_CARACTERES) return 'curta';
  if (new TextEncoder().encode(senha).length > SENHA_MAX_BYTES) return 'longa';
  return null;
}
