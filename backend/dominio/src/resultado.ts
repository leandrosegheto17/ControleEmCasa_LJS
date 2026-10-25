/**
 * Resultado de uma regra do domínio: sucesso com valor ou recusa com o código de erro do contrato
 * (PRD-TECNICO §1.1). O domínio não lança exceção por regra de negócio: quem chama (a API) decide
 * a ordem das recusas (RT-02) e o status HTTP.
 */
export type CodigoErroDominio = 'valor_invalido' | 'registro_invalido' | 'sem_permissao' | 'confirmar_descarte_ajustes';

export type Resultado<T, E extends CodigoErroDominio = CodigoErroDominio> =
  { readonly ok: true; readonly valor: T } | { readonly ok: false; readonly erro: E };

export function sucesso<T>(valor: T): { readonly ok: true; readonly valor: T } {
  return { ok: true, valor };
}

export function recusa<E extends CodigoErroDominio>(erro: E): { readonly ok: false; readonly erro: E } {
  return { ok: false, erro };
}
