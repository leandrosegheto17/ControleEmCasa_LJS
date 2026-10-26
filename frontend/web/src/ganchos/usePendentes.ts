import { useEffect, useState } from 'react';
import { fila } from '../dados/fila/fila';
import type { ItemFila } from '../dados/fila/tipos';

export type { ItemFila };

export type Pendentes = { total: number; aguardando: number; falhas: number; itens: ItemFila[] };

const ZERO: Pendentes = { total: 0, aguardando: 0, falhas: 0, itens: [] };

const assinatura = (itens: ItemFila[]) => itens.map((i) => `${i.id}:${i.situacao}:${i.motivo ?? ''}`).join('|');

/** Itens da fila do membro atual; os de outro membro nunca entram na conta. */
export function usePendentes(): Pendentes {
  const [pendentes, setPendentes] = useState<Pendentes>(ZERO);
  useEffect(() => {
    let ativo = true;
    const atualizar = async () => {
      const itens = await fila.listar();
      if (!ativo) return;
      const aguardando = itens.filter((i) => i.situacao === 'aguardando').length;
      setPendentes((atual) =>
        assinatura(atual.itens) === assinatura(itens)
          ? atual
          : { total: itens.length, aguardando, falhas: itens.length - aguardando, itens },
      );
    };
    void atualizar();
    const cancelar = fila.assinar(() => void atualizar());
    return () => {
      ativo = false;
      cancelar();
    };
  }, []);
  return pendentes;
}
