import type { FormEvent } from 'react';
import { formatarMoeda } from '../../formatacao/moeda';
import { AvisoErroTopo } from '../base/AvisoErroTopo';
import { Botao } from '../base/Botao';
import { CampoValor } from '../base/CampoValor';
import { Folha } from '../base/Folha';
import estiloFolha from '../base/FolhaPagamento.module.css';
import estilo from './FolhaValorOrcamento.module.css';

const FORMULARIO = 'form-orcamento';

interface Props {
  nomeCategoria: string;
  /** Mês por extenso ("Outubro de 2026"). */
  nomeMes: string;
  /** Texto do escopo ("Casa" ou "Eu"). */
  escopo: string;
  /** Ausente quando a categoria ainda não tem orçamento no mês. */
  realizadoCentavos?: number;
  valorCentavos: number;
  /** Só categoria que já tem orçamento pode ser removida. */
  podeRemover: boolean;
  erroValor?: string;
  /** Erro do envio, no topo do formulário. */
  erro?: { texto: string; semConexao: boolean };
  /** Ação em andamento. */
  ocupada: 'salvar' | 'remover' | null;
  aoMudarValor: (centavos: number) => void;
  aoSalvar: () => void;
  aoRemover: () => void;
  aoFechar: () => void;
}

/** Folha com o valor orçado de uma categoria no mês: salvar e, quando já há orçamento, remover. */
export function FolhaValorOrcamento({
  nomeCategoria,
  nomeMes,
  escopo,
  realizadoCentavos,
  valorCentavos,
  podeRemover,
  erroValor,
  erro,
  ocupada,
  aoMudarValor,
  aoSalvar,
  aoRemover,
  aoFechar,
}: Props) {
  function enviar(evento: FormEvent) {
    evento.preventDefault();
    aoSalvar();
  }

  const rodape = (
    <Botao
      variante="principal"
      tipo="submit"
      form={FORMULARIO}
      bloco
      salvando={ocupada === 'salvar'}
      rotuloOcupado="Salvando…"
    >
      {erro?.semConexao ? 'Tentar de novo' : 'Salvar'}
    </Botao>
  );

  return (
    <Folha
      aberta
      aoFechar={aoFechar}
      titulo={`Orçamento de ${nomeCategoria}`}
      rodape={rodape}
      ocupada={ocupada !== null}
    >
      <form id={FORMULARIO} onSubmit={enviar} noValidate className={estiloFolha.formulario}>
        {erro ? <AvisoErroTopo icone={erro.semConexao ? 'offline' : 'alerta'}>{erro.texto}</AvisoErroTopo> : null}
        <p className={estiloFolha['item-sub']}>
          {nomeMes} · {escopo}
          {realizadoCentavos === undefined ? null : (
            <>
              {' '}
              · realizado <span className="valor">{formatarMoeda(realizadoCentavos)}</span>
            </>
          )}
        </p>
        <CampoValor rotulo="Valor orçado" centavos={valorCentavos} aoMudar={aoMudarValor} erro={erroValor} />
        {podeRemover ? (
          <span className={estilo.remover}>
            <Botao variante="texto" salvando={ocupada === 'remover'} rotuloOcupado="Removendo…" onClick={aoRemover}>
              Remover orçamento desta categoria
            </Botao>
          </span>
        ) : null}
      </form>
    </Folha>
  );
}
