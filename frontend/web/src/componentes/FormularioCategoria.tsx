import type { Escopo, TipoLancamento } from '../comum/enums';
import { useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { ORDEM_ESCOPO } from '../rotulos/escopo';
import { ORDEM_TIPO_LANCAMENTO, ROTULO_TIPO_LANCAMENTO } from '../rotulos/tipoLancamento';
import { CampoLeitura } from './base/CampoLeitura';
import { CampoTexto } from './base/CampoTexto';
import { focarPrimeiroErro } from './base/focarPrimeiroErro';
import { Interruptor } from './base/Interruptor';
import { Segmentado } from './base/Segmentado';
import { SeloEscopo } from './base/SeloEscopo';
import estilo from './FormularioCategoria.module.css';

export interface DadosCategoria {
  nome: string;
  tipo: TipoLancamento;
  escopo: Escopo;
  /** Sempre `false` em receita; a tela não envia o campo nesse caso. */
  variavel: boolean;
}

interface Props {
  inicial: DadosCategoria;
  /** Em edição tipo e escopo são só leitura: nunca mudam depois da criação. */
  tipoEscopoFixos: boolean;
  /** Erro de nome vindo do servidor (nome repetido); some quando o nome muda. */
  erroNome?: string;
  aoSalvar: (dados: DadosCategoria) => void;
  /** Botões do formulário; o primeiro ocupa a largura que sobra. */
  children: ReactNode;
}

export const ROTULO_POSSE: Record<Escopo, string> = { conjunto: 'Da casa', individual: 'Minha' };

const AJUDA_CRIACAO = 'A categoria define se o lançamento é da casa ou seu. Receita é sempre "Minha". Não muda depois.';
const AJUDA_VARIAVEL = 'Entra no total de variáveis (meta M1)';

function ajudaLeitura(escopo: Escopo): string {
  return escopo === 'conjunto'
    ? 'Escolhidos na criação. Mudanças no nome valem para os dois.'
    : 'Escolhidos na criação.';
}

export function FormularioCategoria({ inicial, tipoEscopoFixos, erroNome, aoSalvar, children }: Props) {
  const [nome, setNome] = useState(inicial.nome);
  const [tipo, setTipo] = useState(inicial.tipo);
  const [escopo, setEscopo] = useState(inicial.escopo);
  const [variavel, setVariavel] = useState(inicial.variavel);
  const [erroVazio, setErroVazio] = useState<string>();
  const [nomeMudou, setNomeMudou] = useState(false);
  const [tentativas, setTentativas] = useState(0);
  const formulario = useRef<HTMLFormElement>(null);

  const erro = erroVazio ?? (nomeMudou ? undefined : erroNome);

  useEffect(() => {
    if (formulario.current) focarPrimeiroErro(formulario.current);
  }, [tentativas, erroNome]);

  function mudarTipo(novo: string) {
    const proximo = novo as TipoLancamento;
    setTipo(proximo);
    if (proximo === 'receita') setEscopo('individual');
  }

  function enviar(evento: FormEvent) {
    evento.preventDefault();
    const nomeLimpo = nome.trim();
    setNomeMudou(false);
    if (!nomeLimpo) {
      setErroVazio('Informe o nome da categoria');
      setTentativas((n) => n + 1);
      return;
    }
    setErroVazio(undefined);
    aoSalvar({ nome: nomeLimpo, tipo, escopo, variavel: tipo === 'despesa' && variavel });
  }

  return (
    <form ref={formulario} className={estilo.formulario} onSubmit={enviar} noValidate>
      <CampoTexto
        rotulo="Nome"
        value={nome}
        autoComplete="off"
        onChange={(e) => {
          setNome(e.target.value);
          setNomeMudou(true);
          setErroVazio(undefined);
        }}
        erro={erro}
      />
      {tipoEscopoFixos ? (
        <CampoLeitura
          rotulo="Tipo e escopo"
          texto={
            <>
              {ROTULO_TIPO_LANCAMENTO[tipo].texto} · <SeloEscopo escopo={escopo} texto={ROTULO_POSSE[escopo]} />
            </>
          }
          ajuda={ajudaLeitura(escopo)}
        />
      ) : (
        <>
          <Segmentado
            legendaVisivel
            legenda="Tipo"
            nome="tipo"
            opcoes={ORDEM_TIPO_LANCAMENTO.map((valor) => ({ valor, rotulo: ROTULO_TIPO_LANCAMENTO[valor].texto }))}
            valor={tipo}
            aoMudar={mudarTipo}
          />
          <Segmentado
            legendaVisivel
            legenda="Escopo"
            nome="escopo"
            opcoes={ORDEM_ESCOPO.map((valor) => ({
              valor,
              rotulo: ROTULO_POSSE[valor],
              desabilitada: tipo === 'receita' && valor === 'conjunto',
            }))}
            valor={escopo}
            aoMudar={(valor) => setEscopo(valor as Escopo)}
            ajuda={AJUDA_CRIACAO}
          />
        </>
      )}
      {tipo === 'despesa' ? (
        <Interruptor
          rotulo="Gasto variável"
          ajuda={tipoEscopoFixos ? AJUDA_VARIAVEL : undefined}
          checked={variavel}
          onChange={(e) => setVariavel(e.target.checked)}
        />
      ) : null}
      <div className={estilo.acoes}>{children}</div>
    </form>
  );
}
