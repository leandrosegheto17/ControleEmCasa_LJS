import { expect, test, type Page } from '@playwright/test';

/**
 * e2e de Ajustes e contas (etapa 12, lote 1): o app real no navegador, com a API simulada por `page.route`
 * (estado em memória). Os e2e com o Worker e o banco são da etapa 16.
 */

const SESSAO = {
  usuario: { id: '00000000-0000-4000-8000-0000000000a1', nome: 'Ana', email: 'ana@exemplo.com' },
  membro: { id: '00000000-0000-4000-8000-0000000000a1', nome: 'Ana', papel: 'titular' },
  lar: { id: '00000000-0000-4000-8000-0000000000b1', nome: 'Casa' },
  plano: null,
  termos_pendentes: false,
};

interface Conta {
  id: string;
  nome: string;
  saldo_inicial_centavos: number;
  saldo_centavos: number;
  arquivada: boolean;
  pode_excluir: boolean;
}

const json = (corpo: unknown, status = 200) => ({
  status,
  contentType: 'application/json',
  body: JSON.stringify(corpo),
});

async function simularApi(page: Page) {
  const contas: Conta[] = [
    {
      id: '00000000-0000-4000-8000-000000000201',
      nome: 'Nubank',
      saldo_inicial_centavos: 250000,
      saldo_centavos: 321485,
      arquivada: false,
      pode_excluir: false,
    },
  ];
  const escritas: Array<{ metodo: string; url: string; corpo: unknown; cabecalhos: Record<string, string> }> = [];

  await page.route('**/api/**', async (rota) => {
    const pedido = rota.request();
    const { pathname } = new URL(pedido.url());
    const metodo = pedido.method();
    if (metodo !== 'GET') {
      escritas.push({ metodo, url: pathname, corpo: pedido.postDataJSON() as unknown, cabecalhos: pedido.headers() });
    }
    if (pathname === '/api/sessao') return rota.fulfill(json(SESSAO));
    if (pathname === '/api/contas' && metodo === 'GET') return rota.fulfill(json(contas));
    const m = /^\/api\/contas\/([^/]+)(?:\/(ajuste|arquivar))?$/.exec(pathname);
    if (m && metodo === 'PUT') {
      const corpo = pedido.postDataJSON() as { nome: string; saldo_inicial_centavos?: number };
      const saldo = corpo.saldo_inicial_centavos ?? 0;
      const existente = contas.find((c) => c.id === m[1]);
      if (existente) Object.assign(existente, { nome: corpo.nome, saldo_inicial_centavos: saldo });
      else {
        contas.push({
          id: m[1]!,
          nome: corpo.nome,
          saldo_inicial_centavos: saldo,
          saldo_centavos: saldo,
          arquivada: false,
          pode_excluir: true,
        });
      }
      return rota.fulfill(json({ id: m[1] }, existente ? 200 : 201));
    }
    if (m && m[2] === 'ajuste' && metodo === 'POST') {
      const corpo = pedido.postDataJSON() as { saldo_real_centavos: number; simular?: boolean };
      const conta = contas.find((c) => c.id === m[1])!;
      const diferenca = corpo.saldo_real_centavos - conta.saldo_centavos;
      if (!corpo.simular) conta.saldo_centavos = corpo.saldo_real_centavos;
      return rota.fulfill(json({ diferenca_centavos: diferenca }));
    }
    if (m && m[2] === 'arquivar' && metodo === 'POST') {
      contas.find((c) => c.id === m[1])!.arquivada = true;
      return rota.fulfill({ status: 204 });
    }
    return rota.fulfill(json({ code: 'rota_inexistente' }, 404));
  });
  return { contas, escritas };
}

test('de Ajustes a Contas: cria uma conta, vê na lista e a escrita é idempotente pelo id do cliente', async ({
  page,
}) => {
  const { escritas } = await simularApi(page);
  await page.goto('/app/ajustes');

  await expect(page.getByRole('heading', { level: 1, name: 'Ajustes' })).toBeVisible();
  await expect(page.getByText('Ana · ana@exemplo.com')).toBeVisible();
  await page.getByRole('link', { name: /^Contas/ }).click();

  await expect(page).toHaveURL(/\/app\/ajustes\/contas$/);
  await expect(page.getByText('Nubank')).toBeVisible();
  await expect(page.getByText('R$ 3.214,85')).toBeVisible();

  await page.getByRole('link', { name: 'Nova', exact: true }).click();
  await page.getByLabel('Nome').fill('Caixa');
  await page.getByLabel('Saldo inicial').pressSequentially('10000');
  await page.getByRole('button', { name: 'Salvar' }).click();

  await expect(page.getByRole('heading', { level: 1, name: 'Contas' })).toBeVisible();
  await expect(page.getByText('Caixa')).toBeVisible();
  await expect(page.getByText('R$ 100,00')).toBeVisible();

  const put = escritas.find((e) => e.metodo === 'PUT');
  expect(put?.url).toMatch(/^\/api\/contas\/[0-9a-f-]{36}$/);
  expect(put?.corpo).toEqual({ nome: 'Caixa', saldo_inicial_centavos: 10000 });
  expect(put?.cabecalhos['x-controle-em-casa']).toBe('1');
});

test('ajusta o saldo de uma conta: prévia da diferença e gravação', async ({ page }) => {
  const { contas, escritas } = await simularApi(page);
  await page.goto(`/app/ajustes/contas/${contas[0]!.id}`);

  await page.getByLabel('Saldo que aparece no banco').pressSequentially('320255');
  await expect(page.getByRole('status').filter({ hasText: 'Ajuste de' })).toContainText('R$ 12,30');
  expect(escritas.every((e) => (e.corpo as { simular?: boolean }).simular === true)).toBe(true);

  await page.getByRole('button', { name: 'Ajustar saldo' }).click();

  await expect(page.getByText('Saldo ajustado')).toBeVisible();
  expect(contas[0]!.saldo_centavos).toBe(320255);
});

test('arquivar uma conta a tira da lista de Contas', async ({ page }) => {
  const { contas } = await simularApi(page);
  await page.goto(`/app/ajustes/contas/${contas[0]!.id}`);

  await page.getByRole('button', { name: 'Arquivar', exact: true }).click();

  await expect(page.getByRole('heading', { level: 1, name: 'Contas' })).toBeVisible();
  await expect(page.getByText('Nenhuma conta cadastrada')).toBeVisible();
});
