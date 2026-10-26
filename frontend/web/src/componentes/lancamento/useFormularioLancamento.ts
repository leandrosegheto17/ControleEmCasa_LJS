import type { SaidaLancamento as Lancamento } from '@controle/contrato';
import { useState } from 'react';
import type { CamposLancamento } from '../../comum/lancamentos';
import { pagamentoDe } from './privados';

/** Valores em edição do formulário; só o estado local, sem dados nem regra de permissão. */
export function useFormularioLancamento(lancamento: Lancamento) {
  const { valor_total_centavos, categoria, descricao, num_parcelas } = lancamento;
  const pagamento = pagamentoDe(lancamento);
  const [inicial] = useState(() => ({
    valor: valor_total_centavos,
    categoriaId: categoria.id,
    descricao: descricao ?? '',
    data: pagamento?.data_operacao ?? '',
    parcelas: num_parcelas,
    formaId: pagamento?.forma?.id ?? '',
  }));
  const [valores, setValores] = useState(inicial);

  const mudar = <K extends keyof typeof inicial>(campo: K, valor: (typeof inicial)[K]) =>
    setValores((atual) => ({ ...atual, [campo]: valor }));

  /** Só o que difere do carregado e que o formulário está mostrando. */
  function alterados(visiveis: { data: boolean; forma: boolean; parcelas: boolean }): CamposLancamento {
    const campos: CamposLancamento = {};
    if (valores.valor !== inicial.valor) campos.valorTotalCentavos = valores.valor;
    if (valores.categoriaId !== inicial.categoriaId) campos.categoriaId = valores.categoriaId;
    if (valores.descricao !== inicial.descricao) campos.descricao = valores.descricao;
    if (visiveis.data && valores.data !== inicial.data) campos.data = valores.data;
    if (visiveis.forma && valores.formaId !== inicial.formaId) campos.formaId = valores.formaId;
    if (visiveis.parcelas && valores.parcelas !== inicial.parcelas) campos.numParcelas = valores.parcelas;
    return campos;
  }

  return { valores, mudar, alterados };
}
