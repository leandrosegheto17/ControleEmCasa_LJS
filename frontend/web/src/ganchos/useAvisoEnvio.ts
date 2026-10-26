import { useEffect, useRef } from 'react';
import type { SaidaLancamentoGravado as LancarDespesa } from '@controle/contrato';
import { fila } from '../dados/fila/fila';
import type { ItemFila } from '../dados/fila/tipos';

interface Opcoes {
  /** Itens que outra tela já está aguardando e vai avisar por conta própria. */
  ignorar?: (item: ItemFila) => boolean;
}

/** Entrega a resposta do servidor de cada item enviado em segundo plano. */
export function useAvisoEnvio(aoEnviado: (resposta: LancarDespesa) => void, { ignorar }: Opcoes = {}): void {
  const atual = useRef({ aoEnviado, ignorar });
  useEffect(() => {
    atual.current = { aoEnviado, ignorar };
  });
  useEffect(
    () =>
      fila.assinar((evento) => {
        if (evento.tipo !== 'enviado' || atual.current.ignorar?.(evento.item)) return;
        atual.current.aoEnviado(evento.resposta);
      }),
    [],
  );
}
