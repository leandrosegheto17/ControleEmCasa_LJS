import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { iniciarEnvioAutomatico } from '../dados/fila/envioAutomatico';
import { fila } from '../dados/fila/fila';

/** Liga o envio automático da fila na área autenticada; item enviado atualiza as telas. */
export function useEnvioAutomatico(): void {
  const clienteConsulta = useQueryClient();
  useEffect(() => {
    const parar = iniciarEnvioAutomatico();
    const cancelar = fila.assinar((evento) => {
      if (evento.tipo === 'enviado') void clienteConsulta.invalidateQueries();
    });
    return () => {
      cancelar();
      parar();
    };
  }, [clienteConsulta]);
}
