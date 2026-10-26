import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import estiloBotao from '../base/Botao.module.css';
import { FolhaEnvios } from './FolhaEnvios';

const { mostrar } = vi.hoisted(() => ({ mostrar: vi.fn() }));
vi.mock('../base/useAviso', () => ({ useAviso: () => ({ mostrar }) }));

type Props = Parameters<typeof FolhaEnvios>[0];
type Item = Props['itens'][number];

const NOME_ITEM = /^lançamento Padaria R\$\s12,50$/;
const DESCARTAR = /^Descartar lançamento Padaria R\$\s12,50$/;
const CORRIGIR = /^Corrigir lançamento Padaria R\$\s12,50$/;

function temClasse(el: Element, nome: string) {
  return [...el.classList].some((c) => c === nome || c.startsWith(`_${nome}_`));
}

function item(extra: Partial<Item> = {}): Item {
  return {
    id: '00000000-0000-4000-8000-0000000009a1',
    dono: '00000000-0000-4000-8000-0000000000a1',
    args: {
      p_id: '00000000-0000-4000-8000-0000000009a1',
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

const falhou = () => item({ situacao: 'falhou', motivo: 'categoria_arquivada' } as Partial<Item>);

function props(extra: Partial<Props> = {}): Props {
  return {
    aberta: true,
    itens: [item()],
    enviando: false,
    aoFechar: vi.fn(),
    aoTentarAgora: vi.fn(),
    aoCorrigir: vi.fn(),
    aoDescartar: vi.fn(),
    ...extra,
  } as Props;
}

function folha() {
  return screen.getByRole('dialog', { name: 'Envios pendentes' });
}

function linhaDoItem() {
  return within(within(folha()).getByRole('list')).getAllByRole('listitem')[0];
}

beforeEach(() => {
  mostrar.mockClear();
});

describe('FolhaEnvios — estrutura', () => {
  it('é a folha "Envios pendentes", modal, com X "Fechar" que chama aoFechar', () => {
    const p = props();
    render(<FolhaEnvios {...p} />);
    expect(folha()).toHaveAttribute('aria-modal', 'true');
    fireEvent.click(within(folha()).getByRole('button', { name: 'Fechar' }));
    expect(p.aoFechar).toHaveBeenCalledTimes(1);
  });

  it('fechada, não aparece', () => {
    render(<FolhaEnvios {...props({ aberta: false })} />);
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('item mostra título, valor, escopo, categoria, data e forma do mockup', () => {
    render(<FolhaEnvios {...props()} />);
    const linha = linhaDoItem();
    expect(linha).toHaveTextContent(/Padaria · R\$\s12,50/);
    expect(linha).toHaveTextContent('Almoço/Alimentação fora · 09/10 · Pix Nubank');
    const selo = within(linha).getByText('Eu');
    expect(temClasse(selo.closest('span') as Element, 'selo')).toBe(true);
  });
});

describe('FolhaEnvios — item aguardando', () => {
  it('mostra "aguardando envio" em role=status e não oferece Corrigir', () => {
    render(<FolhaEnvios {...props()} />);
    const linha = linhaDoItem();
    expect(within(linha).getByRole('status')).toHaveTextContent('aguardando envio');
    expect(within(linha).queryByRole('button', { name: CORRIGIR })).toBeNull();
    expect(within(linha).getByRole('button', { name: DESCARTAR })).toHaveTextContent('Descartar');
  });

  it('texto de topo do estado sem falhas', () => {
    render(<FolhaEnvios {...props()} />);
    expect(folha()).toHaveTextContent('Guardados neste aparelho. São enviados sozinhos quando houver conexão.');
  });
});

describe('FolhaEnvios — item com falha', () => {
  it('mostra o motivo em role=status e o botão Corrigir', () => {
    render(<FolhaEnvios {...props({ itens: [falhou()] })} />);
    const linha = linhaDoItem();
    expect(within(linha).getByRole('status')).toHaveTextContent(
      'Falhou: a categoria foi arquivada. Corrija a categoria ou descarte.',
    );
    const corrigir = within(linha).getByRole('button', { name: CORRIGIR });
    expect(corrigir).toHaveTextContent('Corrigir');
    expect(corrigir.classList.contains(estiloBotao.secundario)).toBe(true);
  });

  it('texto de topo do estado com falha', () => {
    render(<FolhaEnvios {...props({ itens: [falhou()] })} />);
    expect(folha()).toHaveTextContent('Guardados neste aparelho. Nada some sem você confirmar.');
  });

  it('Corrigir chama aoCorrigir com o item', () => {
    const itemFalhou = falhou();
    const p = props({ itens: [itemFalhou] });
    render(<FolhaEnvios {...p} />);
    fireEvent.click(within(linhaDoItem()).getByRole('button', { name: CORRIGIR }));
    expect(p.aoCorrigir).toHaveBeenCalledTimes(1);
    expect(p.aoCorrigir).toHaveBeenCalledWith(itemFalhou);
  });

  it('o motivo é anunciado quando o item passa de aguardando para falhou', () => {
    const p = props();
    const { rerender } = render(<FolhaEnvios {...p} />);
    rerender(<FolhaEnvios {...p} itens={[falhou()]} />);
    expect(within(linhaDoItem()).getByRole('status')).toHaveTextContent(/^Falhou: /);
  });
});

describe('FolhaEnvios — Descartar', () => {
  it('abre um alertdialog e não descarta sozinho', () => {
    const p = props();
    render(<FolhaEnvios {...p} />);
    fireEvent.click(within(linhaDoItem()).getByRole('button', { name: DESCARTAR }));
    expect(screen.getByRole('alertdialog')).toHaveAttribute('aria-modal', 'true');
    expect(p.aoDescartar).not.toHaveBeenCalled();
  });

  it('Cancelar fecha o diálogo sem descartar', () => {
    const p = props();
    render(<FolhaEnvios {...p} />);
    fireEvent.click(within(linhaDoItem()).getByRole('button', { name: DESCARTAR }));
    fireEvent.click(within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Cancelar' }));
    expect(screen.queryByRole('alertdialog')).toBeNull();
    expect(p.aoDescartar).not.toHaveBeenCalled();
    expect(linhaDoItem()).toBeInTheDocument();
  });

  it('Esc fecha o diálogo sem descartar', () => {
    const p = props();
    render(<FolhaEnvios {...p} />);
    fireEvent.click(within(linhaDoItem()).getByRole('button', { name: DESCARTAR }));
    fireEvent.keyDown(screen.getByRole('alertdialog'), { key: 'Escape' });
    expect(screen.queryByRole('alertdialog')).toBeNull();
    expect(p.aoDescartar).not.toHaveBeenCalled();
  });

  it('só o botão de confirmar do diálogo descarta, uma vez, o item certo', () => {
    const p = props();
    render(<FolhaEnvios {...p} />);
    fireEvent.click(within(linhaDoItem()).getByRole('button', { name: DESCARTAR }));
    const dialogo = screen.getByRole('alertdialog');
    expect(dialogo).toHaveTextContent('Padaria');
    fireEvent.click(within(dialogo).getByRole('button', { name: 'Descartar' }));
    expect(p.aoDescartar).toHaveBeenCalledTimes(1);
    expect(p.aoDescartar).toHaveBeenCalledWith('00000000-0000-4000-8000-0000000009a1');
  });
});

describe('FolhaEnvios — Tentar agora', () => {
  it('chama aoTentarAgora', () => {
    const p = props({ itens: [falhou()] });
    render(<FolhaEnvios {...p} />);
    fireEvent.click(within(folha()).getByRole('button', { name: 'Tentar agora' }));
    expect(p.aoTentarAgora).toHaveBeenCalledTimes(1);
  });

  it('durante o envio, o botão vira "Enviando…" bloqueado e o item aguardando mostra "Enviando…"', () => {
    const p = props({ enviando: true });
    render(<FolhaEnvios {...p} />);
    const botao = within(folha()).getByRole('button', { name: 'Enviando…' });
    expect(botao).toHaveAttribute('aria-disabled', 'true');
    fireEvent.click(botao);
    expect(p.aoTentarAgora).not.toHaveBeenCalled();
    expect(within(linhaDoItem()).getByRole('status')).toHaveTextContent('Enviando…');
  });

  it('o rodapé usa o botão principal com o ícone recarregar', () => {
    render(<FolhaEnvios {...props()} />);
    const botao = within(folha()).getByRole('button', { name: 'Tentar agora' });
    expect(botao.classList.contains(estiloBotao.principal)).toBe(true);
    expect(botao.querySelector('use[href="#i-recarregar"]')).not.toBeNull();
  });
});

describe('FolhaEnvios — fila esvaziada', () => {
  it('item enviado some da lista', () => {
    const outro = item({
      id: '00000000-0000-4000-8000-0000000009a2',
      args: { ...item().args, p_id: '00000000-0000-4000-8000-0000000009a2', descricao: 'Feira' },
    } as Partial<Item>);
    const p = props({ itens: [item(), outro] });
    const { rerender } = render(<FolhaEnvios {...p} />);
    rerender(<FolhaEnvios {...p} itens={[outro]} />);
    const linhas = within(within(folha()).getByRole('list')).getAllByRole('listitem');
    expect(linhas).toHaveLength(1);
    expect(linhas[0]).toHaveTextContent('Feira');
  });

  it('lista vazia com a folha aberta chama aoFechar e avisa "Tudo enviado"', () => {
    const p = props();
    const { rerender } = render(<FolhaEnvios {...p} />);
    expect(mostrar).not.toHaveBeenCalled();
    rerender(<FolhaEnvios {...p} itens={[]} />);
    expect(p.aoFechar).toHaveBeenCalledTimes(1);
    expect(mostrar).toHaveBeenCalledWith('sucesso', 'Tudo enviado');
  });

  it('fechada, esvaziar não avisa', () => {
    const p = props({ aberta: false });
    const { rerender } = render(<FolhaEnvios {...p} />);
    rerender(<FolhaEnvios {...p} itens={[]} />);
    expect(mostrar).not.toHaveBeenCalled();
    expect(p.aoFechar).not.toHaveBeenCalled();
  });
});

describe('FolhaEnvios — nomes acessíveis', () => {
  it('as ações levam descrição e valor no nome', () => {
    render(<FolhaEnvios {...props({ itens: [falhou()] })} />);
    const linha = linhaDoItem();
    for (const botao of within(linha).getAllByRole('button')) {
      const nome = botao.getAttribute('aria-label') ?? '';
      expect(nome.replace(/^(Corrigir|Descartar) /, '')).toMatch(NOME_ITEM);
    }
  });
});
