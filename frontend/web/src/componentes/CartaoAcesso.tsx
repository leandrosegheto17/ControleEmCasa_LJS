import { useId, type FormEvent, type ReactNode } from 'react';
import { Icone } from './base/Icone';
import estilo from './CartaoAcesso.module.css';

interface Props {
  titulo: string;
  /** Recebe o formulário, para quem precisa focar o primeiro campo com erro depois de renderizá-lo. */
  aoEnviar: (formulario: HTMLFormElement) => void;
  ocupado?: boolean;
  /** Nome do formulário quando o título repete o rótulo de um campo (senão o campo ficaria com dois alvos de rótulo). */
  nomeFormulario?: string;
  children: ReactNode;
}

/** Moldura das telas públicas de acesso: logo, título da página e o formulário. */
export function CartaoAcesso({ titulo, aoEnviar, ocupado, nomeFormulario, children }: Props) {
  const idTitulo = useId();

  function aoSubmeter(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    aoEnviar(e.currentTarget);
  }

  return (
    <main className={estilo['tela-entrar']}>
      <form
        className={estilo['cartao-entrar']}
        aria-label={nomeFormulario}
        aria-labelledby={nomeFormulario ? undefined : idTitulo}
        aria-busy={ocupado ? 'true' : undefined}
        onSubmit={aoSubmeter}
        noValidate
      >
        <p className={estilo.logo}>
          <Icone nome="casa" />
          Controle em Casa
        </p>
        <h1 id={idTitulo} className={estilo['titulo-pagina']}>
          {titulo}
        </h1>
        {children}
      </form>
    </main>
  );
}
