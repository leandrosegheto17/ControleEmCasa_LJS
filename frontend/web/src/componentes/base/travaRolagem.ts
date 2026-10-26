let travas = 0;

/** Marca o <html> com `com-folha` (rolagem da página travada); empilhável: cada `travar` pede o seu `liberar`. */
export function travar(): void {
  travas += 1;
  document.documentElement.classList.add('com-folha');
}

export function liberar(): void {
  travas = Math.max(0, travas - 1);
  if (travas === 0) document.documentElement.classList.remove('com-folha');
}
