import { useRef, useState } from 'react';
import type { ErroDados } from '../comum/erros';
import { TEXTO_SEM_CONEXAO, TEXTO_SERVIDOR_INDISPONIVEL } from '../rotulos/textosConexao';
import { ROTULO_ERRO } from '../rotulos/erros';
import { AvisoErroTopo } from './base/AvisoErroTopo';
import { Botao } from './base/Botao';
import { CampoTexto } from './base/CampoTexto';
import { Nota } from './base/Nota';

const EMAIL_VALIDO = /^\S+@\S+\.\S+$/;

interface Props {
  aoReenviar: (email: string) => void;
  ocupado: boolean;
  enviado: boolean;
  erro: ErroDados | null;
  /** E-mail já informado antes (ex.: no cadastro); o campo começa com ele. */
  emailInicial?: string;
}

function textoDoErro(erro: ErroDados): string {
  if (erro.tipo === 'rede') return TEXTO_SEM_CONEXAO;
  if (erro.tipo === 'regra' && (erro.codigo === 'muitas_requisicoes' || erro.codigo === 'muitas_tentativas')) {
    return ROTULO_ERRO[erro.codigo].texto;
  }
  return TEXTO_SERVIDOR_INDISPONIVEL;
}

/** Reenvio do e-mail de confirmação. A mensagem de sucesso é a mesma para qualquer e-mail (G-19). */
export function FormularioReenviar({ aoReenviar, ocupado, enviado, erro, emailInicial = '' }: Props) {
  const [email, setEmail] = useState(emailInicial);
  const [erroEmail, setErroEmail] = useState<string | undefined>();
  const campo = useRef<HTMLInputElement>(null);

  function reenviar() {
    if (ocupado) return;
    if (!EMAIL_VALIDO.test(email.trim())) {
      setErroEmail('Informe seu e-mail para receber o link.');
      campo.current?.focus();
      return;
    }
    setErroEmail(undefined);
    aoReenviar(email.trim());
  }

  return (
    <>
      {erro ? <AvisoErroTopo>{textoDoErro(erro)}</AvisoErroTopo> : null}
      <CampoTexto
        ref={campo}
        rotulo="E-mail"
        type="email"
        autoComplete="username"
        inputMode="email"
        value={email}
        onChange={(e) => {
          setEmail(e.target.value);
          setErroEmail(undefined);
        }}
        erro={erroEmail}
      />
      <Botao variante="secundario" bloco salvando={ocupado} rotuloOcupado="Enviando…" onClick={reenviar}>
        Reenviar link de confirmação
      </Botao>
      {enviado && !erro ? <Nota>Se o e-mail tiver um cadastro pendente, você vai receber um novo link.</Nota> : null}
    </>
  );
}
