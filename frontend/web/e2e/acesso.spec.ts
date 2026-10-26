import { expect, test, type Page } from '@playwright/test';

/**
 * e2e mínimo do acesso (etapa 11): o app real no navegador, com a API simulada por `page.route`.
 * Os e2e que sobem o Worker e o banco (cadastro, login, assinar, lançar) são da etapa 16.
 */

const SESSAO = {
  usuario: { id: '00000000-0000-4000-8000-0000000000a1', nome: 'Ana', email: 'ana@exemplo.com' },
  membro: { id: '00000000-0000-4000-8000-0000000000a1', nome: 'Ana', papel: 'titular' },
  lar: { id: '00000000-0000-4000-8000-0000000000b1', nome: 'Casa' },
  plano: null,
  termos_pendentes: false,
};

async function simularApi(page: Page, opcoes: { logada: boolean }) {
  let logada = opcoes.logada;
  const escritas: Array<{ url: string; cabecalhos: Record<string, string> }> = [];
  await page.route('**/api/**', async (rota) => {
    const pedido = rota.request();
    const { pathname } = new URL(pedido.url());
    if (pedido.method() !== 'GET') escritas.push({ url: pathname, cabecalhos: pedido.headers() });
    if (pathname === '/api/sessao' && pedido.method() === 'GET') {
      return logada
        ? rota.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(SESSAO) })
        : rota.fulfill({
            status: 401,
            contentType: 'application/json',
            body: JSON.stringify({ code: 'sessao_expirada', message: 'x' }),
          });
    }
    if (pathname === '/api/sessao/entrar') {
      const { senha } = pedido.postDataJSON() as { senha: string };
      if (senha !== 'senha-correta-123') {
        return rota.fulfill({
          status: 400,
          contentType: 'application/json',
          body: JSON.stringify({ code: 'credenciais_invalidas', message: 'x' }),
        });
      }
      logada = true;
      return rota.fulfill({ status: 204 });
    }
    if (pathname === '/api/sessao/sair') {
      logada = false;
      return rota.fulfill({ status: 204 });
    }
    return rota.fulfill({ status: 404, contentType: 'application/json', body: '{"code":"rota_inexistente"}' });
  });
  return { escritas };
}

test('sem sessão, o app leva a Entrar com o endereço de volta', async ({ page }) => {
  await simularApi(page, { logada: false });

  await page.goto('/app');

  await expect(page.getByRole('heading', { level: 1, name: 'Entrar' })).toBeVisible();
  expect(new URL(page.url()).searchParams.get('volta')).toBe('/app');
});

test('credenciais erradas: alerta genérico; a escrita leva o cabeçalho de CSRF e o Origin do navegador', async ({
  page,
}) => {
  const { escritas } = await simularApi(page, { logada: false });
  await page.goto('/entrar');

  await page.getByLabel('E-mail', { exact: true }).fill('ana@exemplo.com');
  await page.getByLabel('Senha', { exact: true }).fill('errada');
  await page.getByRole('button', { name: 'Entrar' }).click();

  await expect(page.getByText('E-mail ou senha incorretos.')).toBeVisible();
  const entrada = escritas.find((e) => e.url === '/api/sessao/entrar');
  expect(entrada?.cabecalhos['x-controle-em-casa']).toBe('1');
  expect(entrada?.cabecalhos['origin']).toBe(new URL(page.url()).origin);
});

test('entrar e sair: o app abre depois do login e volta a Entrar na saída', async ({ page }) => {
  await simularApi(page, { logada: false });
  await page.goto('/entrar');

  await page.getByLabel('E-mail', { exact: true }).fill('ana@exemplo.com');
  await page.getByLabel('Senha', { exact: true }).fill('senha-correta-123');
  await page.getByRole('button', { name: 'Entrar' }).click();

  // SPEC_DEVIATION (lote 2 da etapa 12): o início provisório ("Olá, Ana." e "Sair") deu lugar ao Início real,
  // cujo marcador é o seletor de mês; a saída mora em Ajustes.
  await expect(page.getByRole('heading', { level: 1, name: /\d{4}$/ })).toBeVisible();
  await expect(page).toHaveURL(/\/app$/);

  await page.getByRole('link', { name: 'Ajustes' }).first().click();
  await page.getByRole('button', { name: /Sair deste aparelho/ }).click();

  await expect(page.getByRole('heading', { level: 1, name: 'Entrar' })).toBeVisible();
  // Saída de propósito: sem `volta` para a área privada (senão o próximo login cairia nos Ajustes).
  await expect(page).toHaveURL(/\/entrar$/);
});

test('redefinir senha: o token do link sai do endereço assim que a página abre', async ({ page }) => {
  await simularApi(page, { logada: false });

  await page.goto('/redefinir-senha#t=token-de-teste');

  await expect(page.getByRole('heading', { level: 1, name: 'Nova senha' })).toBeVisible();
  await expect.poll(() => new URL(page.url()).hash).toBe('');
});
