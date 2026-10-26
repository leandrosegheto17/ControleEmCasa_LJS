import { useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { CampoTexto } from './base/CampoTexto';
import { CampoValor } from './base/CampoValor';
import { focarPrimeiroErro } from './base/focarPrimeiroErro';
import estilo from './FormularioConta.module.css';

/** Mesmo limite que `api.salvar_conta` aplica ao nome. */
const LIMITE_NOME_CONTA = 80;

interface Props {
  nomeInicial: string;
  saldoInicialCentavos: number;
  /** Erro de valor vindo do servidor, mostrado no campo "Saldo inicial". */
  erroSaldoInicial?: string;
  aoSalvar: (nome: string, saldoInicialCentavos: number) => void;
  /** Botões do formulário; o primeiro ocupa a largura que sobra. */
  children: ReactNode;
}

export function FormularioConta({ nomeInicial, saldoInicialCentavos, erroSaldoInicial, aoSalvar, children }: Props) {
  const [nome, setNome] = useState(nomeInicial);
  const [saldoInicial, setSaldoInicial] = useState(saldoInicialCentavos);
  const [erroNome, setErroNome] = useState<string | undefined>();
  const [tentativasInvalidas, setTentativasInvalidas] = useState(0);
  const formulario = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (tentativasInvalidas > 0 && formulario.current) focarPrimeiroErro(formulario.current);
  }, [tentativasInvalidas]);

  function enviar(evento: FormEvent) {
    evento.preventDefault();
    const nomeLimpo = nome.trim();
    if (!nomeLimpo) {
      setErroNome('Informe o nome da conta');
      setTentativasInvalidas((n) => n + 1);
      return;
    }
    if (nomeLimpo.length > LIMITE_NOME_CONTA) {
      setErroNome(`O nome pode ter no máximo ${LIMITE_NOME_CONTA} caracteres`);
      setTentativasInvalidas((n) => n + 1);
      return;
    }
    setErroNome(undefined);
    aoSalvar(nomeLimpo, saldoInicial);
  }

  return (
    <form ref={formulario} className={estilo.formulario} onSubmit={enviar} noValidate>
      <CampoTexto
        rotulo="Nome"
        value={nome}
        autoComplete="off"
        maxLength={LIMITE_NOME_CONTA}
        onChange={(e) => {
          setNome(e.target.value);
          setErroNome(undefined);
        }}
        erro={erroNome}
      />
      <CampoValor rotulo="Saldo inicial" centavos={saldoInicial} aoMudar={setSaldoInicial} erro={erroSaldoInicial} />
      <div className={estilo.acoes}>{children}</div>
    </form>
  );
}
