import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Icone } from './Icone';
import estilos from './PuxarParaAtualizar.module.css';

const LIMIAR_PX = 64;
const DESLOCAMENTO_MAXIMO_PX = 48;
const RESISTENCIA = 0.5;

interface Props {
  aoAtualizar: () => Promise<unknown>;
  children: ReactNode;
}

const aparelhoDeToque = () => window.matchMedia('(pointer: coarse)').matches;
const reduzirMovimento = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/**
 * Puxar o topo da página no celular chama `aoAtualizar`. No PC (sem ponteiro de toque) não
 * registra listener algum. O gesto é só um atalho: a revalidação também acontece ao voltar
 * o foco ao app e pelo botão "Tentar de novo" dos estados de erro.
 */
export function PuxarParaAtualizar({ aoAtualizar, children }: Props) {
  const raiz = useRef<HTMLDivElement>(null);
  const aoAtualizarAtual = useRef(aoAtualizar);
  aoAtualizarAtual.current = aoAtualizar;
  const atualizandoAgora = useRef(false);
  const [puxado, setPuxado] = useState(0);
  const [atualizando, setAtualizando] = useState(false);
  const semAnimacao = reduzirMovimento();

  useEffect(() => {
    const el = raiz.current;
    if (!el || !aparelhoDeToque()) return;

    let inicio: { x: number; y: number } | null = null;
    let distancia = 0;

    const cancelar = () => {
      inicio = null;
      distancia = 0;
      setPuxado(0);
    };

    const aoComecar = (e: TouchEvent) => {
      const livre =
        window.scrollY === 0 && !atualizandoAgora.current && !document.documentElement.classList.contains('com-folha');
      const dedo = e.touches[0];
      if (!livre || e.touches.length !== 1 || !dedo) return;
      inicio = { x: dedo.clientX, y: dedo.clientY };
      distancia = 0;
    };

    const aoMover = (e: TouchEvent) => {
      if (!inicio) return;
      const dedo = e.touches[0];
      if (e.touches.length !== 1 || !dedo) return cancelar();
      const dx = dedo.clientX - inicio.x;
      const dy = dedo.clientY - inicio.y;
      if (dy <= 0 || Math.abs(dx) > dy) return cancelar();
      distancia = dy;
      if (e.cancelable) e.preventDefault();
      setPuxado(Math.min(dy * RESISTENCIA, DESLOCAMENTO_MAXIMO_PX));
    };

    const aoTerminar = async () => {
      const passou = inicio !== null && distancia >= LIMIAR_PX;
      cancelar();
      if (!passou || atualizandoAgora.current) return;
      atualizandoAgora.current = true;
      setAtualizando(true);
      try {
        await aoAtualizarAtual.current();
      } catch {
        // a falha aparece no estado de erro da própria consulta
      } finally {
        atualizandoAgora.current = false;
        setAtualizando(false);
      }
    };

    el.addEventListener('touchstart', aoComecar, { passive: true });
    el.addEventListener('touchmove', aoMover, { passive: false });
    el.addEventListener('touchend', aoTerminar);
    el.addEventListener('touchcancel', cancelar);
    return () => {
      el.removeEventListener('touchstart', aoComecar);
      el.removeEventListener('touchmove', aoMover);
      el.removeEventListener('touchend', aoTerminar);
      el.removeEventListener('touchcancel', cancelar);
    };
  }, []);

  const visivel = puxado > 0 || atualizando;
  const deslocamento = atualizando ? DESLOCAMENTO_MAXIMO_PX : puxado;
  const pronto = atualizando || puxado >= LIMIAR_PX * RESISTENCIA;

  return (
    <div ref={raiz} className={estilos.raiz}>
      {visivel && (
        <div
          className={`${estilos.indicador} ${pronto ? estilos.pronto : ''}`}
          style={semAnimacao ? undefined : { transform: `translateY(${deslocamento}px)` }}
          aria-hidden="true"
        >
          <span className={atualizando && !semAnimacao ? estilos.giro : undefined}>
            <Icone nome="recarregar" />
          </span>
        </div>
      )}
      <div role="status" className="visualmente-oculto">
        {atualizando ? 'Atualizando…' : ''}
      </div>
      {children}
    </div>
  );
}
