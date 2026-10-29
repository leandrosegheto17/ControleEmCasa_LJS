/**
 * "Sair da casa" leva ao primeiro acesso pela guarda: a sessão relida já não tem lar e a área do app troca de tela,
 * o que desmonta a região de avisos da tela anterior. Esta marca atravessa a troca para o primeiro acesso mostrar
 * "Você saiu da casa" (spec da etapa 18, sair, critério 3). É deixada antes de reler a sessão e lida uma vez só.
 */
let saiu = false;

export const marcarSaidaDaCasa = (): void => {
  saiu = true;
};

/** Lê e apaga: o aviso aparece uma vez. */
export const tomarSaidaDaCasa = (): boolean => {
  const valor = saiu;
  saiu = false;
  return valor;
};
