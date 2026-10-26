import type { ReactNode } from 'react';
import { Link } from 'react-router';
import { linkEnvios } from '../../formatacao/linksApp';
import { Faixa } from '../base/Faixa';
import estilos from './FaixasInicio.module.css';

interface Props {
  mes: string;
  conectado: boolean;
  pendentes: number;
  /** Faixa de instalar, montada por quem conhece o estado de instalação. */
  faixaInstalar?: ReactNode;
}

const textoPendentes = (n: number) =>
  n === 1
    ? '1 lançamento aguardando envio. Ele fica guardado no aparelho.'
    : `${n} lançamentos aguardando envio. Eles ficam guardados no aparelho.`;

export function FaixasInicio({ mes, conectado, pendentes, faixaInstalar }: Props) {
  return (
    <>
      {conectado ? null : <Faixa variante="offline" />}
      {pendentes > 0 ? (
        <Faixa
          variante="pendentes"
          acoes={
            <Link to={linkEnvios(mes)} className={estilos.ver}>
              Ver
            </Link>
          }
        >
          {textoPendentes(pendentes)}
        </Faixa>
      ) : null}
      {faixaInstalar}
    </>
  );
}
