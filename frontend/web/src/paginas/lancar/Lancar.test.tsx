import { act, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { onlineManager } from '@tanstack/react-query';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { limparAparelho, preAquecerPaginas, montarApp, UUID_V4 } from '../../../test/apoio/apiCadastros';
import {
  chamadasA,
  criarServidorLancamentos,
  instalarApiLancamentos,
  type ServidorLancamentos,
} from '../../../test/apoio/apiLancamentos';
import { fila, limparFila } from '../../../test/apoio/apoioFila';

/**
 * Folha Lançar (etapa 12, lote 2): despesa à vista e parcelada, receita e fila offline, pelo app inteiro contra a API
 * simulada. Critérios: RN-01 (escopo vem da categoria), RN-14 (parcelas), ADR-007 (fila só para despesa), ADR-010
 * (id do cliente, `ja_existia`), RT-03.
 */

const CATEGORIA_MERCADO = '00000000-0000-4000-8000-000000000401';
const CATEGORIA_SALARIO = '00000000-0000-4000-8000-000000000421';
const FORMA_PIX = '00000000-0000-4000-8000-000000000301';
const FORMA_CREDITO = '00000000-0000-4000-8000-000000000303';
const CONTA_NUBANK = '00000000-0000-4000-8000-000000000201';

let servidor: ServidorLancamentos;

beforeAll(preAquecerPaginas, 30_000);

beforeEach(async () => {
  servidor = criarServidorLancamentos();
  instalarApiLancamentos(servidor);
  // Antes de esquecer o dono: a fila só lista os itens do usuário lembrado.
  await limparFila();
  await limparAparelho();
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-10-12T15:00:00-03:00'));
});
afterEach(() => {
  // O evento `offline` desliga o `onlineManager` do TanStack, que é global ao arquivo de teste.
  Object.defineProperty(window.navigator, 'onLine', { configurable: true, value: true });
  onlineManager.setOnline(true);
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

const folha = () => document.querySelector<HTMLElement>('[role="dialog"]');

async function abrirPelaBarra(usuario: ReturnType<typeof userEvent.setup>) {
  await waitFor(() => expect(folha()).not.toBeNull());
  const botoes = screen.getAllByRole('link', { name: 'Lançar' });
  await usuario.click(botoes.at(-1)!);
  return within(await screen.findByRole('dialog'));
}

async function digitarValor(usuario: ReturnType<typeof userEvent.setup>, digitos: string) {
  await usuario.type(document.getElementById('valor')!, digitos);
}

const escritasDespesa = () => chamadasA(servidor, 'POST', '/api/lancamentos/despesas');
const escritasReceita = () => chamadasA(servidor, 'POST', '/api/lancamentos/receitas');

describe('abrir a folha pelo "+ Lançar"', () => {
  it.each(['/app', '/app/lancamentos?mes=2026-10', '/app/ajustes'])(
    'em %s a folha já está montada e oculta',
    async (rota) => {
      montarApp(rota);

      await waitFor(() => expect(folha()).not.toBeNull());
      expect(folha()).toHaveAttribute('hidden');
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    },
  );

  it('pela barra inferior: abre a folha e põe o foco no valor, sem navegar', async () => {
    const usuario = userEvent.setup();
    const { local } = montarApp('/app');

    await abrirPelaBarra(usuario);

    expect(document.activeElement).toBe(document.getElementById('valor'));
    expect(local()).toBe('/app');
  });

  it('pelo trilho (PC): abre a folha', async () => {
    const usuario = userEvent.setup();
    montarApp('/app');
    await waitFor(() => expect(document.getElementById('valor')).not.toBeNull());

    await usuario.click(screen.getAllByRole('link', { name: 'Lançar' })[0]!);

    expect(await screen.findByRole('dialog')).toBeInTheDocument();
    expect(document.activeElement).toBe(document.getElementById('valor'));
  });

  it('a rota /app/lancar abre a folha; fechar leva de volta a /app', async () => {
    const usuario = userEvent.setup();
    const { local } = montarApp('/app/lancar');

    const dialogo = within(await screen.findByRole('dialog'));
    await usuario.click(dialogo.getByRole('button', { name: 'Fechar' }));

    await waitFor(() => expect(local()).toBe('/app'));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('fechar fora de /app/lancar só oculta a folha, sem navegar', async () => {
    const usuario = userEvent.setup();
    const { local } = montarApp('/app/lancamentos?mes=2026-10');
    const dialogo = await abrirPelaBarra(usuario);

    await usuario.click(dialogo.getByRole('button', { name: 'Fechar' }));

    expect(local()).toBe('/app/lancamentos?mes=2026-10');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});

describe('despesa à vista', () => {
  it('lança no Pix padrão: POST com id do cliente, escopo pela categoria, aviso e folha pronta para a próxima', async () => {
    const usuario = userEvent.setup();
    montarApp('/app');
    const dialogo = await abrirPelaBarra(usuario);

    await digitarValor(usuario, '4590');
    await usuario.click(dialogo.getByRole('radio', { name: /Mercado/ }));
    expect(dialogo.getByRole('button', { name: 'Lançar R$ 45,90' })).toBeInTheDocument();
    await usuario.click(dialogo.getByRole('button', { name: 'Lançar R$ 45,90' }));

    await waitFor(() => expect(escritasDespesa()).toHaveLength(1));
    const corpo = escritasDespesa()[0]!.corpo!;
    expect(corpo).toMatchObject({
      valor_centavos: 4590,
      categoria_id: CATEGORIA_MERCADO,
      forma_id: FORMA_PIX,
      parcelas: 1,
      data: '2026-10-12',
    });
    expect(corpo.id).toMatch(UUID_V4);
    expect(escritasDespesa()[0]!.cabecalhos['X-Controle-Em-Casa']).toBe('1');
    expect(await screen.findByText('Lançado: R$ 45,90 · Mercado · Casa')).toBeInTheDocument();
    // Pronta para o próximo: valor zerado e foco nele; a forma fica.
    await waitFor(() => expect(document.getElementById('valor')).toHaveValue('R$ 0,00'));
    expect(document.activeElement).toBe(document.getElementById('valor'));
    expect(await fila.listar()).toHaveLength(0);
  });

  it('envio vazio mostra os dois erros e não chama a API', async () => {
    const usuario = userEvent.setup();
    montarApp('/app');
    const dialogo = await abrirPelaBarra(usuario);

    await usuario.click(dialogo.getByRole('button', { name: 'Lançar' }));

    expect(await dialogo.findByText('Informe um valor maior que zero.')).toBeInTheDocument();
    expect(dialogo.getByText('Escolha uma categoria.')).toBeInTheDocument();
    expect(escritasDespesa()).toHaveLength(0);
  });

  it('regra do servidor (categoria arquivada) aparece no topo da folha e os dados ficam', async () => {
    servidor.falhas.set('POST /api/lancamentos/despesas', { status: 409, code: 'categoria_arquivada' });
    const usuario = userEvent.setup();
    montarApp('/app');
    const dialogo = await abrirPelaBarra(usuario);

    await digitarValor(usuario, '1000');
    await usuario.click(dialogo.getByRole('radio', { name: /Mercado/ }));
    await usuario.click(dialogo.getByRole('button', { name: 'Lançar R$ 10,00' }));

    expect(await dialogo.findByRole('alert')).toBeInTheDocument();
    expect(document.getElementById('valor')).toHaveValue('R$ 10,00');
    expect(await fila.listar()).toHaveLength(0);
  });
});

describe('despesa parcelada no crédito', () => {
  it('3x: o botão mostra as parcelas, o POST leva parcelas=3 e o aviso diz a 1ª parcela da resposta', async () => {
    const usuario = userEvent.setup();
    montarApp('/app');
    const dialogo = await abrirPelaBarra(usuario);

    await digitarValor(usuario, '36000');
    await usuario.click(dialogo.getByRole('radio', { name: /Mercado/ }));
    await usuario.click(dialogo.getByRole('button', { name: /Forma de pagamento/ }));
    await usuario.click(await dialogo.findByRole('radio', { name: /Cartão de crédito XP/ }));
    await usuario.click(await dialogo.findByRole('radio', { name: '3x' }));
    expect(dialogo.getByRole('button', { name: 'Lançar R$ 360,00 em 3x' })).toBeInTheDocument();
    await usuario.click(dialogo.getByRole('button', { name: 'Lançar R$ 360,00 em 3x' }));

    await waitFor(() => expect(escritasDespesa()).toHaveLength(1));
    expect(escritasDespesa()[0]!.corpo).toMatchObject({
      valor_centavos: 36000,
      forma_id: FORMA_CREDITO,
      parcelas: 3,
    });
    expect(await screen.findByText('Lançado em 3x · Mercado · Casa · 1ª parcela em 12/10')).toBeInTheDocument();
  });

  it('forma que não é crédito não oferece parcelas', async () => {
    const usuario = userEvent.setup();
    montarApp('/app');
    const dialogo = await abrirPelaBarra(usuario);

    expect(dialogo.queryByRole('radio', { name: '3x' })).not.toBeInTheDocument();
    await usuario.click(dialogo.getByRole('button', { name: /Forma de pagamento/ }));
    await usuario.click(await dialogo.findByRole('radio', { name: /Cartão de crédito XP/ }));

    expect(await dialogo.findByRole('radio', { name: '3x' })).toBeInTheDocument();
  });
});

describe('receita (sempre individual, sem fila, direto no servidor)', () => {
  it('troca para Receita, escolhe a categoria e a conta e lança: POST /receitas, sem forma nem parcelas', async () => {
    const usuario = userEvent.setup();
    montarApp('/app');
    const dialogo = await abrirPelaBarra(usuario);

    await usuario.click(dialogo.getByRole('radio', { name: 'Receita' }));
    await digitarValor(usuario, '750000');
    await usuario.click(await dialogo.findByRole('radio', { name: /Salário/ }));
    await usuario.click(dialogo.getByRole('button', { name: 'Lançar receita R$ 7.500,00' }));

    await waitFor(() => expect(escritasReceita()).toHaveLength(1));
    const corpo = escritasReceita()[0]!.corpo!;
    expect(corpo).toMatchObject({
      valor_centavos: 750000,
      categoria_id: CATEGORIA_SALARIO,
      conta_id: CONTA_NUBANK,
      data: '2026-10-12',
    });
    expect(corpo).not.toHaveProperty('forma_id');
    expect(corpo).not.toHaveProperty('parcelas');
    expect(corpo.id).toMatch(UUID_V4);
    expect(escritasDespesa()).toHaveLength(0);
    expect(await screen.findByText(/Lançado: R\$ 7\.500,00 · Salário · Eu/)).toBeInTheDocument();
    expect(await fila.listar()).toHaveLength(0);
  });

  it('sem rede a receita nem é tentada, não vai para a fila e a folha explica', async () => {
    const usuario = userEvent.setup();
    montarApp('/app');
    const dialogo = await abrirPelaBarra(usuario);
    // Fica sem rede só depois de a folha ter os dados.
    await waitFor(() => expect(servidor.chamadas.some((c) => c.url === '/api/lancamentos/dados')).toBe(true));
    servidor.semRede = true;
    Object.defineProperty(window.navigator, 'onLine', { configurable: true, value: false });
    act(() => {
      window.dispatchEvent(new Event('offline'));
    });

    await usuario.click(dialogo.getByRole('radio', { name: 'Receita' }));
    await digitarValor(usuario, '10000');
    await usuario.click(await dialogo.findByRole('radio', { name: /Salário/ }));
    await usuario.click(dialogo.getByRole('button', { name: 'Lançar receita R$ 100,00' }));

    expect(await dialogo.findByRole('alert')).toHaveTextContent(/conexão/i);
    expect(escritasReceita()).toHaveLength(0);
    expect(await fila.listar()).toHaveLength(0);
  });
});

describe('sem rede: a despesa fica guardada na fila (ADR-007)', () => {
  it('guarda no aparelho com o dono da sessão, avisa, e o reenvio usa o mesmo id (idempotência)', async () => {
    const usuario = userEvent.setup();
    montarApp('/app');
    const dialogo = await abrirPelaBarra(usuario);
    await waitFor(() => expect(servidor.chamadas.some((c) => c.url === '/api/lancamentos/dados')).toBe(true));

    servidor.semRede = true;
    await digitarValor(usuario, '4590');
    await usuario.click(dialogo.getByRole('radio', { name: /Mercado/ }));
    await usuario.click(dialogo.getByRole('button', { name: 'Lançar R$ 45,90' }));

    expect(await screen.findByText('Guardado no aparelho. Será enviado quando houver conexão.')).toBeInTheDocument();
    const itens = await fila.listar();
    expect(itens).toHaveLength(1);
    expect(itens[0]).toMatchObject({
      situacao: 'aguardando',
      exibicao: { categoria_nome: 'Mercado', forma_nome: 'Pix Nubank' },
    });
    expect(itens[0]!.dono).toBe('00000000-0000-4000-8000-0000000000a1');
    expect(itens[0]!.args).toMatchObject({
      valor_centavos: 4590,
      categoria_id: CATEGORIA_MERCADO,
      forma_id: FORMA_PIX,
    });

    // A rede volta: o envio da fila repete o mesmo id e a API responde `ja_existia` sem duplicar.
    servidor.semRede = false;
    await act(() => fila.esvaziar());
    await waitFor(async () => expect(await fila.listar()).toHaveLength(0));
    const enviados = escritasDespesa().filter((c) => c.corpo?.id === itens[0]!.args.id);
    expect(enviados.length).toBeGreaterThanOrEqual(1);
  });

  it('o item guardado aparece em "Aguardando envio (fora do total)" na lista de lançamentos', async () => {
    const usuario = userEvent.setup();
    montarApp('/app/lancamentos?mes=2026-10');
    const dialogo = await abrirPelaBarra(usuario);
    await waitFor(() => expect(servidor.chamadas.some((c) => c.url === '/api/lancamentos/dados')).toBe(true));
    servidor.semRede = true;
    await digitarValor(usuario, '4590');
    await usuario.click(dialogo.getByRole('radio', { name: /Mercado/ }));
    await usuario.click(dialogo.getByRole('button', { name: 'Lançar R$ 45,90' }));
    await screen.findByText('Guardado no aparelho. Será enviado quando houver conexão.');
    servidor.semRede = false;

    await usuario.click(screen.getAllByRole('link', { name: 'Lançamentos' })[0]!);

    const grupo = await screen.findByRole('region', { name: /Aguardando envio \(fora do total\)/ });
    expect(within(grupo).getByRole('link', { name: /Mercado.*aguardando envio/ })).toBeInTheDocument();
  });
});

describe('cadastro incompleto', () => {
  it('sem forma de pagamento a folha oferece cadastrar uma forma', async () => {
    const usuario = userEvent.setup();
    servidor.dados = { ...servidor.dados, formas: [], forma_padrao_id: null };
    montarApp('/app');

    const dialogo = await abrirPelaBarra(usuario);

    expect(await dialogo.findByRole('link', { name: 'Cadastrar forma' })).toHaveAttribute(
      'href',
      '/app/ajustes/formas/nova',
    );
  });
});
