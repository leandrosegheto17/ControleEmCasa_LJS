import { FormularioEntrar } from '../componentes/FormularioEntrar';
import { useAviso } from '../componentes/base/useAviso';
import type { ErroDados } from '../comum/erros';
import { useEntrar } from '../ganchos/useEntrar';
import { usePedirRedefinicao } from '../ganchos/usePedirRedefinicao';
import { ROTULO_ERRO } from '../rotulos/erros';
import { TEXTO_SEM_CONEXAO, TEXTO_SERVIDOR_INDISPONIVEL } from '../rotulos/textosConexao';

const MENSAGEM_NEUTRA = 'Se o e-mail tiver cadastro, você vai receber um link.';

function textoDoPedidoDeLink(erro: ErroDados): string {
  if (erro.tipo === 'rede') return TEXTO_SEM_CONEXAO;
  if (erro.tipo === 'regra' && (erro.codigo === 'muitas_requisicoes' || erro.codigo === 'muitas_tentativas')) {
    return ROTULO_ERRO[erro.codigo].texto;
  }
  return TEXTO_SERVIDOR_INDISPONIVEL;
}

/** A guarda da rota leva a `/app` (ou ao `volta`) quando a sessão muda; a página só envia as credenciais. */
export function Entrar() {
  const entrar = useEntrar();
  const redefinicao = usePedirRedefinicao();
  const { mostrar } = useAviso();

  function pedirLink(email: string) {
    redefinicao.mutate(email, {
      onSuccess: () => mostrar('sucesso', MENSAGEM_NEUTRA),
      onError: (erro) => mostrar('erro', textoDoPedidoDeLink(erro)),
    });
  }

  return (
    <FormularioEntrar
      aoEntrar={(email, senha) => entrar.mutateAsync({ email, senha })}
      aoEsqueci={pedirLink}
      ocupado={entrar.isPending}
      erro={entrar.error}
    />
  );
}
