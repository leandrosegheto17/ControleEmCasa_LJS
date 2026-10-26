import { configure, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { limparAparelho, montarApp, preAquecerPaginas } from '../../test/apoio/apiCadastros';
import {
  criarServidorPlano,
  instalarApiPlano,
  PIX_DE_TESTE,
  planoFree,
  planoTrial,
  preAquecerPlano,
  type ServidorPlano,
} from '../../test/apoio/apiPlano';
import { chamadasA } from '../../test/apoio/apiLancamentos';

/**
 * Meu plano (etapa 13, lote 2). Critérios: RN-24 (plano do lar; só o titular assina e cancela; o convidado vê o plano
 * sem ações), CA-24.1 (trial de 14 dias), CA-24.6 (CPF/CNPJ com dígito errado não assina), CA-24.7 (a cobrança em aberto
 * leva o Pix copia-e-cola e o QR), CA-24.8 (cancelar mantém o Pro até o fim do período pago), CA-24.11 (o CPF/CNPJ só
 * viaja no corpo do POST; nunca em armazenamento local, fila ou URL). Assinar e cancelar exigem rede.
 */

let servidor: ServidorPlano;

configure({ asyncUtilTimeout: 5000 });

beforeAll(async () => {
  await preAquecerPaginas();
  await preAquecerPlano();
}, 60_000);

beforeEach(async () => {
  servidor = criarServidorPlano({ meuPlano: planoFree() });
  instalarApiPlano(servidor);
  await limparAparelho();
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-10-09T15:00:00-03:00'));
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

const PLANO = '/app/ajustes/plano';
const CPF_VALIDO = '52998224725';
const CPF_COM_MASCARA = '529.982.247-25';
const CPF_INVALIDO = '52998224724';

const COBRANCA = {
  vencimento: '2026-10-09',
  valor_centavos: 990,
  situacao: 'pendente' as const,
  pix_copia_cola: PIX_DE_TESTE,
  qr_png_base64: 'iVBORw0KGgo=',
};

const campoCpf = () => screen.findByLabelText('CPF ou CNPJ do titular');
const chamadasDePlano = () => servidor.chamadas.filter((c) => c.url.startsWith('/api/plano'));

describe('Meu plano: o que a pessoa vê', () => {
  it('trial: plano Pro, dias restantes e o preço de R$ 9,90 por mês (CA-24.1)', async () => {
    servidor.meuPlano = planoTrial();
    montarApp(PLANO);

    expect(await screen.findByRole('heading', { level: 1, name: 'Meu plano' })).toBeInTheDocument();
    const grupo = await screen.findByRole('region', { name: 'Plano da casa' });
    expect(grupo).toHaveTextContent('PlanoPro');
    expect(grupo).toHaveTextContent('Período de teste: faltam 14 dias');
    expect(grupo).toHaveTextContent(/R\$\s9,90 por mês/);
  });

  it('free: plano Free e o formulário de assinatura para o titular', async () => {
    montarApp(PLANO);

    const grupo = await screen.findByRole('region', { name: 'Plano da casa' });
    expect(grupo).toHaveTextContent('PlanoFree');
    expect(grupo).toHaveTextContent('Plano Free');
    expect(await campoCpf()).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Assinar o Pro' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Cancelar assinatura' })).not.toBeInTheDocument();
  });

  it('ativa: mostra até quando está paga e oferece cancelar, sem formulário de assinatura', async () => {
    servidor.meuPlano = planoFree({ plano: 'pro', situacao: 'ativa', periodo_ate: '2026-11-09T15:00:00.000Z' });
    montarApp(PLANO);

    const grupo = await screen.findByRole('region', { name: 'Plano da casa' });
    expect(grupo).toHaveTextContent('Ativa, paga até 09/11/2026');
    expect(screen.getByRole('button', { name: 'Cancelar assinatura' })).toBeInTheDocument();
    expect(screen.queryByLabelText('CPF ou CNPJ do titular')).not.toBeInTheDocument();
  });

  it('atrasada: avisa que o pagamento está atrasado e mostra a cobrança vencida', async () => {
    servidor.meuPlano = planoFree({
      plano: 'pro',
      situacao: 'atrasada',
      cobranca: { ...COBRANCA, vencimento: '2026-10-05', situacao: 'vencida' },
    });
    montarApp(PLANO);

    expect(await screen.findByText('Pagamento atrasado')).toBeInTheDocument();
    const cobranca = screen.getByRole('region', { name: 'Cobrança vencida' });
    expect(cobranca).toHaveTextContent('venceu em 05/10/2026');
    expect(screen.getByRole('button', { name: 'Cancelar assinatura' })).toBeInTheDocument();
  });

  it('cancelada com período pago: mostra "Pro até" a data (CA-24.8) e deixa assinar de novo', async () => {
    servidor.meuPlano = planoFree({ plano: 'pro', situacao: 'cancelada', periodo_ate: '2026-11-09T15:00:00.000Z' });
    montarApp(PLANO);

    expect(await screen.findByText('Cancelada. Pro até 09/11/2026')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Assinar o Pro' })).toBeInTheDocument();
  });

  it('o link de Ajustes leva a Meu plano', async () => {
    montarApp('/app/ajustes');

    const link = await screen.findByRole('link', { name: /Meu plano/ });
    expect(link).toHaveAttribute('href', PLANO);
  });

  it('o voltar leva a Ajustes', async () => {
    montarApp(PLANO);

    expect(await screen.findByRole('link', { name: 'Voltar para Ajustes' })).toHaveAttribute('href', '/app/ajustes');
  });
});

describe('Meu plano: o convidado (RN-24: o plano é do titular)', () => {
  beforeEach(() => {
    servidor.meuPlano = planoTrial({ sou_titular: false });
  });

  it('vê o plano da casa e a explicação, sem formulário nem botões de assinatura', async () => {
    montarApp(PLANO);

    const grupo = await screen.findByRole('region', { name: 'Plano da casa' });
    expect(grupo).toHaveTextContent('Pro');
    expect(screen.getByText(/O plano é da casa e quem assina e cancela é o titular/)).toBeInTheDocument();
    expect(screen.queryByLabelText('CPF ou CNPJ do titular')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Assinar|Cancelar assinatura/ })).not.toBeInTheDocument();
  });

  it('nenhuma escrita é feita', async () => {
    montarApp(PLANO);
    await screen.findByRole('region', { name: 'Plano da casa' });

    expect(chamadasDePlano().filter((c) => c.metodo !== 'GET')).toEqual([]);
  });
});

