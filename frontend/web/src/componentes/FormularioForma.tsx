import type { TipoForma } from '../comum/enums';
import { useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { ORDEM_TIPO_FORMA, ROTULO_TIPO_FORMA } from '../rotulos/tipoForma';
import { CampoLeitura } from './base/CampoLeitura';
import { CampoTexto } from './base/CampoTexto';
import { focarPrimeiroErro } from './base/focarPrimeiroErro';
import { Interruptor } from './base/Interruptor';
import { Segmentado } from './base/Segmentado';
import { Selecao } from './base/Selecao';
import estilo from './FormularioForma.module.css';

export interface DadosForma {
  nome: string;
  tipo: TipoForma;
  /** Só no crédito. */
  diaVencimento: number | null;
  /** Pix/Débito: conta de origem; crédito: conta de pagamento padrão (ou `null`). */
  contaId: string | null;
  preferida: boolean;
}

export interface ValoresIniciaisForma {
  nome: string;
  tipo: TipoForma;
  dia: string;
  contaId: string;
  preferida: boolean;
}

interface Props {
  inicial: ValoresIniciaisForma;
  /** Em edição o tipo é só leitura: nunca muda depois da criação. */
  tipoFixo: boolean;
  contas: { id: string; nome: string; arquivada: boolean }[];
  aoSalvar: (dados: DadosForma) => void;
  /** Botões do formulário; o primeiro ocupa a largura que sobra. */
  children: ReactNode;
}

type Erros = { nome?: string; dia?: string; conta?: string };

const AJUDA_DIA = 'De 1 a 31. Mudar o dia vale para compras novas: as parcelas já lançadas não mudam.';
const AJUDA_TIPO = 'O tipo é escolhido na criação e não muda depois.';

function validar(nome: string, tipo: TipoForma, dia: string, contaId: string): Erros {
  const erros: Erros = {};
  if (!nome) erros.nome = 'Informe o nome da forma';
  if (tipo === 'credito') {
    const numero = Number(dia);
    if (!/^\d{1,2}$/.test(dia) || numero < 1 || numero > 31) {
      erros.dia = 'Informe o dia de vencimento do cartão (1 a 31).';
    }
  } else if (!contaId) {
    erros.conta = 'Escolha a conta de origem.';
  }
  return erros;
}

export function FormularioForma({ inicial, tipoFixo, contas, aoSalvar, children }: Props) {
  const [nome, setNome] = useState(inicial.nome);
  const [tipo, setTipo] = useState<TipoForma>(inicial.tipo);
  const [dia, setDia] = useState(inicial.dia);
  const [contaId, setContaId] = useState(inicial.contaId);
  const [preferida, setPreferida] = useState(inicial.preferida);
  const [erros, setErros] = useState<Erros>({});
  const [tentativasInvalidas, setTentativasInvalidas] = useState(0);
  const formulario = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (tentativasInvalidas > 0 && formulario.current) focarPrimeiroErro(formulario.current);
  }, [tentativasInvalidas]);

  const opcoesConta = contas
    .filter((conta) => !conta.arquivada || conta.id === inicial.contaId)
    .map((conta) => ({ valor: conta.id, rotulo: conta.nome }));
  const credito = tipo === 'credito';

  function mudarTipo(novo: string) {
    setTipo(novo as TipoForma);
    setContaId('');
    setErros({});
  }

  function enviar(evento: FormEvent) {
    evento.preventDefault();
    const nomeLimpo = nome.trim();
    const encontrados = validar(nomeLimpo, tipo, dia, contaId);
    setErros(encontrados);
    if (Object.keys(encontrados).length > 0) {
      setTentativasInvalidas((n) => n + 1);
      return;
    }
    aoSalvar({
      nome: nomeLimpo,
      tipo,
      diaVencimento: credito ? Number(dia) : null,
      contaId: contaId || null,
      preferida,
    });
  }

  return (
    <form ref={formulario} className={estilo.formulario} onSubmit={enviar} noValidate>
      <CampoTexto
        rotulo="Nome"
        value={nome}
        autoComplete="off"
        onChange={(e) => {
          setNome(e.target.value);
          setErros((atuais) => ({ ...atuais, nome: undefined }));
        }}
        erro={erros.nome}
      />
      {tipoFixo ? (
        <CampoLeitura rotulo="Tipo" texto={ROTULO_TIPO_FORMA[tipo].texto} ajuda={AJUDA_TIPO} />
      ) : (
        <Segmentado
          legenda="Tipo"
          legendaVisivel
          nome="tipo"
          opcoes={ORDEM_TIPO_FORMA.map((valor) => ({ valor, rotulo: ROTULO_TIPO_FORMA[valor].texto }))}
          valor={tipo}
          aoMudar={mudarTipo}
        />
      )}
      {credito ? (
        <>
          <CampoTexto
            rotulo="Dia de vencimento"
            value={dia}
            inputMode="numeric"
            autoComplete="off"
            onChange={(e) => {
              setDia(e.target.value);
              setErros((atuais) => ({ ...atuais, dia: undefined }));
            }}
            ajuda={erros.dia ? undefined : AJUDA_DIA}
            erro={erros.dia}
          />
          <Selecao
            rotulo="Conta de pagamento padrão (opcional)"
            value={contaId}
            onChange={(e) => setContaId(e.target.value)}
            opcoes={[{ valor: '', rotulo: 'Nenhuma' }, ...opcoesConta]}
          />
        </>
      ) : (
        <Selecao
          rotulo="Conta de origem"
          value={contaId}
          onChange={(e) => {
            setContaId(e.target.value);
            setErros((atuais) => ({ ...atuais, conta: undefined }));
          }}
          opcoes={[{ valor: '', rotulo: 'Escolha a conta' }, ...opcoesConta]}
          ajuda={erros.conta ? undefined : 'Obrigatória.'}
          erro={erros.conta}
        />
      )}
      <Interruptor
        rotulo="Preferida no lançamento rápido"
        checked={preferida}
        onChange={(e) => setPreferida(e.target.checked)}
      />
      <div className={estilo.acoes}>{children}</div>
    </form>
  );
}
