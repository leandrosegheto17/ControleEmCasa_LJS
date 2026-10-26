import { useId, useRef, useState } from 'react';
import { Icone } from './Icone';
import { ListaFormas, type OpcaoForma } from './ListaFormas';
import estilos from './BotaoForma.module.css';

interface Props {
  rotulo: string;
  opcoes: OpcaoForma[];
  valor: string;
  aoEscolher: (id: string) => void;
  ajuda?: string;
  /** Base dos ids `<id>-rotulo` e `<id>-atual` (padrão `forma`, como no mockup). */
  id?: string;
}

/** Botão-chip com a forma (ou conta) atual; o toque abre a lista e a escolha fecha. */
export function BotaoForma({ rotulo, opcoes, valor, aoEscolher, ajuda, id = 'forma' }: Props) {
  if (opcoes.length === 0) throw new Error('BotaoForma exige ao menos uma opção.');
  const idLista = `${id}-lista`;
  const idAjuda = `${id}-ajuda`;
  const nome = useId();
  const botao = useRef<HTMLButtonElement>(null);
  const [aberta, setAberta] = useState(false);
  const atual = opcoes.find((o) => o.id === valor);

  function fechar(devolverFoco: boolean) {
    setAberta(false);
    if (devolverFoco) botao.current?.focus();
  }

  return (
    <div className={estilos.campo}>
      <span className={estilos.rotulo} id={`${id}-rotulo`}>
        {rotulo}
      </span>
      <button
        ref={botao}
        type="button"
        className={estilos.botao}
        aria-labelledby={`${id}-rotulo ${id}-atual`}
        aria-describedby={ajuda ? idAjuda : undefined}
        aria-expanded={aberta}
        aria-controls={aberta ? idLista : undefined}
        onClick={() => setAberta((a) => !a)}
      >
        <span id={`${id}-atual`}>
          {atual?.nome}
          {atual?.detalhe ? (
            <>
              {' '}
              <span className={estilos.tipo}>· {atual.detalhe}</span>
            </>
          ) : null}
        </span>
        <Icone nome="baixo" />
      </button>
      {aberta ? (
        <ListaFormas
          id={idLista}
          nome={nome}
          rotulo={rotulo}
          opcoes={opcoes}
          valor={valor}
          aoEscolher={aoEscolher}
          aoFechar={fechar}
        />
      ) : null}
      {ajuda ? (
        <p id={idAjuda} className={estilos.ajuda}>
          {ajuda}
        </p>
      ) : null}
    </div>
  );
}
