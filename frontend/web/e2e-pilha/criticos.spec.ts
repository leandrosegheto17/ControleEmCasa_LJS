import { expect, test } from '@playwright/test';
import { PIX_FALSO } from './apoio/asaasFalso';
import { linhasDoLog, linkDoEmail, pagarPrimeiraCobranca, pedidosAoAsaas } from './apoio/pilha';

/**
 * e2e críticos contra a pilha real (PLANO etapa 16; SDD 12.1 "Críticos: cadastro → confirmar → entrar → criar lar;
 * lançar; assinar"): o navegador fala com o Worker de verdade (`wrangler dev`), que grava no Postgres 17; só o Asaas é
 * simulado (como nas etapas 13), por um servidor local que também manda o webhook do pagamento.
 * Critérios: RN-17 a RN-20 (cadastro aberto com confirmação por e-mail, sessão por cookie `__Host-sid`), CA-19.x,
 * RN-24 e CA-24.6/24.7 (o titular assina; a cobrança Pix aparece; o CPF só vai ao Asaas) e RN-01 (lançar uma despesa).
 */

const SENHA = 'senha-bem-longa-e2e-1';
const CPF = '52998224725';

test('cadastro → confirmar por e-mail → entrar → criar o lar → assinar o Pro (Pix e webhook) → lançar → sair e entrar de novo', async ({
  page,
  context,
}) => {
  test.setTimeout(90_000);
  const email = `ana.e2e.${Date.now()}@exemplo.com`;

  // Cadastro: o Worker grava a conta e "envia" o e-mail (transporte de console do AMBIENTE=local).
  const antes = linhasDoLog();
  await page.goto('/cadastro');
  await page.getByLabel('Nome', { exact: true }).fill('Ana Souza');
  await page.getByLabel('E-mail', { exact: true }).fill(email);
  await page.getByLabel('Senha', { exact: true }).fill(SENHA);
  await page.getByRole('checkbox').check();
  await page.getByRole('button', { name: 'Criar conta' }).click();
  await expect(page.getByRole('heading', { name: 'Confira seu e-mail' })).toBeVisible();

  // Antes de confirmar, entrar é recusado com o aviso próprio.
  await page.goto('/entrar');
  await page.getByLabel('E-mail', { exact: true }).fill(email);
  await page.getByLabel('Senha', { exact: true }).fill(SENHA);
  await page.getByRole('button', { name: 'Entrar' }).click();
  await expect(page.getByText('Confirme seu e-mail para entrar.')).toBeVisible();
  await expect(page).toHaveURL(/\/entrar/);

  // O link do e-mail: o token vem no fragmento e some do endereço.
  const link = await linkDoEmail('/confirmar', antes);
  const token = new URL(link).hash.replace('#t=', '');
  expect(token.length).toBeGreaterThanOrEqual(32);
  await page.goto(link);
  await expect(page.getByRole('heading', { name: 'E-mail confirmado' })).toBeVisible();
  expect(page.url()).not.toContain(token);

  // Login: cookie de sessão HttpOnly, Secure e SameSite=Lax; a guarda leva ao primeiro acesso.
  await page.getByRole('link', { name: 'Ir para Entrar' }).click();
  await page.getByLabel('E-mail', { exact: true }).fill(email);
  await page.getByLabel('Senha', { exact: true }).fill(SENHA);
  await page.getByRole('button', { name: 'Entrar' }).click();
  await expect(page.getByRole('heading', { name: 'Bem-vindo' })).toBeVisible();
  const sid = (await context.cookies()).find((c) => c.name === '__Host-sid');
  expect(sid).toMatchObject({ httpOnly: true, secure: true, sameSite: 'Lax', path: '/' });

  await page.getByRole('button', { name: 'Criar meu lar' }).click();
  await expect(page.getByRole('heading', { level: 1, name: /\d{4}$/ })).toBeVisible();
  await expect(page).toHaveURL(/\/app$/);

  // Assinar: lar novo começa no teste do Pro; o titular assina com CPF e recebe a cobrança Pix do "Asaas".
  await page.getByRole('link', { name: 'Ajustes' }).first().click();
  await page
    .getByRole('main')
    .getByRole('link', { name: /Meu plano/ })
    .click();
  const planoDaCasa = page.getByRole('region', { name: 'Plano da casa' });
  await expect(planoDaCasa).toContainText('Pro');
  await expect(planoDaCasa).toContainText('Período de teste');
  await page.getByLabel('CPF ou CNPJ do titular').pressSequentially(CPF);
  await page.getByRole('button', { name: 'Assinar o Pro' }).click();
  const cobranca = page.getByRole('region', { name: 'Cobrança em aberto' });
  await expect(cobranca.getByLabel('Pix copia e cola')).toHaveText(PIX_FALSO);
  await expect(cobranca.getByRole('img', { name: 'QR code do Pix' })).toBeVisible();

  const pedidos = await pedidosAoAsaas();
  const cliente = pedidos.find((p) => p.metodo === 'POST' && p.caminho === '/v3/customers');
  expect((cliente?.corpo as { cpfCnpj: string }).cpfCnpj.replace(/\D/g, '')).toBe(CPF);
  expect(cliente?.chave).toMatch(/^e2e_/);
  expect(pedidos.find((p) => p.caminho === '/v3/subscriptions')?.corpo).toMatchObject({
    billingType: 'PIX',
    value: 9.9,
    cycle: 'MONTHLY',
  });
  // O CPF não fica no aparelho.
  const guardado = await page.evaluate(() => JSON.stringify([{ ...localStorage }, { ...sessionStorage }]));
  expect(guardado).not.toContain(CPF);

  // O "Asaas" recebe o Pix e manda o webhook: o plano fica ativo.
  expect(await pagarPrimeiraCobranca()).toBe(200);
  await page.reload();
  await expect(planoDaCasa).toContainText(/Ativa/);

  // Primeiros passos do Início: uma conta e uma forma de pagamento (lançar exige forma; as categorias já existem).
  await page.goto('/app');
  await page.getByRole('link', { name: 'Cadastre uma conta' }).click();
  await page.getByLabel('Nome').fill('Nubank');
  await page.getByLabel('Saldo inicial').pressSequentially('10000');
  await page.getByRole('button', { name: 'Salvar' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Contas' })).toBeVisible();
  await page.goto('/app');
  await page.getByRole('link', { name: 'Cadastre uma forma de pagamento' }).click();
  await page.getByLabel('Nome').fill('Pix Nubank');
  await page.getByLabel('Conta de origem').selectOption({ label: 'Nubank' });
  await page.getByRole('button', { name: 'Criar forma' }).click();
  await expect(page.getByRole('heading', { level: 1, name: /Formas de pagamento/ })).toBeVisible();

  // Lançar: despesa à vista pelo "+ Lançar", gravada no banco e listada em Lançamentos.
  await page.goto('/app');
  await page.getByRole('link', { name: 'Lançar' }).first().click();
  const folha = page.getByRole('dialog');
  await expect(folha).toBeVisible();
  await folha.locator('#valor').pressSequentially('4590');
  await folha.getByRole('radio', { name: /Mercado/ }).click({ force: true });
  await folha.getByRole('button', { name: 'Lançar R$ 45,90' }).click();
  await expect(page.getByText(/Lançado: R\$ 45,90 · Mercado/)).toBeVisible();
  await page.goto('/app/lancamentos');
  await expect(page.getByRole('main')).toContainText('Mercado');
  await expect(page.getByRole('main')).toContainText('45,90');

  // Sair e entrar de novo: a sessão nova abre o app direto no Início, com o lar e o lançamento.
  await page.getByRole('link', { name: 'Ajustes' }).first().click();
  await page.getByRole('button', { name: /Sair deste aparelho/ }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Entrar' })).toBeVisible();
  expect((await context.cookies()).find((c) => c.name === '__Host-sid')).toBeUndefined();
  await page.getByLabel('E-mail', { exact: true }).fill(email);
  await page.getByLabel('Senha', { exact: true }).fill(SENHA);
  await page.getByRole('button', { name: 'Entrar' }).click();
  await expect(page.getByRole('heading', { level: 1, name: /\d{4}$/ })).toBeVisible();
  await expect(page).toHaveURL(/\/app$/);
});

test('login com senha errada: alerta genérico e nenhuma sessão criada', async ({ page, context }) => {
  await page.goto('/entrar');
  await page.getByLabel('E-mail', { exact: true }).fill(`ninguem.${Date.now()}@exemplo.com`);
  await page.getByLabel('Senha', { exact: true }).fill('senha-qualquer-errada');
  await page.getByRole('button', { name: 'Entrar' }).click();
  await expect(page.getByText('E-mail ou senha incorretos.')).toBeVisible();
  await expect(page).toHaveURL(/\/entrar/);
  expect((await context.cookies()).find((c) => c.name === '__Host-sid')).toBeUndefined();
});
