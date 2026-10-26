import { expect, test, type Page } from '@playwright/test';

/** e2e do cadastro (etapa 11, lote 2): cadastro, confirmação por link e entrada, com a API simulada. */

const TOKEN = 'token-de-confirmacao-e2e';
const SESSAO = {
  usuario: { id: '00000000-0000-4000-8000-0000000000a1', nome: 'Ana Souza', email: 'ana@exemplo.com' },
  membro: null,
  lar: null,
  plano: null,
  termos_pendentes: false,
};

async function simularApi(page: Page) {
  const estado = { cadastrada: false, confirmada: false, logada: false, lar: false };
  const corpos: Record<string, unknown> = {};
  const json = (status: number, corpo: unknown) => ({
    status,
    contentType: 'application/json',
    body: JSON.stringify(corpo),
  });
  await page.route('**/api/**', async (rota) => {
    const pedido = rota.request();
    const { pathname } = new URL(pedido.url());
    if (pedido.method() !== 'GET') corpos[pathname] = pedido.postDataJSON();
    switch (`${pedido.method()} ${pathname}`) {
      case 'POST /api/cadastro':
        estado.cadastrada = true;
        return rota.fulfill({ status: 202 });
      case 'POST /api/cadastro/confirmar':
        if ((pedido.postDataJSON() as { token: string }).token !== TOKEN || estado.confirmada) {
          return rota.fulfill(json(400, { code: 'link_expirado', message: 'x' }));
        }
        estado.confirmada = true;
        return rota.fulfill({ status: 204 });
      case 'POST /api/cadastro/reenviar':
        return rota.fulfill({ status: 202 });
      case 'POST /api/sessao/entrar':
        if (!estado.confirmada) return rota.fulfill(json(403, { code: 'email_nao_confirmado', message: 'x' }));
        estado.logada = true;
        return rota.fulfill({ status: 204 });
      case 'GET /api/sessao':
        return estado.logada
          ? rota.fulfill(json(200, { ...SESSAO, lar: estado.lar ? { id: SESSAO.usuario.id, nome: 'Lar' } : null }))
          : rota.fulfill(json(401, { code: 'sessao_expirada', message: 'x' }));
      case 'POST /api/lar':
        estado.lar = true;
        return rota.fulfill(json(201, { id: SESSAO.usuario.id, nome: 'Lar' }));
      default:
        return rota.fulfill(json(404, { code: 'rota_inexistente', message: 'x' }));
    }
  });
  return { estado, corpos };
}

test('cadastro → confirmar → entrar → criar o lar', async ({ page }) => {
  const { corpos } = await simularApi(page);

  await page.goto('/cadastro');
  await page.getByLabel('Nome', { exact: true }).fill('Ana Souza');
  await page.getByLabel('E-mail', { exact: true }).fill('ana@exemplo.com');
  await page.getByLabel('Senha', { exact: true }).fill('senha-bem-longa-1');
  await page.getByRole('checkbox').check();
  await page.getByRole('button', { name: 'Criar conta' }).click();

  await expect(page.getByRole('heading', { name: 'Confira seu e-mail' })).toBeVisible();
  expect(corpos['/api/cadastro']).toMatchObject({
    nome: 'Ana Souza',
    email: 'ana@exemplo.com',
    aceite: { termos: expect.any(String), privacidade: expect.any(String) },
  });

  // O link do e-mail: o token vem no fragmento e some do endereço.
  await page.goto(`/confirmar#t=${TOKEN}`);
  await expect(page.getByRole('heading', { name: 'E-mail confirmado' })).toBeVisible();
  expect(page.url()).not.toContain(TOKEN);
  expect(corpos['/api/cadastro/confirmar']).toEqual({ token: TOKEN });

  await page.getByRole('link', { name: 'Ir para Entrar' }).click();
  await page.getByLabel('E-mail', { exact: true }).fill('ana@exemplo.com');
  await page.getByLabel('Senha', { exact: true }).fill('senha-bem-longa-1');
  await page.getByRole('button', { name: 'Entrar' }).click();

  // Sessão sem lar: a guarda leva ao primeiro acesso.
  await expect(page.getByRole('heading', { name: 'Bem-vindo' })).toBeVisible();
  await expect(page).toHaveURL(/\/app\/bem-vindo$/);
  await page.getByRole('button', { name: 'Criar meu lar' }).click();
  // O Início real (lote 2 da etapa 12) substituiu o provisório: o marcador é o seletor de mês.
  await expect(page.getByRole('heading', { level: 1, name: /\d{4}$/ })).toBeVisible();
  await expect(page).toHaveURL(/\/app$/);
});

test('link de confirmação usado de novo: expirado, com reenvio neutro', async ({ page }) => {
  await simularApi(page);

  await page.goto('/confirmar#t=token-errado');

  await expect(page.getByRole('alert').filter({ hasText: 'expirou' })).toBeVisible();
  await page.getByLabel('E-mail', { exact: true }).fill('qualquer@exemplo.com');
  await page.getByRole('button', { name: 'Reenviar link de confirmação' }).click();
  await expect(page.getByText(/Se o e-mail tiver um cadastro pendente/)).toBeVisible();
});

test('entrar com conta não confirmada mostra o aviso próprio', async ({ page }) => {
  await simularApi(page);
  await page.goto('/entrar');

  await page.getByLabel('E-mail', { exact: true }).fill('ana@exemplo.com');
  await page.getByLabel('Senha', { exact: true }).fill('senha-bem-longa-1');
  await page.getByRole('button', { name: 'Entrar' }).click();

  await expect(page.getByText(/Confirme seu e-mail para entrar/)).toBeVisible();
});

test('páginas legais abrem sem sessão e avisam que o texto é provisório', async ({ page }) => {
  await simularApi(page);
  for (const [caminho, titulo] of [
    ['/termos', 'Termos de uso'],
    ['/privacidade', 'Política de privacidade'],
  ]) {
    await page.goto(caminho as string);
    await expect(page.getByRole('heading', { level: 1, name: titulo })).toBeVisible();
    await expect(page.getByText('Texto provisório.')).toBeVisible();
  }
});

test('convite sem sessão: manda entrar e o token não fica no endereço', async ({ page }) => {
  await simularApi(page);

  await page.goto('/convite#t=token-de-convite-e2e');

  await expect(page.getByRole('link', { name: 'Entrar' })).toHaveAttribute('href', '/entrar?volta=%2Fconvite');
  expect(page.url()).not.toContain('token-de-convite-e2e');
});
