import { useState, type InputHTMLAttributes, type Ref } from 'react';
import { BotaoIcone } from './BotaoIcone';
import { Campo, type PropsCampoBase } from './Campo';
import campo from './Campo.module.css';
import estilo from './CampoSenha.module.css';

type Props = PropsCampoBase &
  Omit<InputHTMLAttributes<HTMLInputElement>, 'disabled' | 'className' | 'type'> & {
    ref?: Ref<HTMLInputElement>;
  };

/** Campo de senha oculta por padrão, com botão de mostrar/ocultar (`aria-pressed`). */
export function CampoSenha({ rotulo, ajuda, erro, desabilitado, id, ref, ...resto }: Props) {
  const [visivel, setVisivel] = useState(false);
  return (
    <Campo rotulo={rotulo} ajuda={ajuda} erro={erro} id={id}>
      {(ligacao) => (
        <div className={estilo.linha}>
          <input
            {...resto}
            {...ligacao}
            ref={ref}
            type={visivel ? 'text' : 'password'}
            disabled={desabilitado}
            className={campo.entrada}
          />
          <BotaoIcone
            icone="olho"
            rotulo={visivel ? 'Ocultar senha' : 'Mostrar senha'}
            aria-pressed={visivel}
            className={estilo.alternar}
            onClick={() => setVisivel((v) => !v)}
          />
        </div>
      )}
    </Campo>
  );
}
