import { useId, useState, type FormEvent } from 'react';
import { AvisoErroTopo } from '../base/AvisoErroTopo';
import { Botao } from '../base/Botao';
import { CampoTexto } from '../base/CampoTexto';
import estilo from './FormularioConvite.module.css';

interface Props {
  salvando: boolean;
  /** Erro do envio inteiro (lar cheio, convite pendente, rede), no topo do formulário. */
  erro?: string;
  /** Erro do campo vindo do servidor (e-mail recusado). */
  erroEmail?: string;
  /** Qualquer edição do campo: o erro do servidor deixa de valer. */
  aoEditar: () => void;
  aoEnviar: (email: string) => void;
}

const FORMATO = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Convite do segundo membro por e-mail (RN-23). O titular não pode convidar o próprio e-mail. */
export function FormularioConvite({ salvando, erro, erroEmail, aoEditar, aoEnviar }: Props) {
  const idTitulo = useId();
  const [email, setEmail] = useState('');
  const [erroLocal, setErroLocal] = useState<string | undefined>();

  function enviar(evento: FormEvent) {
    evento.preventDefault();
    const limpo = email.trim();
    if (!FORMATO.test(limpo)) {
      setErroLocal('Informe um e-mail válido.');
      return;
    }
    aoEnviar(limpo);
  }

  return (
    <section aria-labelledby={idTitulo}>
      <h2 id={idTitulo}>Convidar a segunda pessoa</h2>
      <form className={estilo.formulario} onSubmit={enviar} noValidate>
        {erro ? <AvisoErroTopo>{erro}</AvisoErroTopo> : null}
        <CampoTexto
          id="email-convite"
          rotulo="E-mail de quem vai participar"
          type="email"
          inputMode="email"
          autoComplete="off"
          value={email}
          onChange={(e) => {
            setEmail(e.target.value);
            setErroLocal(undefined);
            aoEditar();
          }}
          ajuda="Enviamos um link, válido por 7 dias. Só quem usar esse e-mail consegue aceitar."
          erro={erroLocal ?? erroEmail}
        />
        <Botao variante="principal" tipo="submit" salvando={salvando} rotuloOcupado="Enviando…">
          Enviar convite
        </Botao>
      </form>
    </section>
  );
}
