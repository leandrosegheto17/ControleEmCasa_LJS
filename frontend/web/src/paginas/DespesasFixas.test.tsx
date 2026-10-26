import { configure, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { limparAparelho, montarApp, preAquecerPaginas } from '../../test/apoio/apiCadastros';
import {
  criarServidorFixas,
  ID_ALUGUEL,
  ID_OC_AGUA,
  ID_OC_ALUGUEL,
  ID_OC_LUZ,
  instalarApiFixas,
  preAquecerFixas,
  type ServidorFixas,
} from '../../test/apoio/apiFixas';
import { chamadasA } from '../../test/apoio/apiLancamentos';
import { lerResposta } from '../../test/apoio/fetchSimulado';

/**
 * Despesas fixas do mês (etapa 12, lote 3). Critérios: RN-15 (ordem atrasadas > pendentes > pagas, totais do servidor,
 * pagar e desfazer), RN-06 (só o pagador desfaz), §2.1 (forma, conta e data do pagamento nunca saem), RT-01.
 * A API é simulada no `fetch`; transporte, ganchos e telas são os de verdade.
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

const moeda = (texto: string) => new RegExp(`R\\$\\s${texto.replace(/\./g, '\\.')}`);
const FIXAS = '/app/fixas?mes=2026-10';

async function cartaoOcorrencias(titulo: RegExp = /Pagas: 4 de 7/) {
  const heading = await screen.findByRole('heading', { name: titulo });
  return heading.closest('section') as HTMLElement;
}

async function itemDe(descricao: string, titulo?: RegExp) {
  const cartao = await cartaoOcorrencias(titulo);
  const item = within(cartao)
    .getAllByRole('listitem')
    .find((li) => within(li).queryByText(descricao, { exact: true }));
  if (!item) throw new Error(`item ${descricao} não encontrado`);
  return item;
}

describe('DespesasFixas: ocorrências do mês', () => {
  it('pede o mês no dia 1 e mostra pagas, total e previsto a pagar do servidor', async () => {
    montarApp(FIXAS);

    const titulo = await screen.findByRole('heading', { name: /Pagas: 4 de 7/ });
    expect(titulo).toHaveTextContent('Previsto a pagar');
    expect(titulo).toHaveTextContent(moeda('1.540,00'));
    expect(chamadasA(servidor, 'GET', '/api/fixas/ocorrencias').map((c) => c.url)).toEqual([
      '/api/fixas/ocorrencias?mes=2026-10-01',
    ]);
    expect(screen.getByText('Outubro de 2026')).toBeInTheDocument();
  });

  it('mantém a ordem do servidor: atrasada primeiro com "venceu", depois pendentes, pagas por último (RN-15)', async () => {
    montarApp(FIXAS);

    const itens = within(await cartaoOcorrencias()).getAllByRole('listitem');
    expect(itens).toHaveLength(7);
    expect(itens[0]).toHaveTextContent('Internet');
    expect(itens[0]).toHaveTextContent('Contas da casa · venceu 05/10');
    expect(itens[0]).toHaveTextContent('Atrasada');
    expect(itens[0]).toHaveTextContent(moeda('119,90'));
    expect(itens[1]).toHaveTextContent('Aluguel');
    expect(itens[1]).toHaveTextContent('Moradia · vence 10/10');
    expect(itens[1]).toHaveTextContent('Pendente');
    expect(itens[2]).toHaveTextContent('Condomínio');
    expect(itens[2]).toHaveTextContent('vence 15/10');
    for (const paga of itens.slice(3)) expect(paga).toHaveTextContent('Paga por');
  });

  it('ocorrência futura (vence depois de hoje) é Pendente e a vencida sem pagamento é Atrasada', async () => {
    montarApp(FIXAS);

    expect(await itemDe('Condomínio')).toHaveTextContent('Pendente');
    expect(await itemDe('Aluguel')).toHaveTextContent('Pendente');
    expect(await itemDe('Internet')).toHaveTextContent('Atrasada');
    expect(await itemDe('Internet')).not.toHaveTextContent('Pendente');
  });

  it('paga pelo outro membro mostra o valor efetivo e o nome dele, sem ação', async () => {
    montarApp(FIXAS);

    const luz = await itemDe('Luz');
    expect(luz).toHaveTextContent(moeda('187,40'));
    expect(luz).toHaveTextContent('Paga por Beatriz');
    expect(within(luz).queryByRole('button')).not.toBeInTheDocument();
    expect(within(luz).queryByRole('link')).not.toBeInTheDocument();
  });

  it('paga por mim mostra "Paga por você" e o botão de desfazer', async () => {
    montarApp(FIXAS);

    const agua = await itemDe('Água');
    expect(agua).toHaveTextContent(moeda('95,10'));
    expect(agua).toHaveTextContent('Paga por você');
    expect(within(agua).getByRole('button', { name: 'Desfazer pagamento: Água' })).toBeInTheDocument();
  });

  it('privacidade: forma, conta e data do pagamento não aparecem para ninguém (§2.1)', async () => {
    montarApp(FIXAS);

    const cartao = await cartaoOcorrencias();
    for (const privado of ['Pix Nubank', 'Débito Itaú', 'Nubank', 'Itaú']) {
      expect(within(cartao).queryByText(new RegExp(privado))).not.toBeInTheDocument();
    }
  });

  it('"Marcar como paga" aponta para a folha da ocorrência no mesmo mês; paga não tem o link', async () => {
    montarApp(FIXAS);

    const link = await screen.findByRole('link', { name: 'Marcar como paga: Aluguel' });
    expect(link).toHaveAttribute('href', `/app/fixas?mes=2026-10&pagar=${ID_OC_ALUGUEL}`);
    expect(screen.getByRole('link', { name: 'Marcar como paga: Internet' })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Marcar como paga: Luz' })).not.toBeInTheDocument();
  });

  it('trocar o mês grava ?mes= e o servidor gera as ocorrências de novembro (1 por fixa ativa)', async () => {
    const usuario = userEvent.setup();
    const { local } = montarApp(FIXAS);
    await cartaoOcorrencias();

    await usuario.click(screen.getByRole('button', { name: 'Próximo mês: novembro de 2026' }));

    const titulo = await screen.findByRole('heading', { name: /Pagas: 0 de 7/ });
    expect(local()).toBe('/app/fixas?mes=2026-11');
    expect(titulo).toHaveTextContent('Previsto a pagar');
    const itens = within(titulo.closest('section') as HTMLElement).getAllByRole('listitem');
    expect(itens.every((li) => li.textContent?.includes('Pendente'))).toBe(true);
    expect(chamadasA(servidor, 'GET', '/api/fixas/ocorrencias').at(-1)!.url).toBe(
      '/api/fixas/ocorrencias?mes=2026-11-01',
    );
  });
});

describe('DespesasFixas: desfazer pagamento (RN-15, RN-06)', () => {
  it('Cancelar no diálogo não chama o servidor', async () => {
    const usuario = userEvent.setup();
    montarApp(FIXAS);

    await usuario.click(await screen.findByRole('button', { name: 'Desfazer pagamento: Água' }));
    await usuario.click(within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Cancelar' }));

    expect(chamadasA(servidor, 'DELETE', '/api/ocorrencias/')).toHaveLength(0);
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
  });

  it('confirmar apaga o pagamento: a ocorrência volta a Pendente e os totais vêm do servidor', async () => {
    const usuario = userEvent.setup();
    montarApp(FIXAS);

    await usuario.click(await screen.findByRole('button', { name: 'Desfazer pagamento: Água' }));
    await usuario.click(within(screen.getByRole('alertdialog')).getByRole('button', { name: /desfazer/i }));

    const titulo = await screen.findByRole('heading', { name: /Pagas: 3 de 7/ });
    expect(titulo).toHaveTextContent(moeda('1.630,00'));
    expect(chamadasA(servidor, 'DELETE', `/api/ocorrencias/${ID_OC_AGUA}/pagamento`)).toHaveLength(1);
    const agua = await itemDe('Água', /Pagas: 3 de 7/);
    expect(agua).toHaveTextContent('Atrasada');
    expect(within(agua).queryByRole('button', { name: /Desfazer/ })).not.toBeInTheDocument();
    expect(await screen.findByText('Pagamento desfeito')).toBeInTheDocument();
  });

  it('o servidor recusa desfazer o pagamento de outro membro (sem_permissao) e a lista não muda', async () => {
    const usuario = userEvent.setup();
    // O front só oferece o botão ao pagador; aqui o servidor muda o dono entre a leitura e o clique.
    montarApp(FIXAS);
    await usuario.click(await screen.findByRole('button', { name: 'Desfazer pagamento: Água' }));
    servidor.ocorrencias.find((o) => o.id === ID_OC_AGUA)!.pagador = { nome: 'Beatriz', sou_eu: false };

    await usuario.click(within(screen.getByRole('alertdialog')).getByRole('button', { name: /desfazer/i }));

    expect(await screen.findByText('Você não tem permissão para alterar este item')).toBeInTheDocument();
    expect(screen.queryByText('Pagamento desfeito')).not.toBeInTheDocument();
    expect(await screen.findByRole('heading', { name: /Pagas: 4 de 7/ })).toBeInTheDocument();
  });

  it('sem rede, avisa o erro e a ocorrência continua paga', async () => {
    const usuario = userEvent.setup();
    montarApp(FIXAS);
    await usuario.click(await screen.findByRole('button', { name: 'Desfazer pagamento: Água' }));
    servidor.semRede = true;

    await usuario.click(within(screen.getByRole('alertdialog')).getByRole('button', { name: /desfazer/i }));

    await waitFor(() => expect(screen.queryByText('Pagamento desfeito')).not.toBeInTheDocument());
    expect(await itemDe('Água')).toHaveTextContent('Paga por você');
  });
});

describe('DespesasFixas: modelos', () => {
  it('lista os modelos ativos com link para o modelo e "Nova despesa fixa" sob /app', async () => {
    montarApp(FIXAS);

    const modelos = await screen.findByRole('region', { name: 'Modelos' });
    const aluguel = within(modelos)
      .getAllByRole('link')
      .find((a) => a.textContent?.includes('Aluguel'));
    expect(aluguel).toHaveTextContent('Moradia · dia 10');
    expect(aluguel).toHaveTextContent(moeda('1.200,00'));
    expect(aluguel).toHaveAttribute('href', `/app/fixas/${ID_ALUGUEL}?mes=2026-10`);
    expect(within(modelos).getByRole('link', { name: /Nova despesa fixa/ })).toHaveAttribute('href', '/app/fixas/nova');
  });

  it('modelo encerrado não aparece em Modelos', async () => {
    servidor.modelos = servidor.modelos.map((m) => (m.descricao === 'Gás' ? { ...m, encerrada_em: '2026-09-30' } : m));
    montarApp(FIXAS);

    const modelos = await screen.findByRole('region', { name: 'Modelos' });
    expect(within(modelos).queryByText('Gás')).not.toBeInTheDocument();
    expect(within(modelos).getByText('Condomínio')).toBeInTheDocument();
  });
});

describe('DespesasFixas: estados', () => {
  it('vazio: sem modelos e sem ocorrências mostra o estado vazio com "Nova despesa fixa"', async () => {
    servidor.modelos = lerResposta('despesas-fixas-vazio.json');
    servidor.ocorrencias = [];
    montarApp(FIXAS);

    expect(await screen.findByRole('heading', { name: 'Nenhuma despesa fixa cadastrada' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Nova despesa fixa/ })).toHaveAttribute('href', '/app/fixas/nova');
    expect(screen.queryByRole('heading', { name: /Pagas:/ })).not.toBeInTheDocument();
  });

  it('mês fora da janela de ±12 meses vem vazio (CA-15.2), mas os modelos ativos continuam listados', async () => {
    montarApp('/app/fixas?mes=2027-11');

    expect(await screen.findByText('Nenhuma despesa fixa neste mês')).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: /Pagas:/ })).not.toBeInTheDocument();
    expect(within(screen.getByRole('region', { name: 'Modelos' })).getByText('Aluguel')).toBeInTheDocument();
  });

  it('mês dentro da janela (outubro de 2027) gera as ocorrências', async () => {
    montarApp('/app/fixas?mes=2027-10');

    expect(await screen.findByRole('heading', { name: /Pagas: 0 de 7/ })).toBeInTheDocument();
  });

  it('todas pagas: avisa "Todas pagas em outubro"', async () => {
    servidor.ocorrencias = servidor.ocorrencias.map((o) =>
      o.pagador
        ? o
        : { ...o, pagador: { nome: 'Beatriz', sou_eu: false }, valor_pago_centavos: o.valor_previsto_centavos },
    );
    montarApp(FIXAS);

    expect(await screen.findByText('Todas pagas em outubro')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /Pagas: 7 de 7/ })).toBeInTheDocument();
  });

  it('carregando: mostra o texto de carregamento enquanto o servidor não responde', async () => {
    servidor.atrasos.set('GET /api/fixas/ocorrencias', 3000);
    montarApp(FIXAS);

    expect(await screen.findByText('Carregando as despesas fixas…', {}, { timeout: 2500 })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: /Pagas:/ })).not.toBeInTheDocument();
  });

  it('erro sem cache: estado de erro com "Tentar de novo", sem Modelos; tentar de novo recarrega', async () => {
    const usuario = userEvent.setup();
    servidor.falhas.set('GET /api/fixas/ocorrencias', { status: 500, code: 'erro_interno' });
    montarApp(FIXAS);

    expect(await screen.findByRole('heading', { name: 'Não foi possível carregar' })).toBeInTheDocument();
    expect(screen.queryByRole('region', { name: 'Modelos' })).not.toBeInTheDocument();
    servidor.falhas.clear();
    await usuario.click(screen.getByRole('button', { name: /Tentar de novo/ }));

    expect(await screen.findByRole('heading', { name: /Pagas: 4 de 7/ })).toBeInTheDocument();
  });
});

describe('Acesso às telas novas', () => {
  it('o link "Despesas fixas" de Ajustes leva à tela de fixas', async () => {
    const usuario = userEvent.setup();
    const { local } = montarApp('/app/ajustes');

    await usuario.click(await screen.findByRole('link', { name: /Despesas fixas/ }));

    expect(await screen.findByRole('heading', { name: /Pagas: 4 de 7/ }, { timeout: 5000 })).toBeInTheDocument();
    expect(local()).toMatch(/^\/app\/fixas/);
  });

  it('a pendência de fixa do Início ("Marcar como paga") abre a folha de pagamento da ocorrência', async () => {
    const usuario = userEvent.setup();
    const { local } = montarApp('/app?mes=2026-10');

    const pagar = await screen.findAllByRole('link', { name: /Aluguel/ });
    const link = pagar.find((a) => a.getAttribute('href')?.includes(`pagar=${ID_OC_ALUGUEL}`));
    expect(link).toBeDefined();
    await usuario.click(link!);

    expect(await screen.findByRole('dialog', { name: 'Marcar como paga' }, { timeout: 5000 })).toBeInTheDocument();
    expect(local()).toContain(`/app/fixas?mes=2026-10&pagar=${ID_OC_ALUGUEL}`);
  });

  it('a ocorrência de outro membro não abre a folha (id sem ocorrência pendente do mês vira /fixas limpo)', async () => {
    const { local } = montarApp(`/app/fixas?mes=2026-10&pagar=${ID_OC_LUZ}`);

    await screen.findByRole('heading', { name: /Pagas: 4 de 7/ }, { timeout: 5000 });

    expect(screen.queryByRole('dialog', { name: 'Marcar como paga' })).not.toBeInTheDocument();
    await waitFor(() => expect(local()).toBe('/app/fixas?mes=2026-10'));
  });
});
