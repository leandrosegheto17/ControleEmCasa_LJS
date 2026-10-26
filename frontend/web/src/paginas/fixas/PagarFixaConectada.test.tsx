import { configure, fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { limparAparelho, montarApp, preAquecerPaginas, UUID_V4 } from '../../../test/apoio/apiCadastros';
import {
  criarServidorFixas,
  ID_OC_AGUA,
  ID_OC_INTERNET,
  ID_PIX_NUBANK,
  instalarApiFixas,
  preAquecerFixas,
  type ServidorFixas,
} from '../../../test/apoio/apiFixas';
import { chamadasA } from '../../../test/apoio/apiLancamentos';

/**
 * Folha "Marcar como paga" (etapa 12, lote 3). Critérios: RN-15 (pagar com qualquer forma do pagador, valor padrão =
 * previsto, data padrão = hoje de 2000-01-01 até hoje + 30 dias; a data mostrada aos dois é sempre o vencimento),
 * CA-15.5 (pagar duas vezes: mesmo id devolve o gravado, outro id é `ocorrencia_paga`), CA-15.8 e RN-28 (a parcela da casa
 * fica no vencimento; a nota explica o crédito). Conforme o PRD-TECNICO, não conforme o legado.
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

const INTERNET = `/app/fixas?mes=2026-10&pagar=${ID_OC_INTERNET}`;
const NOTA_CREDITO =
  'Se pagar no cartão de crédito: conta em outubro na casa e aparece no cartão no próximo vencimento.';
const pagamentos = () => chamadasA(servidor, 'POST', '/api/ocorrencias/');

const folha = () => screen.getByRole('dialog', { name: 'Marcar como paga' });
const abrir = async (caminho = INTERNET) => {
  const app = montarApp(caminho);
  await screen.findByRole('dialog', { name: 'Marcar como paga' });
  return app;
};
const valorDe = (campo: HTMLElement) => (campo as HTMLInputElement).value;

async function escolherForma(usuario: ReturnType<typeof userEvent.setup>, nome: string) {
  await usuario.click(within(folha()).getByRole('button', { name: /Forma de pagamento/ }));
  await usuario.click(within(folha()).getByText(nome));
}

describe('Folha "Marcar como paga": abertura e padrões', () => {
  it('abre para a ocorrência do ?pagar= com forma preferida, valor previsto, hoje e a nota do crédito', async () => {
    await abrir();

    const dialogo = folha();
    expect(dialogo).toHaveAttribute('aria-modal', 'true');
    expect(dialogo).toHaveTextContent('Internet');
    expect(dialogo).toHaveTextContent('Contas da casa · venceu 05/10');
    expect(
      within(dialogo).getByRole('button', { name: /Forma de pagamento\s*Pix Nubank\s*· Pix/ }),
    ).toBeInTheDocument();
    expect(
      within(dialogo).getByText('Só você vê a forma e a conta. O outro membro vê "Paga por Ana".'),
    ).toBeInTheDocument();
    expect(valorDe(within(dialogo).getByLabelText('Valor pago'))).toMatch(/^R\$\s119,90$/);
    expect(within(dialogo).getByText(/^Previsto: R\$\s119,90$/)).toBeInTheDocument();
    expect(within(dialogo).getByLabelText('Data do pagamento')).toHaveValue('2026-10-09');
    expect(within(dialogo).getByText(NOTA_CREDITO)).toBeInTheDocument();
  });

  it('o campo de data limita o período a 2000-01-01 até hoje + 30 dias', async () => {
    await abrir();

    const data = within(folha()).getByLabelText('Data do pagamento');
    expect(data).toHaveAttribute('min', '2000-01-01');
    expect(data).toHaveAttribute('max', '2026-11-08');
  });

  it('escolher o cartão de crédito mantém a nota (a parcela da casa não muda de data)', async () => {
    const usuario = userEvent.setup();
    await abrir();

    await escolherForma(usuario, 'Cartão de crédito XP');

    expect(
      within(folha()).getByRole('button', { name: /Forma de pagamento\s*Cartão de crédito XP\s*· Crédito/ }),
    ).toBeInTheDocument();
    expect(within(folha()).getByText(NOTA_CREDITO)).toBeInTheDocument();
  });

  it.each([
    ['ocorrência já paga', ID_OC_AGUA],
    ['id estranho', 'xyz'],
  ])('%s: não abre e tira o parâmetro', async (_caso, id) => {
    const { local } = montarApp(`/app/fixas?mes=2026-10&pagar=${id}`);

    await screen.findByRole('heading', { name: /Pagas: 4 de 7/ });

    await waitFor(() => expect(local()).toBe('/app/fixas?mes=2026-10'));
    expect(screen.queryByRole('dialog', { name: 'Marcar como paga' })).not.toBeInTheDocument();
  });

  it('fechar pelo X tira o parâmetro e mantém o mês', async () => {
    const usuario = userEvent.setup();
    const { local } = await abrir();

    await usuario.click(within(folha()).getByRole('button', { name: 'Fechar' }));

    expect(screen.queryByRole('dialog', { name: 'Marcar como paga' })).not.toBeInTheDocument();
    expect(local()).toBe('/app/fixas?mes=2026-10');
  });
});

describe('Folha "Marcar como paga": confirmar', () => {
  it('envia id novo, forma, valor e data; a ocorrência vira paga por mim e mostra o VENCIMENTO, não a data do pagamento', async () => {
    const usuario = userEvent.setup();
    const { local } = await abrir();

    await usuario.click(within(folha()).getByRole('button', { name: 'Confirmar pagamento' }));

    expect(await screen.findByText('Marcada como paga')).toBeInTheDocument();
    expect(pagamentos()).toHaveLength(1);
    const chamada = pagamentos()[0]!;
    expect(chamada.url).toBe(`/api/ocorrencias/${ID_OC_INTERNET}/pagamento`);
    expect(chamada.corpo).toMatchObject({
      forma_id: ID_PIX_NUBANK,
      valor_centavos: 11990,
      data: '2026-10-09',
    });
    expect(chamada.corpo!.id).toMatch(UUID_V4);
    expect(chamada.cabecalhos['X-Controle-Em-Casa']).toBe('1');
    await waitFor(() => expect(local()).toBe('/app/fixas?mes=2026-10'));
    expect(screen.queryByRole('dialog', { name: 'Marcar como paga' })).not.toBeInTheDocument();

    const titulo = await screen.findByRole('heading', { name: /Pagas: 5 de 7/ });
    const internet = within(titulo.closest('section') as HTMLElement)
      .getAllByRole('listitem')
      .find((li) => li.textContent?.includes('Internet'))!;
    expect(internet).toHaveTextContent('Paga por você');
    // RN-15 / I-20: a data mostrada é a do vencimento (05/10), nunca a da operação (09/10).
    expect(internet).toHaveTextContent('vence 05/10');
    expect(internet).not.toHaveTextContent('09/10');
    expect(servidor.pagamentos).toHaveLength(1);
  });

  it('pagar no crédito com valor e data editados envia o que foi escolhido; o servidor decide as parcelas', async () => {
    const usuario = userEvent.setup();
    await abrir();

    await escolherForma(usuario, 'Cartão de crédito XP');
    const valor = within(folha()).getByLabelText('Valor pago');
    await usuario.clear(valor);
    await usuario.type(valor, '12490');
    fireDataDoPagamento('2026-10-07');
    await usuario.click(within(folha()).getByRole('button', { name: 'Confirmar pagamento' }));

    await screen.findByText('Marcada como paga');
    expect(pagamentos()[0]!.corpo).toMatchObject({
      forma_id: '00000000-0000-4000-8000-000000000303',
      valor_centavos: 12490,
    });
    const titulo = await screen.findByRole('heading', { name: /Pagas: 5 de 7/ });
    const internet = within(titulo.closest('section') as HTMLElement)
      .getAllByRole('listitem')
      .find((li) => li.textContent?.includes('Internet'))!;
    expect(internet).toHaveTextContent(/R\$\s124,90/);
    expect(internet).toHaveTextContent('vence 05/10');
  });

  it('sem rede: aviso de topo, dados mantidos; "Tentar de novo" reenvia com o MESMO id (idempotência, CA-15.5)', async () => {
    const usuario = userEvent.setup();
    await abrir();
    await escolherForma(usuario, 'Débito Itaú');
    const valor = within(folha()).getByLabelText('Valor pago');
    await usuario.clear(valor);
    await usuario.type(valor, '12490');
    servidor.semRede = true;
    await usuario.click(within(folha()).getByRole('button', { name: 'Confirmar pagamento' }));

    const alerta = await within(folha()).findByRole('alert');
    expect(alerta).toHaveTextContent(/Sem conexão\. O pagamento não foi registrado/);
    expect(valorDe(within(folha()).getByLabelText('Valor pago'))).toMatch(/^R\$\s124,90$/);
    expect(within(folha()).getByRole('button', { name: /Forma de pagamento\s*Débito Itaú/ })).toBeInTheDocument();
    servidor.semRede = false;

    await usuario.click(within(folha()).getByRole('button', { name: 'Tentar de novo' }));

    await screen.findByText('Marcada como paga');
    const enviados = pagamentos();
    expect(enviados).toHaveLength(2);
    expect(enviados[0]!.corpo!.id).toMatch(UUID_V4);
    expect(enviados[1]!.corpo!.id).toBe(enviados[0]!.corpo!.id);
    expect(enviados[1]!.corpo).toMatchObject({ valor_centavos: 12490 });
    expect(servidor.pagamentos).toHaveLength(1);
  });

  it('data fora do período: o servidor recusa (valor_invalido) e a folha mostra o texto da data', async () => {
    const usuario = userEvent.setup();
    await abrir();
    fireDataDoPagamento('2026-12-31');

    await usuario.click(within(folha()).getByRole('button', { name: 'Confirmar pagamento' }));

    expect(await within(folha()).findByRole('alert')).toHaveTextContent('Data fora do período permitido');
    expect(servidor.pagamentos).toHaveLength(0);
  });

  it('já paga pelo outro membro (ocorrencia_paga): aviso no topo e a lista é relida', async () => {
    const usuario = userEvent.setup();
    await abrir();
    const o = servidor.ocorrencias.find((x) => x.id === ID_OC_INTERNET)!;
    o.pagador = { nome: 'Beatriz', sou_eu: false };
    o.valor_pago_centavos = 11990;
    servidor.pagamentos.push({
      id: crypto.randomUUID(),
      ocorrenciaId: ID_OC_INTERNET,
      formaId: ID_PIX_NUBANK,
      data: '2026-10-08',
      valorCentavos: 11990,
    });

    await usuario.click(within(folha()).getByRole('button', { name: 'Confirmar pagamento' }));

    expect((await screen.findAllByText('Esta ocorrência já foi paga.')).length).toBeGreaterThan(0);
    expect(servidor.pagamentos).toHaveLength(1);
    // A lista é relida: a ocorrência aparece paga pelo outro membro e a folha deixa de abrir para ela.
    const titulo = await screen.findByRole('heading', { name: /Pagas: 5 de 7/ });
    const internet = within(titulo.closest('section') as HTMLElement)
      .getAllByRole('listitem')
      .find((li) => li.textContent?.includes('Internet'))!;
    expect(internet).toHaveTextContent('Paga por Beatriz');
    expect(screen.queryByRole('dialog', { name: 'Marcar como paga' })).not.toBeInTheDocument();
  });
});

describe('Folha "Marcar como paga": sem forma de pagamento', () => {
  it('mostra o atalho "Cadastrar forma" sob /app e não mostra o rodapé', async () => {
    servidor.dados = { ...servidor.dados, formas: [], forma_padrao_id: null };
    await abrir();

    const dialogo = folha();
    expect(
      within(dialogo).getByRole('heading', { level: 3, name: 'Você ainda não tem forma de pagamento' }),
    ).toBeInTheDocument();
    expect(within(dialogo).getByRole('link', { name: 'Cadastrar forma' })).toHaveAttribute(
      'href',
      '/app/ajustes/formas/nova',
    );
    expect(within(dialogo).queryByRole('button', { name: 'Confirmar pagamento' })).not.toBeInTheDocument();
    expect(within(dialogo).queryByLabelText('Valor pago')).not.toBeInTheDocument();
  });
});

function fireDataDoPagamento(data: string) {
  fireEvent.change(within(folha()).getByLabelText('Data do pagamento'), { target: { value: data } });
}
