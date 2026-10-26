import { expect, test } from '@playwright/test';
import { simularApiFixas } from './apoio/apiFixas';
import { fixarRelogio, simularApiMetas } from './apoio/apiMetas';
import { PIX, planoFree, simularPlano } from './apoio/apiPlano';

/**
 * e2e de Meu plano e do Free (etapa 13, lote 2), contra a API simulada por `page.route`. Critérios: RN-24 (o titular
 * assina e cancela; o convidado vê o plano sem ações), CA-24.6 (CPF/CNPJ inválido não assina), CA-24.7 (cobrança em
 * aberto com Pix copia-e-cola e QR), CA-24.8 (cancelar mantém o Pro até o fim do período pago), CA-24.11 (o CPF/CNPJ só
 * viaja no corpo do POST), RN-25 e CA-25.1 a CA-25.3 (Free: orçamento e metas só para consulta).
 */

const CPF = '52998224725';
const CPF_MASCARADO = '529.982.247-25';

test.beforeEach(async ({ page }) => {
  await fixarRelogio(page);
});

test('assinar: CPF inválido não envia; CPF válido mostra a cobrança com Pix e QR, e o CPF não vai ao armazenamento local', async ({
  page,
}) => {
  await simularApiMetas(page);
  const { escritas } = await simularPlano(page, planoFree());
  await page.goto('/app/ajustes');

  await page
    .getByRole('main')
    .getByRole('link', { name: /Meu plano/ })
    .click();
  await expect(page).toHaveURL(/\/app\/ajustes\/plano$/);
  await expect(page.getByRole('heading', { level: 1, name: 'Meu plano' })).toBeVisible();
  await expect(page.getByRole('region', { name: 'Plano da casa' })).toContainText('Plano Free');

  const campo = page.getByLabel('CPF ou CNPJ do titular');
  await campo.pressSequentially('52998224724');
  await expect(campo).toHaveValue('529.982.247-24');
  await page.getByRole('button', { name: 'Assinar o Pro' }).click();
  await expect(page.getByText('Informe um CPF ou CNPJ válido.')).toBeVisible();
  expect(escritas.filter((e) => e.url === '/api/plano/assinar')).toHaveLength(0);

  await campo.fill('');
  await campo.pressSequentially(CPF);
  await expect(campo).toHaveValue(CPF_MASCARADO);
  await page.getByRole('button', { name: 'Assinar o Pro' }).click();

  const cobranca = page.getByRole('region', { name: 'Cobrança em aberto' });
  await expect(cobranca).toContainText('vence em 09/10/2026');
  await expect(cobranca.getByLabel('Pix copia e cola')).toHaveText(PIX);
  await expect(cobranca.getByRole('img', { name: 'QR code do Pix' })).toBeVisible();
  const envio = escritas.find((e) => e.url === '/api/plano/assinar');
  expect(envio?.corpo).toEqual({ cpf_cnpj: CPF_MASCARADO });
  expect(envio?.cabecalhos['x-controle-em-casa']).toBe('1');

  const guardado = await page.evaluate(() => JSON.stringify([{ ...localStorage }, { ...sessionStorage }]));
  expect(guardado).not.toContain(CPF);
  expect(page.url()).not.toContain(CPF);
});

test('copiar o código Pix põe o código na área de transferência', async ({ page, context }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await simularApiMetas(page);
  await simularPlano(
    page,
    planoFree({
      cobranca: {
        vencimento: '2026-10-09',
        valor_centavos: 990,
        situacao: 'pendente',
        pix_copia_cola: PIX,
        qr_png_base64: null,
      },
    }),
  );
  await page.goto('/app/ajustes/plano');

  await page.getByRole('button', { name: 'Copiar código Pix' }).click();

  await expect(page.getByText('Código Pix copiado')).toBeVisible();
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(PIX);
});

test('Pix nulo: sem código, com "Tentar de novo" que busca de novo', async ({ page }) => {
  await simularApiMetas(page);
  const { estado } = await simularPlano(
    page,
    planoFree({
      cobranca: {
        vencimento: '2026-10-09',
        valor_centavos: 990,
        situacao: 'pendente',
        pix_copia_cola: PIX,
        qr_png_base64: null,
      },
    }),
  );
  estado.pixNuloNaProxima = true;
  await page.goto('/app/ajustes/plano');

  await expect(page.getByText(/Não conseguimos gerar o Pix agora/)).toBeVisible();
  await expect(page.getByRole('button', { name: 'Copiar código Pix' })).toHaveCount(0);

  await page.getByRole('button', { name: /Tentar de novo/ }).click();

  await expect(page.getByLabel('Pix copia e cola')).toHaveText(PIX);
  await expect(page.getByRole('button', { name: 'Copiar código Pix' })).toBeVisible();
});