describe('Meu plano: assinar (CA-24.6, CA-24.7, CA-24.11)', () => {
  it('CPF com dígito errado: mostra o erro no campo e não envia nada', async () => {
    const usuario = userEvent.setup();
    montarApp(PLANO);

    await usuario.type(await campoCpf(), CPF_INVALIDO);
    await usuario.click(screen.getByRole('button', { name: 'Assinar o Pro' }));

    expect(await screen.findByText('Informe um CPF ou CNPJ válido.')).toBeInTheDocument();
    expect(chamadasA(servidor, 'POST', '/api/plano/assinar')).toHaveLength(0);
  });

  it('campo vazio também não envia', async () => {
    const usuario = userEvent.setup();
    montarApp(PLANO);

    await campoCpf();
    await usuario.click(screen.getByRole('button', { name: 'Assinar o Pro' }));

    expect(await screen.findByText('Informe um CPF ou CNPJ válido.')).toBeInTheDocument();
    expect(chamadasA(servidor, 'POST', '/api/plano/assinar')).toHaveLength(0);
  });

  it('a máscara acompanha a digitação: CPF e depois CNPJ', async () => {
    const usuario = userEvent.setup();
    montarApp(PLANO);
    const campo = await campoCpf();

    await usuario.type(campo, CPF_VALIDO);
    expect(campo).toHaveValue(CPF_COM_MASCARA);

    await usuario.clear(campo);
    await usuario.type(campo, '11444777000161');
    expect(campo).toHaveValue('11.444.777/0001-61');
  });

  it('CPF válido: assina, mostra a cobrança com o Pix copia-e-cola e o QR e avisa', async () => {
    const usuario = userEvent.setup();
    montarApp(PLANO);

    await usuario.type(await campoCpf(), CPF_VALIDO);
    await usuario.click(screen.getByRole('button', { name: 'Assinar o Pro' }));

    const cobranca = await screen.findByRole('region', { name: 'Cobrança em aberto' });
    expect(within(cobranca).getByLabelText('Pix copia e cola')).toHaveTextContent(PIX_DE_TESTE);
    expect(within(cobranca).getByRole('img', { name: 'QR code do Pix' })).toHaveAttribute(
      'src',
      expect.stringMatching(/^data:image\/png;base64,/),
    );
    expect(cobranca).toHaveTextContent(/R\$\s9,90, vence em 09\/10\/2026/);
    expect(await screen.findByText('Assinatura criada. Pague o Pix para ativar o Pro')).toBeInTheDocument();
    const envios = chamadasA(servidor, 'POST', '/api/plano/assinar');
    expect(envios).toHaveLength(1);
    expect(envios[0]?.cabecalhos['X-Controle-Em-Casa']).toBe('1');
    expect(envios[0]?.corpo).toEqual({ cpf_cnpj: CPF_COM_MASCARA });
    expect(screen.queryByLabelText('CPF ou CNPJ do titular')).not.toBeInTheDocument();
  });

  it('o CPF só viaja no corpo do POST: nunca na URL, em localStorage ou sessionStorage (CA-24.11)', async () => {
    const usuario = userEvent.setup();
    montarApp(PLANO);

    await usuario.type(await campoCpf(), CPF_VALIDO);
    await usuario.click(screen.getByRole('button', { name: 'Assinar o Pro' }));
    await screen.findByRole('region', { name: 'Cobrança em aberto' });

    for (const chamada of servidor.chamadas) {
      expect(chamada.url).not.toContain(CPF_VALIDO);
      expect(chamada.url).not.toContain(CPF_COM_MASCARA);
      if (chamada.url !== '/api/plano/assinar') expect(JSON.stringify(chamada.corpo ?? {})).not.toContain(CPF_VALIDO);
    }
    for (const armazem of [localStorage, sessionStorage]) {
      for (let i = 0; i < armazem.length; i += 1) {
        const chave = armazem.key(i)!;
        expect(`${chave}=${armazem.getItem(chave)}`).not.toContain(CPF_VALIDO);
        expect(`${chave}=${armazem.getItem(chave)}`).not.toContain(CPF_COM_MASCARA);
      }
    }
    expect(document.body.innerHTML).not.toContain(CPF_VALIDO);
  });

  it('o servidor recusa o CPF (valor_invalido): o erro aparece no campo e o texto é corrigível', async () => {
    const usuario = userEvent.setup();
    servidor.falhas.set('POST /api/plano/assinar', { status: 400, code: 'valor_invalido' });
    montarApp(PLANO);

    await usuario.type(await campoCpf(), CPF_VALIDO);
    await usuario.click(screen.getByRole('button', { name: 'Assinar o Pro' }));

    expect(await screen.findByText('Confira o CPF ou CNPJ informado.')).toBeInTheDocument();
    await usuario.type(screen.getByLabelText('CPF ou CNPJ do titular'), '0');
    expect(screen.queryByText('Confira o CPF ou CNPJ informado.')).not.toBeInTheDocument();
  });

  it('Asaas fora do ar (503): mostra o erro e mantém o formulário', async () => {
    const usuario = userEvent.setup();
    servidor.falhas.set('POST /api/plano/assinar', { status: 503, code: 'indisponivel' });
    montarApp(PLANO);

    await usuario.type(await campoCpf(), CPF_VALIDO);
    await usuario.click(screen.getByRole('button', { name: 'Assinar o Pro' }));

    expect(await screen.findByText(/O serviço de pagamento está indisponível/)).toBeInTheDocument();
    expect(screen.getByLabelText('CPF ou CNPJ do titular')).toHaveValue(CPF_COM_MASCARA);
  });

  it('sem rede: diz que assinar exige internet e não guarda nada no aparelho (não entra na fila)', async () => {
    const usuario = userEvent.setup();
    montarApp(PLANO);
    await usuario.type(await campoCpf(), CPF_VALIDO);
    servidor.semRede = true;

    await usuario.click(screen.getByRole('button', { name: 'Assinar o Pro' }));

    expect(
      await screen.findByText(/Assinar e cancelar exigem internet e não ficam guardados no aparelho/),
    ).toBeInTheDocument();
    expect(screen.queryByText(/aguardando envio/i)).not.toBeInTheDocument();
    expect(screen.getByLabelText('CPF ou CNPJ do titular')).toHaveValue(CPF_COM_MASCARA);
  });

  it('a casa já tem assinatura (409): explica e relê o plano', async () => {
    const usuario = userEvent.setup();
    servidor.falhas.set('POST /api/plano/assinar', { status: 409, code: 'assinatura_ativa' });
    montarApp(PLANO);
    await usuario.type(await campoCpf(), CPF_VALIDO);
    const leiturasAntes = chamadasA(servidor, 'GET', '/api/plano').length;

    await usuario.click(screen.getByRole('button', { name: 'Assinar o Pro' }));

    expect(await screen.findByText('A casa já tem uma assinatura ativa.')).toBeInTheDocument();
    await waitFor(() => expect(chamadasA(servidor, 'GET', '/api/plano').length).toBeGreaterThan(leiturasAntes));
  });
});

