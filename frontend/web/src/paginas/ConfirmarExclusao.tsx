import { CartaoAcesso } from '../componentes/CartaoAcesso';
import { AvisoErroTopo } from '../componentes/base/AvisoErroTopo';
import { Botao } from '../componentes/base/Botao';
import { BotaoLink } from '../componentes/base/BotaoLink';
import { LinkMais } from '../componentes/base/LinkMais';
import { Nota } from '../componentes/base/Nota';
import { PRAZO_PURGA_DIAS } from '../comum/conta';
import { useConfirmarExclusao } from '../ganchos/useExclusaoConta';
import { useTokenDoLink } from '../ganchos/useTokenDoLink';
import { textoErroConfirmacao } from '../rotulos/conta';

const PEDIR_DE_NOVO = '/app/ajustes/conta';

/**
 * Página do link de exclusão (RN-26; CA-26.2, CA-26.9): o token vem em `#t=` e sai do endereço ao ser lido. Nada é
 * enviado ao abrir: a exclusão só acontece quando a pessoa confirma de forma explícita.
 */
export function ConfirmarExclusao() {
  const token = useTokenDoLink();
  const confirmar = useConfirmarExclusao();

  if (confirmar.isSuccess) {
    return (
      <CartaoAcesso titulo="Conta excluída" aoEnviar={() => undefined}>
        <Nota icone>
          {`Pronto. Sua conta foi marcada para exclusão e todas as sessões foram encerradas. Em ${PRAZO_PURGA_DIAS} dias os seus dados serão apagados. Até lá você não consegue entrar.`}
        </Nota>
        <BotaoLink para="/" variante="principal">
          Ir para a página inicial
        </BotaoLink>
      </CartaoAcesso>
    );
  }

  const erro = confirmar.error;
  const semConexao = erro?.tipo === 'rede';
  const linkVencido = erro?.tipo === 'regra' && erro.codigo === 'link_expirado';

  if (token === undefined || linkVencido) {
    return (
      <CartaoAcesso titulo="Link inválido" aoEnviar={() => undefined}>
        <AvisoErroTopo>
          {token === undefined
            ? 'Este link está incompleto. Abra o link do e-mail de novo ou peça um novo.'
            : textoErroConfirmacao(erro!)}
        </AvisoErroTopo>
        <BotaoLink para={PEDIR_DE_NOVO} variante="principal">
          Pedir um novo link
        </BotaoLink>
        <LinkMais centralizado para="/">
          Voltar para a página inicial
        </LinkMais>
      </CartaoAcesso>
    );
  }

  function enviar() {
    if (token !== undefined && !confirmar.isPending) confirmar.mutate(token);
  }

  return (
    <CartaoAcesso titulo="Excluir minha conta" aoEnviar={enviar} ocupado={confirmar.isPending}>
      {erro ? <AvisoErroTopo>{textoErroConfirmacao(erro)}</AvisoErroTopo> : null}
      <Nota icone>
        {`Ao confirmar, a conta fica bloqueada por ${PRAZO_PURGA_DIAS} dias e depois tudo é apagado. Isso não pode ser desfeito.`}
      </Nota>
      <Botao variante="perigo" bloco tipo="submit" salvando={confirmar.isPending} rotuloOcupado="Excluindo…">
        {semConexao ? 'Tentar de novo' : 'Sim, excluir minha conta'}
      </Botao>
      <LinkMais centralizado para="/">
        Não, manter minha conta
      </LinkMais>
    </CartaoAcesso>
  );
}
