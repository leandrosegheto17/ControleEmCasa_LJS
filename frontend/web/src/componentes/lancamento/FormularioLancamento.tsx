import type { SaidaDadosLancamento as DadosLancamento } from '@controle/contrato';
import type { SaidaLancamento as Lancamento } from '@controle/contrato';
import type { FormEvent, ReactNode } from 'react';
import type { CamposLancamento } from '../../comum/lancamentos';
import { ROTULO_ESCOPO } from '../../rotulos/escopo';
import { ROTULO_TIPO_FORMA } from '../../rotulos/tipoForma';
import { AvisoErroTopo } from '../base/AvisoErroTopo';
import { Botao } from '../base/Botao';
import { BotaoForma } from '../base/BotaoForma';
import { CampoData } from '../base/CampoData';
import { CampoTexto } from '../base/CampoTexto';
import { CampoValor } from '../base/CampoValor';
import { Nota } from '../base/Nota';
import { Selecao } from '../base/Selecao';
import estilo from './FormularioLancamento.module.css';
import { pagamentoDe } from './privados';
import { useFormularioLancamento } from './useFormularioLancamento';

interface Props {
  lancamento: Lancamento;
  /** Categorias do tipo do lançamento; vazio enquanto as opções não chegam. */
  categorias: Lancamento['categoria'][];
  formas: DadosLancamento['formas'];
  /** Recebe só os campos alterados. */
  aoSalvar: (campos: CamposLancamento) => void;
  salvando?: boolean;
  /** Erro do envio, mostrado no topo do formulário. */
  erro?: string;
  /** Conteúdo entre os campos e as ações (a lista de parcelas). */
  children?: ReactNode;
  /** Botões depois de "Salvar alterações". */
  acoes?: ReactNode;
}

const OPCOES_PARCELAS = Array.from({ length: 24 }, (_, i) => ({ valor: String(i + 1), rotulo: `${i + 1}x` }));
const AJUDA_CATEGORIA = 'Trocar para uma categoria "Eu" tira a despesa da Casa (só quem lançou pode).';
const NOTA_RESTRITA = 'Forma de pagamento e parcelas: só quem pagou pode alterar.';

/**
 * Campos por papel: quem pagou recebe `pagamento` e vê tudo; o outro membro não recebe e, por isso,
 * não vê data, forma nem parcelas (nem desabilitados). A permissão final é do servidor.
 */
export function FormularioLancamento({
  lancamento,
  categorias,
  formas,
  aoSalvar,
  salvando,
  erro,
  children,
  acoes,
}: Props) {
  const { valores, mudar, alterados } = useFormularioLancamento(lancamento);
  const { categoria, escopo } = lancamento;
  const pagamento = pagamentoDe(lancamento);
  const doPagador = lancamento.pagador.sou_eu && pagamento !== undefined;

  const formaAtual = pagamento?.forma ?? null;
  const opcoesForma =
    formaAtual === null || formas.some((f) => f.id === formaAtual.id) ? formas : [formaAtual, ...formas];
  const tipoForma = opcoesForma.find((f) => f.id === valores.formaId)?.tipo ?? formaAtual?.tipo;
  const visiveis = {
    data: pagamento !== undefined,
    forma: doPagador && formaAtual !== null && opcoesForma.length > 0,
    parcelas: doPagador && tipoForma === 'credito',
  };

  const permitidas = doPagador ? categorias : categorias.filter((c) => c.escopo === 'conjunto');
  const todasCategorias = permitidas.some((c) => c.id === categoria.id) ? permitidas : [categoria, ...permitidas];
  const opcoesCategoria = todasCategorias.map((c) => ({
    valor: c.id,
    rotulo: `${c.nome} · ${ROTULO_ESCOPO[c.escopo].texto}`,
  }));

  function enviar(evento: FormEvent) {
    evento.preventDefault();
    aoSalvar(alterados(visiveis));
  }

  return (
    <form className={estilo.formulario} onSubmit={enviar} noValidate>
      {erro ? <AvisoErroTopo>{erro}</AvisoErroTopo> : null}
      <CampoValor
        id="valor-total"
        rotulo="Valor total da compra"
        centavos={valores.valor}
        aoMudar={(v) => mudar('valor', v)}
      />
      <Selecao
        id="categoria"
        rotulo="Categoria"
        ajuda={doPagador && escopo === 'conjunto' ? AJUDA_CATEGORIA : undefined}
        opcoes={opcoesCategoria}
        value={valores.categoriaId}
        onChange={(e) => mudar('categoriaId', e.target.value)}
      />
      <CampoTexto
        id="descricao"
        rotulo="Descrição"
        autoComplete="off"
        value={valores.descricao}
        onChange={(e) => mudar('descricao', e.target.value)}
      />
      {visiveis.data || visiveis.parcelas ? (
        <div className={estilo.grade}>
          {visiveis.data ? (
            <CampoData
              id="data-compra"
              rotulo="Data da compra"
              value={valores.data}
              onChange={(e) => mudar('data', e.target.value)}
            />
          ) : null}
          {visiveis.parcelas ? (
            <Selecao
              id="parcelas"
              rotulo="Parcelas"
              opcoes={OPCOES_PARCELAS}
              value={String(valores.parcelas)}
              onChange={(e) => mudar('parcelas', Number(e.target.value))}
            />
          ) : null}
        </div>
      ) : null}
      {visiveis.forma ? (
        <BotaoForma
          rotulo="Forma de pagamento"
          opcoes={opcoesForma.map((f) => ({ id: f.id, nome: f.nome, detalhe: ROTULO_TIPO_FORMA[f.tipo].texto }))}
          valor={valores.formaId}
          aoEscolher={(id) => mudar('formaId', id)}
        />
      ) : null}
      {pagamento === undefined ? <Nota icone>{NOTA_RESTRITA}</Nota> : null}
      {children}
      <div className={estilo.acoes}>
        <Botao variante="principal" tipo="submit" salvando={salvando}>
          Salvar alterações
        </Botao>
        {acoes}
      </div>
    </form>
  );
}
