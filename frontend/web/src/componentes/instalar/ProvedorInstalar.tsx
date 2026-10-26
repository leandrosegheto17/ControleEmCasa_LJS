import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useSearchParams } from 'react-router';
import { ContextoInstalar } from './ContextoInstalar';
import { FaixaInstalar } from './FaixaInstalar';
import { FolhaInstalar } from './FolhaInstalar';

interface Props {
  plataforma: 'ios' | 'android' | 'outra';
  instalado: boolean;
  temPrompt: boolean;
  mostrarFaixa: boolean;
  /** Chama o prompt nativo; só dentro do clique do usuário. */
  aoPedirPrompt: () => void;
  aoDispensar: () => void;
  children: ReactNode;
}

/** Monta a folha de instalação uma vez (vale sobre qualquer tela) e entrega faixa e ação às telas. */
export function ProvedorInstalar({
  plataforma,
  instalado,
  temPrompt,
  mostrarFaixa,
  aoPedirPrompt,
  aoDispensar,
  children,
}: Props) {
  const [aberta, definirAberta] = useState(false);
  const [params, definirParams] = useSearchParams();
  const tratado = useRef(false);

  function instalar() {
    if (plataforma !== 'ios' && temPrompt) {
      definirAberta(false);
      aoPedirPrompt();
    } else if (plataforma !== 'outra') {
      definirAberta(true);
    }
  }

  // `/ajustes?instalar=1` (passo "Instale o app" dos primeiros passos) abre a folha e limpa o parâmetro.
  useEffect(() => {
    if (params.get('instalar') !== '1' || tratado.current) return;
    tratado.current = true;
    if (!instalado) definirAberta(plataforma !== 'outra');
    const resto = new URLSearchParams(params);
    resto.delete('instalar');
    definirParams(resto, { replace: true });
  }, [params, definirParams, instalado, plataforma]);

  useEffect(() => {
    if (params.get('instalar') !== '1') tratado.current = false;
  }, [params]);

  const faixa = mostrarFaixa ? <FaixaInstalar aoInstalar={instalar} aoDispensar={aoDispensar} /> : null;

  return (
    <ContextoInstalar.Provider value={{ instalado, instalar, faixa }}>
      {children}
      {plataforma === 'outra' ? null : (
        <FolhaInstalar
          aberta={aberta && !instalado}
          plataforma={plataforma}
          temPrompt={temPrompt}
          aoInstalar={instalar}
          aoFechar={() => definirAberta(false)}
        />
      )}
    </ContextoInstalar.Provider>
  );
}
