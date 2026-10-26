/** Altura da janela coberta pelo teclado virtual (nunca negativa). */
export function calcularFolga(alturaJanela: number, alturaVisivel: number, offsetTop: number): number {
  return Math.max(0, alturaJanela - alturaVisivel - offsetTop);
}

/**
 * Mantém `--folga-teclado` no elemento, em px, a cada mudança do `visualViewport`.
 * A propriedade entra pelo CSSOM (`style.setProperty`), nunca por atributo `style` no HTML.
 * Devolve a função que cancela a observação.
 */
export function observarFolga(elemento: HTMLElement): () => void {
  const viewport = window.visualViewport;
  if (!viewport) {
    elemento.style.setProperty('--folga-teclado', '0px');
    return () => {};
  }
  const atualizar = () => {
    const folga = calcularFolga(window.innerHeight, viewport.height, viewport.offsetTop);
    elemento.style.setProperty('--folga-teclado', `${folga}px`);
  };
  atualizar();
  viewport.addEventListener('resize', atualizar);
  viewport.addEventListener('scroll', atualizar);
  return () => {
    viewport.removeEventListener('resize', atualizar);
    viewport.removeEventListener('scroll', atualizar);
  };
}