test('cancelar: pede confirmação, cancela e mostra "Pro até" a data', async ({ page }) => {
  await simularApiMetas(page);
  const { escritas } = await simularPlano(
    page,
    planoFree({ plano: 'pro', situacao: 'ativa', periodo_ate: '2026-11-09T15:00:00.000Z' }),
  );
  await page.goto('/app/ajustes/plano');

  await expect(page.getByRole('region', { name: 'Plano da casa' })).toContainText('Ativa, paga até 09/11/2026');
  await page.getByRole('button', { name: 'Cancelar assinatura' }).click();
  const dialogo = page.getByRole('alertdialog');
  await expect(dialogo).toContainText('O Pro continua até 09/11/2026');
  await dialogo.getByRole('button', { name: 'Manter assinatura' }).click();
  expect(escritas.filter((e) => e.url === '/api/plano/cancelar')).toHaveLength(0);

  await page.getByRole('button', { name: 'Cancelar assinatura' }).click();
  await page.getByRole('alertdialog').getByRole('button', { name: 'Cancelar assinatura' }).click();

  await expect(page.getByText('Assinatura cancelada')).toBeVisible();
  await expect(page.getByRole('region', { name: 'Plano da casa' })).toContainText('Cancelada. Pro até 09/11/2026');
  expect(escritas.filter((e) => e.url === '/api/plano/cancelar')).toHaveLength(1);
});

test('convidado: vê o plano da casa e a explicação, sem formulário nem botões', async ({ page }) => {
  await simularApiMetas(page);
  await simularPlano(
    page,
    planoFree({ plano: 'pro', situacao: 'trial', trial_ate: '2026-10-23T15:00:00.000Z', sou_titular: false }),
  );
  await page.goto('/app/ajustes/plano');

  await expect(page.getByRole('region', { name: 'Plano da casa' })).toContainText('Período de teste: faltam 14 dias');
  await expect(page.getByText(/quem assina e cancela é o titular/)).toBeVisible();
  await expect(page.getByLabel('CPF ou CNPJ do titular')).toHaveCount(0);
  await expect(page.getByRole('button', { name: /Assinar|Cancelar assinatura/ })).toHaveCount(0);
});

test('Free: metas ficam legíveis, sem criar nem editar, e o bloqueio leva a Meu plano', async ({ page }) => {
  await simularApiMetas(page);
  const { escritas } = await simularPlano(page, planoFree());
  await page.goto('/app/metas');

  await expect(page.getByText('Viagem Nordeste')).toBeVisible();
  const faixa = page.getByText(/No plano Free as metas fica só para consulta/);
  await expect(faixa).toBeVisible();
  await expect(page.getByRole('link', { name: /Nova meta/ })).toHaveCount(0);

  await page.goto('/app/metas/nova');
  await expect(page.getByRole('heading', { name: 'Metas só para consulta no plano Free' })).toBeVisible();
  await page.getByRole('link', { name: 'Ver meu plano' }).click();
  await expect(page).toHaveURL(/\/app\/ajustes\/plano$/);
  expect(escritas.filter((e) => e.url.startsWith('/api/metas'))).toHaveLength(0);
});

test('Free: orçamento fica legível, sem abrir a edição', async ({ page }) => {
  await simularApiFixas(page);
  const { escritas } = await simularPlano(page, planoFree());
  await page.goto('/app/orcamento?mes=2026-10');

  await expect(page.getByRole('heading', { name: /Orçamento da casa/ })).toBeVisible();
  await expect(page.getByText(/No plano Free o orçamento fica só para consulta/)).toBeVisible();
  const lista = page.getByRole('region', { name: 'Por categoria' });
  await expect(lista).toContainText('Contas da casa');
  await expect(lista.getByRole('link')).toHaveCount(0);

  await page.goto('/app/orcamento?mes=2026-10&escopo=casa&editar=00000000-0000-4000-8000-000000000404');
  await expect(page.getByRole('heading', { name: /Orçamento da casa/ })).toBeVisible();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  expect(escritas.filter((e) => e.url.startsWith('/api/orcamento'))).toHaveLength(0);
});
