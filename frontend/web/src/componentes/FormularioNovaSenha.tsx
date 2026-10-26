import { useState } from 'react';
import { flushSync } from 'react-dom';
import { AvisoErroTopo } from './base/AvisoErroTopo';
import { Botao } from './base/Botao';
import { CampoTexto } from './base/CampoTexto';
import { focarPrimeiroErro } from './base/focarPrimeiroErro';
import { LinkMais } from './base/LinkMais';
import { CartaoAcesso } from './CartaoAcesso';

interface Props {
  aoSalvar: (senha: string) => void;
  ocupado: boolean;
  /** Texto do erro do envio inteiro (link vencido, sem conexão…), mostrado acima dos campos. */
  erroTopo?: string;
  /** Erro de senha recusada pelo servidor, mostrado no campo da senha. */
  erroSenhaServidor?: string;
}

const TAMANHO_MINIMO = 12;
const REGRA = `Pelo menos ${TAMANHO_MINIMO} caracteres.`;
const ERRO_CURTA = `Use pelo menos ${TAMANHO_MINIMO} caracteres.`;
const ERRO_CONFERE = 'As senhas não conferem.';

interface Erros {
  senha?: string;
  confirma?: string;
}

export function FormularioNovaSenha({ aoSalvar, ocupado, erroTopo, erroSenhaServidor }: Props) {
  const [senha, setSenha] = useState('');
  const [confirma, setConfirma] = useState('');
  const [erros, setErros] = useState<Erros>({});

  function enviar(formulario: HTMLFormElement) {
    if (ocupado) return;
    const novos: Erros = {};
    if (senha.length < TAMANHO_MINIMO) novos.senha = ERRO_CURTA;
    if (confirma !== senha) novos.confirma = ERRO_CONFERE;
    // Síncrono: o aria-invalid precisa estar no DOM antes de focar.
    flushSync(() => setErros(novos));
    if (novos.senha || novos.confirma) {
      focarPrimeiroErro(formulario);
      return;
    }
    aoSalvar(senha);
  }

  const erroSenha = erros.senha ?? erroSenhaServidor;

  return (
    <CartaoAcesso titulo="Nova senha" nomeFormulario="Redefinir senha" aoEnviar={enviar} ocupado={ocupado}>
      {erroTopo ? <AvisoErroTopo>{erroTopo}</AvisoErroTopo> : null}
      <CampoTexto
        rotulo="Nova senha"
        type="password"
        autoComplete="new-password"
        value={senha}
        onChange={(e) => setSenha(e.target.value)}
        ajuda={erroSenha ? undefined : REGRA}
        erro={erroSenha}
      />
      <CampoTexto
        rotulo="Repita a nova senha"
        type="password"
        autoComplete="new-password"
        value={confirma}
        onChange={(e) => setConfirma(e.target.value)}
        erro={erros.confirma}
      />
      <Botao variante="principal" bloco tipo="submit" salvando={ocupado}>
        Salvar senha
      </Botao>
      <LinkMais centralizado para="/entrar">
        Voltar para Entrar
      </LinkMais>
    </CartaoAcesso>
  );
}
