import { useState } from 'react';
import { Botao } from '../../componentes/base/Botao';
import { FormularioForma } from '../../componentes/FormularioForma';
import { useContas } from '../../ganchos/useContas';
import { useAcoesForma } from './useAcoesForma';

export function NovaForma() {
  // O mesmo id em todos os envios: reenviar depois de uma falha de rede não cria duas formas.
  const [id] = useState(() => crypto.randomUUID());
  const acoes = useAcoesForma(id, false);
  const contas = useContas();
  return (
    <FormularioForma
      inicial={{ nome: '', tipo: 'pix', dia: '', contaId: '', preferida: false }}
      tipoFixo={false}
      contas={contas.data ?? []}
      aoSalvar={acoes.salvar}
    >
      <Botao variante="principal" tipo="submit" salvando={acoes.salvando}>
        Criar forma
      </Botao>
    </FormularioForma>
  );
}
