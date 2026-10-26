import type { FocusEventHandler, PointerEventHandler } from 'react';
import { Icone, type NomeIcone } from './Icone';
import estilos from './Aviso.module.css';

export type TipoAviso = 'sucesso' | 'guardado' | 'erro';

const ICONE: Record<TipoAviso, NomeIcone> = { sucesso: 'ok', guardado: 'envio', erro: 'alerta' };

interface Props {
  tipo: TipoAviso;
  mensagem: string;
  onFocus?: FocusEventHandler<HTMLDivElement>;
  onBlur?: FocusEventHandler<HTMLDivElement>;
  onPointerEnter?: PointerEventHandler<HTMLDivElement>;
  onPointerLeave?: PointerEventHandler<HTMLDivElement>;
}

/** Toast: a mensagem é sempre texto. O foco (tabIndex 0) permite parar a contagem do tempo. */
export function Aviso({ tipo, mensagem, ...eventos }: Props) {
  return (
    <div className={estilos.aviso} tabIndex={0} {...eventos}>
      <Icone nome={ICONE[tipo]} />
      <span>{mensagem}</span>
    </div>
  );
}
