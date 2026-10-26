import { useCallback, useRef, useState } from 'react';
import { enviarAgora } from '../dados/fila/envioAutomatico';
import { fila } from '../dados/fila/fila';

/** Ações do membro sobre a fila: tentar agora, descartar e corrigir (o item antigo só sai depois de lançar o novo). */
export function useAcoesFila() {
  const [enviando, setEnviando] = useState(false);
  const emCorrecao = useRef<string | null>(null);

  const tentarAgora = useCallback(async () => {
    setEnviando(true);
    try {
      await fila.reativarFalhas();
      await enviarAgora();
    } catch {
      // Os itens continuam na fila; o envio automático tenta de novo.
    } finally {
      setEnviando(false);
    }
  }, []);

  const descartar = useCallback((id: string) => fila.descartar(id, { confirmado: true }), []);

  const iniciarCorrecao = useCallback((id: string) => {
    emCorrecao.current = id;
  }, []);

  const cancelarCorrecao = useCallback(() => {
    emCorrecao.current = null;
  }, []);

  /** O lançamento corrigido foi gravado: a confirmação dele é a do membro para sair o item antigo. */
  const concluirCorrecao = useCallback(async () => {
    const id = emCorrecao.current;
    emCorrecao.current = null;
    if (id) await fila.descartar(id, { confirmado: true });
  }, []);

  return { enviando, tentarAgora, descartar, iniciarCorrecao, concluirCorrecao, cancelarCorrecao };
}

export type AcoesFila = ReturnType<typeof useAcoesFila>;
