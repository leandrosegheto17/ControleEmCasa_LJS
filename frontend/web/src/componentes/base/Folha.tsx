import { useCallback, useId, useLayoutEffect, useRef, type PointerEvent, type ReactNode } from 'react';
import { BotaoIcone } from './BotaoIcone';
import { focaveisEm } from './focaveis';
import { liberar, travar } from './travaRolagem';
import { useArmadilhaFoco } from './useArmadilhaFoco';
import { Veu } from './Veu';
import styles from './Folha.module.css';

interface Props {
  aberta: boolean;
  aoFechar: () => void;
  titulo: string;
  children: ReactNode;
  rodape?: ReactNode;
  /** Fechada, continua no DOM (oculta e inacessível), preservando o estado interno. */
  montadaOculta?: boolean;
  /** O título continua nomeando o diálogo, mas só para tecnologia assistiva. */
  tituloOculto?: boolean;
  /** Conteúdo do topo, entre o título e o X de fechar. */
  topo?: ReactNode;
  /** Envio em andamento: o diálogo anuncia `aria-busy`. */
  ocupada?: boolean;
  /** Seletor do elemento que recebe o foco ao abrir; sem ele (ou sem achá-lo), o primeiro focável. */
  focoInicial?: string;
}

const LIMIAR_FECHAR_PX = 80;
const LARGURA_PC = '(min-width: 1024px)';

/** Bottom sheet no celular e diálogo de ~480 px no PC. Não fecha ao tocar no véu: protege o que foi digitado. */
export function Folha({
  aberta,
  aoFechar,
  titulo,
  children,
  rodape,
  montadaOculta = false,
  tituloOculto = false,
  topo,
  ocupada,
  focoInicial,
}: Props) {
  const idTitulo = useId();
  const ref = useRef<HTMLElement>(null);
  const arrasto = useRef<{ inicio: number; deslocamento: number } | null>(null);

  useArmadilhaFoco(ref, aberta, aoFechar);

  useLayoutEffect(() => {
    if (!aberta) return;
    const gatilho = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    travar();
    const folha = ref.current;
    if (folha && !folha.contains(document.activeElement)) {
      const alvo = focoInicial ? folha.querySelector<HTMLElement>(focoInicial) : null;
      (alvo ?? focaveisEm(folha)[0])?.focus();
    }
    return () => {
      liberar();
      ref.current?.style.removeProperty('--arraste');
      if (gatilho?.isConnected) gatilho.focus();
    };
  }, [aberta, focoInicial]);

  const aoPressionar = useCallback((evento: PointerEvent<HTMLElement>) => {
    const alvo = evento.target as Element;
    // Controles do topo (botões e o segmentado) recebem o toque; capturar o ponteiro perderia o clique.
    if (!alvo.closest('[data-arraste]') || alvo.closest('button, label')) return;
    if (window.matchMedia?.(LARGURA_PC).matches) return;
    arrasto.current = { inicio: evento.clientY, deslocamento: 0 };
    evento.currentTarget.setPointerCapture?.(evento.pointerId);
    evento.currentTarget.dataset.arrastando = '';
  }, []);

  const aoMover = useCallback((evento: PointerEvent<HTMLElement>) => {
    const atual = arrasto.current;
    if (!atual) return;
    atual.deslocamento = Math.max(0, evento.clientY - atual.inicio);
    evento.currentTarget.style.setProperty('--arraste', `${atual.deslocamento}px`);
  }, []);

  const aoSoltar = useCallback(
    (evento: PointerEvent<HTMLElement>) => {
      const atual = arrasto.current;
      if (!atual) return;
      arrasto.current = null;
      delete evento.currentTarget.dataset.arrastando;
      if (atual.deslocamento > LIMIAR_FECHAR_PX) aoFechar();
      else evento.currentTarget.style.removeProperty('--arraste');
    },
    [aoFechar],
  );

  if (!aberta && !montadaOculta) return null;

  return (
    <div hidden={!aberta}>
      <Veu />
      <section
        ref={ref}
        hidden={!aberta}
        className={styles.folha}
        role="dialog"
        aria-modal="true"
        aria-busy={ocupada || undefined}
        aria-labelledby={idTitulo}
        onPointerDown={aoPressionar}
        onPointerMove={aoMover}
        onPointerUp={aoSoltar}
        onPointerCancel={aoSoltar}
      >
        <div className={`${styles.alca} ${styles.zonaArraste}`} data-arraste aria-hidden="true" />
        <div className={`${styles.topo} ${styles.zonaArraste}`} data-arraste>
          <h2 id={idTitulo} className={tituloOculto ? 'visualmente-oculto' : styles.titulo}>
            {titulo}
          </h2>
          {topo}
          <BotaoIcone icone="fechar" rotulo="Fechar" onClick={aoFechar} />
        </div>
        <div className={styles.corpo}>{children}</div>
        {rodape ? <div className={styles.rodape}>{rodape}</div> : null}
      </section>
    </div>
  );
}
