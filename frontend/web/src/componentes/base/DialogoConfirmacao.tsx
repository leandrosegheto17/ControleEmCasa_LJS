import { useId, useLayoutEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Botao } from './Botao';
import type { NomeIcone } from './Icone';
import { liberar, travar } from './travaRolagem';
import { useArmadilhaFoco } from './useArmadilhaFoco';
import { Veu } from './Veu';
import styles from './DialogoConfirmacao.module.css';

interface Props {
  aberto: boolean;
  /** Título e texto são exibidos exatamente como recebidos. */
  titulo: string;
  texto: string;
  rotuloConfirmar: string;
  variante: 'destrutiva' | 'neutra';
  iconeConfirmar?: NomeIcone;
  rotuloCancelar?: string;
  /** Ação em curso: confirmar fica inerte (com giro, mantendo o rótulo) e cancelar/Esc são desligados. */
  ocupado?: boolean;
  aoConfirmar: () => void;
  aoCancelar: () => void;
}

/**
 * Confirmação modal (`alertdialog`), aberta por cima de uma `Folha` se houver. Só o botão de confirmar
 * confirma: Esc, véu e foco inicial ficam do lado seguro (foco em "Cancelar", véu inerte).
 */
export function DialogoConfirmacao({
  aberto,
  titulo,
  texto,
  rotuloConfirmar,
  variante,
  iconeConfirmar,
  rotuloCancelar = 'Cancelar',
  ocupado = false,
  aoConfirmar,
  aoCancelar,
}: Props) {
  const idTitulo = useId();
  const idTexto = useId();
  const ref = useRef<HTMLElement>(null);
  const refCancelar = useRef<HTMLButtonElement>(null);

  useArmadilhaFoco(ref, aberto, () => {
    if (!ocupado) aoCancelar();
  });

  useLayoutEffect(() => {
    if (!aberto) return;
    const gatilho = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    travar();
    refCancelar.current?.focus();
    return () => {
      liberar();
      if (gatilho?.isConnected) gatilho.focus();
    };
  }, [aberto]);

  if (!aberto) return null;

  const destrutiva = variante === 'destrutiva';
  // Em portal, para não herdar a rolagem/recorte do corpo da folha e ficar fora do seu DOM de foco.
  return createPortal(
    <>
      <Veu variante="dialogo" />
      <section
        ref={ref}
        className={styles.dialogo}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby={idTitulo}
        aria-describedby={idTexto}
      >
        <h2 id={idTitulo} className={styles.titulo}>
          {titulo}
        </h2>
        <p id={idTexto} className={styles.texto}>
          {texto}
        </p>
        <div className={destrutiva ? styles.acoes : `${styles.acoes} ${styles.neutra}`}>
          <Botao ref={refCancelar} variante="secundario" disabled={ocupado} onClick={aoCancelar}>
            {rotuloCancelar}
          </Botao>
          <Botao
            variante={destrutiva ? 'perigo' : 'principal'}
            icone={iconeConfirmar}
            salvando={ocupado}
            rotuloOcupado={rotuloConfirmar}
            onClick={aoConfirmar}
          >
            {rotuloConfirmar}
          </Botao>
        </div>
      </section>
    </>,
    document.body,
  );
}
