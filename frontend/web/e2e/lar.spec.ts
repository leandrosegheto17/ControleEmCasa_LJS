import { expect, test } from '@playwright/test';
import { fixarRelogio, ID_CONVITE, simularApiMetas } from './apoio/apiMetas';

/**
 * e2e do convite de membro e do "sair de todos" (etapa 12, lote 4), contra a API simulada por `page.route`. Critérios:
 * RN-23 (CA-23.1: o titular convida por e-mail e o token nunca chega à tela; o convite vale 7 dias e o titular o revoga),
 * CA-20.5 (sair de todos encerra todas as sessões, inclusive a atual).
 */

test.beforeEach(async ({ page }) => {
  await fixarRelogio(page);
});

test('de Ajustes a Casa e membros: o titular convida, vê o convite pendente e o cancela', async ({ page }) => {
  const { escritas, lar } = await simularApiMetas(page);
  await page.goto('/app/ajustes');

  await page
    .getByRole('main')
    .getByRole('link', { name: /Casa e membros/ })
    .click();

  await expect(page).toHaveURL(/\/app\/ajustes\/lar$/);
  await expect(page.getByRole('heading', { level: 1, name: 'Casa e membros' })).toBeVisible();
  await expect(page.getByRole('region', { name: 'Membros' })).toContainText('Titular · você');

  await page.getByLabel('E-mail de quem vai participar').fill('Beatriz@Exemplo.com');
  await page.getByRole('button', { name: 'Enviar convite' }).click();

  await expect(page.getByText('Convite enviado para beatriz@exemplo.com', { exact: true })).toBeVisible();
  const pendente = page.getByRole('region', { name: 'Convite pendente' });
  await expect(pendente).toContainText('válido até 16/10/2026');
  const envio = escritas.find((e) => e.url === '/api/lar/convites');
  expect(envio?.metodo).toBe('POST');
  expect(envio?.corpo).toEqual({ email: 'Beatriz@Exemplo.com' });
  expect(envio?.cabecalhos['x-controle-em-casa']).toBe('1');
  await expect(page.locator('body')).not.toContainText(/token/i);

  await pendente.getByRole('button', { name: 'Cancelar convite' }).click();
  await page.getByRole('alertdialog').getByRole('button', { name: 'Cancelar convite' }).click();

  await expect(page.getByText('Convite cancelado')).toBeVisible();
  await expect(page.getByLabel('E-mail de quem vai participar')).toBeVisible();
  expect(escritas.some((e) => e.metodo === 'DELETE' && e.url === `/api/lar/convites/${ID_CONVITE}`)).toBe(true);
  expect(lar.convite_pendente).toBeUndefined();
});

test('com os dois membros, não há formulário de convite', async ({ page }) => {
  await simularApiMetas(page, 'lar-dois-membros.json');
  await page.goto('/app/ajustes/lar');

  await expect(page.getByRole('region', { name: 'Membros' }).getByRole('listitem')).toHaveCount(2);
  await expect(page.getByText(/A casa já tem os dois membros/)).toBeVisible();
  await expect(page.getByLabel('E-mail de quem vai participar')).toHaveCount(0);
});

test('sair de todos os aparelhos: pede confirmação, chama a rota global e leva a Entrar', async ({ page }) => {
  const { escritas, estado } = await simularApiMetas(page);
  await page.goto('/app/ajustes');

  await page.getByRole('button', { name: /Sair de todos os aparelhos/ }).click();
  const dialogo = page.getByRole('alertdialog');
  await expect(dialogo).toContainText('Sair de todos os aparelhos?');
  await dialogo.getByRole('button', { name: 'Cancelar' }).click();
  expect(escritas.some((e) => e.url === '/api/sessao/sair-de-todos')).toBe(false);

  await page.getByRole('button', { name: /Sair de todos os aparelhos/ }).click();
  await page.getByRole('alertdialog').getByRole('button', { name: 'Sair de todos' }).click();

  await expect(page).toHaveURL(/\/entrar/);
  const saida = escritas.find((e) => e.url === '/api/sessao/sair-de-todos');
  expect(saida?.metodo).toBe('POST');
  expect(saida?.cabecalhos['x-controle-em-casa']).toBe('1');
  expect(estado.sessaoAtiva).toBe(false);
});

/**
 * Remover o membro (etapa 18; spec "Titular remove o membro" e critério de sucesso "em até 2 toques"): Ana, titular,
 * remove Beatriz (`lar-dois-membros.json`).
 */
const ID_BEATRIZ = '00000000-0000-4000-8000-000000000102';

test('o titular remove o membro em 2 toques e a lista volta só com ele', async ({ page }) => {
  const { escritas, lar } = await simularApiMetas(page, 'lar-dois-membros.json');
  await page.goto('/app/ajustes/lar');
  const membros = page.getByRole('region', { name: 'Membros' }).getByRole('listitem');
  await expect(membros).toHaveCount(2);

  await page.getByRole('button', { name: 'Remover' }).click();
  const dialogo = page.getByRole('alertdialog');
  await expect(dialogo).toHaveAccessibleName('Remover Beatriz da casa?');
  await expect(dialogo).toContainText('Ex-membro');
  await dialogo.getByRole('button', { name: 'Remover' }).click();

  await expect(page.getByText('Membro removido', { exact: true })).toBeVisible();
  await expect(dialogo).toHaveCount(0);
  await expect(membros).toHaveCount(1);
  await expect(membros.first()).toContainText('Ana');
  await expect(page.getByLabel('E-mail de quem vai participar')).toBeVisible();
  const remocoes = escritas.filter((e) => e.url.startsWith('/api/lar/membros/'));
  expect(remocoes).toHaveLength(1);
  expect(remocoes[0]).toMatchObject({ metodo: 'DELETE', url: `/api/lar/membros/${ID_BEATRIZ}` });
  expect(remocoes[0]?.cabecalhos['x-controle-em-casa']).toBe('1');
  expect(lar.membros).toHaveLength(1);
});

