import type { ReactNode } from 'react';
import { BotaoIcone } from './BotaoIcone';
import estilo from './CabecalhoPagina.module.css';

interface Props {
  titulo: string;
  /** Destino do botão de voltar e seu nome acessível ("Voltar para Início"). */
  voltarPara: string;
  rotuloVoltar: string;
  /** Slot à direita do título (ação da tela). */
  acao?: ReactNode;
}

export function CabecalhoPagina({ titulo, voltarPara, rotuloVoltar, acao }: Props) {
  return (
    <header className={estilo.cabecalho}>
      <BotaoIcone icone="esq" rotulo={rotuloVoltar} para={voltarPara} />
      <h1 className={estilo.titulo}>{titulo}</h1>
      {acao ?? <span />}
    </header>
  );
}
