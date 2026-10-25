import { ErroApi } from '../../erros';
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
 * Pagamento de despesa fixa (RN-28). SPEC_DEVIATION: as tabelas `despesa_fixa` e `ocorrencia_fixa` nascem na
 * etapa 9; até lá nenhum lançamento é pagamento de fixa. A etapa 9 troca esta função pela consulta à
 * `ocorrencia_fixa` pelo id do lançamento (o domínio já aplica as regras da RN-28 quando receber `true`).
 */
export function ehPagamentoDeFixa(): boolean {
  return false;
}