test('cancelar a remoção não chama DELETE /api/lar/membros/:id', async ({ page }) => {
  const { escritas } = await simularApiMetas(page, 'lar-dois-membros.json');
  await page.goto('/app/ajustes/lar');

  await page.getByRole('button', { name: 'Remover' }).click();
  await page.getByRole('alertdialog').getByRole('button', { name: 'Cancelar' }).click();
  await expect(page.getByRole('alertdialog')).toHaveCount(0);
  await page.getByRole('button', { name: 'Remover' }).click();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('alertdialog')).toHaveCount(0);

  await expect(page.getByRole('region', { name: 'Membros' }).getByRole('listitem')).toHaveCount(2);
  expect(escritas.filter((e) => e.url.startsWith('/api/lar/membros/'))).toHaveLength(0);
});

test('registro_invalido (o membro já saiu): avisa "Este membro já não está na casa" e relê a lista', async ({
  page,
}) => {
  const { lar } = await simularApiMetas(page, 'lar-dois-membros.json');
  await page.goto('/app/ajustes/lar');

  await page.getByRole('button', { name: 'Remover' }).click();
  // Beatriz sai por conta própria enquanto a confirmação está aberta.
  lar.membros = lar.membros.filter((m) => m.id !== ID_BEATRIZ);
  await page.getByRole('alertdialog').getByRole('button', { name: 'Remover' }).click();

  await expect(page.getByText('Este membro já não está na casa', { exact: true })).toBeVisible();
  await expect(page.getByRole('alertdialog')).toHaveCount(0);
  await expect(page.getByRole('region', { name: 'Membros' }).getByRole('listitem')).toHaveCount(1);
  await expect(page.getByText('Membro removido', { exact: true })).toHaveCount(0);
});

/**
 * Sair da casa (etapa 18; spec "Membro sai da casa" e "Sem conexão"): Beatriz, membro (`lar-como-membro.json`), sai e
 * cai no primeiro acesso. Sem conexão, "Remover" e "Sair da casa" ficam desativados e nada vai para a fila.
 */
test('o membro sai da casa e cai no primeiro acesso com o aviso "Você saiu da casa"', async ({ page }) => {
  const { escritas, estado } = await simularApiMetas(page, 'lar-como-membro.json');
  await page.goto('/app/ajustes/lar');

  await expect(page.getByRole('button', { name: 'Remover' })).toHaveCount(0);
  await page.getByRole('button', { name: 'Sair da casa' }).click();
  const dialogo = page.getByRole('alertdialog');
  await expect(dialogo).toHaveAccessibleName('Sair da casa?');
  await expect(dialogo).toContainText('Ex-membro');
  await dialogo.getByRole('button', { name: 'Sair da casa' }).click();

  await expect(page).toHaveURL(/\/app\/bem-vindo$/);
  await expect(page.getByText('Você saiu da casa', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Criar meu lar' })).toBeVisible();
  const saidas = escritas.filter((e) => e.url === '/api/lar/sair');
  expect(saidas).toHaveLength(1);
  expect(saidas[0]?.metodo).toBe('POST');
  expect(saidas[0]?.cabecalhos['x-controle-em-casa']).toBe('1');
  expect(estado.saiuDoLar).toBe(true);
});

test('cancelar a saída não chama POST /api/lar/sair', async ({ page }) => {
  const { escritas } = await simularApiMetas(page, 'lar-como-membro.json');
  await page.goto('/app/ajustes/lar');

  await page.getByRole('button', { name: 'Sair da casa' }).click();
  await page.getByRole('alertdialog').getByRole('button', { name: 'Cancelar' }).click();
  await expect(page.getByRole('alertdialog')).toHaveCount(0);
  await page.getByRole('button', { name: 'Sair da casa' }).click();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('alertdialog')).toHaveCount(0);

  await expect(page).toHaveURL(/\/app\/ajustes\/lar$/);
  expect(escritas.filter((e) => e.url === '/api/lar/sair')).toHaveLength(0);
});

for (const [quem, fixture, rotulo, rota] of [
  ['titular', 'lar-dois-membros.json', 'Remover', '/api/lar/membros/'],
  ['membro', 'lar-como-membro.json', 'Sair da casa', '/api/lar/sair'],
] as const) {
  test(`sem conexão (${quem}): "${rotulo}" desativado com o aviso, e nada é enfileirado`, async ({ page, context }) => {
    const { escritas } = await simularApiMetas(page, fixture);
    await page.goto('/app/ajustes/lar');
    const botao = page.getByRole('button', { name: rotulo });
    await expect(botao).toBeEnabled();

    await context.setOffline(true);

    await expect(botao).toBeDisabled();
    await expect(page.getByText('Precisa de conexão para esta ação', { exact: true })).toBeVisible();
    await botao.click({ force: true });
    await expect(page.getByRole('alertdialog')).toHaveCount(0);

    // De volta à rede, a fila do aparelho enviaria o que tivesse guardado: nada pode sair para a rota.
    await context.setOffline(false);
    await expect(botao).toBeEnabled();
    await expect(page.getByText('Precisa de conexão para esta ação', { exact: true })).toHaveCount(0);
    await page.waitForLoadState('networkidle');
    expect(escritas.filter((e) => e.url.startsWith(rota))).toHaveLength(0);
  });
}
