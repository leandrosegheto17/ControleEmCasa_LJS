import { expect, test } from '@playwright/test';
import { simularApiMetas, fixarRelogio } from './apoio/apiMetas';
import { SENHA_CERTA, TOKEN_VALIDO, simularConta } from './apoio/apiConta';

/**
 * e2e da landing, das páginas legais e da exclusão de conta (etapa 14, lote 2), contra a API simulada por `page.route`.
 * Critérios: RN-26 (CA-26.1: pedir não exclui; CA-26.2: o link confirma e as sessões acabam; CA-26.7: o convidado é avisado;
 * CA-26.9: link vencido é recusado), CA-26.5 (a privacidade informa os backups), RNF-14.
 */

test.beforeEach(async ({ page }) => {
  await fixarRelogio(page);
});

test('landing: visitante navega até o cadastro e chega aos textos legais', async ({ page }) => {
  await simularConta(page, { logado: false });
  await page.goto('/');

  await expect(page).toHaveTitle(/As finanças da casa, em dois · Controle em Casa/);
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Saiba quanto a casa gasta de verdade');
  await expect(page.getByRole('region', { name: 'Planos' })).toContainText('R$ 9,90');
  await expect(page.getByRole('region', { name: 'Planos' })).toContainText('14 dias de teste, sem cartão');

  await page.getByRole('contentinfo').getByRole('link', { name: 'Política de privacidade' }).click();
  await expect(page).toHaveURL(/\/privacidade$/);
  await expect(page.getByRole('region', { name: '6. Por quanto tempo guardamos' })).toContainText(
    'até 30 dias depois do apagamento',
  );
  await page.getByRole('navigation', { name: 'Outras páginas' }).getByRole('link', { name: 'Termos de uso' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Termos de uso' })).toBeVisible();
  await page.getByRole('navigation', { name: 'Outras páginas' }).getByRole('link', { name: 'Página inicial' }).click();

  await page.getByRole('banner').getByRole('link', { name: 'Começar grátis' }).click();
  await expect(page).toHaveURL(/\/cadastro$/);
  await expect(page.getByRole('heading', { level: 1, name: 'Criar conta' })).toBeVisible();
});

test('landing: quem já entrou continua em "/" e vê "Abrir o app"', async ({ page }) => {
  await simularApiMetas(page);
  await simularConta(page);
  await page.goto('/');

  const abrir = page.getByRole('banner').getByRole('link', { name: 'Abrir o app' });
  await expect(abrir).toBeVisible();
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByRole('link', { name: 'Começar grátis' })).toHaveCount(0);
  await abrir.click();
  await expect(page).toHaveURL(/\/app$/);
});

test('landing: no celular o conteúdo cabe na largura, sem rolagem lateral', async ({ page }) => {
  await simularConta(page, { logado: false });
  await page.setViewportSize({ width: 375, height: 800 });
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();

  const sobra = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(sobra).toBeLessThanOrEqual(0);
});

test('pedir a exclusão: senha errada é recusada; a certa mostra "enviamos o link" e nada muda', async ({ page }) => {
  await simularApiMetas(page);
  const { escritas, estado } = await simularConta(page);
  await page.goto('/app/ajustes');

  await page
    .getByRole('main')
    .getByRole('link', { name: /Excluir minha conta/ })
    .click();
  await expect(page).toHaveURL(/\/app\/ajustes\/conta$/);

  await page.getByLabel('Sua senha atual').fill('senha-errada-123');
  await page.getByRole('button', { name: 'Enviar link de exclusão' }).click();
  await expect(page.getByText('Senha incorreta.')).toBeVisible();

  await page.getByLabel('Sua senha atual').fill(SENHA_CERTA);
  await page.getByRole('button', { name: 'Enviar link de exclusão' }).click();
  await expect(page.getByText(/Enviamos o link para ana@exemplo.com/)).toBeVisible();

  const pedidos = escritas.filter((e) => e.url === '/api/conta/exclusao');
  expect(pedidos.map((p) => p.corpo)).toEqual([{ senha: 'senha-errada-123' }, { senha: SENHA_CERTA }]);
  expect(pedidos[1]!.cabecalhos['x-controle-em-casa']).toBe('1');
  expect(estado.excluida).toBe(false);
  expect(estado.pedidos).toBe(1);
  // A senha nunca fica no armazenamento local nem na URL.
  const guardado = await page.evaluate(() => JSON.stringify([{ ...localStorage }, { ...sessionStorage }]));
  expect(guardado).not.toContain(SENHA_CERTA);
  expect(page.url()).not.toContain(SENHA_CERTA);
});

test('confirmar com o token no fragmento: o fragmento some, exige confirmar, exclui e leva à landing', async ({
  page,
}) => {
  await simularApiMetas(page);
  const { escritas, estado } = await simularConta(page);
  await page.goto(`/confirmar-exclusao#t=${TOKEN_VALIDO}`);

  await expect(page.getByRole('heading', { level: 1, name: 'Excluir minha conta' })).toBeVisible();
  // O token saiu do endereço e nada foi enviado ainda.
  await expect.poll(() => page.url()).not.toContain(TOKEN_VALIDO);
  expect(await page.evaluate(() => window.location.hash)).toBe('');
  expect(escritas.filter((e) => e.url.endsWith('/confirmar'))).toHaveLength(0);
  expect(estado.excluida).toBe(false);

  await page.getByRole('button', { name: 'Sim, excluir minha conta' }).click();

  await expect(page.getByRole('heading', { level: 1, name: 'Conta excluída' })).toBeVisible();
  const envio = escritas.filter((e) => e.url.endsWith('/confirmar'));
  expect(envio).toHaveLength(1);
  expect(envio[0]!.corpo).toEqual({ token: TOKEN_VALIDO });
  expect(page.url()).not.toContain(TOKEN_VALIDO);
  expect(estado.excluida).toBe(true);

  await page.getByRole('link', { name: 'Ir para a página inicial' }).click();
  await expect(page).toHaveURL(/\/$/);
  // A sessão acabou: a landing volta ao visitante.
  await expect(page.getByRole('banner').getByRole('link', { name: 'Começar grátis' })).toBeVisible();
});

test('link de exclusão vencido ou já usado: mensagem e caminho para pedir de novo', async ({ page }) => {
  await simularApiMetas(page);
  const { estado } = await simularConta(page, { logado: false });
  await page.goto('/confirmar-exclusao#t=token-vencido');

  await page.getByRole('button', { name: 'Sim, excluir minha conta' }).click();

  await expect(page.getByRole('heading', { level: 1, name: 'Link inválido' })).toBeVisible();
  await expect(page.getByText('Este link expirou ou já foi usado')).toBeVisible();
  await expect(page.getByRole('link', { name: 'Pedir um novo link' })).toHaveAttribute('href', '/app/ajustes/conta');
  expect(estado.excluida).toBe(false);
});

test('confirmar-exclusao sem token mostra o estado de erro e não chama a API', async ({ page }) => {
  await simularApiMetas(page);
  const { escritas } = await simularConta(page, { logado: false });
  await page.goto('/confirmar-exclusao');

  await expect(page.getByRole('heading', { level: 1, name: 'Link inválido' })).toBeVisible();
  expect(escritas).toHaveLength(0);
});

test('aviso ao convidado: faixa com a data da purga quando o titular excluiu a conta', async ({ page }) => {
  await simularApiMetas(page);
  await simularConta(page, { papel: 'membro', encerramento: { purga_em: '2026-11-25T12:00:00.000Z' } });
  await page.goto('/app/ajustes');

  await expect(page.getByRole('status').filter({ hasText: 'O titular excluiu a conta' })).toContainText(
    'este lar e os seus dados nele serão apagados em 25/11/2026',
  );
});

test('sem encerramento não há faixa de aviso', async ({ page }) => {
  await simularApiMetas(page);
  await simularConta(page, { papel: 'membro' });
  await page.goto('/app/ajustes');

  await expect(page.getByRole('heading', { level: 1, name: 'Ajustes' })).toBeVisible();
  await expect(page.getByText('O titular excluiu a conta')).toHaveCount(0);
});
