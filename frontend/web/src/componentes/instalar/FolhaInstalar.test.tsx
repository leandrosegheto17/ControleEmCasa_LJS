import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { FolhaInstalar } from './FolhaInstalar';
import botao from '../base/Botao.module.css';
import botaoIcone from '../base/BotaoIcone.module.css';

type Props = Parameters<typeof FolhaInstalar>[0];

function temClasse(el: Element, nome: string) {
  return [...el.classList].some((c) => c === nome || c.startsWith(`_${nome}_`));
}

function renderizar(props: Partial<Props> = {}) {
  const aoInstalar = vi.fn();
  const aoFechar = vi.fn();
  const resultado = render(
    <FolhaInstalar aberta plataforma="ios" temPrompt={false} aoInstalar={aoInstalar} aoFechar={aoFechar} {...props} />,
  );
  return { ...resultado, aoInstalar, aoFechar };
}

describe('FolhaInstalar no iOS', () => {
  it('é um diálogo modal "Instalar no iPhone" com o texto do mockup', () => {
    renderizar();
    const folha = screen.getByRole('dialog', { name: 'Instalar no iPhone' });
    expect(folha).toHaveAttribute('aria-modal', 'true');
    expect(folha).toHaveTextContent(
      'Com o app na tela de início, ele abre em tela cheia e o lançamento fica a um toque.',
    );
  });

  it('mostra os 3 passos em texto, na ordem do mockup', () => {
    renderizar();
    const folha = screen.getByRole('dialog', { name: 'Instalar no iPhone' });
    const passos = within(within(folha).getByRole('list')).getAllByRole('listitem');
    expect(passos).toHaveLength(3);
    expect(passos[0]).toHaveTextContent('No Safari, toque em Compartilhar');
    expect(passos[1]).toHaveTextContent('Escolha Adicionar à Tela de Início');
    expect(passos[2]).toHaveTextContent('Toque em Adicionar. O ícone "Controle em Casa" aparece na tela de início.');
    expect(within(passos[0]).getByText('Compartilhar').tagName).toBe('STRONG');
    expect(within(passos[1]).getByText('Adicionar à Tela de Início').tagName).toBe('STRONG');
  });

  it('os números dos passos ficam ocultos do leitor de tela', () => {
    renderizar();
    const folha = screen.getByRole('dialog', { name: 'Instalar no iPhone' });
    const numeros = [...folha.querySelectorAll('li > span:first-child')];
    expect(numeros.map((n) => n.textContent)).toEqual(['1', '2', '3']);
    numeros.forEach((n) => {
      expect(n).toHaveAttribute('aria-hidden', 'true');
      expect(temClasse(n, 'passo-num')).toBe(true);
    });
  });

  it('os ícones dos passos têm texto alternativo', () => {
    renderizar();
    const compartilhar = screen.getByRole('img', { name: '(ícone de quadrado com seta para cima)' });
    const adicionar = screen.getByRole('img', { name: '(ícone de quadrado com sinal de mais)' });
    expect(compartilhar.querySelector('use')).toHaveAttribute('href', '#i-compartilhar');
    expect(adicionar.querySelector('use')).toHaveAttribute('href', '#i-adicionar');
  });

  it('"Agora não" e o X só fecham', () => {
    const { aoFechar, aoInstalar } = renderizar();
    fireEvent.click(screen.getByRole('button', { name: 'Agora não' }));
    expect(aoFechar).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole('button', { name: 'Fechar' }));
    expect(aoFechar).toHaveBeenCalledTimes(2);
    expect(aoInstalar).not.toHaveBeenCalled();
  });

  it('"Agora não" ocupa a largura com alvo pela classe e não há style inline', () => {
    renderizar();
    const agoraNao = screen.getByRole('button', { name: 'Agora não' });
    expect(agoraNao.classList.contains(botao.botao)).toBe(true);
    expect(agoraNao.classList.contains(botao.secundario)).toBe(true);
    expect(agoraNao.classList.contains(botao.bloco)).toBe(true);
    expect(screen.getByRole('button', { name: 'Fechar' }).classList.contains(botaoIcone.botao)).toBe(true);
    expect(document.body.querySelector('[style]')).toBeNull();
  });

  it('fechada, não mostra o diálogo', () => {
    renderizar({ aberta: false });
    expect(screen.queryByRole('dialog')).toBeNull();
  });
});

describe('FolhaInstalar no Android', () => {
  it('sem prompt nativo, mostra os 3 passos manuais', () => {
    const { aoInstalar } = renderizar({ plataforma: 'android', temPrompt: false });
    const folha = screen.getByRole('dialog', { name: /Android/ });
    expect(within(within(folha).getByRole('list')).getAllByRole('listitem')).toHaveLength(3);
    expect(folha).toHaveTextContent('Instalar app');
    expect(within(folha).queryByRole('button', { name: 'Instalar' })).toBeNull();
    expect(aoInstalar).not.toHaveBeenCalled();
  });

  it('sem prompt, "Agora não" fecha', () => {
    const { aoFechar } = renderizar({ plataforma: 'android', temPrompt: false });
    fireEvent.click(screen.getByRole('button', { name: 'Agora não' }));
    expect(aoFechar).toHaveBeenCalledTimes(1);
  });

  it('com prompt nativo, "Instalar" chama aoInstalar', () => {
    const { aoInstalar } = renderizar({ plataforma: 'android', temPrompt: true });
    const folha = screen.getByRole('dialog');
    fireEvent.click(within(folha).getByRole('button', { name: 'Instalar' }));
    expect(aoInstalar).toHaveBeenCalledTimes(1);
  });
});
