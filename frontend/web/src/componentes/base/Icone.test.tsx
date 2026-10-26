import { readdirSync, readFileSync } from 'node:fs';
import { render } from '@testing-library/react';
import { describe, expect, expectTypeOf, it } from 'vitest';
import { Icone, type NomeIcone } from './Icone';
import { SpriteIcones } from './SpriteIcones';

// SPEC_DEVIATION: o mockup do legado (`.md/mockup/telas/`) não faz parte deste repositório; a lista de símbolos do
// mockup fica fixada aqui e os ícones usados são conferidos nos fontes do próprio app.
const SIMBOLOS_DO_MOCKUP = [
  'i-adicionar', 'i-ajustes', 'i-alerta', 'i-alvo', 'i-aviso', 'i-baixo', 'i-banco', 'i-busca', 'i-calendario',
  'i-cartao', 'i-casa', 'i-compartilhar', 'i-dir', 'i-editar', 'i-envio', 'i-esq', 'i-estrela', 'i-fechar',
  'i-grafico', 'i-lista', 'i-lixo', 'i-mais', 'i-marcado', 'i-offline', 'i-ok', 'i-olho', 'i-pessoa',
  'i-recarregar', 'i-relogio', 'i-sair',
]; // prettier-ignore

const RAIZ_SRC = new URL('../../', import.meta.url);

function fontesTsx(pasta: URL): string[] {
  return readdirSync(pasta, { withFileTypes: true }).flatMap((e) => {
    const destino = new URL(e.isDirectory() ? `${e.name}/` : e.name, pasta);
    if (e.isDirectory()) return fontesTsx(destino);
    return e.name.endsWith('.tsx') && !e.name.endsWith('.test.tsx') ? [readFileSync(destino, 'utf8')] : [];
  });
}

function unicos(textos: string[], padrao: RegExp): string[] {
  const achados = new Set<string>();
  for (const texto of textos) for (const m of texto.matchAll(padrao)) achados.add(m[1]);
  return [...achados].sort();
}

function idsDoSprite(): string[] {
  const { container } = render(<SpriteIcones />);
  return [...container.querySelectorAll('symbol')].map((s) => s.id).sort();
}

describe('Icone', () => {
  it('renderiza <use href="#i-casa"> num svg oculto do leitor de tela', () => {
    const { container } = render(<Icone nome="casa" />);
    const svg = container.querySelector('svg');
    expect(svg).toHaveAttribute('aria-hidden', 'true');
    expect(svg).toHaveClass('icone');
    expect(svg?.querySelector('use')).toHaveAttribute('href', '#i-casa');
  });

  it('o nome do ícone é tipado', () => {
    expectTypeOf<'casa'>().toMatchTypeOf<NomeIcone>();
    expectTypeOf<'inexistente'>().not.toMatchTypeOf<NomeIcone>();
  });
});

describe('SpriteIcones', () => {
  it('é um svg 0×0 oculto do leitor de tela', () => {
    const { container } = render(<SpriteIcones />);
    const svg = container.querySelector('svg');
    expect(svg).toHaveAttribute('aria-hidden');
    expect(svg).toHaveAttribute('width', '0');
    expect(svg).toHaveAttribute('height', '0');
  });

  it('tem os 30 símbolos, um por nome de ícone, sem repetição', () => {
    const ids = idsDoSprite();
    expect(ids).toHaveLength(30);
    expect(new Set(ids).size).toBe(30);
    for (const id of ids) {
      expect(id).toMatch(/^i-[a-z-]+$/);
      const { container } = render(<Icone nome={id.slice(2) as NomeIcone} />);
      expect(container.querySelector('use')).toHaveAttribute('href', `#${id}`);
    }
  });

  it('tem exatamente os símbolos que o mockup define', () => {
    expect(idsDoSprite()).toEqual([...SIMBOLOS_DO_MOCKUP].sort());
  });

  it('todo ícone usado nos componentes (nome="…") tem símbolo no sprite', () => {
    const textos = fontesTsx(RAIZ_SRC);
    const usados = unicos(textos, /<Icone[^>]*nome="([a-z-]+)"/g).map((nome) => `i-${nome}`);
    expect(usados.length).toBeGreaterThan(0);
    const doSprite = new Set(idsDoSprite());
    expect(usados.filter((id) => !doSprite.has(id))).toEqual([]);
  });
});
