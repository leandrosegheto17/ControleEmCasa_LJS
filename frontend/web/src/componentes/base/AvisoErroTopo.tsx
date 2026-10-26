import type { ReactNode } from 'react';
import { Icone, type NomeIcone } from './Icone';
import estilo from './AvisoErroTopo.module.css';

/** Erro do envio inteiro, no topo do formulário; o texto entra como filho e é sempre texto puro. */
export function AvisoErroTopo({ children, icone = 'alerta' }: { children: ReactNode; icone?: NomeIcone }) {
  return (
    <p className={estilo['aviso-erro-topo']} role="alert">
      <Icone nome={icone} />
      {children}
    </p>
  );
}
