import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { Aviso, type TipoAviso } from './Aviso';
import { ContextoAviso } from './useAviso';

/** Tempo mínimo na tela (WCAG 2.2.1): quem lê devagar ou navega por teclado precisa de tempo. */
const TEMPO_VISIVEL_MS = 4000;

interface ItemAviso {
  id: number;
  tipo: TipoAviso;
  mensagem: string;
}

let proximoId = 0;

/**
 * Provedor dos avisos. As duas regiões vivas ficam sempre montadas: o leitor de tela só
 * anuncia texto inserido em região que já existia. Um aviso por vez; os demais esperam.
 */
export function RegiaoAvisos({ children }: { children: ReactNode }) {
  const [fila, setFila] = useState<ItemAviso[]>([]);
  const [comFoco, setComFoco] = useState(false);
  const [comPonteiro, setComPonteiro] = useState(false);
  const atual = fila[0];
  const pausado = comFoco || comPonteiro;

  const mostrar = useCallback((tipo: TipoAviso, mensagem: string) => {
    setFila((f) => [...f, { id: ++proximoId, tipo, mensagem }]);
  }, []);
  const controle = useMemo(() => ({ mostrar }), [mostrar]);

  useEffect(() => {
    if (!atual || pausado) return;
    const id = atual.id;
    const temporizador = setTimeout(() => {
      setFila((f) => f.filter((item) => item.id !== id));
      setComFoco(false);
      setComPonteiro(false);
    }, TEMPO_VISIVEL_MS);
    return () => clearTimeout(temporizador);
  }, [atual, pausado]);

  const eventos = {
    onFocus: () => setComFoco(true),
    onBlur: () => setComFoco(false),
    onPointerEnter: () => setComPonteiro(true),
    onPointerLeave: () => setComPonteiro(false),
  };
  const naRegiao = (assertiva: boolean) =>
    atual && (atual.tipo === 'erro') === assertiva ? (
      <Aviso key={atual.id} tipo={atual.tipo} mensagem={atual.mensagem} {...eventos} />
    ) : null;

  return (
    <ContextoAviso.Provider value={controle}>
      {children}
      <div role="status" aria-live="polite">
        {naRegiao(false)}
      </div>
      <div role="alert" aria-live="assertive">
        {naRegiao(true)}
      </div>
    </ContextoAviso.Provider>
  );
}
