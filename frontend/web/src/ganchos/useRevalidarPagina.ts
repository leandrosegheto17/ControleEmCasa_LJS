import { useQueryClient } from '@tanstack/react-query';
import { useCallback } from 'react';

/** Refaz as consultas montadas na página; as de outras telas ficam como estão. */
export function useRevalidarPagina(): () => Promise<void> {
  const clienteConsulta = useQueryClient();
  return useCallback(() => clienteConsulta.refetchQueries({ type: 'active' }), [clienteConsulta]);
}
