import { formatarNomeMes } from '../../formatacao/mes';
import type { ErroDados } from '../../comum/erros';

/** Título e texto do erro sem dado em cache; fora da indisponibilidade valem os padrões do estado de erro. */
export function textoErroInicio(erro: ErroDados | null, mes: string): { titulo?: string; texto?: string } {
  if (erro?.tipo !== 'indisponivel') return {};
  return {
    titulo: 'Servidor indisponível',
    texto: `Não foi possível carregar o resumo de ${formatarNomeMes(mes)}. Seus lançamentos de despesa ficam guardados no aparelho e serão enviados quando o servidor voltar.`,
  };
}
