/** Foca o primeiro campo marcado com aria-invalid="true" (ordem do DOM); devolve se encontrou algum. */
export function focarPrimeiroErro(raiz: HTMLElement): boolean {
  const campo = raiz.querySelector<HTMLElement>('[aria-invalid="true"]');
  if (!campo) return false;
  campo.focus();
  return true;
}
