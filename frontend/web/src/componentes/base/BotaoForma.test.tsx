import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ROTULO_TIPO_FORMA } from '../../rotulos/tipoForma';
import { BotaoForma } from './BotaoForma';

// Dados de exemplo (os mesmos ids e nomes do mockup do legado).
const dados = {
  formas: [
    { id: '00000000-0000-4000-8000-000000000301', nome: 'Pix Nubank', tipo: 'pix' as const },
    { id: '00000000-0000-4000-8000-000000000302', nome: 'Débito Itaú', tipo: 'debito' as const },
    { id: '00000000-0000-4000-8000-000000000303', nome: 'Cartão de crédito XP', tipo: 'credito' as const },
  ],
  contas: [
    { id: '00000000-0000-4000-8000-000000000201', nome: 'Nubank' },
    { id: '00000000-0000-4000-8000-000000000202', nome: 'Itaú' },
  ],
};

const formas = dados.formas.map((f) => ({
  id: f.id,
  nome: f.nome,
  detalhe: ROTULO_TIPO_FORMA[f.tipo].texto,
}));
const contas = dados.contas.map((c) => ({ id: c.id, nome: c.nome }));

const PIX = '00000000-0000-4000-8000-000000000301';
const XP = '00000000-0000-4000-8000-000000000303';

type Opcao = { id: string; nome: string; detalhe?: string };

function Controlado(props: {
  opcoes: Opcao[];
  inicial: string;
  aoEscolher: (id: string) => void;
  rotulo?: string;
  id?: string;
  ajuda?: string;
}) {
  const [valor, setValor] = useState(props.inicial);
  return (
    <>
      <BotaoForma
        rotulo={props.rotulo ?? 'Forma de pagamento'}
        id={props.id}
        ajuda={props.ajuda}
        opcoes={props.opcoes}
        valor={valor}
        aoEscolher={(id: string) => {
          setValor(id);
          props.aoEscolher(id);
        }}
      />
      <button type="button">Depois</button>
    </>
  );
}

function botao() {
  return screen.getByRole('button', { name: /^Forma de pagamento/ });
}

function opcoes() {
  const radios = screen.queryAllByRole('radio');
  return radios.length > 0 ? radios : screen.getAllByRole('option');
}

function opcao(nome: RegExp) {
  const achada = opcoes().find(
    (o) =>
      nome.test(o.textContent ?? '') ||
      nome.test(o.getAttribute('aria-label') ?? '') ||
      nome.test(o.closest('label')?.textContent ?? ''),
  );
  if (!achada) throw new Error(`opção ${nome} não encontrada`);
  return achada;
}

