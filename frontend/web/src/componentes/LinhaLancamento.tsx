import { Link } from 'react-router';
import type { Escopo } from '../comum/enums';
import { formatarDataCurta, formatarDataPorExtenso } from '../formatacao/data';
import { formatarMoeda } from '../formatacao/moeda';
import { ROTULO_ESCOPO } from '../rotulos/escopo';
import { Icone, type NomeIcone } from './base/Icone';
import { SeloSituacao } from './base/SeloSituacao';
import estilo from './LinhaLancamento.module.css';

interface Props {
  href: string;
  escopo: Escopo;
  /** Já formatado por quem chama (descrição ou categoria, com "(k/N)"). */
  titulo: string;
  categoria: string;
  variavel: boolean;
  tipo: 'despesa' | 'receita';
  valorCentavos: number;
  /** 'YYYY-MM-DD'. */
  data: string;
  /** `souEu` é decidido por quem chama, comparando ids. */
  pagador?: { nome: string; souEu: boolean };
  /** Parcela da linha; só a compra parcelada (total > 1) ganha "parcela k de N" no nome acessível. */
  parcela?: { numero: number; total: number };
  /** Item da fila de envio, ainda fora do total. */
  aguardando?: boolean;
  /** Estado da navegação ao abrir a linha (ex.: `voltarPara`, a lista com mês e filtros que abriu o detalhe). */
  estado?: unknown;
}

/** Título falado: troca o sufixo visual "(k/N)" por "parcela k de N" separado por vírgula. */
function tituloFalado({ titulo, parcela }: Props): string[] {
  if (parcela === undefined || parcela.total <= 1) return [titulo];
  const sufixo = ` (${parcela.numero}/${parcela.total})`;
  const base = titulo.endsWith(sufixo) ? titulo.slice(0, -sufixo.length) : titulo;
  return [base, `parcela ${parcela.numero} de ${parcela.total}`];
}

/** Nome completo lido pelo leitor de tela (UX-SPEC §5): o texto visível das colunas não basta sozinho. */
function nomeAcessivel(p: Props, pagador: string | undefined): string {
  return [
    ...tituloFalado(p),
    ROTULO_ESCOPO[p.escopo].texto,
    pagador === undefined ? null : `pago por ${pagador}`,
    formatarMoeda(p.valorCentavos),
    formatarDataPorExtenso(p.data),
    p.tipo === 'receita' ? 'receita' : null,
    p.aguardando ? 'aguardando envio' : null,
  ]
    .filter((parte) => parte !== null)
    .join(', ');
}

/** Linha de lançamento: no celular, três colunas; no PC, a "tabela" com data e pagador. */
export function LinhaLancamento(props: Props) {
  const { href, escopo, titulo, categoria, variavel, tipo, valorCentavos, data, pagador, aguardando } = props;
  const rotuloEscopo = ROTULO_ESCOPO[escopo];
  const conjunta = escopo === 'conjunto';
  const nomePagador = pagador?.souEu ? 'Você' : pagador?.nome;
  // No meio da frase falada, "Você" perde a maiúscula; nome próprio fica como está.
  const pagadorFalado = pagador?.souEu ? 'você' : pagador?.nome;
  const receita = tipo === 'receita';

  return (
    <Link
      to={href}
      state={props.estado}
      className={estilo['linha-lancamento']}
      aria-label={nomeAcessivel(props, conjunta ? pagadorFalado : undefined)}
    >
      <span className={`${estilo['col-data']} valor`}>{formatarDataCurta(data)}</span>
      <Icone
        nome={rotuloEscopo.icone as NomeIcone}
        className={`${estilo['icone-escopo']} ${estilo[conjunta ? 'casa' : 'eu']}`}
        rotulo={rotuloEscopo.texto}
      />
      <span className={estilo['item-info']}>
        <span className={estilo['item-titulo']}>{titulo}</span>
        <span className={estilo['item-sub']}>
          {categoria}
          {variavel ? <SeloSituacao situacao="variavel" /> : null}
          {receita ? <span>Receita</span> : null}
          {aguardando ? <SeloSituacao situacao="aguardando" /> : null}
          {conjunta && nomePagador !== undefined ? (
            <span className={estilo['pagador-movel']}>Pago por {nomePagador}</span>
          ) : null}
        </span>
      </span>
      {nomePagador !== undefined ? <span className={estilo['col-pagador']}>{nomePagador}</span> : null}
      <span className={receita ? `valor ${estilo['valor-receita']}` : 'valor'}>
        {formatarMoeda(valorCentavos, { sinal: receita })}
      </span>
    </Link>
  );
}
