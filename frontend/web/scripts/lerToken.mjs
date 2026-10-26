/** Devolve o valor de uma custom property CSS (`--nome`) declarada em `css`. */
export function lerToken(css, nome) {
  const declaracoes = css.replace(/\/\*[\s\S]*?\*\//g, '').split(/[;{}]/);
  for (const declaracao of declaracoes) {
    const dois = declaracao.indexOf(':');
    if (dois < 0) continue;
    if (declaracao.slice(0, dois).trim() === nome) return declaracao.slice(dois + 1).trim();
  }
  throw new Error(`token ${nome} não encontrado`);
}
