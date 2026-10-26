import estilos from './ValorDestaque.module.css';

/** Selo ao lado de um valor: "parcial" num total que ainda não fechou o mês, ou o texto dado. */
export function RotuloParcial({ children = 'parcial' }: { children?: string }) {
  return <span className={estilos['rotulo-parcial']}>{children}</span>;
}
