/** Textos de remover o membro e sair da casa (RN-23; CA-23.12 a CA-23.14). */

/** Confirmação do titular ao remover o outro membro. */
export function tituloRemocao(nome: string): string {
  return `Remover ${nome} da casa?`;
}

export function textoRemocao(nome: string): string {
  return (
    `${nome} perde o acesso ao que é do conjunto da casa. O que é só de ${nome} some em 30 dias. ` +
    `As despesas conjuntas que ${nome} pagou ficam como "Ex-membro". Para voltar, só com um novo convite.`
  );
}

/** Confirmação do membro ao sair da casa. */
export const TITULO_SAIDA = 'Sair da casa?';
export const TEXTO_SAIDA =
  'Você perde o acesso ao que é do conjunto da casa. O que é só seu some em 30 dias. ' +
  'As despesas conjuntas que você pagou ficam como "Ex-membro". Para voltar, só com um novo convite.';

export const AVISO_MEMBRO_REMOVIDO = 'Membro removido';
export const AVISO_SAIU_DA_CASA = 'Você saiu da casa';
/** Remoção que encontrou o membro já fora (corrida com a saída dele). */
export const AVISO_JA_NAO_ESTA = 'Este membro já não está na casa';
/** Remover e sair são só online: nunca vão para a fila do aparelho. */
export const AVISO_PRECISA_CONEXAO = 'Precisa de conexão para esta ação';
