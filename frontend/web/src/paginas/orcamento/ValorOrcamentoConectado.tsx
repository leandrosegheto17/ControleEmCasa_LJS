import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useState, type RefObject } from 'react';
import { useAviso } from '../../componentes/base/useAviso';
import { FolhaValorOrcamento } from '../../componentes/orcamento/FolhaValorOrcamento';
import type { CategoriaSemOrcamento, LinhaOrcamentoMes as LinhaOrcamento } from '../../componentes/orcamento/tipos';
import { ehUuid } from '../../comum/uuid';
import type { ErroDados } from '../../comum/erros';
import { paraEscopoApi, type EscopoUrl } from '../../formatacao/escopoUrl';
import { formatarMes } from '../../formatacao/mes';
import { CHAVES } from '../../ganchos/chavesConsulta';
import { useComandosOrcamento } from '../../ganchos/useComandosOrcamento';
import { useParametroDaFolha } from '../../ganchos/useParametroDaFolha';
import { mensagemErro } from '../../rotulos/mensagensErro';
import { ROTULO_ESCOPO } from '../../rotulos/escopo';

const SEM_CONEXAO =
  'Sem conexão. O orçamento não foi salvo. Seus dados continuam aqui: tente de novo quando a rede voltar.';
const VALOR_ZERO = 'Informe um valor maior que zero.';

type Acao = 'salvar' | 'remover';

interface Props {
  mes: string;
  escopo: EscopoUrl;
  linhas: readonly LinhaOrcamento[];
  semOrcamento: readonly CategoriaSemOrcamento[];
  /** Recebe o foco quando o valor é salvo ou removido. */
  tituloCartao: RefObject<HTMLHeadingElement | null>;
}

interface Alvo {
  categoriaId: string;
  nome: string;
  orcadoCentavos: number | null;
  realizadoCentavos?: number;
}

function procurar(id: string, linhas: Props['linhas'], semOrcamento: Props['semOrcamento']): Alvo | undefined {
  const linha = linhas.find((l) => l.categoria_id === id);
  if (linha) {
    return {
      categoriaId: id,
      nome: linha.nome,
      orcadoCentavos: linha.orcado_centavos,
      realizadoCentavos: linha.realizado_centavos,
    };
  }
  const sem = semOrcamento.find((c) => c.categoria_id === id);
  return sem ? { categoriaId: id, nome: sem.nome, orcadoCentavos: null } : undefined;
}

/** Abre a folha para o `?editar=<categoria_id>` quando a categoria está na resposta já carregada; senão tira o parâmetro. */
export function ValorOrcamentoConectado({ mes, escopo, linhas, semOrcamento, tituloCartao }: Props) {
  const [id, definirParametro] = useParametroDaFolha('editar');
  const alvo = id !== null && ehUuid(id) ? procurar(id, linhas, semOrcamento) : undefined;
  const removerParametro = () => definirParametro(null);

  useEffect(() => {
    if (id !== null && !alvo) removerParametro();
  }, [id, alvo]);

  if (!alvo) return null;
  return (
    <ValorAberto
      key={alvo.categoriaId}
      mes={mes}
      escopo={escopo}
      alvo={alvo}
      tituloCartao={tituloCartao}
      aoFechar={removerParametro}
    />
  );
}

interface PropsAberto extends Pick<Props, 'mes' | 'escopo' | 'tituloCartao'> {
  alvo: Alvo;
  aoFechar: () => void;
}

function ValorAberto({ mes, escopo, alvo, tituloCartao, aoFechar }: PropsAberto) {
  const { definirOrcamento } = useComandosOrcamento();
  const { mostrar } = useAviso();
  const cliente = useQueryClient();
  const [valor, definirValor] = useState(alvo.orcadoCentavos ?? 0);
  const [erroValor, definirErroValor] = useState<string>();
  const [erro, definirErro] = useState<ErroDados | null>(null);
  const [ultima, definirUltima] = useState<Acao>('salvar');
  const [ocupada, definirOcupada] = useState<Acao | null>(null);

  async function enviar(acao: Acao) {
    if (ocupada) return;
    definirErro(null);
    definirErroValor(undefined);
    if (acao === 'salvar' && valor <= 0) {
      definirErroValor(VALOR_ZERO);
      return;
    }
    definirUltima(acao);
    definirOcupada(acao);
    try {
      await definirOrcamento.mutateAsync({
        mes,
        categoriaId: alvo.categoriaId,
        valorCentavos: acao === 'remover' ? null : valor,
      });
      mostrar('sucesso', acao === 'remover' ? 'Orçamento removido' : 'Orçamento salvo');
      aoFechar();
      setTimeout(() => tituloCartao.current?.focus(), 0);
    } catch (e) {
      const falha = e as ErroDados;
      if (falha.tipo === 'regra' && falha.codigo === 'valor_invalido') {
        definirErroValor(mensagemErro(falha));
      } else {
        definirErro(falha);
        if (falha.tipo === 'regra') void cliente.invalidateQueries({ queryKey: CHAVES.orcamentoMes });
        // A folha pode desmontar quando o refetch não traz mais a categoria; o aviso global sobrevive a isso.
        if (falha.tipo === 'regra' && falha.codigo === 'registro_invalido') mostrar('erro', mensagemErro(falha));
      }
    } finally {
      definirOcupada(null);
    }
  }

  return (
    <FolhaValorOrcamento
      nomeCategoria={alvo.nome}
      nomeMes={formatarMes(mes)}
      escopo={ROTULO_ESCOPO[paraEscopoApi(escopo)].texto}
      realizadoCentavos={alvo.realizadoCentavos}
      valorCentavos={valor}
      podeRemover={alvo.orcadoCentavos !== null}
      erroValor={erroValor}
      erro={
        erro
          ? {
              texto: erro.tipo === 'rede' ? SEM_CONEXAO : mensagemErro(erro),
              semConexao: erro.tipo === 'rede' || erro.tipo === 'indisponivel',
            }
          : undefined
      }
      ocupada={ocupada}
      aoMudarValor={(centavos) => {
        definirValor(centavos);
        definirErro(null);
        definirErroValor(undefined);
      }}
      aoSalvar={() => void enviar(erro ? ultima : 'salvar')}
      aoRemover={() => void enviar('remover')}
      aoFechar={aoFechar}
    />
  );
}
