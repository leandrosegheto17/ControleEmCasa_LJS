import { useState } from 'react';
import { flushSync } from 'react-dom';
import { Link } from 'react-router';
import type { ErroDados } from '../comum/erros';
import { SENHA_MIN_CARACTERES, problemaDaSenha } from '../comum/senha';
import { ROTULO_ERRO } from '../rotulos/erros';
import { TEXTO_SEM_CONEXAO, TEXTO_SERVIDOR_INDISPONIVEL } from '../rotulos/textosConexao';
import { AvisoErroTopo } from './base/AvisoErroTopo';
import { Botao } from './base/Botao';
import { CampoSenha } from './base/CampoSenha';
import { CampoTexto } from './base/CampoTexto';
import { focarPrimeiroErro } from './base/focarPrimeiroErro';
import { LinkMais } from './base/LinkMais';
import { CartaoAcesso } from './CartaoAcesso';
import estiloAceite from './FormularioCadastro.module.css';

export interface DadosDoFormularioDeCadastro {
  nome: string;
  email: string;
  senha: string;
}

interface Props {
  aoEnviar: (dados: DadosDoFormularioDeCadastro) => void;
  ocupado: boolean;
  erro: ErroDados | null;
}

const EMAIL_VALIDO = /^\S+@\S+\.\S+$/;
const REGRA_SENHA = `Pelo menos ${SENHA_MIN_CARACTERES} caracteres.`;

interface Erros {
  nome?: string;
  email?: string;
  senha?: string;
  aceite?: string;
}

/** Texto do erro do envio inteiro; `senha_fraca` vai para o campo da senha, não para o topo. */
function textoErroTopo(erro: ErroDados | null): string | undefined {
  if (!erro || (erro.tipo === 'regra' && erro.codigo === 'senha_fraca')) return undefined;
  if (erro.tipo === 'rede') return TEXTO_SEM_CONEXAO;
  if (erro.tipo === 'indisponivel') return TEXTO_SERVIDOR_INDISPONIVEL;
  if (erro.tipo === 'regra' && (erro.codigo === 'muitas_requisicoes' || erro.codigo === 'origem_invalida')) {
    return ROTULO_ERRO[erro.codigo].texto;
  }
  return 'Não foi possível criar a conta. Confira os dados e tente de novo.';
}

export function FormularioCadastro({ aoEnviar, ocupado, erro }: Props) {
  const [nome, setNome] = useState('');
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [aceite, setAceite] = useState(false);
  const [erros, setErros] = useState<Erros>({});

  function enviar(formulario: HTMLFormElement) {
    if (ocupado) return;
    const novos: Erros = {};
    if (!nome.trim()) novos.nome = 'Informe seu nome.';
    if (!EMAIL_VALIDO.test(email.trim())) novos.email = 'Informe um e-mail válido.';
    const problema = problemaDaSenha(senha);
    if (problema === 'curta') novos.senha = `Use pelo menos ${SENHA_MIN_CARACTERES} caracteres.`;
    if (problema === 'longa') novos.senha = 'A senha é longa demais. Use uma menor.';
    if (!aceite) novos.aceite = 'Aceite os Termos de uso e a Política de privacidade para continuar.';
    flushSync(() => setErros(novos));
    if (Object.keys(novos).length > 0) {
      focarPrimeiroErro(formulario);
      return;
    }
    aoEnviar({ nome: nome.trim(), email: email.trim(), senha });
  }

  const senhaFraca = erro?.tipo === 'regra' && erro.codigo === 'senha_fraca';
  const erroSenha = erros.senha ?? (senhaFraca ? `Use pelo menos ${SENHA_MIN_CARACTERES} caracteres.` : undefined);
  const topo = textoErroTopo(erro);

  return (
    <CartaoAcesso titulo="Criar conta" aoEnviar={enviar} ocupado={ocupado}>
      {topo ? <AvisoErroTopo>{topo}</AvisoErroTopo> : null}
      <CampoTexto
        rotulo="Nome"
        autoComplete="name"
        value={nome}
        onChange={(e) => setNome(e.target.value)}
        erro={erros.nome}
      />
      <CampoTexto
        rotulo="E-mail"
        type="email"
        autoComplete="username"
        inputMode="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        erro={erros.email}
      />
      <CampoSenha
        rotulo="Senha"
        autoComplete="new-password"
        value={senha}
        onChange={(e) => setSenha(e.target.value)}
        ajuda={erroSenha ? undefined : REGRA_SENHA}
        erro={erroSenha}
      />
      <div className={estiloAceite.aceite}>
        <label>
          <input
            type="checkbox"
            checked={aceite}
            aria-invalid={erros.aceite ? 'true' : undefined}
            aria-describedby={erros.aceite ? 'erro-aceite' : undefined}
            onChange={(e) => setAceite(e.target.checked)}
          />{' '}
          Li e aceito os <Link to="/termos">Termos de uso</Link> e a{' '}
          <Link to="/privacidade">Política de privacidade</Link>.
        </label>
        {erros.aceite ? (
          <p id="erro-aceite" className={estiloAceite.erro}>
            {erros.aceite}
          </p>
        ) : null}
      </div>
      <Botao variante="principal" bloco tipo="submit" salvando={ocupado} rotuloOcupado="Criando…">
        Criar conta
      </Botao>
      <LinkMais centralizado para="/entrar">
        Já tenho conta
      </LinkMais>
    </CartaoAcesso>
  );
}
