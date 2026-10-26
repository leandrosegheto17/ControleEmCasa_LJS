import { describe, it, expect, vi } from 'vitest';
import { useState, type FormEvent } from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { Botao } from './Botao';

describe('Botao', () => {
  it.each([
    ['principal', /principal/],
    ['secundario', /secundario/],
    ['perigo', /perigo/],
    ['texto', /texto/],
  ] as const)('variante %s gera a classe certa', (variante, classe) => {
    render(<Botao variante={variante}>Ação</Botao>);
    expect(screen.getByRole('button', { name: 'Ação' }).className).toMatch(classe);
  });

  it('bloco acrescenta a classe de bloco', () => {
    render(
      <Botao variante="principal" bloco>
        Salvar
      </Botao>,
    );
    expect(screen.getByRole('button', { name: 'Salvar' }).className).toMatch(/bloco/);
  });

  it('o tipo padrão é button', () => {
    render(<Botao variante="principal">Salvar</Botao>);
    expect(screen.getByRole('button', { name: 'Salvar' })).toHaveAttribute('type', 'button');
  });

  it('com icone renderiza o ícone decorativo antes do texto', () => {
    render(
      <Botao variante="perigo" icone="lixo">
        Excluir
      </Botao>,
    );
    const botao = screen.getByRole('button', { name: 'Excluir' });
    const svg = botao.querySelector('svg');
    expect(svg).toHaveAttribute('aria-hidden', 'true');
    expect(botao.querySelector('use')?.getAttribute('href')).toBe('#i-lixo');
  });

  it('clique chama onClick', () => {
    const aoClicar = vi.fn();
    render(
      <Botao variante="principal" onClick={aoClicar}>
        Salvar
      </Botao>,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Salvar' }));
    expect(aoClicar).toHaveBeenCalledTimes(1);
  });

  describe('salvando', () => {
    it('mostra "Salvando…" com o ícone recarregar e aria-disabled="true"', () => {
      render(
        <Botao variante="principal" salvando>
          Salvar
        </Botao>,
      );
      const botao = screen.getByRole('button', { name: 'Salvando…' });
      expect(botao).toHaveAttribute('aria-disabled', 'true');
      expect(botao.querySelector('use')?.getAttribute('href')).toBe('#i-recarregar');
      expect(screen.queryByText('Salvar')).toBeNull();
    });

    it('não aplica classe "salvando" (estado expresso por aria-disabled)', () => {
      render(
        <Botao variante="principal" salvando>
          Salvar
        </Botao>,
      );
      expect(screen.getByRole('button', { name: 'Salvando…' }).className).not.toMatch(/salvando|undefined/);
    });

    it('continua focável (não usa disabled)', () => {
      render(
        <Botao variante="principal" salvando>
          Salvar
        </Botao>,
      );
      const botao = screen.getByRole('button', { name: 'Salvando…' });
      expect(botao).not.toHaveAttribute('disabled');
      botao.focus();
      expect(botao).toHaveFocus();
    });

    it('clique não chama onClick', () => {
      const aoClicar = vi.fn();
      render(
        <Botao variante="principal" salvando onClick={aoClicar}>
          Salvar
        </Botao>,
      );
      fireEvent.click(screen.getByRole('button', { name: 'Salvando…' }));
      expect(aoClicar).not.toHaveBeenCalled();
    });

    it('submit do formulário não dispara de novo enquanto salva', () => {
      const aoEnviar = vi.fn((e: FormEvent) => e.preventDefault());

      function Formulario() {
        const [salvando, setSalvando] = useState(false);
        return (
          <form
            onSubmit={(e) => {
              aoEnviar(e);
              setSalvando(true);
            }}
          >
            <Botao variante="principal" tipo="submit" salvando={salvando}>
              Salvar
            </Botao>
          </form>
        );
      }

      render(<Formulario />);
      fireEvent.click(screen.getByRole('button', { name: 'Salvar' }));
      expect(aoEnviar).toHaveBeenCalledTimes(1);
      fireEvent.click(screen.getByRole('button', { name: 'Salvando…' }));
      fireEvent.click(screen.getByRole('button', { name: 'Salvando…' }));
      expect(aoEnviar).toHaveBeenCalledTimes(1);
    });
  });
});
