import { useEffect, useRef, type KeyboardEvent, type MouseEvent, type FocusEvent } from 'react';
import { GrupoChips } from './GrupoChips';
import estilos from './BotaoForma.module.css';

export interface OpcaoForma {
  id: string;
  nome: string;
  /** Texto secundário ao lado do nome (ex.: o tipo da forma); a conta não tem. */
  detalhe?: string;
}

interface Props {
  id: string;
  nome: string;
  rotulo: string;
  opcoes: OpcaoForma[];
  valor: string;
  aoEscolher: (id: string) => void;
  /** Fecha a lista; `devolverFoco` é falso quando o foco já saiu para outro controle. */
  aoFechar: (devolverFoco: boolean) => void;
}

/** Lista inline das opções (radiogroup). A escolha, mesmo da opção já marcada, escolhe e fecha. */
export function ListaFormas({ id, nome, rotulo, opcoes, valor, aoEscolher, aoFechar }: Props) {
  const raiz = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const marcada = raiz.current?.querySelector<HTMLInputElement>('input[type="radio"]:checked');
    (marcada ?? raiz.current?.querySelector<HTMLInputElement>('input[type="radio"]'))?.focus();
  }, []);

  function escolher(idEscolhido: string) {
    aoEscolher(idEscolhido);
    aoFechar(true);
  }

  function aoClicar(e: MouseEvent<HTMLDivElement>) {
    const alvo = e.target as HTMLElement;
    if (alvo instanceof HTMLInputElement && alvo.type === 'radio') escolher(alvo.value);
  }

  function aoTeclar(e: KeyboardEvent<HTMLDivElement>) {
    if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      aoFechar(true);
    } else if (e.key === 'Enter') {
      const alvo = e.target as HTMLElement;
      if (alvo instanceof HTMLInputElement && alvo.type === 'radio') {
        e.preventDefault();
        escolher(alvo.value);
      }
    }
  }

  // O rótulo não é focável: sem isto o mousedown tira o foco da lista e ela fecha antes do click.
  function aoPressionar(e: MouseEvent<HTMLDivElement>) {
    e.preventDefault();
  }

  function aoPerderFoco(e: FocusEvent<HTMLDivElement>) {
    const destino = e.relatedTarget as Node | null;
    if (destino && raiz.current?.contains(destino)) return;
    // Para o botão, quem decide é o clique dele (alterna); para fora, fecha sem puxar o foco de volta.
    if (destino && destino === document.querySelector(`[aria-controls="${id}"]`)) return;
    aoFechar(false);
  }

  return (
    <div
      id={id}
      ref={raiz}
      className={estilos.lista}
      onMouseDown={aoPressionar}
      onClick={aoClicar}
      onKeyDown={aoTeclar}
      onBlur={aoPerderFoco}
    >
      <GrupoChips
        nome={nome}
        rotulo={rotulo}
        variante="linha"
        valor={valor}
        aoMudar={() => {}}
        opcoes={opcoes.map((o) => ({
          valor: o.id,
          conteudo: (
            <>
              {o.nome}
              {o.detalhe ? (
                <>
                  {' '}
                  <span className={estilos.tipo}>· {o.detalhe}</span>
                </>
              ) : null}
            </>
          ),
        }))}
      />
    </div>
  );
}
