import { useNavigate } from 'react-router';
import { CartaoAcesso } from '../componentes/CartaoAcesso';
import { AvisoErroTopo } from '../componentes/base/AvisoErroTopo';
import { Botao } from '../componentes/base/Botao';
import { LinkMais } from '../componentes/base/LinkMais';
import { Nota } from '../componentes/base/Nota';
import type { ErroDados } from '../comum/erros';
import { useAceitarConvite, useConviteAtual, useRecusarConvite } from '../ganchos/useLar';
import { useSessao } from '../ganchos/useSessao';
import { useTokenDoConvite } from '../ganchos/useTokenDoLink';
import { ROTULO_ERRO } from '../rotulos/erros';
import { TEXTO_SEM_CONEXAO, TEXTO_SERVIDOR_INDISPONIVEL } from '../rotulos/textosConexao';

const VOLTA = encodeURIComponent('/convite');

function textoDoErro(erro: ErroDados): string {
  if (erro.tipo === 'rede') return TEXTO_SEM_CONEXAO;
  if (erro.tipo === 'indisponivel') return TEXTO_SERVIDOR_INDISPONIVEL;
  if (erro.tipo === 'regra') return ROTULO_ERRO[erro.codigo].texto;
  return 'Não foi possível concluir. Tente de novo.';
}

/**
 * Convite por e-mail (RN-23). O token chega em `#t=`, sai do endereço e fica só na sessionStorage da aba até o aceite,
 * a recusa ou um convite inválido. Sem sessão, manda entrar ou cadastrar e volta para cá.
 */
export function Convite() {
  const { token, esquecer } = useTokenDoConvite();
  const sessao = useSessao();
  const navegar = useNavigate();
  const aceitar = useAceitarConvite();
  const recusar = useRecusarConvite();
  const logada = sessao.situacao === 'ativa';
  const convite = useConviteAtual(token, logada);

  function concluir() {
    esquecer();
    navegar('/app', { replace: true });
  }

  if (sessao.situacao === 'carregando') return null;

  if (!token) {
    return (
      <CartaoAcesso titulo="Convite" aoEnviar={() => undefined}>
        <AvisoErroTopo>{ROTULO_ERRO.convite_invalido.texto}</AvisoErroTopo>
        <LinkMais centralizado para="/entrar">
          Ir para Entrar
        </LinkMais>
      </CartaoAcesso>
    );
  }

  if (!logada) {
    return (
      <CartaoAcesso titulo="Convite" aoEnviar={() => undefined}>
        <Nota icone>Você recebeu um convite para participar de um lar. Entre ou crie sua conta para vê-lo.</Nota>
        <LinkMais centralizado para={`/entrar?volta=${VOLTA}`}>
          Entrar
        </LinkMais>
        <LinkMais centralizado para="/cadastro">
          Criar conta
        </LinkMais>
      </CartaoAcesso>
    );
  }

  const erro = aceitar.error ?? recusar.error ?? (convite.error as ErroDados | null);
  const invalido = erro?.tipo === 'regra' && erro.codigo === 'convite_invalido';
  const ocupado = aceitar.isPending || recusar.isPending;

  return (
    <CartaoAcesso titulo="Convite" aoEnviar={() => undefined} ocupado={ocupado}>
      {erro ? <AvisoErroTopo>{textoDoErro(erro)}</AvisoErroTopo> : null}
      {convite.data ? (
        <Nota>
          {convite.data.convidado_por_nome} convidou você para o lar “{convite.data.lar_nome}”.
        </Nota>
      ) : null}
      {convite.data ? (
        <>
          <Botao
            variante="principal"
            bloco
            salvando={aceitar.isPending}
            rotuloOcupado="Aceitando…"
            onClick={() => aceitar.mutate(token, { onSuccess: concluir })}
          >
            Aceitar convite
          </Botao>
          <Botao
            variante="secundario"
            bloco
            salvando={recusar.isPending}
            rotuloOcupado="Recusando…"
            onClick={() => recusar.mutate(token, { onSuccess: concluir })}
          >
            Recusar
          </Botao>
        </>
      ) : null}
      {invalido ? (
        <LinkMais centralizado aoClicar={concluir}>
          Seguir para o app
        </LinkMais>
      ) : null}
    </CartaoAcesso>
  );
}
