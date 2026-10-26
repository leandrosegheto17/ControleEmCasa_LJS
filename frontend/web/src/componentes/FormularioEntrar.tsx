import { useRef, useState, type FormEvent } from 'react';
import type { ErroDados } from '../comum/erros';
import { AvisoErroTopo } from './base/AvisoErroTopo';
import { Botao } from './base/Botao';
import { CampoSenha } from './base/CampoSenha';
import { CampoTexto } from './base/CampoTexto';
import { LinkMais } from './base/LinkMais';
import { CartaoAcesso } from './CartaoAcesso';
import { textoErroEntrar } from './textoErroEntrar';

interface Props {
  /** Rejeita quando a entrada falha; o formulário então limpa a senha. */
  aoEntrar: (email: string, senha: string) => Promise<unknown>;
  aoEsqueci: (email: string) => void;
  ocupado: boolean;
  erro: ErroDados | null;
}

const EMAIL_VALIDO = /^\S+@\S+\.\S+$/;

export function FormularioEntrar({ aoEntrar, aoEsqueci, ocupado, erro }: Props) {
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [erroEmail, setErroEmail] = useState<string | undefined>();
  const campoEmail = useRef<HTMLInputElement>(null);

  function enviar() {
    if (ocupado) return;
    setErroEmail(undefined);
    aoEntrar(email, senha).catch(() => setSenha(''));
  }

  function esqueci() {
    const informado = email.trim();
    if (!EMAIL_VALIDO.test(informado)) {
      setErroEmail('Informe seu e-mail para receber o link.');
      campoEmail.current?.focus();
      return;
    }
    setErroEmail(undefined);
    aoEsqueci(informado);
  }

  const aoDigitarEmail = (e: FormEvent<HTMLInputElement>) => {
    setEmail(e.currentTarget.value);
    setErroEmail(undefined);
  };

  return (
    <CartaoAcesso titulo="Entrar" aoEnviar={enviar} ocupado={ocupado}>
      {erro ? <AvisoErroTopo>{textoErroEntrar(erro)}</AvisoErroTopo> : null}
      <CampoTexto
        ref={campoEmail}
        rotulo="E-mail"
        type="email"
        autoComplete="username"
        inputMode="email"
        value={email}
        onChange={aoDigitarEmail}
        erro={erroEmail}
      />
      <CampoSenha
        rotulo="Senha"
        autoComplete="current-password"
        value={senha}
        onChange={(e) => setSenha(e.target.value)}
      />
      <Botao variante="principal" bloco tipo="submit" salvando={ocupado} rotuloOcupado="Entrando…">
        Entrar
      </Botao>
      <LinkMais centralizado aoClicar={esqueci}>
        Esqueci minha senha
      </LinkMais>
    </CartaoAcesso>
  );
}
