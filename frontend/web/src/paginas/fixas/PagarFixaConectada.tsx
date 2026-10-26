import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useState, type RefObject } from 'react';
import { useAviso } from '../../componentes/base/useAviso';
import type { Ocorrencia } from '../../componentes/fixas/CartaoOcorrencias';
import { FolhaPagarFixa } from '../../componentes/fixas/FolhaPagarFixa';
import { ehUuid } from '../../comum/uuid';
import type { ErroDados } from '../../comum/erros';
import { hojeEmSaoPaulo } from '../../formatacao/data';
import { formatarNomeMes } from '../../formatacao/mes';
import { CHAVES } from '../../ganchos/chavesConsulta';
import { useComandosFixas } from '../../ganchos/useComandosFixas';
import { useContexto } from '../../ganchos/useContexto';
import { useDadosLancamento } from '../../ganchos/useDadosLancamento';
import { useParametroDaFolha } from '../../ganchos/useParametroDaFolha';
import { ROTULO_ERRO } from '../../rotulos/erros';
import { mensagemErro } from '../../rotulos/mensagensErro';

const SEM_CONEXAO =
  'Sem conexão. O pagamento não foi registrado. Seus dados continuam aqui: tente de novo quando a rede voltar.';

interface Props {
  mes: string;
  ocorrencias: readonly Ocorrencia[];
  /** Recebe o foco quando o pagamento é registrado. */
  tituloCartao: RefObject<HTMLHeadingElement | null>;
}

const DATA_FORA_DO_PERIODO = 'Data fora do período permitido';

/** No pagamento, `valor_invalido` vem da data fora do período (o valor já é validado na folha). */
function textoDoErro(erro: ErroDados): string {
  if (erro.tipo === 'rede') return SEM_CONEXAO;
  if (erro.tipo === 'regra' && erro.codigo === 'valor_invalido') return DATA_FORA_DO_PERIODO;
  if (erro.tipo === 'regra' && erro.codigo === 'ocorrencia_paga') return ROTULO_ERRO.ocorrencia_paga.texto;
  return mensagemErro(erro);
}

/** Abre a folha para o `?pagar=<id>` quando é de uma ocorrência do mês ainda não paga; senão tira o parâmetro. */
export function PagarFixaConectada({ mes, ocorrencias, tituloCartao }: Props) {
  const [id, definirParametro] = useParametroDaFolha('pagar');
  const ocorrencia =
    id !== null && ehUuid(id) ? ocorrencias.find((o) => o.id === id && o.situacao !== 'paga') : undefined;
  const removerParametro = () => definirParametro(null);

  useEffect(() => {
    if (id !== null && !ocorrencia) removerParametro();
  }, [id, ocorrencia]);

  if (!ocorrencia) return null;
  return (
    <PagarAberta
      key={ocorrencia.id}
      mes={mes}
      ocorrencia={ocorrencia}
      tituloCartao={tituloCartao}
      aoFechar={removerParametro}
    />
  );
}

interface PropsAberta extends Pick<Props, 'mes' | 'tituloCartao'> {
  ocorrencia: Ocorrencia;
  aoFechar: () => void;
}

function PagarAberta({ mes, ocorrencia, tituloCartao, aoFechar }: PropsAberta) {
  const dados = useDadosLancamento().data?.dados;
  const membro = useContexto().data?.membro;
  const { pagarOcorrencia } = useComandosFixas();
  const { mostrar } = useAviso();
  const cliente = useQueryClient();
  const [formaEscolhida, definirForma] = useState<string | null>(null);
  const [valor, definirValor] = useState(ocorrencia.valor_previsto_centavos);
  const [data, definirData] = useState(() => hojeEmSaoPaulo());
  const [erro, definirErro] = useState<ErroDados | null>(null);
  const [salvando, definirSalvando] = useState(false);
  // O mesmo id em todas as tentativas: reenviar depois de uma falha de rede não paga a ocorrência duas vezes (CA-15.5).
  const [idPagamento] = useState(() => crypto.randomUUID());

  if (!dados) return null;
  const formaId = formaEscolhida ?? dados.forma_padrao_id ?? dados.formas[0]?.id ?? '';

  async function confirmar() {
    if (salvando) return;
    definirErro(null);
    definirSalvando(true);
    try {
      await pagarOcorrencia.mutateAsync({
        id: idPagamento,
        ocorrenciaId: ocorrencia.id,
        formaId,
        valorCentavos: valor,
        data,
      });
      mostrar('sucesso', 'Marcada como paga');
      aoFechar();
      setTimeout(() => tituloCartao.current?.focus(), 0);
    } catch (e) {
      const falha = e as ErroDados;
      definirErro(falha);
      if (falha.tipo === 'regra') void cliente.invalidateQueries({ queryKey: CHAVES.ocorrenciasMes });
      // A folha desmonta quando a releitura traz a ocorrência já paga; o aviso global sobrevive a isso.
      if (falha.tipo === 'regra' && falha.codigo === 'ocorrencia_paga') mostrar('erro', textoDoErro(falha));
    } finally {
      definirSalvando(false);
    }
  }

  return (
    <FolhaPagarFixa
      ocorrencia={ocorrencia}
      nomeMes={formatarNomeMes(mes)}
      nomeMembro={membro?.nome ?? ''}
      formas={dados.formas}
      formaId={formaId}
      valorCentavos={valor}
      data={data}
      erro={
        erro
          ? { texto: textoDoErro(erro), semConexao: erro.tipo === 'rede' || erro.tipo === 'indisponivel' }
          : undefined
      }
      salvando={salvando}
      aoMudarForma={definirForma}
      aoMudarValor={definirValor}
      aoMudarData={definirData}
      aoConfirmar={() => void confirmar()}
      aoFechar={aoFechar}
    />
  );
}
