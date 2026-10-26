import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { situacaoEnvio, subtituloEnvio, textoEnviado, tituloEnvio } from './textoEnvio';

const RESPOSTAS = new URL('../../../test/fixtures/respostas/', import.meta.url);

function resposta(nome: string) {
  return JSON.parse(readFileSync(new URL(nome, RESPOSTAS), 'utf8'));
}

type Item = Parameters<typeof tituloEnvio>[0];

function itemPadaria(extra: Partial<Item> = {}): Item {
  return {
    id: '00000000-0000-4000-8000-0000000009a1',
    dono: '00000000-0000-4000-8000-0000000000a1',
    args: {
      id: '00000000-0000-4000-8000-0000000009a1',
      valor_centavos: 1250,
      categoria_id: '00000000-0000-4000-8000-000000000411',
      forma_id: '00000000-0000-4000-8000-000000000301',
      parcelas: 1,
      data: '2026-10-09',
      descricao: 'Padaria',
    },
    exibicao: { categoria_nome: 'Almoço/Alimentação fora', forma_nome: 'Pix Nubank', escopo: 'individual' },
    criadoEm: '2026-10-09T12:30:00.000Z',
    situacao: 'aguardando',
    ...extra,
  } as Item;
}

describe('tituloEnvio', () => {
  it('usa a descrição do lançamento', () => {
    expect(tituloEnvio(itemPadaria())).toBe('Padaria');
  });

  it('sem descrição, usa o nome da categoria', () => {
    const item = itemPadaria();
    expect(tituloEnvio({ ...item, args: { ...item.args, descricao: '' } })).toBe('Almoço/Alimentação fora');
  });
});

describe('subtituloEnvio', () => {
  it('categoria · data curta · forma, como no mockup', () => {
    expect(subtituloEnvio(itemPadaria())).toBe('Almoço/Alimentação fora · 09/10 · Pix Nubank');
  });
});

describe('situacaoEnvio', () => {
  it('aguardando → "aguardando envio"', () => {
    expect(situacaoEnvio(itemPadaria())).toBe('aguardando envio');
  });

  it('falhou por categoria arquivada → texto do mockup', () => {
    const item = itemPadaria({ situacao: 'falhou', motivo: 'categoria_arquivada' } as Partial<Item>);
    expect(situacaoEnvio(item)).toBe('Falhou: a categoria foi arquivada. Corrija a categoria ou descarte.');
  });

  it('outras falhas trazem o motivo traduzido, nunca o código cru', () => {
    for (const motivo of ['registro_invalido', 'valor_invalido', 'desconhecido']) {
      const texto = situacaoEnvio(itemPadaria({ situacao: 'falhou', motivo } as Partial<Item>));
      expect(texto).toMatch(/^Falhou: /);
      expect(texto.length).toBeGreaterThan('Falhou: '.length);
      expect(texto).not.toContain(motivo);
    }
  });
});

describe('textoEnviado', () => {
  it('crédito: "Enviado: 1ª parcela em 10/11" a partir da resposta do servidor', () => {
    expect(textoEnviado(resposta('lancar-despesa-credito.json'))).toBe('Enviado: 1ª parcela em 10/11');
  });

  it('à vista: começa com "Enviado:" e não fala em parcela', () => {
    const avista = {
      ...resposta('lancar-despesa-credito.json'),
      num_parcelas: 1,
      valor_total_centavos: 1250,
      primeira_parcela_data: '2026-10-09',
    };
    const texto = textoEnviado(avista);
    expect(texto).toMatch(/^Enviado: /);
    expect(texto).not.toMatch(/parcela/);
  });
});
