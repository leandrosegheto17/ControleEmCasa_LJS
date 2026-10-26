/**
 * "Sair deste aparelho" e "Sair de todos" encerram a sessão de propósito. Quando o cache da sessão vira `null`, a guarda
 * de `/app/*` reage antes do `navigate` da tela e mandaria o membro a `/entrar?volta=<tela privada>`: o login seguinte
 * cairia de volta nos Ajustes. Esta marca diz à guarda que a saída foi escolha do membro, para ir a
 * `/entrar` sem `volta`. Um 401 inesperado não a marca, e aí o `volta` continua valendo.
 */
let saindo = false;

export const marcarSaidaDeProposito = (): void => {
  saindo = true;
};

export const desmarcarSaidaDeProposito = (): void => {
  saindo = false;
};

/** Só lê (a guarda renderiza mais de uma vez): quem apaga é `desmarcarSaidaDeProposito`, na próxima sessão ativa. */
export const saiuDePropositoAgora = (): boolean => saindo;
