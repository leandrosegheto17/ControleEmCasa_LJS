import { useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { CampoTexto } from '../base/CampoTexto';
import { CampoValor } from '../base/CampoValor';
import { focarPrimeiroErro } from '../base/focarPrimeiroErro';
import { Selecao } from '../base/Selecao';
import estilo from './FormularioFixa.module.css';
import type { OpcaoCategoria } from './opcoesCategoriaFixa';

export interface DadosFixa {
  descricao: string;
  categoriaId: string;
  valorPrevistoCentavos: number;
  diaVencimento: number;
}

interface Props {
  categorias: OpcaoCategoria[];
  inicial?: { descricao: string; categoriaId: string; valorCentavos: number; dia: number };
  /** Erro de valor vindo do servidor, mostrado no campo "Valor previsto". */
  erroValor?: string;
  aoSalvar: (dados: DadosFixa) => void;
  /** Botões do formulário; o primeiro ocupa a largura que sobra. */
  acoes: ReactNode;
  /** Nota logo abaixo dos botões. */
  nota?: string;
}

const AJUDA_MESES_CURTOS = 'Em meses mais curtos, vale o último dia.';

function lerDia(texto: string): number | null {
  if (!/^\d+$/.test(texto.trim())) return null;
  const dia = Number(texto);
  return dia >= 1 && dia <= 31 ? dia : null;
}

export function FormularioFixa({ categorias, inicial, erroValor, aoSalvar, acoes, nota }: Props) {
  const [descricao, setDescricao] = useState(inicial?.descricao ?? '');
  const [categoriaId, setCategoriaId] = useState(inicial?.categoriaId ?? categorias[0]?.valor ?? '');
  const [valor, setValor] = useState(inicial?.valorCentavos ?? 0);
  const [dia, setDia] = useState(inicial ? String(inicial.dia) : '');
  const [erros, setErros] = useState<{ descricao?: string; valor?: string; dia?: string }>({});
  const [tentativasInvalidas, setTentativasInvalidas] = useState(0);
  const formulario = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (tentativasInvalidas > 0 && formulario.current) focarPrimeiroErro(formulario.current);
  }, [tentativasInvalidas]);

  function enviar(evento: FormEvent) {
    evento.preventDefault();
    const diaLido = lerDia(dia);
    const novos = {
      descricao: descricao.trim() ? undefined : 'Informe a descrição.',
      valor: valor > 0 ? undefined : 'Informe um valor maior que zero.',
      dia: diaLido === null ? 'Use um dia de 1 a 31.' : undefined,
    };
    setErros(novos);
    if (novos.descricao || novos.valor || diaLido === null) {
      setTentativasInvalidas((n) => n + 1);
      return;
    }
    aoSalvar({
      descricao: descricao.trim(),
      categoriaId,
      valorPrevistoCentavos: valor,
      diaVencimento: diaLido,
    });
  }

  return (
    <form ref={formulario} className={estilo.formulario} onSubmit={enviar} noValidate>
      <CampoTexto
        id="descricao"
        rotulo="Descrição"
        value={descricao}
        autoComplete="off"
        onChange={(e) => {
          setDescricao(e.target.value);
          setErros((atuais) => ({ ...atuais, descricao: undefined }));
        }}
        erro={erros.descricao}
      />
      <Selecao
        id="categoria"
        rotulo="Categoria da casa"
        value={categoriaId}
        onChange={(e) => setCategoriaId(e.target.value)}
        opcoes={categorias}
      />
      <CampoValor
        id="valor"
        rotulo="Valor previsto"
        centavos={valor}
        aoMudar={(centavos) => {
          setValor(centavos);
          setErros((atuais) => ({ ...atuais, valor: undefined }));
        }}
        ajuda="Pode ser ajustado na hora de pagar."
        erro={erros.valor ?? erroValor}
      />
      <CampoTexto
        id="dia"
        rotulo="Dia de vencimento"
        inputMode="numeric"
        autoComplete="off"
        value={dia}
        onChange={(e) => {
          setDia(e.target.value);
          setErros((atuais) => ({ ...atuais, dia: undefined }));
        }}
        ajuda={erros.dia ? AJUDA_MESES_CURTOS : `De 1 a 31. ${AJUDA_MESES_CURTOS}`}
        erro={erros.dia}
      />
      <div className={estilo.acoes}>{acoes}</div>
      {nota ? <p className={estilo.nota}>{nota}</p> : null}
    </form>
  );
}
