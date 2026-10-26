import type { ReactNode } from 'react';
import { Botao } from '../base/Botao';
import { Folha } from '../base/Folha';
import { Icone } from '../base/Icone';
import passos from '../base/Passos.module.css';
import estilos from './FolhaInstalar.module.css';

interface Props {
  aberta: boolean;
  plataforma: 'ios' | 'android';
  /** Android com o prompt nativo guardado: a folha oferece o botão que o chama. */
  temPrompt: boolean;
  aoInstalar: () => void;
  aoFechar: () => void;
}

const BENEFICIO = 'Com o app na tela de início, ele abre em tela cheia e o lançamento fica a um toque.';

const PASSOS_IOS: ReactNode[] = [
  <>
    No Safari, toque em <strong>Compartilhar</strong>{' '}
    <Icone nome="compartilhar" className={estilos['icone-passo']} rotulo="(ícone de quadrado com seta para cima)" />
  </>,
  <>
    Escolha <strong>Adicionar à Tela de Início</strong>{' '}
    <Icone nome="adicionar" className={estilos['icone-passo']} rotulo="(ícone de quadrado com sinal de mais)" />
  </>,
  <>
    Toque em <strong>Adicionar</strong>. O ícone &quot;Controle em Casa&quot; aparece na tela de início.
  </>,
];

const PASSOS_ANDROID: ReactNode[] = [
  <>
    No Chrome, toque em <strong>⋮ Mais</strong>
  </>,
  <>
    Escolha <strong>Instalar app</strong>
  </>,
  <>
    Toque em <strong>Instalar</strong>. O ícone &quot;Controle em Casa&quot; aparece na tela de início.
  </>,
];

function ListaPassos({ itens }: { itens: ReactNode[] }) {
  return (
    <ol className={passos.passos}>
      {itens.map((item, i) => (
        <li key={i}>
          <span className={passos['passo-num']} aria-hidden="true">
            {i + 1}
          </span>
          <span>{item}</span>
        </li>
      ))}
    </ol>
  );
}

/** Instruções de instalação: passos manuais no iOS (e no Android sem prompt), botão nativo no Android com prompt. */
export function FolhaInstalar({ aberta, plataforma, temPrompt, aoInstalar, aoFechar }: Props) {
  const ios = plataforma === 'ios';
  const comPrompt = !ios && temPrompt;
  return (
    <Folha
      aberta={aberta}
      aoFechar={aoFechar}
      titulo={ios ? 'Instalar no iPhone' : 'Instalar no Android'}
      rodape={
        <div className={estilos.rodape}>
          {comPrompt ? (
            <Botao variante="principal" bloco onClick={aoInstalar}>
              Instalar
            </Botao>
          ) : null}
          <Botao variante="secundario" bloco onClick={aoFechar}>
            Agora não
          </Botao>
        </div>
      }
    >
      <p className="texto-2">{BENEFICIO}</p>
      {comPrompt ? null : <ListaPassos itens={ios ? PASSOS_IOS : PASSOS_ANDROID} />}
    </Folha>
  );
}
