import type { CodigoErro } from '../comum/erros';

const GENERICO = 'Não foi possível concluir. Tente de novo.';

/**
 * Texto pt-BR de cada código de erro do contrato (SDD 7); a tela nunca mostra o código nem a mensagem do servidor.
 * Os códigos de acesso, que a pessoa vê nas telas públicas, não revelam se o e-mail existe (G-19).
 */
export const ROTULO_ERRO = {
  // Acesso
  valor_invalido: { texto: 'Confira os dados informados.' },
  credenciais_invalidas: { texto: 'E-mail ou senha incorretos.' },
  senha_fraca: { texto: 'Escolha uma senha mais forte, com pelo menos 12 caracteres.' },
  link_expirado: { texto: 'Este link expirou. Peça um novo.' },
  sessao_expirada: { texto: 'Sua sessão expirou. Entre novamente.' },
  email_nao_confirmado: { texto: 'Confirme seu e-mail para entrar. Peça um novo link, se precisar.' },
  conta_em_exclusao: { texto: 'Esta conta está em processo de exclusão.' },
  muitas_tentativas: { texto: 'Muitas tentativas. Aguarde alguns minutos e tente de novo.' },
  muitas_requisicoes: { texto: 'Muitos pedidos em pouco tempo. Aguarde um instante e tente de novo.' },
  origem_invalida: { texto: 'Não foi possível validar o pedido. Recarregue a página e tente de novo.' },
  // Lar e convite
  sem_lar: { texto: 'Crie ou aceite o convite de um lar para continuar.' },
  convite_invalido: { texto: 'Este convite não é mais válido.' },
  lar_cheio: { texto: 'Este lar já tem o número máximo de membros.' },
  ja_tem_lar: { texto: 'Você já faz parte de um lar.' },
  titular_obrigatorio: { texto: 'O titular precisa permanecer no lar.' },
  convite_pendente: { texto: 'Já existe um convite pendente.' },
  // Cadastros e lançamentos
  registro_invalido: { texto: 'Este item não está mais disponível. Escolha outro.' },
  sem_permissao: { texto: 'Você não tem permissão para fazer isso.' },
  confirmar_descarte_ajustes: { texto: 'Confirme o descarte dos ajustes para continuar.' },
  categoria_em_uso: { texto: 'Esta categoria está em uso e não pode ser removida.' },
  em_uso: { texto: 'Este item está em uso e não pode ser removido.' },
  nome_repetido: { texto: 'Já existe um item com esse nome.' },
  categoria_arquivada: { texto: 'Esta categoria foi arquivada. Escolha outra.' },
  forma_arquivada: { texto: 'Esta forma de pagamento foi arquivada. Escolha outra.' },
  conta_arquivada: { texto: 'Esta conta foi arquivada. Escolha outra.' },
  ocorrencia_paga: { texto: 'Esta ocorrência já foi paga.' },
  retirada_maior_que_guardado: { texto: 'A retirada é maior que o valor guardado.' },
} as const satisfies Record<CodigoErro, { texto: string }>;

/** Texto para quando o código não é reconhecido ou o envio falhou sem código. */
export const TEXTO_ERRO_GENERICO = GENERICO;
