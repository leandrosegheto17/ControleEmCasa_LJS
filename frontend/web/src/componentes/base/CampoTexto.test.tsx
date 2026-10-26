import { describe, it, expect, vi } from 'vitest';
import { createRef, useState } from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { CampoTexto } from './CampoTexto';

function idsDescritos(campo: HTMLElement): string[] {
  return (campo.getAttribute('aria-describedby') ?? '').split(/\s+/).filter(Boolean);
}

function Controlado(props: { erro?: string; ajuda?: string; desabilitado?: boolean; aoMudar?: (v: string) => void }) {
  const [valor, setValor] = useState('');
  return (
    <CampoTexto
      rotulo="Descrição"
      value={valor}
      onChange={(e) => {
        setValor(e.target.value);
        props.aoMudar?.(e.target.value);
      }}
      erro={props.erro}
      ajuda={props.ajuda}
      desabilitado={props.desabilitado}
    />
  );
}

describe('CampoTexto', () => {
  it('é achado pelo rótulo visível', () => {
    render(<Controlado />);
    const campo = screen.getByLabelText('Descrição');
    expect(campo.tagName).toBe('INPUT');
    expect(screen.getByText('Descrição').tagName).toBe('LABEL');
  });

  it('sem erro: sem aria-invalid e aria-describedby só com a ajuda', () => {
    render(<Controlado ajuda="Como aparece na lista" />);
    const campo = screen.getByLabelText('Descrição');
    expect(campo).not.toHaveAttribute('aria-invalid');
    const ids = idsDescritos(campo);
    expect(ids).toHaveLength(1);
    expect(document.getElementById(ids[0])).toHaveTextContent('Como aparece na lista');
    expect(campo).toHaveAccessibleDescription('Como aparece na lista');
  });

  it('sem erro nem ajuda: sem aria-describedby', () => {
    render(<Controlado />);
    expect(idsDescritos(screen.getByLabelText('Descrição'))).toHaveLength(0);
  });

  it('com erro: aria-invalid="true" e aria-describedby = erro, depois ajuda', () => {
    render(<Controlado erro="Informe a descrição." ajuda="Como aparece na lista" />);
    const campo = screen.getByLabelText('Descrição');
    expect(campo).toHaveAttribute('aria-invalid', 'true');
    const [idErro, idAjuda] = idsDescritos(campo);
    expect(document.getElementById(idErro)).toHaveTextContent('Informe a descrição.');
    expect(document.getElementById(idAjuda)).toHaveTextContent('Como aparece na lista');
    expect(campo).toHaveAccessibleDescription(/Informe a descrição\./);
  });

  it('a mensagem de erro traz o ícone de alerta decorativo e não é role=alert', () => {
    render(<Controlado erro="Informe a descrição." />);
    const [idErro] = idsDescritos(screen.getByLabelText('Descrição'));
    const erro = document.getElementById(idErro) as HTMLElement;
    expect(erro.querySelector('use')?.getAttribute('href')).toBe('#i-alerta');
    expect(erro.querySelector('svg')).toHaveAttribute('aria-hidden', 'true');
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('digitar chama onChange', () => {
    const aoMudar = vi.fn();
    render(<Controlado aoMudar={aoMudar} />);
    fireEvent.change(screen.getByLabelText('Descrição'), { target: { value: 'Mercado' } });
    expect(aoMudar).toHaveBeenCalledWith('Mercado');
    expect(screen.getByLabelText('Descrição')).toHaveValue('Mercado');
  });

  it('desabilitado aplica disabled', () => {
    render(<Controlado desabilitado />);
    expect(screen.getByLabelText('Descrição')).toBeDisabled();
  });

  it('aceita type email e password com autoComplete', () => {
    render(
      <>
        <CampoTexto rotulo="E-mail" type="email" autoComplete="email" />
        <CampoTexto rotulo="Senha" type="password" autoComplete="current-password" />
      </>,
    );
    expect(screen.getByLabelText('E-mail')).toHaveAttribute('type', 'email');
    expect(screen.getByLabelText('E-mail')).toHaveAttribute('autocomplete', 'email');
    expect(screen.getByLabelText('Senha')).toHaveAttribute('type', 'password');
    expect(screen.getByLabelText('Senha')).toHaveAttribute('autocomplete', 'current-password');
  });

  it('o tipo padrão é text', () => {
    render(<CampoTexto rotulo="Nome" />);
    expect(screen.getByLabelText('Nome')).toHaveAttribute('type', 'text');
  });

  it('repassa a ref para o input', () => {
    const ref = createRef<HTMLInputElement>();
    render(<CampoTexto rotulo="Nome" ref={ref} />);
    expect(ref.current).toBe(screen.getByLabelText('Nome'));
    ref.current?.focus();
    expect(ref.current).toHaveFocus();
  });

  it('dois campos na mesma página têm ids distintos', () => {
    render(
      <>
        <CampoTexto rotulo="Nome" erro="Erro A" />
        <CampoTexto rotulo="Apelido" erro="Erro B" />
      </>,
    );
    expect(screen.getByLabelText('Nome').id).not.toBe(screen.getByLabelText('Apelido').id);
    expect(screen.getByLabelText('Nome')).toHaveAccessibleDescription('Erro A');
    expect(screen.getByLabelText('Apelido')).toHaveAccessibleDescription('Erro B');
  });
});
