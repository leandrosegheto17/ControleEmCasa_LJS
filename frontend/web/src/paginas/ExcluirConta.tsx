import { useState, type FormEvent } from 'react';
import { AvisoErroTopo } from '../componentes/base/AvisoErroTopo';
import { Botao } from '../componentes/base/Botao';
import { CabecalhoPagina } from '../componentes/base/CabecalhoPagina';
import { CampoSenha } from '../componentes/base/CampoSenha';
import { Nota } from '../componentes/base/Nota';
import { usePedirExclusao } from '../ganchos/useExclusaoConta';
import { useSessao } from '../ganchos/useSessao';
import { AVISO_CONVIDADO, AVISO_TITULAR, PASSOS_DA_EXCLUSAO, textoErroExclusao } from '../rotulos/conta';
import estilo from './ExcluirConta.module.css';

/**
 * Conta (SDD 9.3, `/app/ajustes/conta`): excluir a própria conta (RN-26). O pedido exige a senha e a rede; a exclusão só
 * vale quando o link do e-mail é confirmado (CA-26.1). A senha fica só na memória desta tela.
 */
export function ExcluirConta() {
  const estado = useSessao();
  const sessao = estado.situacao === 'ativa' ? estado.sessao : null;
  const pedir = usePedirExclusao();
  const [senha, setSenha] = useState('');
  const [faltaSenha, setFaltaSenha] = useState(false);

  function enviar(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (pedir.isPending) return;
    if (senha === '') {
      setFaltaSenha(true);
      return;
    }
    setFaltaSenha(false);
    pedir.mutate(senha, { onSettled: () => setSenha('') });
  }

  const erro = pedir.error;
  const senhaIncorreta = erro?.tipo === 'regra' && erro.codigo === 'credenciais_invalidas';
  const papel = sessao?.membro?.papel;

  return (
    <>
      <CabecalhoPagina titulo="Conta" voltarPara="/app/ajustes" rotuloVoltar="Voltar para Ajustes" />
      <main>
        {sessao ? (
          <p className="texto-2 pequeno">
            {sessao.usuario.nome} · {sessao.usuario.email}
          </p>
        ) : null}
        <section className={estilo.secao} aria-labelledby="titulo-exclusao">
          <h2 id="titulo-exclusao" className={estilo.titulo}>
            Excluir minha conta
          </h2>
          <ol className={estilo.passos}>
            {PASSOS_DA_EXCLUSAO.map((passo) => (
              <li key={passo}>{passo}</li>
            ))}
          </ol>
          {papel === 'titular' ? <Nota icone>{AVISO_TITULAR}</Nota> : null}
          {papel === 'membro' ? <Nota icone>{AVISO_CONVIDADO}</Nota> : null}
          {pedir.isSuccess ? (
            <>
              <Nota icone>
                {`Enviamos o link para ${sessao?.usuario.email ?? 'o seu e-mail'}. Abra-o em até 30 minutos para confirmar. Até lá, nada foi excluído.`}
              </Nota>
              <Botao variante="secundario" onClick={() => pedir.reset()}>
                Pedir outro link
              </Botao>
            </>
          ) : (
            <form className={estilo.formulario} aria-label="Pedir a exclusão da conta" onSubmit={enviar} noValidate>
              {erro && !senhaIncorreta ? <AvisoErroTopo>{textoErroExclusao(erro)}</AvisoErroTopo> : null}
              <CampoSenha
                rotulo="Sua senha atual"
                ajuda="Pedimos a senha para ter certeza de que é você."
                autoComplete="current-password"
                value={senha}
                onChange={(e) => {
                  setSenha(e.target.value);
                  setFaltaSenha(false);
                }}
                erro={faltaSenha ? 'Informe a senha.' : senhaIncorreta ? textoErroExclusao(erro) : undefined}
              />
              <Botao variante="perigo" tipo="submit" icone="lixo" salvando={pedir.isPending} rotuloOcupado="Enviando…">
                Enviar link de exclusão
              </Botao>
            </form>
          )}
        </section>
      </main>
    </>
  );
}
