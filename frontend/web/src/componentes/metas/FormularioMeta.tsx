import type { Escopo } from '../../comum/enums';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Botao } from '../base/Botao';
import { CampoData } from '../base/CampoData';
import { CampoLeitura } from '../base/CampoLeitura';
import { CampoTexto } from '../base/CampoTexto';
import { CampoValor } from '../base/CampoValor';
import { focarPrimeiroErro } from '../base/focarPrimeiroErro';
import { Segmentado } from '../base/Segmentado';
import { SeloEscopo } from '../base/SeloEscopo';
import estilo from './FormularioMeta.module.css';

export interface DadosMeta {
  nome: string;
  alvoCentavos: number;
  /** `AAAA-MM`, ou nulo sem prazo. */
  prazo: string | null;
  /** Só na criação; na edição o escopo não muda. */
  escopo?: Escopo;
}

interface Props {
  /** Meta aberta para edição; sem ela o formulário cria uma meta. */
  inicial?: { nome: string; alvoCentavos: number; prazo: string | null; escopo: Escopo };
  /** Escopo marcado na criação. */
  escopoPadrao?: Escopo;
  salvando: boolean;
  aoSalvar: (dados: DadosMeta) => void;
}

const OPCOES_ESCOPO = [
  { valor: 'individual', rotulo: 'Minha' },
  { valor: 'conjunto', rotulo: 'Da casa' },
];

export function FormularioMeta({ inicial, escopoPadrao = 'individual', salvando, aoSalvar }: Props) {
  const [nome, setNome] = useState(inicial?.nome ?? '');
  const [alvo, setAlvo] = useState(inicial?.alvoCentavos ?? 0);
  const [prazo, setPrazo] = useState(inicial?.prazo ?? '');
  const [escopo, setEscopo] = useState<Escopo>(escopoPadrao);
  const [erros, setErros] = useState<{ nome?: string; alvo?: string }>({});
  const [tentativasInvalidas, setTentativasInvalidas] = useState(0);
  const formulario = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (tentativasInvalidas > 0 && formulario.current) focarPrimeiroErro(formulario.current);
  }, [tentativasInvalidas]);

  function enviar(evento: FormEvent) {
    evento.preventDefault();
    const novos = {
      nome: nome.trim() ? undefined : 'Informe o nome da meta.',
      alvo: alvo > 0 ? undefined : 'Informe um valor-alvo maior que zero.',
    };
    setErros(novos);
    if (novos.nome || novos.alvo) {
      setTentativasInvalidas((n) => n + 1);
      return;
    }
    aoSalvar({
      nome: nome.trim(),
      alvoCentavos: alvo,
      prazo: prazo || null,
      ...(inicial === undefined && { escopo }),
    });
  }

  return (
    <form ref={formulario} className={estilo.formulario} onSubmit={enviar} noValidate>
      <CampoTexto
        id="nome"
        rotulo="Nome"
        value={nome}
        autoComplete="off"
        onChange={(e) => {
          setNome(e.target.value);
          setErros((atuais) => ({ ...atuais, nome: undefined }));
        }}
        erro={erros.nome}
      />
      <CampoValor
        id="alvo"
        rotulo="Valor-alvo"
        centavos={alvo}
        aoMudar={(centavos) => {
          setAlvo(centavos);
          setErros((atuais) => ({ ...atuais, alvo: undefined }));
        }}
        erro={erros.alvo}
      />
      <CampoData
        id="prazo"
        tipo="month"
        rotulo="Prazo (opcional)"
        value={prazo}
        onChange={(e) => setPrazo(e.target.value)}
        ajuda={inicial ? 'Com prazo, o app mostra quanto guardar por mês.' : undefined}
      />
      {inicial ? (
        <CampoLeitura
          rotulo="Escopo"
          texto={<SeloEscopo escopo={inicial.escopo} texto={inicial.escopo === 'conjunto' ? 'Da casa' : 'Minha'} />}
          ajuda="O escopo é escolhido na criação e não muda depois, para não expor o histórico."
        />
      ) : (
        <Segmentado
          legenda="Escopo"
          legendaVisivel
          nome="escopo"
          opcoes={OPCOES_ESCOPO}
          valor={escopo}
          aoMudar={(valor) => setEscopo(valor as Escopo)}
          ajuda="Minha: só você vê. Da casa: os dois veem alvo, guardado, aportes e onde está guardado. Não muda depois."
        />
      )}
      <div className={estilo.acoes}>
        <Botao variante="principal" tipo="submit" salvando={salvando}>
          {inicial ? 'Salvar' : 'Criar meta'}
        </Botao>
      </div>
    </form>
  );
}
