import { configure, fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { limparAparelho, montarApp, preAquecerPaginas } from '../../../test/apoio/apiCadastros';
import {
  criarServidorFixas,
  ID_CONTAS_CASA,
  ID_DELIVERY_CASAL,
  ID_TRANSPORTE,
  instalarApiFixas,
  preAquecerFixas,
  type ServidorFixas,
} from '../../../test/apoio/apiFixas';
import { chamadasA } from '../../../test/apoio/apiLancamentos';

/**
 * Folha de valor do orçamento (etapa 12, lote 3). Critérios: RN-16 (definir por categoria de despesa e mês; escopo e dono
 * vêm da categoria; valor > 0; valor ausente remove, idempotente), RN-25 (aberto neste lote), CA-T3.5.
 */

let servidor: ServidorFixas;

// Com a suíte inteira em paralelo, a primeira montagem de uma tela pode passar de 1 s (módulos e contrato carregados na hora).
configure({ asyncUtilTimeout: 5000 });

beforeAll(async () => {
  await preAquecerPaginas();
  await preAquecerFixas();
}, 60_000);

beforeEach(async () => {
  servidor = criarServidorFixas();
  instalarApiFixas(servidor);
  await limparAparelho();
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-10-09T15:00:00-03:00'));
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

const BASE = '/app/orcamento?mes=2026-10&escopo=casa';
const CONTAS = `${BASE}&editar=${ID_CONTAS_CASA}`;
const puts = () => chamadasA(servidor, 'PUT', '/api/orcamento/');
const folha = (nome: string) => screen.getByRole('dialog', { name: nome });
const valorDe = (campo: HTMLElement) => (campo as HTMLInputElement).value;

async function abrir(caminho: string, nome: string) {
  const app = montarApp(caminho);
  await screen.findByRole('dialog', { name: nome });
  return app;
}

async function digitarValor(usuario: ReturnType<typeof userEvent.setup>, nome: string, digitos: string) {
  const campo = within(folha(nome)).getByLabelText('Valor orçado');
  await usuario.clear(campo);
  if (digitos) await usuario.type(campo, digitos);
}

describe('Folha de valor do orçamento: abertura', () => {
  it('abre para a categoria do ?editar= com mês, escopo, realizado e o valor orçado', async () => {
    await abrir(CONTAS, 'Orçamento de Contas da casa');

    const dialogo = folha('Orçamento de Contas da casa');
    expect(dialogo).toHaveAttribute('aria-modal', 'true');
    expect(dialogo).toHaveTextContent('Outubro de 2026 · Casa');
    expect(dialogo).toHaveTextContent(/realizado\s+R\$\s332,50/);
    expect(valorDe(within(dialogo).getByLabelText('Valor orçado'))).toMatch(/^R\$\s300,00$/);
    expect(within(dialogo).getByRole('button', { name: 'Remover orçamento desta categoria' })).toBeInTheDocument();
  });

  it('categoria sem orçamento abre vazia e sem "Remover"', async () => {
    servidor.orcado.conjunto.delete(`2026-10-01|${ID_DELIVERY_CASAL}`);
    await abrir(`${BASE}&editar=${ID_DELIVERY_CASAL}`, 'Orçamento de Delivery/iFood do casal');

    const dialogo = folha('Orçamento de Delivery/iFood do casal');
    expect(valorDe(within(dialogo).getByLabelText('Valor orçado'))).toMatch(/^R\$\s0,00$/);
    expect(within(dialogo).queryByRole('button', { name: /Remover/ })).not.toBeInTheDocument();
  });

  it.each([
    ['id estranho', 'xyz'],
    ['categoria de outro escopo ou de outro membro', ID_TRANSPORTE],
  ])('%s: não abre e tira o parâmetro', async (_caso, id) => {
    const { local } = montarApp(`${BASE}&editar=${id}`);

    await screen.findByRole('heading', { name: /Orçamento da casa/ });

    await waitFor(() => expect(local()).toBe(BASE));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('fechar pelo X tira o parâmetro e mantém mês e escopo', async () => {
    const usuario = userEvent.setup();
    const { local } = await abrir(CONTAS, 'Orçamento de Contas da casa');

    await usuario.click(within(folha('Orçamento de Contas da casa')).getByRole('button', { name: 'Fechar' }));

    expect(screen.queryByRole('dialog', { name: 'Orçamento de Contas da casa' })).not.toBeInTheDocument();
    expect(local()).toBe(BASE);
  });

  it('o link de uma categoria da lista abre a folha dela', async () => {
    const usuario = userEvent.setup();
    const { local } = montarApp(BASE);

    await usuario.click(await screen.findByRole('link', { name: /Editar orçamento de Contas da casa/ }));

    expect(await screen.findByRole('dialog', { name: 'Orçamento de Contas da casa' })).toBeInTheDocument();
    expect(local()).toBe(CONTAS);
  });
});

describe('Folha de valor do orçamento: salvar e remover', () => {
  it('salvar envia PUT no mês e na categoria; avisa, fecha e a lista mostra o novo valor e a nova situação', async () => {
    const usuario = userEvent.setup();
    const { local } = await abrir(CONTAS, 'Orçamento de Contas da casa');

    await digitarValor(usuario, 'Orçamento de Contas da casa', '40000');
    await usuario.click(within(folha('Orçamento de Contas da casa')).getByRole('button', { name: 'Salvar' }));

    expect(await screen.findByText('Orçamento salvo')).toBeInTheDocument();
    expect(puts()).toHaveLength(1);
    expect(puts()[0]!.url).toBe(`/api/orcamento/2026-10-01/${ID_CONTAS_CASA}`);
    expect(puts()[0]!.corpo).toEqual({ valor_centavos: 40000 });
    expect(puts()[0]!.cabecalhos['X-Controle-Em-Casa']).toBe('1');
    await waitFor(() => expect(local()).toBe(BASE));
    // 332,50 de 400,00 = 83%: deixa de estourar e passa a atenção (razão exata, RN-16).
    const contas = await screen.findByRole('link', { name: /Editar orçamento de Contas da casa/ });
    await waitFor(() => expect(contas).toHaveTextContent('Atenção'));
    expect(contas).toHaveTextContent('83%');
    const total = (await screen.findByRole('heading', { name: /Orçamento da casa/ })).closest('section')!;
    await waitFor(() => expect(total).toHaveTextContent(/R\$\s4\.400,00/));
  });

  it('definir uma categoria sem orçamento a move de "Sem orçamento" para a lista, com realizado zero', async () => {
    const usuario = userEvent.setup();
    servidor.orcado.conjunto.delete(`2026-10-01|${ID_DELIVERY_CASAL}`);
    servidor.realizado.delete(`2026-10-01|${ID_DELIVERY_CASAL}`);
    await abrir(`${BASE}&editar=${ID_DELIVERY_CASAL}`, 'Orçamento de Delivery/iFood do casal');

    await digitarValor(usuario, 'Orçamento de Delivery/iFood do casal', '25000');
    await usuario.click(within(folha('Orçamento de Delivery/iFood do casal')).getByRole('button', { name: 'Salvar' }));

    await screen.findByText('Orçamento salvo');
    const linha = await screen.findByRole('link', { name: /Editar orçamento de Delivery/ });
    expect(linha).toHaveTextContent('Dentro');
    expect(linha).toHaveTextContent('0%');
    expect(
      await screen.findByText('Todas as categorias de despesa da casa têm orçamento em outubro.'),
    ).toBeInTheDocument();
  });

  it('no escopo Eu define a categoria individual e o total passa a ser "Meu orçamento"', async () => {
    const usuario = userEvent.setup();
    await abrir(`/app/orcamento?mes=2026-10&escopo=eu&editar=${ID_TRANSPORTE}`, 'Orçamento de Transporte');
    expect(folha('Orçamento de Transporte')).toHaveTextContent('Outubro de 2026 · Eu');

    await digitarValor(usuario, 'Orçamento de Transporte', '20000');
    await usuario.click(within(folha('Orçamento de Transporte')).getByRole('button', { name: 'Salvar' }));

    expect(await screen.findByRole('heading', { name: /Meu orçamento/ })).toBeInTheDocument();
    expect(servidor.orcado.individual.get(`2026-10-01|${ID_TRANSPORTE}`)).toBe(20000);
    expect(servidor.orcado.conjunto.has(`2026-10-01|${ID_TRANSPORTE}`)).toBe(false);
  });

  it('a categoria individual de outro escopo não abre na Casa (e vice-versa)', async () => {
    const { local } = montarApp(`/app/orcamento?mes=2026-10&escopo=eu&editar=${ID_CONTAS_CASA}`);

    await screen.findByRole('heading', { name: 'Sem orçamento seu em outubro' });

    await waitFor(() => expect(local()).toBe('/app/orcamento?mes=2026-10&escopo=eu'));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('remover envia valor nulo; avisa e a categoria passa a "Sem orçamento"', async () => {
    const usuario = userEvent.setup();
    await abrir(CONTAS, 'Orçamento de Contas da casa');

    await usuario.click(
      within(folha('Orçamento de Contas da casa')).getByRole('button', {
        name: 'Remover orçamento desta categoria',
      }),
    );

    expect(await screen.findByText('Orçamento removido')).toBeInTheDocument();
    expect(puts()[0]!.corpo).toEqual({ valor_centavos: null });
    expect(servidor.orcado.conjunto.has(`2026-10-01|${ID_CONTAS_CASA}`)).toBe(false);
    expect(await screen.findByText(/Sem orçamento \(1\)/)).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /Editar orçamento de Contas da casa/ })).not.toBeInTheDocument();
  });

  it('valor apagado (zero) mostra o erro no campo e não chama o servidor', async () => {
    const usuario = userEvent.setup();
    await abrir(CONTAS, 'Orçamento de Contas da casa');

    await digitarValor(usuario, 'Orçamento de Contas da casa', '');
    await usuario.click(within(folha('Orçamento de Contas da casa')).getByRole('button', { name: 'Salvar' }));

    expect(
      within(folha('Orçamento de Contas da casa')).getByText('Informe um valor maior que zero.'),
    ).toBeInTheDocument();
    expect(puts()).toHaveLength(0);
  });
});

describe('Folha de valor do orçamento: erros', () => {
  it('sem rede: aviso de topo, valor mantido, "Tentar de novo" reenvia e salva', async () => {
    const usuario = userEvent.setup();
    await abrir(CONTAS, 'Orçamento de Contas da casa');
    await digitarValor(usuario, 'Orçamento de Contas da casa', '45000');
    servidor.semRede = true;

    await usuario.click(within(folha('Orçamento de Contas da casa')).getByRole('button', { name: 'Salvar' }));

    const alerta = await within(folha('Orçamento de Contas da casa')).findByRole('alert');
    expect(alerta).toHaveTextContent(/Sem conexão\. O orçamento não foi salvo/);
    expect(valorDe(within(folha('Orçamento de Contas da casa')).getByLabelText('Valor orçado'))).toMatch(
      /^R\$\s450,00$/,
    );
    servidor.semRede = false;

    await usuario.click(within(folha('Orçamento de Contas da casa')).getByRole('button', { name: 'Tentar de novo' }));

    expect(await screen.findByText('Orçamento salvo')).toBeInTheDocument();
    expect(puts()).toHaveLength(2);
    expect(puts()[1]!.corpo).toEqual({ valor_centavos: 45000 });
    expect(servidor.orcado.conjunto.get(`2026-10-01|${ID_CONTAS_CASA}`)).toBe(45000);
  });

  it('valor_invalido do servidor aparece no campo "Valor orçado"', async () => {
    const usuario = userEvent.setup();
    servidor.falhas.set('PUT /api/orcamento/:mes/:id', { status: 400, code: 'valor_invalido' });
    await abrir(CONTAS, 'Orçamento de Contas da casa');

    await usuario.click(within(folha('Orçamento de Contas da casa')).getByRole('button', { name: 'Salvar' }));

    expect(
      await within(folha('Orçamento de Contas da casa')).findByText('Valor inválido. Confira e tente de novo'),
    ).toBeInTheDocument();
    expect(servidor.orcado.conjunto.get(`2026-10-01|${ID_CONTAS_CASA}`)).toBe(30000);
  });

  it('categoria que sumiu (registro_invalido): a folha fecha, o parâmetro sai e a mensagem fica no aviso global', async () => {
    const usuario = userEvent.setup();
    const { local } = await abrir(CONTAS, 'Orçamento de Contas da casa');
    // A categoria foi arquivada por outro membro entre a leitura e o clique.
    servidor.categorias = servidor.categorias.map((c) => (c.id === ID_CONTAS_CASA ? { ...c, arquivada: true } : c));
    servidor.orcado.conjunto.delete(`2026-10-01|${ID_CONTAS_CASA}`);
    await digitarValor(usuario, 'Orçamento de Contas da casa', '40000');

    await usuario.click(within(folha('Orçamento de Contas da casa')).getByRole('button', { name: 'Salvar' }));

    expect(await screen.findByText('Não encontramos este item. Ele pode ter sido removido')).toBeInTheDocument();
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    await waitFor(() => expect(local()).toBe(BASE));
    expect(servidor.orcado.conjunto.has(`2026-10-01|${ID_CONTAS_CASA}`)).toBe(false);
  });
});

describe('Folha de valor do orçamento: URL como entrada não confiável', () => {
  it('um UUID válido que não está na resposta não abre folha', async () => {
    const { local } = montarApp(`${BASE}&editar=00000000-0000-4000-8000-0000000009aa`);

    await screen.findByRole('heading', { name: /Orçamento da casa/ });

    await waitFor(() => expect(local()).toBe(BASE));
    fireEvent.keyDown(document.body, { key: 'Escape' });
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});
