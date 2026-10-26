import { useEffect, useRef } from 'react';
import { CartaoAcesso } from '../componentes/CartaoAcesso';
import { FormularioReenviar } from '../componentes/FormularioReenviar';
import { AvisoErroTopo } from '../componentes/base/AvisoErroTopo';
import { LinkMais } from '../componentes/base/LinkMais';
import { Nota } from '../componentes/base/Nota';
import { useConfirmar } from '../ganchos/useConfirmar';
import { useReenviar } from '../ganchos/useReenviar';
import { useTokenDoLink } from '../ganchos/useTokenDoLink';
import { TEXTO_SEM_CONEXAO, TEXTO_SERVIDOR_INDISPONIVEL } from '../rotulos/textosConexao';

const LINK_EXPIRADO = 'Este link expirou ou já foi usado. Peça um novo abaixo.';

/** Página do link de confirmação: o token vem em `#t=`, sai do endereço e é enviado uma única vez. */
export function Confirmar() {
  const token = useTokenDoLink();
  const confirmar = useConfirmar();
  const reenviar = useReenviar();
  const enviado = useRef(false);

  useEffect(() => {
    if (token && !enviado.current) {
      enviado.current = true;
      confirmar.mutate(token);
    }
    // Uma única confirmação por abertura do link (o StrictMode roda o efeito duas vezes).
  }, [token]);

  const semToken = token === undefined;
  const erro = confirmar.error;
  const linkExpirado = semToken || (erro?.tipo === 'regra' && erro.codigo === 'link_expirado');
  const semConexao = erro?.tipo === 'rede';

  if (confirmar.isSuccess) {
    return (
      <CartaoAcesso titulo="E-mail confirmado" aoEnviar={() => undefined}>
        <Nota icone>Sua conta está ativa. Agora é só entrar.</Nota>
        <LinkMais centralizado para="/entrar">
          Ir para Entrar
        </LinkMais>
      </CartaoAcesso>
    );
  }

  return (
    <CartaoAcesso titulo="Confirmar e-mail" aoEnviar={() => undefined} ocupado={confirmar.isPending}>
      {confirmar.isPending ? <Nota>Confirmando…</Nota> : null}
      {linkExpirado ? <AvisoErroTopo>{LINK_EXPIRADO}</AvisoErroTopo> : null}
      {semConexao ? <AvisoErroTopo>{TEXTO_SEM_CONEXAO}</AvisoErroTopo> : null}
      {erro && !linkExpirado && !semConexao ? (
        <AvisoErroTopo>
          {erro.tipo === 'indisponivel' ? TEXTO_SERVIDOR_INDISPONIVEL : 'Não foi possível confirmar.'}
        </AvisoErroTopo>
      ) : null}
      {linkExpirado ? (
        <FormularioReenviar
          aoReenviar={(e) => reenviar.mutate(e)}
          ocupado={reenviar.isPending}
          enviado={reenviar.isSuccess}
          erro={reenviar.error}
        />
      ) : null}
      <LinkMais centralizado para="/entrar">
        Voltar para Entrar
      </LinkMais>
    </CartaoAcesso>
  );
}
