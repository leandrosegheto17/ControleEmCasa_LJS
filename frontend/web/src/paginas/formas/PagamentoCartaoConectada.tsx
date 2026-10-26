import type { SaidaLinhaFormasPagamento as LinhaFormasPagamento } from '@controle/contrato';
import { useEffect, useState } from 'react';
import { useAviso } from '../../componentes/base/useAviso';
import { FolhaPagamentoCartao, type DadosPagamento } from '../../componentes/formas/FolhaPagamentoCartao';
import type { ErroDados } from '../../comum/erros';
import { hojeEmSaoPaulo } from '../../formatacao/data';
import { useContas } from '../../ganchos/useContas';
import { useComandosForma } from '../../ganchos/useFormasPagamento';
import { useParametroDaFolha } from '../../ganchos/useParametroDaFolha';
import { mensagemErro } from '../../rotulos/mensagensErro';

const PARAMETRO = 'pagamento';

/** Abre a folha para `?pagamento=1` num cartão de crédito; qualquer outro caso retira o parâmetro da URL. */
export function PagamentoCartaoConectada({ forma }: { forma: LinhaFormasPagamento }) {
  const [bruto, definirParametro] = useParametroDaFolha(PARAMETRO);
  const aberta = bruto === '1' && forma.tipo === 'credito';
  const removerParametro = () => definirParametro(null);

  useEffect(() => {
    if (bruto !== null && !aberta) removerParametro();
  }, [bruto, aberta]);

  if (!aberta) return null;
  return <PagamentoAberto key={forma.id} forma={forma} aoFechar={removerParametro} />;
}

interface PropsAberto {
  forma: LinhaFormasPagamento;
  aoFechar: () => void;
}

function PagamentoAberto({ forma, aoFechar }: PropsAberto) {
  const contas = useContas().data;
  const { registrarPagamentoCartao } = useComandosForma();
  const { mostrar } = useAviso();
  const [id] = useState(() => crypto.randomUUID());
  const [dataInicial] = useState(() => hojeEmSaoPaulo());
  const [erro, definirErro] = useState<ErroDados | null>(null);

  if (!contas) return null;

  function confirmar(dados: DadosPagamento) {
    definirErro(null);
    registrarPagamentoCartao.mutate(
      { id, formaId: forma.id, ...dados },
      {
        onSuccess: () => {
          mostrar('sucesso', 'Pagamento registrado');
          aoFechar();
        },
        onError: definirErro,
      },
    );
  }

  return (
    <FolhaPagamentoCartao
      nomeCartao={forma.nome}
      diaVencimento={forma.dia_vencimento}
      contas={contas.filter((c) => !c.arquivada)}
      contaPadraoId={forma.conta?.id}
      dataInicial={dataInicial}
      erro={
        erro
          ? { texto: mensagemErro(erro), semConexao: erro.tipo === 'rede' || erro.tipo === 'indisponivel' }
          : undefined
      }
      salvando={registrarPagamentoCartao.isPending}
      aoConfirmar={confirmar}
      aoFechar={aoFechar}
    />
  );
}
