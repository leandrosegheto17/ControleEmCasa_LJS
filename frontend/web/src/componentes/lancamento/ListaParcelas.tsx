import type { SaidaLancamento as Lancamento } from '@controle/contrato';
import { type KeyboardEvent, useId, useRef, useState } from 'react';
import { formatarData } from '../../formatacao/data';
import { formatarMoeda } from '../../formatacao/moeda';
import { Botao } from '../base/Botao';
import { CampoData } from '../base/CampoData';
import { SeloSituacao } from '../base/SeloSituacao';
import estilo from './ListaParcelas.module.css';

type Parcela = Lancamento['parcelas'][number];

interface Props {
  parcelas: Lancamento['parcelas'];
  numParcelas: number;
  /** Quem pagou no crédito pode ajustar a data de cada parcela; o servidor decide de fato. */
  editavel: boolean;
  onAlterarData: (parcelaId: string, data: string) => Promise<void>;
}

const ajustada = (p: Parcela): boolean => 'data_ajustada' in p && p.data_ajustada === true;

/** Parcelas da compra (número, data e valor); com `editavel`, cada uma tem "Alterar data". */
export function ListaParcelas({ parcelas, numParcelas, editavel, onAlterarData }: Props) {
  const idTitulo = useId();
  const [aberta, setAberta] = useState<string | null>(null);
  const campos = useRef(new Map<string, HTMLInputElement>());
  const [salvando, setSalvando] = useState<string | null>(null);
  const seletorNativo = useRef(new Set<string>());
  const emSalvamento = useRef(new Set<string>());

  /** Seletor nativo quando o navegador deixa; senão o campo de data da linha aparece e recebe o foco. */
  function abrir(id: string) {
    const campo = campos.current.get(id);
    setAberta(id);
    try {
      if (typeof campo?.showPicker === 'function') {
        seletorNativo.current.add(id);
        campo.showPicker();
      } else campo?.focus();
    } catch {
      seletorNativo.current.delete(id);
      campo?.focus();
    }
  }

  /**
   * Com seletor nativo (ou campo sem foco) o `change` já é a escolha final e confirma na hora.
   * Digitando no campo visível, cada tecla muda o valor (ex.: ano 0002, 0020…): só blur/Enter confirmam.
   */
  function aoMudar(p: Parcela, campo: HTMLInputElement) {
    if (seletorNativo.current.has(p.id) || document.activeElement !== campo) void escolher(p, campo.value);
  }

  function aoTeclar(p: Parcela, e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') {
      e.preventDefault();
      void escolher(p, e.currentTarget.value);
    } else if (e.key === 'Escape') {
      e.currentTarget.value = p.data;
      setAberta(null);
    }
  }

  async function escolher(p: Parcela, data: string) {
    seletorNativo.current.delete(p.id);
    setAberta(null);
    if (data === '' || data === p.data || emSalvamento.current.has(p.id)) return;
    emSalvamento.current.add(p.id);
    setSalvando(p.id);
    try {
      await onAlterarData(p.id, data);
    } finally {
      emSalvamento.current.delete(p.id);
      setSalvando(null);
    }
  }

  return (
    <section className={estilo.secao} aria-labelledby={idTitulo}>
      <h2 id={idTitulo} className={estilo.titulo}>
        Parcelas
      </h2>
      <ul className={estilo.lista}>
        {parcelas.map((p) => {
          const rotulo = `${p.numero} de ${numParcelas}`;
          return (
            <li key={p.id}>
              <span className="valor texto-2">
                {p.numero}/{numParcelas}
              </span>
              {editavel ? (
                <>
                  <span className={estilo.info}>
                    <span className="valor">{formatarData(p.data)}</span>
                    {ajustada(p) ? (
                      <span className={estilo.sub}>
                        <SeloSituacao situacao="ajustada" />
                      </span>
                    ) : null}
                  </span>
                  <span className={estilo.direita}>
                    <span className="valor">{formatarMoeda(p.valor_centavos)}</span>
                    <Botao
                      variante="texto"
                      icone="calendario"
                      aria-label={`Alterar data da parcela ${rotulo}`}
                      salvando={salvando === p.id}
                      rotuloOcupado="Salvando…"
                      onClick={() => abrir(p.id)}
                    >
                      Alterar data
                    </Botao>
                  </span>
                  <div
                    className={aberta === p.id ? estilo.seletor : estilo.seletorOculto}
                    aria-hidden={aberta === p.id ? undefined : true}
                  >
                    <CampoData
                      rotulo={`Nova data da parcela ${rotulo}`}
                      defaultValue={p.data}
                      tabIndex={aberta === p.id ? undefined : -1}
                      ref={(el) => {
                        if (el) campos.current.set(p.id, el);
                        else campos.current.delete(p.id);
                      }}
                      onChange={(e) => aoMudar(p, e.target)}
                      onBlur={(e) => void escolher(p, e.target.value)}
                      onKeyDown={(e) => aoTeclar(p, e)}
                    />
                  </div>
                </>
              ) : (
                <>
                  <span className="valor">{formatarData(p.data)}</span>
                  <span className="valor">{formatarMoeda(p.valor_centavos)}</span>
                </>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
