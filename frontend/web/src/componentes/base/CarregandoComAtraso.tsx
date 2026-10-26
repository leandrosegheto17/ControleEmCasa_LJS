import { useEffect, useState, type ReactNode } from 'react';

interface Props {
  /** Espera antes de mostrar o esqueleto; respostas rápidas não piscam (UX-SPEC §4). */
  atrasoMs?: number;
  /** Texto lido por leitor de tela enquanto o esqueleto aparece. */
  anuncio?: string;
  children: ReactNode;
}

export function CarregandoComAtraso({ atrasoMs = 300, anuncio = 'Carregando…', children }: Props) {
  const [visivel, setVisivel] = useState(false);

  useEffect(() => {
    const id = setTimeout(() => setVisivel(true), atrasoMs);
    return () => clearTimeout(id);
  }, [atrasoMs]);

  if (!visivel) return null;
  return (
    <>
      <p className="visualmente-oculto" role="status">
        {anuncio}
      </p>
      <div aria-hidden="true">{children}</div>
    </>
  );
}
