import { configure, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { escritas, limparAparelho, montarApp, preAquecerPaginas, UUID_V4 } from '../../../test/apoio/apiCadastros';
import { chamadasA } from '../../../test/apoio/apiLancamentos';
import {
  criarServidorMetas,
  ID_CARRO,
  ID_VIAGEM,
  instalarApiMetas,
  preAquecerMetas,
  type ServidorMetas,
} from '../../../test/apoio/apiMetas';

/**
 * Movimentar a meta, aporte e retirada (etapa 12, lote 4). Critérios: RN-08, RN-09, CA-09.1 (retirada limitada ao guardado
 * do local, `retirada_maior_que_guardado` com 422), CA-09.3 (conta só do próprio autor), CA-09.4 (local vazio e valor
 * inválido), CA-09.5 (sugestões de local do mais recente ao mais antigo), CA-08.5 (a conta é privada), ADR-010 (id do
 * movimento gerado uma vez por folha). `POST /api/metas/:id/movimentos` devolve `{ id }`.
 */

let servidor: ServidorMetas;

configure({ asyncUtilTimeout: 5000 });

beforeAll(async () => {
  await preAquecerPaginas();
  await preAquecerMetas();
}, 60_000);

beforeEach(async () => {
  servidor = criarServidorMetas();
  instalarApiMetas(servidor);
  await limparAparelho();
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-10-09T15:00:00-03:00'));
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

const APORTE = `/app/metas/${ID_VIAGEM}?movimentar=aporte`;
const RETIRADA = `/app/metas/${ID_VIAGEM}?movimentar=retirada`;
const folha = () => screen.findByRole('dialog');
const posts = () => escritas(servidor).filter((c) => c.metodo === 'POST');

describe('Aporte', () => {
  it('abre a folha com o nome da meta, o tipo Aporte, sugestões de local e conta "Nenhuma"', async () => {
    montarApp(APORTE);

    const dialogo = await folha();
    expect(dialogo).toHaveAccessibleName('Viagem Nordeste');
    const tipo = within(dialogo).getByRole('group', { name: 'Tipo de movimento' });
    expect(within(tipo).getByRole('radio', { name: 'Aporte' })).toBeChecked();
    expect(within(dialogo).getByLabelText('Valor')).toHaveValue('R$ 0,00');
    const local = within(dialogo).getByLabelText('Onde está guardado');
    expect(local).toHaveAttribute('placeholder', 'Ex.: Caixinha Nubank');
    // CA-09.5: do uso mais recente ao mais antigo, incluindo os de outras metas visíveis.
    expect(await within(dialogo).findByText(/Já usados: Caixinha Nubank, CDB Banco Inter/)).toBeInTheDocument();
    const lista = document.getElementById(local.getAttribute('list') ?? '');
    expect(Array.from(lista?.querySelectorAll('option') ?? []).map((o) => o.value)).toEqual(
      expect.arrayContaining(['Caixinha Nubank', 'CDB Banco Inter']),
    );
    const conta = within(dialogo).getByLabelText('Conta de origem (opcional)') as HTMLSelectElement;
    // As contas chegam de `GET /api/lancamentos/dados`, depois de a folha abrir.
    await waitFor(() =>
      expect(
        within(conta)
          .getAllByRole('option')
          .map((o) => o.textContent),
      ).toEqual(['Nenhuma', 'Nubank', 'Itaú']),
    );
    expect(conta.selectedOptions[0]!.textContent).toBe('Nenhuma');
    expect(within(dialogo).getByText('Debita o saldo da conta. Só você vê a conta.')).toBeInTheDocument();
    expect(within(dialogo).getByLabelText('Data')).toHaveValue('2026-10-09');
    expect(screen.getByRole('button', { name: 'Confirmar aporte' })).toBeInTheDocument();
  });

  it('local vazio mostra erro e põe o foco no campo, sem enviar (CA-09.4)', async () => {
    const usuario = userEvent.setup();
    montarApp(APORTE);

    const dialogo = await folha();
    await usuario.type(within(dialogo).getByLabelText('Valor'), '50000');
    await usuario.click(screen.getByRole('button', { name: 'Confirmar aporte' }));

    expect(await within(dialogo).findByText('Informe onde está guardado.')).toBeInTheDocument();
    expect(within(dialogo).getByLabelText('Onde está guardado')).toHaveFocus();
    expect(posts()).toHaveLength(0);
  });

  it('valor zero mostra erro no campo de valor, sem enviar (CA-09.4)', async () => {
    const usuario = userEvent.setup();
    montarApp(APORTE);

    const dialogo = await folha();
    await usuario.type(within(dialogo).getByLabelText('Onde está guardado'), 'Cofre');
    await usuario.click(screen.getByRole('button', { name: 'Confirmar aporte' }));

    expect(await within(dialogo).findByText('Informe um valor maior que zero.')).toBeInTheDocument();
    expect(within(dialogo).getByLabelText('Valor')).toHaveFocus();
    expect(posts()).toHaveLength(0);
  });

  it('envia POST /api/metas/:id/movimentos sem conta quando "Nenhuma"; o guardado sobe', async () => {
    const usuario = userEvent.setup();
    montarApp(APORTE);

    const dialogo = await folha();
    await usuario.type(within(dialogo).getByLabelText('Valor'), '50000');
    await usuario.type(within(dialogo).getByLabelText('Onde está guardado'), 'Cofre');
    await usuario.click(screen.getByRole('button', { name: 'Confirmar aporte' }));

    expect(await screen.findByText('Aporte registrado')).toBeInTheDocument();
    expect(posts()).toHaveLength(1);
    expect(posts()[0]).toMatchObject({
      url: `/api/metas/${ID_VIAGEM}/movimentos`,
      corpo: { tipo: 'aporte', valor_centavos: 50000, local: 'Cofre', data: '2026-10-09' },
    });
    expect(posts()[0]!.corpo).not.toHaveProperty('conta_id');
    expect(String(posts()[0]!.corpo!.id)).toMatch(UUID_V4);
    expect(posts()[0]!.cabecalhos['X-Controle-Em-Casa']).toBe('1');
    // Recarregado: 6.200,00 + 500,00 = 6.700,00.
    const resumo = await screen.findByRole('region', { name: 'Faltam' });
    await waitFor(() =>
      expect(within(resumo).getByText('Guardado').nextElementSibling).toHaveTextContent('R$ 6.700,00'),
    );
  });

  it('envia a conta escolhida e debita o saldo dela; a conta não vai para a URL', async () => {
    const usuario = userEvent.setup();
    const { local } = montarApp(APORTE);
    const saldoAntes = servidor.contas.find((c) => c.nome === 'Nubank')!.saldo_centavos;

    const dialogo = await folha();
    await usuario.type(within(dialogo).getByLabelText('Valor'), '50000');
    await usuario.type(within(dialogo).getByLabelText('Onde está guardado'), 'Caixinha Nubank');
    await usuario.selectOptions(within(dialogo).getByLabelText('Conta de origem (opcional)'), 'Nubank');
    expect(local()).not.toContain('Nubank');
    await usuario.click(screen.getByRole('button', { name: 'Confirmar aporte' }));

    await screen.findByText('Aporte registrado');
    expect(posts()[0]!.corpo).toMatchObject({ conta_id: '00000000-0000-4000-8000-000000000201' });
    expect(servidor.contas.find((c) => c.nome === 'Nubank')!.saldo_centavos).toBe(saldoAntes - 50000);
  });

  it('sucesso fecha a folha e tira o parâmetro da URL', async () => {
    const usuario = userEvent.setup();
    const { local } = montarApp(APORTE);

    const dialogo = await folha();
    await usuario.type(within(dialogo).getByLabelText('Valor'), '50000');
    await usuario.type(within(dialogo).getByLabelText('Onde está guardado'), 'Cofre');
    await usuario.click(screen.getByRole('button', { name: 'Confirmar aporte' }));

    await screen.findByText('Aporte registrado');
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(local()).toBe(`/app/metas/${ID_VIAGEM}`);
  });

  it('ADR-010: sem rede avisa no topo, mantém os campos e reenvia com o mesmo id, gravando um só movimento', async () => {
    const usuario = userEvent.setup();
    montarApp(APORTE);

    const dialogo = await folha();
    await usuario.type(within(dialogo).getByLabelText('Valor'), '50000');
    await usuario.type(within(dialogo).getByLabelText('Onde está guardado'), 'Cofre');
    await usuario.selectOptions(within(dialogo).getByLabelText('Conta de origem (opcional)'), 'Nubank');
    servidor.semRede = true;
    await usuario.click(screen.getByRole('button', { name: 'Confirmar aporte' }));

    expect(await within(dialogo).findByText(/Sem conexão/)).toBeInTheDocument();
    expect(within(dialogo).getByLabelText('Valor')).toHaveValue('R$ 500,00');
    expect(within(dialogo).getByLabelText('Onde está guardado')).toHaveValue('Cofre');
    expect(
      (within(dialogo).getByLabelText('Conta de origem (opcional)') as HTMLSelectElement).selectedOptions[0]!
        .textContent,
    ).toBe('Nubank');

    servidor.semRede = false;
    await usuario.click(screen.getByRole('button', { name: /Confirmar aporte|Tentar de novo/ }));
    await screen.findByText('Aporte registrado');
    const envios = servidor.chamadas.filter((c) => c.metodo === 'POST' && c.url.endsWith('/movimentos'));
    expect(envios).toHaveLength(2);
    expect(envios[1]!.corpo!.id).toBe(envios[0]!.corpo!.id);
    expect(servidor.movimentos.filter((m) => m.local === 'Cofre')).toHaveLength(1);
  });
});

describe('Retirada', () => {
  it('mostra os locais com saldo como escolha, o 1º marcado, e os textos de destino', async () => {
    montarApp(RETIRADA);

    const dialogo = await folha();
    expect(within(dialogo).getByRole('radio', { name: 'Retirada' })).toBeChecked();
    const origem = within(dialogo).getByRole('radiogroup', { name: 'De onde sai' });
    const locais = within(origem).getAllByRole('radio');
    expect(locais).toHaveLength(2);
    expect(locais[0]).toHaveAccessibleName('Caixinha Nubank · R$ 4.200,00');
    expect(locais[0]).toBeChecked();
    expect(locais[1]).toHaveAccessibleName('CDB Banco Inter · R$ 2.000,00');
    expect(within(dialogo).getByLabelText('Conta de destino (opcional)')).toBeInTheDocument();
    expect(within(dialogo).getByText('Credita o saldo da conta. Só você vê a conta.')).toBeInTheDocument();
    expect(within(dialogo).queryByLabelText('Onde está guardado')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Confirmar retirada' })).toBeInTheDocument();
    // As sugestões de local só servem ao aporte.
    expect(chamadasA(servidor, 'GET', '/api/metas/locais')).toEqual([]);
  });

  it('meta sem valor guardado mostra o estado vazio, sem botão de confirmar', async () => {
    servidor.metas.push({
      id: ID_CARRO,
      nome: 'Carro novo',
      escopo: 'individual',
      alvo: 2000000,
      prazo: '2028-12',
      doOutro: false,
    });
    montarApp(`/app/metas/${ID_CARRO}?movimentar=retirada`);

    const dialogo = await folha();
    expect(dialogo).toHaveAccessibleName('Carro novo');
    expect(
      within(dialogo).getByRole('heading', { level: 3, name: 'Não há valor guardado para retirar' }),
    ).toBeInTheDocument();
    expect(within(dialogo).getByText('Esta meta ainda não tem aportes.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Confirmar/ })).not.toBeInTheDocument();
    expect(within(dialogo).queryByLabelText('Valor')).not.toBeInTheDocument();
  });

  it('envia o local escolhido e credita a conta de destino', async () => {
    const usuario = userEvent.setup();
    montarApp(RETIRADA);
    const saldoAntes = servidor.contas.find((c) => c.nome === 'Nubank')!.saldo_centavos;

    const dialogo = await folha();
    await usuario.click(within(dialogo).getByRole('radio', { name: /CDB Banco Inter/ }));
    await usuario.type(within(dialogo).getByLabelText('Valor'), '30000');
    await usuario.selectOptions(within(dialogo).getByLabelText('Conta de destino (opcional)'), 'Nubank');
    await usuario.click(screen.getByRole('button', { name: 'Confirmar retirada' }));

    expect(await screen.findByText('Retirada registrada')).toBeInTheDocument();
    expect(posts()[0]!.corpo).toMatchObject({ tipo: 'retirada', local: 'CDB Banco Inter', valor_centavos: 30000 });
    expect(servidor.contas.find((c) => c.nome === 'Nubank')!.saldo_centavos).toBe(saldoAntes + 30000);
  });

  it('CA-09.1: retirar acima do guardado do local é recusado e o erro aparece no campo de valor', async () => {
    const usuario = userEvent.setup();
    montarApp(RETIRADA);

    const dialogo = await folha();
    await usuario.click(within(dialogo).getByRole('radio', { name: /CDB Banco Inter/ }));
    // O CDB tem R$ 2.000,00; a meta toda tem R$ 6.200,00, mas o limite é o do local.
    await usuario.type(within(dialogo).getByLabelText('Valor'), '250000');
    await usuario.click(screen.getByRole('button', { name: 'Confirmar retirada' }));

    const mensagem = 'Em CDB Banco Inter há R$ 2.000,00. A retirada não pode passar disso.';
    expect(await within(dialogo).findByText(mensagem)).toBeInTheDocument();
    const valor = within(dialogo).getByLabelText('Valor');
    expect(valor).toHaveAttribute('aria-invalid', 'true');
    expect(valor).toHaveAccessibleDescription(expect.stringContaining(mensagem));
    expect(servidor.movimentos.filter((m) => m.tipo === 'retirada')).toHaveLength(1);
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });
});

describe('Abertura e fechamento da folha', () => {
  it('trocar o tipo no segmentado atualiza a URL', async () => {
    const usuario = userEvent.setup();
    const { local } = montarApp(APORTE);

    const dialogo = await folha();
    await usuario.click(within(dialogo).getByRole('radio', { name: 'Retirada' }));

    await waitFor(() => expect(local()).toContain('movimentar=retirada'));
    expect(screen.getByRole('button', { name: 'Confirmar retirada' })).toBeInTheDocument();
  });

  it('valor estranho no parâmetro é retirado sem abrir a folha', async () => {
    const { local } = montarApp(`/app/metas/${ID_VIAGEM}?movimentar=xyz`);

    await screen.findByRole('heading', { level: 1, name: 'Viagem Nordeste' });
    await waitFor(() => expect(local()).toBe(`/app/metas/${ID_VIAGEM}`));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('Esc fecha, tira o parâmetro e devolve o foco ao botão de origem', async () => {
    const usuario = userEvent.setup();
    const { local } = montarApp(`/app/metas/${ID_VIAGEM}`);

    await usuario.click(await screen.findByRole('link', { name: 'Aportar' }));
    await folha();
    await usuario.keyboard('{Escape}');

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(local()).toBe(`/app/metas/${ID_VIAGEM}`);
    await waitFor(() => expect(screen.getByRole('link', { name: 'Aportar' })).toHaveFocus());
  });

  it('o X "Fechar" fecha a folha', async () => {
    const usuario = userEvent.setup();
    const { local } = montarApp(APORTE);

    const dialogo = await folha();
    await usuario.click(within(dialogo).getByLabelText('Fechar'));

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(local()).toBe(`/app/metas/${ID_VIAGEM}`);
  });
});
