import type { EntradaCopiarOrcamento, EntradaDefinirOrcamento } from '@controle/contrato';
import type { Escopo } from '../../comum/enums';
import { ehUuid } from '../../comum/uuid';
import { REGISTRO_INVALIDO } from '../consultas/cadastro';
import { chamar } from '../transporte';

/**
 * `PUT /api/orcamento/:mes/:categoria_id` (204). `valorCentavos: null` remove o orçamento da categoria no mês
 * (idempotente). Escopo e dono vêm da categoria, no servidor. `mes` é `AAAA-MM`.
 */
export async function definirOrcamento({
  mes,
  categoriaId,
  valorCentavos,
}: {
  mes: string;
  categoriaId: string;
  valorCentavos: number | null;
}): Promise<void> {
  if (!ehUuid(categoriaId)) throw REGISTRO_INVALIDO;
  const corpo: EntradaDefinirOrcamento = { valor_centavos: valorCentavos };
  await chamar('PUT', `/api/orcamento/${mes}-01/${categoriaId}`, corpo);
}

/** `POST /api/orcamento/:mes/copiar`: devolve quantas categorias foram copiadas do mês anterior. */
export async function copiarOrcamento({ mes, escopo }: { mes: string; escopo: Escopo }): Promise<number> {
  const corpo: EntradaCopiarOrcamento = { escopo };
  const r = await chamar<{ copiadas: number }>('POST', `/api/orcamento/${mes}-01/copiar`, corpo, {
    saida: 'CopiaDeOrcamento',
  });
  return r.copiadas;
}
