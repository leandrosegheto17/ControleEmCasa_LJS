import type { SaidaMeuPlano } from '@controle/contrato';
import { useState } from 'react';
import { CabecalhoPagina } from '../componentes/base/CabecalhoPagina';
import { Botao } from '../componentes/base/Botao';
import { DialogoConfirmacao } from '../componentes/base/DialogoConfirmacao';
import { EsqueletoLista } from '../componentes/base/EsqueletoLista';
import { ItemValor } from '../componentes/base/ItemValor';
import { Nota } from '../componentes/base/Nota';
import { useAviso } from '../componentes/base/useAviso';
import { CobrancaEmAberto } from '../componentes/plano/CobrancaEmAberto';
import { FormularioAssinar } from '../componentes/plano/FormularioAssinar';
import { EstadosDeLeitura } from '../componentes/EstadosDeLeitura';
import { GrupoMenu } from '../componentes/GrupoMenu';
import type { ErroDados } from '../comum/erros';
import { formatarMoeda } from '../formatacao/moeda';
import { useLeituraComCache } from '../ganchos/useLeituraComCache';
import { useAssinar, useCancelarAssinatura, useMeuPlano } from '../ganchos/usePlano';
import { dataDoInstante, descreverSituacao } from '../formatacao/situacaoPlano';
import { ROTULO_PLANO, TEXTO_SEM_REDE_PLANO, TEXTO_SO_TITULAR, textoErroPlano } from '../rotulos/plano';

/** Cobrança em aberto ou assinatura vigente: dá para cancelar. */
function temAssinatura(plano: SaidaMeuPlano): boolean {
  return (
    plano.cobranca !== undefined ||
    (plano.situacao === 'ativa' && plano.plano === 'pro') ||
    plano.situacao === 'atrasada'
  );
}

function textoCancelar(plano: SaidaMeuPlano): string {
  if (plano.cobranca && plano.situacao !== 'ativa' && plano.situacao !== 'atrasada') {
    return 'A cobrança em aberto é cancelada e nada será cobrado. A casa continua no plano atual até o fim do teste.';
  }
  const ate = plano.periodo_ate ? ` O Pro continua até ${dataDoInstante(plano.periodo_ate)}.` : '';
  return `Nenhuma cobrança nova será gerada.${ate} Depois disso, orçamento e metas ficam só para consulta.`;
}

function Titular({
  plano,
  aoRelerPlano,
  relendo,
}: {
  plano: SaidaMeuPlano;
  aoRelerPlano: () => void;
  relendo: boolean;
}) {
  const { mostrar } = useAviso();
  const assinar = useAssinar();
  const cancelar = useCancelarAssinatura();
  const [erro, setErro] = useState<ErroDados | null>(null);
  const [cancelando, setCancelando] = useState(false);

  function falhou(e: ErroDados) {
    setErro(e);
    // O plano mudou por outro caminho (webhook, outro aparelho): relê para a tela refletir.
    if (e.tipo === 'regra' && (e.codigo === 'assinatura_ativa' || e.codigo === 'sem_assinatura')) aoRelerPlano();
  }

  async function copiar(codigo: string) {
    try {
      await navigator.clipboard.writeText(codigo);
      mostrar('sucesso', 'Código Pix copiado');
    } catch {
      mostrar('erro', 'Não foi possível copiar. Selecione o código e copie.');
    }
  }

  const cpfRecusado = erro?.tipo === 'regra' && erro.codigo === 'valor_invalido';
  return (
    <>
      {plano.cobranca ? (
        <CobrancaEmAberto
          cobranca={plano.cobranca}
          atualizando={relendo}
          aoCopiar={(c) => void copiar(c)}
          aoTentarDeNovo={aoRelerPlano}
        />
      ) : null}
      {temAssinatura(plano) ? (
        <>
          {erro && !cpfRecusado ? <Nota icone>{textoErroPlano(erro)}</Nota> : null}
          <Botao
            variante="secundario"
            salvando={cancelar.isPending}
            rotuloOcupado="Cancelando…"
            onClick={() => {
              setErro(null);
              setCancelando(true);
            }}
          >
            Cancelar assinatura
          </Botao>
          <DialogoConfirmacao
            aberto={cancelando}
            titulo="Cancelar a assinatura?"
            texto={textoCancelar(plano)}
            rotuloConfirmar="Cancelar assinatura"
            rotuloCancelar="Manter assinatura"
            variante="destrutiva"
            aoConfirmar={() => {
              setCancelando(false);
              cancelar.mutate(undefined, {
                onSuccess: () => mostrar('sucesso', 'Assinatura cancelada'),
                onError: falhou,
              });
            }}
            aoCancelar={() => setCancelando(false)}
          />
        </>
      ) : (
        <FormularioAssinar
          precoCentavos={plano.preco_centavos}
          salvando={assinar.isPending}
          erro={erro && !cpfRecusado ? textoErroPlano(erro) : undefined}
          cpfRecusado={cpfRecusado}
          aoEditar={() => setErro((atual) => (atual?.tipo === 'regra' ? null : atual))}
          aoAssinar={(cpf) => {
            setErro(null);
            assinar.mutate(cpf, {
              onSuccess: () => mostrar('sucesso', 'Assinatura criada. Pague o Pix para ativar o Pro'),
              onError: falhou,
            });
          }}
        />
      )}
    </>
  );
}

function Conteudo({
  plano,
  aoRelerPlano,
  relendo,
}: {
  plano: SaidaMeuPlano;
  aoRelerPlano: () => void;
  relendo: boolean;
}) {
  return (
    <>
      <GrupoMenu titulo="Plano da casa">
        <ItemValor rotulo="Plano" valor={ROTULO_PLANO[plano.plano]} />
        <ItemValor rotulo="Situação" valor={descreverSituacao(plano, new Date())} />
        <ItemValor rotulo="Preço do Pro" valor={`${formatarMoeda(plano.preco_centavos)} por mês`} />
      </GrupoMenu>
      {plano.sou_titular ? (
        <Titular plano={plano} aoRelerPlano={aoRelerPlano} relendo={relendo} />
      ) : (
        <Nota>{TEXTO_SO_TITULAR}</Nota>
      )}
    </>
  );
}

/**
 * Meu plano (SDD 9.4; RN-24, RN-25; CA-24.x): plano e situação da casa para os dois membros; assinar, pagar o Pix e
 * cancelar só para o titular. Assinar e cancelar exigem rede e não entram na fila offline.
 */
export function MeuPlano() {
  const consulta = useMeuPlano();
  const leitura = useLeituraComCache(consulta);
  return (
    <>
      <CabecalhoPagina titulo="Meu plano" voltarPara="/app/ajustes" rotuloVoltar="Voltar para Ajustes" />
      <main aria-busy={leitura.situacao === 'carregando'}>
        <EstadosDeLeitura
          leitura={leitura}
          esqueleto={<EsqueletoLista linhas={3} />}
          anuncioCarregando="Carregando o plano…"
          textoErro={consulta.error?.tipo === 'rede' ? TEXTO_SEM_REDE_PLANO : undefined}
          aoTentarDeNovo={() => void consulta.refetch()}
        >
          {(plano) => (
            <Conteudo plano={plano} aoRelerPlano={() => void consulta.refetch()} relendo={consulta.isFetching} />
          )}
        </EstadosDeLeitura>
      </main>
    </>
  );
}
