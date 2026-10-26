import type { TipoMovimentoMeta } from '../../comum/enums';
import type { SaidaLinhaMetas as LinhaMetas } from '@controle/contrato';
import { useEffect, useState } from 'react';
import { useAviso } from '../../componentes/base/useAviso';
import { FolhaMovimentarMeta, type DadosMovimento } from '../../componentes/metas/FolhaMovimentarMeta';
import type { ErroDados } from '../../comum/erros';
import { hojeEmSaoPaulo } from '../../formatacao/data';
import { formatarMoeda } from '../../formatacao/moeda';
import { useComandosMetas } from '../../ganchos/useComandosMetas';
import { useDadosLancamento } from '../../ganchos/useDadosLancamento';
import { useLocaisGuardados } from '../../ganchos/useLocaisGuardados';
import { useParametroDaFolha } from '../../ganchos/useParametroDaFolha';
import { mensagemErro } from '../../rotulos/mensagensErro';

const PARAMETRO = 'movimentar';
const AVISO_SUCESSO: Record<TipoMovimentoMeta, string> = {
  aporte: 'Aporte registrado',
  retirada: 'Retirada registrada',
};

function tipoDaUrl(valor: string | null): TipoMovimentoMeta | null {
  return valor === 'aporte' || valor === 'retirada' ? valor : null;
}

/** Abre a folha para `?movimentar=aporte|retirada`; qualquer outro valor é retirado da URL. */
export function MovimentarMetaConectada({ meta }: { meta: LinhaMetas }) {
  const [bruto, mudarParametro] = useParametroDaFolha(PARAMETRO);
  const tipo = tipoDaUrl(bruto);

  useEffect(() => {
    if (bruto !== null && tipo === null) mudarParametro(null);
  }, [bruto, tipo]);

  if (!tipo) return null;
  return (
    <MovimentarAberta
      key={meta.id}
      meta={meta}
      tipo={tipo}
      aoMudarTipo={mudarParametro}
      aoFechar={() => mudarParametro(null)}
    />
  );
}

interface PropsAberta {
  meta: LinhaMetas;
  tipo: TipoMovimentoMeta;
  aoMudarTipo: (tipo: TipoMovimentoMeta) => void;
  aoFechar: () => void;
}

function MovimentarAberta({ meta, tipo, aoMudarTipo, aoFechar }: PropsAberta) {
  const contas = useDadosLancamento().data?.dados.contas ?? [];
  const locais = useLocaisGuardados({ enabled: tipo === 'aporte' }).data ?? [];
  const { movimentarMeta } = useComandosMetas();
  const { mostrar } = useAviso();
  const [id] = useState(() => crypto.randomUUID());
  const [dataInicial] = useState(() => hojeEmSaoPaulo());
  const [erro, definirErro] = useState<{ falha: ErroDados; local: string } | null>(null);

  function confirmar(dados: DadosMovimento) {
    definirErro(null);
    movimentarMeta.mutate(
      { id, metaId: meta.id, tipo, ...dados },
      {
        onSuccess: () => {
          mostrar('sucesso', AVISO_SUCESSO[tipo]);
          aoFechar();
        },
        onError: (falha) => definirErro({ falha, local: dados.local }),
      },
    );
  }

  const falha = erro?.falha;
  const acimaDoGuardado = falha?.tipo === 'regra' && falha.codigo === 'retirada_maior_que_guardado';
  const localDoErro = erro?.local ?? '';
  const guardado = meta.por_local?.find((p) => p.local === localDoErro)?.guardado_centavos ?? 0;

  return (
    <FolhaMovimentarMeta
      nomeMeta={meta.nome}
      tipo={tipo}
      porLocal={meta.por_local ?? []}
      sugestoes={locais}
      contas={contas}
      dataInicial={dataInicial}
      erroValor={
        acimaDoGuardado
          ? `Em ${localDoErro} há ${formatarMoeda(guardado)}. A retirada não pode passar disso.`
          : undefined
      }
      erro={
        falha && !acimaDoGuardado
          ? { texto: mensagemErro(falha), semConexao: falha.tipo === 'rede' || falha.tipo === 'indisponivel' }
          : undefined
      }
      salvando={movimentarMeta.isPending}
      aoMudarTipo={aoMudarTipo}
      aoEditar={() => definirErro((atual) => (atual?.falha.tipo === 'regra' ? null : atual))}
      aoConfirmar={confirmar}
      aoFechar={aoFechar}
    />
  );
}