function listaAberta() {
  return screen.queryAllByRole('radio').length > 0 || screen.queryAllByRole('option').length > 0;
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('BotaoForma', () => {
  it('nome acessível junta o rótulo, a forma atual e o tipo', () => {
    render(<Controlado opcoes={formas} inicial={PIX} aoEscolher={vi.fn()} />);

    expect(botao()).toHaveAccessibleName('Forma de pagamento Pix Nubank · Pix');
    expect(botao()).toHaveAttribute('aria-expanded', 'false');
    expect(listaAberta()).toBe(false);
  });

  it('ids padrão batem com o mockup (forma-rotulo e forma-atual)', () => {
    render(<Controlado opcoes={formas} inicial={PIX} aoEscolher={vi.fn()} />);

    expect(document.getElementById('forma-rotulo')).toHaveTextContent('Forma de pagamento');
    expect(document.getElementById('forma-atual')).toHaveTextContent('Pix Nubank · Pix');
  });

  it('o toque abre a lista na ordem recebida e foca a opção marcada', async () => {
    const user = userEvent.setup();
    render(<Controlado opcoes={formas} inicial={PIX} aoEscolher={vi.fn()} />);

    await user.click(botao());

    expect(botao()).toHaveAttribute('aria-expanded', 'true');
    const controlada = botao().getAttribute('aria-controls');
    expect(controlada).toBeTruthy();
    expect(document.getElementById(controlada as string)).toBeInTheDocument();

    const textos = opcoes().map((o) => o.closest('label')?.textContent ?? o.textContent ?? '');
    expect(textos[0]).toMatch(/Pix Nubank/);
    expect(textos[1]).toMatch(/Débito Itaú/);
    expect(textos[2]).toMatch(/Cartão de crédito XP/);
    expect(document.activeElement).toBe(opcao(/Pix Nubank/));
  });

  it('escolher outra forma chama aoEscolher, fecha e devolve o foco ao botão em 2 toques', async () => {
    const user = userEvent.setup();
    const aoEscolher = vi.fn();
    render(<Controlado opcoes={formas} inicial={PIX} aoEscolher={aoEscolher} />);
    let toques = 0;

    await user.click(botao());
    toques++;
    await user.click(opcao(/Cartão de crédito XP/));
    toques++;

    expect(toques).toBe(2);
    expect(aoEscolher).toHaveBeenCalledTimes(1);
    expect(aoEscolher).toHaveBeenCalledWith(XP);
    expect(listaAberta()).toBe(false);
    expect(botao()).toHaveAttribute('aria-expanded', 'false');
    expect(document.activeElement).toBe(botao());
    expect(botao()).toHaveAccessibleName('Forma de pagamento Cartão de crédito XP · Crédito');
  });

  it('clicar no rótulo da opção (que não recebe foco) escolhe a forma e fecha', async () => {
    const user = userEvent.setup();
    const aoEscolher = vi.fn();
    render(<Controlado opcoes={formas} inicial={PIX} aoEscolher={aoEscolher} />);

    await user.click(botao());
    const rotulo = opcao(/Cartão de crédito XP/).closest('label') as HTMLElement;
    await user.click(rotulo);

    expect(aoEscolher).toHaveBeenCalledTimes(1);
    expect(aoEscolher).toHaveBeenCalledWith(XP);
    expect(listaAberta()).toBe(false);
    expect(botao()).toHaveAccessibleName('Forma de pagamento Cartão de crédito XP · Crédito');
  });

  it('Esc fecha sem escolher e devolve o foco ao botão', async () => {
    const user = userEvent.setup();
    const aoEscolher = vi.fn();
    render(<Controlado opcoes={formas} inicial={PIX} aoEscolher={aoEscolher} />);

    await user.click(botao());
    await user.keyboard('{Escape}');

    expect(aoEscolher).not.toHaveBeenCalled();
    expect(listaAberta()).toBe(false);
    expect(document.activeElement).toBe(botao());
  });

  it('Tab para fora da lista fecha sem escolher', async () => {
    const user = userEvent.setup();
    const aoEscolher = vi.fn();
    render(<Controlado opcoes={formas} inicial={PIX} aoEscolher={aoEscolher} />);

    await user.click(botao());
    for (let i = 0; i < 5 && listaAberta(); i++) await user.tab();

    expect(listaAberta()).toBe(false);
    expect(aoEscolher).not.toHaveBeenCalled();
  });

  it('variante conta: "Conta de destino" sem o tipo', () => {
    render(
      <Controlado
        id="conta"
        rotulo="Conta de destino"
        opcoes={contas}
        inicial="00000000-0000-4000-8000-000000000201"
        aoEscolher={vi.fn()}
      />,
    );

    const conta = screen.getByRole('button', { name: /^Conta de destino/ });
    expect(conta).toHaveAccessibleName('Conta de destino Nubank');
    expect(document.getElementById('conta-rotulo')).toHaveTextContent('Conta de destino');
    expect(document.getElementById('conta-atual')).toHaveTextContent(/^Nubank$/);
    expect(conta.textContent).not.toContain('·');
  });

  it('ajuda ligada ao botão por aria-describedby', () => {
    render(
      <Controlado
        opcoes={formas}
        inicial={PIX}
        aoEscolher={vi.fn()}
        ajuda="A conta da forma é a que sai o dinheiro."
      />,
    );

    expect(botao()).toHaveAccessibleDescription('A conta da forma é a que sai o dinheiro.');
  });

  it('lista com 1 opção abre e fecha', async () => {
    const user = userEvent.setup();
    const aoEscolher = vi.fn();
    render(<Controlado opcoes={formas.slice(0, 1)} inicial={PIX} aoEscolher={aoEscolher} />);

    await user.click(botao());
    expect(opcoes()).toHaveLength(1);
    await user.click(opcao(/Pix Nubank/));

    expect(listaAberta()).toBe(false);
    expect(document.activeElement).toBe(botao());
  });

  it('opcoes vazio é erro de uso', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});

    expect(() =>
      render(<BotaoForma rotulo="Forma de pagamento" opcoes={[]} valor="" aoEscolher={vi.fn()} />),
    ).toThrow();
  });
});
