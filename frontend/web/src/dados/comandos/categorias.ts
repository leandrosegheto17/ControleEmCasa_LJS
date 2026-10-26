import type { SaidaIdSalvo } from '@controle/contrato';
import type { Escopo, TipoLancamento } from '../../comum/enums';
import { chamar } from '../transporte';

export interface DadosSalvarCategoria {
  id: string;
  nome: string;
  tipo: TipoLancamento;
  escopo: Escopo;
  /** Só vale na despesa. */
  variavel?: boolean;
}

/** `PUT /api/categorias/:id`: cria ou atualiza. */
export const salvarCategoria = (d: DadosSalvarCategoria) =>
  chamar<SaidaIdSalvo>(
    'PUT',
    `/api/categorias/${d.id}`,
    { nome: d.nome, tipo: d.tipo, escopo: d.escopo, ...(d.variavel !== undefined && { variavel: d.variavel }) },
    { saida: 'IdSalvo' },
  );

export const arquivarCategoria = async (id: string): Promise<void> => {
  await chamar('POST', `/api/categorias/${id}/arquivar`);
};

export const excluirCategoria = async (id: string): Promise<void> => {
  await chamar('DELETE', `/api/categorias/${id}`);
};
