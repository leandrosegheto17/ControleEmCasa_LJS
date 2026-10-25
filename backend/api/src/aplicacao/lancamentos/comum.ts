import { ErroApi } from '../../erros';
import { ocorrenciaDoLancamento } from '../../infraestrutura/db/repositorios/fixas';
import { erroRegistroInvalido, vinculoDe, type DepsLar } from '../lar/comum';

/**
 * Peças comuns dos casos de uso de lançamento (etapa 8). Sem Hono e sem `c.env`. O lar e o dono vêm do vínculo
 * derivado no banco, nunca do cliente (G-03). Ordem das recusas: RT-02 e as exceções herdadas lá descritas.
 */
export { erroRegistroInvalido, vinculoDe, type DepsLar };

export const erroValorInvalido = () => new ErroApi(400, 'valor_invalido', 'Dados inválidos.');
export const erroSemPermissao = () =>
  new ErroApi(403, 'sem_permissao', 'Você não pode mudar isso num lançamento pago pelo outro membro.');
export const erroCategoriaArquivada = () =>
  new ErroApi(422, 'categoria_arquivada', 'Esta categoria está arquivada. Escolha outra.');
export const erroFormaArquivada = () =>
  new ErroApi(422, 'forma_arquivada', 'Esta forma de pagamento está arquivada. Escolha outra.');
export const erroContaArquivada = () =>
  new ErroApi(422, 'conta_arquivada', 'Esta conta está arquivada. Escolha outra.');
export const erroConfirmarDescarte = () =>
  new ErroApi(
    409,
    'confirmar_descarte_ajustes',
    'Esta edição descarta as datas de parcela ajustadas à mão. Confirme para continuar.',
  );

/** Tradução dos códigos do domínio usados aqui. */
export function erroDe(
  codigo: 'valor_invalido' | 'registro_invalido' | 'sem_permissao' | 'confirmar_descarte_ajustes',
): ErroApi {
  switch (codigo) {
    case 'valor_invalido':
      return erroValorInvalido();
    case 'registro_invalido':
      return erroRegistroInvalido();
    case 'sem_permissao':
      return erroSemPermissao();
    case 'confirmar_descarte_ajustes':
      return erroConfirmarDescarte();
  }
}

/**
 * O lançamento é o pagamento de uma ocorrência de despesa fixa (RN-28)? Devolve a ocorrência (com o vencimento, onde
 * a parcela única fica) ou nulo. A ocorrência é do lar: a consulta filtra pelo lar do vínculo além da RLS.
 */
export async function ocorrenciaPagaPor(
  deps: DepsLar,
  lancamentoId: string,
): Promise<{ id: string; vencimento: string } | null> {
  return ocorrenciaDoLancamento(deps.tx, { lancamentoId, larId: vinculoDe(deps).larId });
}
