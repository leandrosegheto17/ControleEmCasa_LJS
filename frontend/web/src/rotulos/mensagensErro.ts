import type { CodigoErro, ErroDados } from '../comum/erros';

const GENERICA = 'Algo deu errado. Tente de novo';

/** Casos de regra que valem para qualquer tela; o texto próprio de cada recurso (`em_uso`, nome repetido) fica na tela. */
const REGRA: Partial<Record<CodigoErro, string>> = {
  valor_invalido: 'Valor inválido. Confira e tente de novo',
  registro_invalido: 'Não encontramos este item. Ele pode ter sido removido',
  sem_permissao: 'Você não tem permissão para alterar este item',
  categoria_arquivada: 'Esta categoria está arquivada',
  forma_arquivada: 'Esta forma de pagamento está arquivada',
  conta_arquivada: 'Esta conta está arquivada',
};

/** Texto pt-BR para o erro; nunca repassa código ou mensagem do servidor. */
export function mensagemErro(erro: ErroDados): string {
  switch (erro.tipo) {
    case 'rede':
      return 'Sem conexão. Tente de novo';
    case 'indisponivel':
      return 'Serviço indisponível no momento. Tente de novo em instantes';
    case 'regra':
      return REGRA[erro.codigo] ?? GENERICA;
    default:
      return GENERICA;
  }
}