describe('Meu plano: cobrança em aberto e Pix', () => {
  it('copiar o código Pix põe o código na área de transferência e avisa', async () => {
    const usuario = userEvent.setup();
    servidor.meuPlano = planoFree({ cobranca: COBRANCA });
    montarApp(PLANO);

    await usuario.click(await screen.findByRole('button', { name: 'Copiar código Pix' }));

    expect(await screen.findByText('Código Pix copiado')).toBeInTheDocument();
    expect(await navigator.clipboard.readText()).toBe(PIX_DE_TESTE);
  });

  it('Pix nulo (Asaas não respondeu): sem código, com "Tentar de novo" que busca outra vez', async () => {
    const usuario = userEvent.setup();
    servidor.meuPlano = planoFree({ cobranca: { ...COBRANCA, pix_copia_cola: null, qr_png_base64: null } });
    montarApp(PLANO);

    expect(await screen.findByText(/Não conseguimos gerar o Pix agora/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Copiar código Pix' })).not.toBeInTheDocument();
    expect(screen.queryByRole('img', { name: 'QR code do Pix' })).not.toBeInTheDocument();

    servidor.meuPlano = planoFree({ cobranca: COBRANCA });
    await usuario.click(screen.getByRole('button', { name: /Tentar de novo/ }));

    expect(await screen.findByLabelText('Pix copia e cola')).toHaveTextContent(PIX_DE_TESTE);
    expect(screen.getByRole('button', { name: 'Copiar código Pix' })).toBeInTheDocument();
  });

  it('QR ausente com código presente: mostra só o código e o botão de copiar', async () => {
    servidor.meuPlano = planoFree({ cobranca: { ...COBRANCA, qr_png_base64: null } });
    montarApp(PLANO);

    expect(await screen.findByLabelText('Pix copia e cola')).toBeInTheDocument();
    expect(screen.queryByRole('img', { name: 'QR code do Pix' })).not.toBeInTheDocument();
  });

  it('com cobrança em aberto não há formulário de assinatura (a assinatura já existe)', async () => {
    servidor.meuPlano = planoFree({ cobranca: COBRANCA });
    montarApp(PLANO);

    await screen.findByRole('region', { name: 'Cobrança em aberto' });
    expect(screen.queryByLabelText('CPF ou CNPJ do titular')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Cancelar assinatura' })).toBeInTheDocument();
  });
});

describe('Meu plano: cancelar (CA-24.8)', () => {
  beforeEach(() => {
    servidor.meuPlano = planoFree({ plano: 'pro', situacao: 'ativa', periodo_ate: '2026-11-09T15:00:00.000Z' });
  });

  it('pede confirmação, cancela e passa a mostrar "Pro até" a data do fim do período', async () => {
    const usuario = userEvent.setup();
    montarApp(PLANO);

    await usuario.click(await screen.findByRole('button', { name: 'Cancelar assinatura' }));
    const dialogo = await screen.findByRole('alertdialog');
    expect(dialogo).toHaveTextContent('O Pro continua até 09/11/2026');
    expect(chamadasA(servidor, 'POST', '/api/plano/cancelar')).toHaveLength(0);
    await usuario.click(within(dialogo).getByRole('button', { name: 'Cancelar assinatura' }));

    expect(await screen.findByText('Assinatura cancelada')).toBeInTheDocument();
    expect(await screen.findByText('Cancelada. Pro até 09/11/2026')).toBeInTheDocument();
    expect(chamadasA(servidor, 'POST', '/api/plano/cancelar')).toHaveLength(1);
    expect(screen.getByRole('button', { name: 'Assinar o Pro' })).toBeInTheDocument();
  });

  it('"Manter assinatura" fecha o diálogo sem chamar a API', async () => {
    const usuario = userEvent.setup();
    montarApp(PLANO);

    await usuario.click(await screen.findByRole('button', { name: 'Cancelar assinatura' }));
    await usuario.click(
      within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Manter assinatura' }),
    );

    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    expect(chamadasA(servidor, 'POST', '/api/plano/cancelar')).toHaveLength(0);
  });

  it('sem rede: avisa que cancelar exige internet e não enfileira', async () => {
    const usuario = userEvent.setup();
    montarApp(PLANO);
    await usuario.click(await screen.findByRole('button', { name: 'Cancelar assinatura' }));
    servidor.semRede = true;

    await usuario.click(
      within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Cancelar assinatura' }),
    );

    expect(await screen.findByText(/Assinar e cancelar exigem internet/)).toBeInTheDocument();
    expect(screen.queryByText(/aguardando envio/i)).not.toBeInTheDocument();
  });

  it('Asaas fora do ar (503): mostra o erro e a assinatura segue como estava', async () => {
    const usuario = userEvent.setup();
    servidor.falhas.set('POST /api/plano/cancelar', { status: 503, code: 'indisponivel' });
    montarApp(PLANO);

    await usuario.click(await screen.findByRole('button', { name: 'Cancelar assinatura' }));
    await usuario.click(
      within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Cancelar assinatura' }),
    );

    expect(await screen.findByText(/O serviço de pagamento está indisponível/)).toBeInTheDocument();
    expect(screen.getByText('Ativa, paga até 09/11/2026')).toBeInTheDocument();
  });
});

describe('Meu plano: carregando, erro e offline', () => {
  it('erro do servidor sem dado mostra o erro padrão e "Tentar de novo" recarrega', async () => {
    const usuario = userEvent.setup();
    servidor.falhas.set('GET /api/plano', { status: 500, code: 'erro_interno' });
    montarApp(PLANO);

    expect(await screen.findByRole('heading', { name: 'Não foi possível carregar' })).toBeInTheDocument();
    servidor.falhas.clear();
    await usuario.click(screen.getByRole('button', { name: /Tentar de novo/ }));

    expect(await screen.findByRole('region', { name: 'Plano da casa' })).toBeInTheDocument();
  });

  it('sem rede e sem dado: diz que a rede falhou, sem inventar o plano', async () => {
    servidor.semRedePlano = true;
    servidor.meuPlano = planoTrial();
    montarApp(PLANO);

    expect(
      await screen.findByRole('heading', { name: 'Não foi possível carregar' }, { timeout: 5000 }),
    ).toBeInTheDocument();
    expect(screen.queryByRole('region', { name: 'Plano da casa' })).not.toBeInTheDocument();
  });

  it('enquanto carrega, a região fica ocupada e depois mostra o plano', async () => {
    servidor.atrasos.set('GET /api/plano', 300);
    montarApp(PLANO);

    expect(await screen.findByRole('heading', { level: 1, name: 'Meu plano' })).toBeInTheDocument();
    expect(screen.getByRole('main')).toHaveAttribute('aria-busy', 'true');
    expect(await screen.findByRole('region', { name: 'Plano da casa' })).toBeInTheDocument();
  });
});
