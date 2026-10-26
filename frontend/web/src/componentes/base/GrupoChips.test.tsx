import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { focarPrimeiroErro } from './focarPrimeiroErro';
import { GrupoChips } from './GrupoChips';

type Opcao = { valor: string; conteudo: string; desabilitada?: boolean };

const categorias: Opcao[] = [
  { valor: 'almoco', conteudo: 'Almoço/Alimentação fora' },
  { valor: 'mercado', conteudo: 'Mercado' },
  { valor: 'transporte', conteudo: 'Transporte' },
];

function Controlado(props: { opcoes: Opcao[]; inicial?: string; aoMudar: (v: string) => void; erro?: string }) {
  const [valor, setValor] = useState(props.inicial ?? '');
  return (
    <GrupoChips
      nome="categoria"
      rotulo="Categoria"
      variante="grade"
      opcoes={props.opcoes}
      valor={valor}
      erro={props.erro}
      aoMudar={(v: string) => {
        setValor(v);
        props.aoMudar(v);
      }}
    />
  );
}

describe('GrupoChips', () => {
  it('é um radiogroup com o nome da legend visível', () => {
    render(<Controlado opcoes={categorias} aoMudar={vi.fn()} />);

    const grupo = screen.getByRole('radiogroup', { name: 'Categoria' });
    expect(grupo.tagName).toBe('FIELDSET');
    expect(grupo.querySelector('legend')).toHaveTextContent('Categoria');
    expect(screen.getAllByRole('radio')).toHaveLength(3);
  });

  it('cada chip é um rádio nativo achado pelo seu conteúdo', () => {
    render(<Controlado opcoes={categorias} aoMudar={vi.fn()} />);

    const mercado = screen.getByRole('radio', { name: 'Mercado' });
    expect(mercado).toHaveAttribute('type', 'radio');
    expect(mercado).toHaveAttribute('name', 'categoria');
  });

  it('clique seleciona e chama aoMudar com o valor', async () => {
    const aoMudar = vi.fn();
    const user = userEvent.setup();
    render(<Controlado opcoes={categorias} aoMudar={aoMudar} />);

    await user.click(screen.getByRole('radio', { name: 'Transporte' }));
    expect(aoMudar).toHaveBeenCalledWith('transporte');
    expect(screen.getByRole('radio', { name: 'Transporte' })).toBeChecked();
  });

  it('seta direita e seta baixo movem e selecionam o próximo', async () => {
    const aoMudar = vi.fn();
    const user = userEvent.setup();
    render(<Controlado opcoes={categorias} inicial="almoco" aoMudar={aoMudar} />);

    screen.getByRole('radio', { name: 'Almoço/Alimentação fora' }).focus();
    await user.keyboard('{ArrowRight}');
    expect(aoMudar).toHaveBeenLastCalledWith('mercado');
    expect(screen.getByRole('radio', { name: 'Mercado' })).toHaveFocus();

    await user.keyboard('{ArrowDown}');
    expect(aoMudar).toHaveBeenLastCalledWith('transporte');
    expect(screen.getByRole('radio', { name: 'Transporte' })).toBeChecked();
  });

  it('Tab entra no chip marcado', async () => {
    const user = userEvent.setup();
    render(
      <>
        <button type="button">Antes</button>
        <Controlado opcoes={categorias} inicial="transporte" aoMudar={vi.fn()} />
      </>,
    );

    screen.getByRole('button', { name: 'Antes' }).focus();
    await user.tab();
    expect(screen.getByRole('radio', { name: 'Transporte' })).toHaveFocus();
  });

  it('opção desabilitada é pulada pelas setas', async () => {
    const aoMudar = vi.fn();
    const user = userEvent.setup();
    const opcoes = [
      { valor: 'almoco', conteudo: 'Almoço/Alimentação fora' },
      { valor: 'mercado', conteudo: 'Mercado', desabilitada: true },
      { valor: 'transporte', conteudo: 'Transporte' },
    ];
    render(<Controlado opcoes={opcoes} inicial="almoco" aoMudar={aoMudar} />);

    expect(screen.getByRole('radio', { name: 'Mercado' })).toBeDisabled();
    screen.getByRole('radio', { name: 'Almoço/Alimentação fora' }).focus();
    await user.keyboard('{ArrowRight}');
    expect(aoMudar).toHaveBeenCalledTimes(1);
    expect(aoMudar).toHaveBeenCalledWith('transporte');
  });

  it('erro ligado ao grupo por aria-describedby', () => {
    render(<Controlado opcoes={categorias} aoMudar={vi.fn()} erro="Escolha uma categoria" />);

    const grupo = screen.getByRole('radiogroup', { name: 'Categoria' });
    expect(grupo).toHaveAccessibleDescription('Escolha uma categoria');
    const id = grupo.getAttribute('aria-describedby') ?? '';
    expect(document.getElementById(id.split(' ')[0])).toHaveTextContent('Escolha uma categoria');
  });

  it('com erro, focarPrimeiroErro foca o rádio marcado', () => {
    const { container } = render(
      <Controlado opcoes={categorias} inicial="mercado" aoMudar={vi.fn()} erro="Escolha uma categoria" />,
    );

    expect(focarPrimeiroErro(container)).toBe(true);
    expect(screen.getByRole('radio', { name: 'Mercado' })).toHaveFocus();
  });

  it('com erro e nenhum marcado, focarPrimeiroErro foca o primeiro rádio', () => {
    const { container } = render(<Controlado opcoes={categorias} aoMudar={vi.fn()} erro="Escolha uma categoria" />);

    expect(focarPrimeiroErro(container)).toBe(true);
    expect(screen.getByRole('radio', { name: 'Almoço/Alimentação fora' })).toHaveFocus();
  });

  it('sem erro, focarPrimeiroErro não acha nada no grupo', () => {
    const { container } = render(<Controlado opcoes={categorias} aoMudar={vi.fn()} />);

    expect(focarPrimeiroErro(container)).toBe(false);
  });

  it('sem erro, o grupo não tem descrição', () => {
    render(<Controlado opcoes={categorias} aoMudar={vi.fn()} />);

    expect(screen.getByRole('radiogroup')).not.toHaveAttribute('aria-describedby');
  });

  it('conteúdo é renderizado como nó React, não como HTML', () => {
    render(<Controlado opcoes={[{ valor: 'x', conteudo: '<b>X</b>' }]} aoMudar={vi.fn()} />);

    expect(screen.getByRole('radiogroup').querySelector('b')).toBeNull();
  });
});
