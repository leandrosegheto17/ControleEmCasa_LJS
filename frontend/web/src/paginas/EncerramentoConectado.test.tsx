import { configure, screen } from '@testing-library/react';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { limparAparelho, montarApp, preAquecerPaginas } from '../../test/apoio/apiCadastros';
import { criarServidorConta, instalarApiConta, type ServidorConta } from '../../test/apoio/apiConta';

/**
 * Aviso ao convidado (RN-26, CA-26.7): quando `GET /api/sessao` traz `encerramento.purga_em`, uma faixa global diz que o
 * titular excluiu a conta e quando o lar e os dados dele nele serão apagados. Sem `encerramento`, nada aparece.
 */

let servidor: ServidorConta;

configure({ asyncUtilTimeout: 5000 });
beforeAll(preAquecerPaginas, 30_000);
beforeEach(async () => {
  servidor = criarServidorConta({ papel: 'membro' });
  await limparAparelho();
});
afterEach(() => vi.unstubAllGlobals());

const TEXTO = 'O titular excluiu a conta: este lar e os seus dados nele serão apagados em 25/11/2026.';

describe('Faixa de encerramento do lar', () => {
  it('aparece em qualquer tela do app, com a data da purga em dd/mm/aaaa', async () => {
    servidor.encerramento = { purga_em: '2026-11-25T12:00:00.000Z' };
    instalarApiConta(servidor);

    montarApp('/app/ajustes');

    const faixa = await screen.findByText(TEXTO);
    expect(faixa.closest('[role="status"]')).not.toBeNull();
  });

  it('continua na tela seguinte (global, não de uma tela só)', async () => {
    servidor.encerramento = { purga_em: '2026-11-25T12:00:00.000Z' };
    instalarApiConta(servidor);

    montarApp('/app/ajustes/categorias');

    expect(await screen.findByText(TEXTO)).toBeInTheDocument();
  });

  it('a data é a do dia em São Paulo, não a do UTC', async () => {
    servidor.encerramento = { purga_em: '2026-11-26T01:30:00.000Z' };
    instalarApiConta(servidor);

    montarApp('/app/ajustes');

    expect(await screen.findByText(/serão apagados em 25\/11\/2026\./)).toBeInTheDocument();
  });

  it('some quando não há encerramento', async () => {
    instalarApiConta(servidor);

    montarApp('/app/ajustes');

    await screen.findByRole('heading', { level: 1, name: 'Ajustes' });
    expect(screen.queryByText(/O titular excluiu a conta/)).not.toBeInTheDocument();
  });
});
