import { useEffect, useRef, type RefObject } from 'react';
import { focaveisEm } from './focaveis';

const pilha: RefObject<HTMLElement | null>[] = [];

/**
 * Enquanto `ativo`: Tab/Shift+Tab circulam dentro de `ref` e Esc chama `aoEsc`.
 * Armadilhas empilhadas (diálogo sobre folha): só a mais recente reage.
 */
export function useArmadilhaFoco(ref: RefObject<HTMLElement | null>, ativo: boolean, aoEsc: () => void): void {
  const aoEscRef = useRef(aoEsc);
  aoEscRef.current = aoEsc;

  useEffect(() => {
    if (!ativo) return;
    pilha.push(ref);
    const aoTeclar = (evento: KeyboardEvent) => {
      if (pilha[pilha.length - 1] !== ref) return;
      const raiz = ref.current;
      if (!raiz) return;
      const atual = document.activeElement;
      const dentro = atual instanceof Node && raiz.contains(atual);
      if (evento.key === 'Escape') {
        if (dentro || atual === document.body) aoEscRef.current();
        return;
      }
      if (evento.key !== 'Tab') return;
      const lista = focaveisEm(raiz);
      const primeiro = lista[0];
      const ultimo = lista[lista.length - 1];
      if (!primeiro || !ultimo) {
        evento.preventDefault();
        return;
      }
      if (evento.shiftKey && (atual === primeiro || !dentro)) {
        evento.preventDefault();
        ultimo.focus();
      } else if (!evento.shiftKey && (atual === ultimo || !dentro)) {
        evento.preventDefault();
        primeiro.focus();
      }
    };
    document.addEventListener('keydown', aoTeclar);
    return () => {
      document.removeEventListener('keydown', aoTeclar);
      pilha.splice(pilha.lastIndexOf(ref), 1);
    };
  }, [ref, ativo]);
}
