import type { Vinculo } from '../../env';
import { ErroApi } from '../../erros';
import { ehViolacaoDeChaveEstrangeira } from '../../infraestrutura/db/codigo-erro';
import { erroRegistroInvalido, vinculoDe, type DepsLar } from '../lar/comum';

/**
 * Peças comuns dos casos de uso de cadastro (contas, formas, categorias; etapa 7). Sem Hono e sem `c.env`.
 * Ordem das recusas (RT-02): `registro_invalido` (não existe, é de outro lar ou de outro membro) → `valor_invalido`
 * (regra do domínio) → `*_arquivada` → demais regras (`em_uso`). O dono e o lar vêm do vínculo derivado no
 * banco, nunca do cliente (G-03).
 */
export { erroRegistroInvalido, vinculoDe, type DepsLar, type Vinculo };

export const erroValorInvalido = () => new ErroApi(400, 'valor_invalido', 'Dados inválidos.');
export const erroEmUso = () => new ErroApi(409, 'em_uso', 'Este item ainda está em uso. Arquive-o em vez de excluir.');
export const erroCategoriaEmUso = () =>
  new ErroApi(409, 'categoria_em_uso', 'Esta categoria ainda está em uso. Arquive-a em vez de excluir.');

/** Resultado de uma escrita idempotente: `criado` decide entre 201 e 200 (ADR-010). */
export interface ResultadoSalvar {
  id: string;
  criado: boolean;
}

/**
 * Exclui e traduz a recusa do Postgres por vínculo (23503) no erro de negócio indicado. O filtro por dono
 * vem antes: o que não é do membro dá 0 linhas e vira `registro_invalido`, nunca `em_uso` (CA-T1.3).
 */
export async function excluirComVinculo(excluir: () => Promise<number>, emUso: () => ErroApi): Promise<void> {
  let apagadas: number;
  try {
    apagadas = await excluir();
  } catch (erro) {
    if (ehViolacaoDeChaveEstrangeira(erro)) throw emUso();
    throw erro;
  }
  if (apagadas !== 1) throw erroRegistroInvalido();
}
