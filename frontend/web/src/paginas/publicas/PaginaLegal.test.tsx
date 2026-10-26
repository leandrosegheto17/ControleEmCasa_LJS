import { render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { describe, expect, it } from 'vitest';
import { VERSAO_PRIVACIDADE, VERSAO_TERMOS } from '../../comum/versoes';
import { Privacidade, Termos } from './PaginaLegal';
import { PENDENCIAS_A_PREENCHER } from './textosLegais';

/**
 * `/termos` e `/privacidade` (RNF-14; CA-26.5): texto real em rascunho, com a versão que o aceite registra, e a
 * pendência de cada dado do controlador que só o dono do produto sabe (`[A PREENCHER: ...]`), rastreada por teste.
 */

function textoDe(tela: React.ReactNode): string {
  const { container, unmount } = render(<MemoryRouter>{tela}</MemoryRouter>);
  const texto = container.textContent ?? '';
  unmount();
  return texto;
}

describe('Política de privacidade', () => {
  it('informa os 30 dias de retenção dos backups depois do apagamento (CA-26.5)', () => {
    render(
      <MemoryRouter>
        <Privacidade />
      </MemoryRouter>,
    );

    const retencao = screen.getByRole('region', { name: '6. Por quanto tempo guardamos' });
    expect(retencao).toHaveTextContent(/backups\) cifradas guardam os dados por até 30 dias depois do apagamento/);
    expect(retencao).toHaveTextContent('bloqueada por 30 dias');
  });

  it('lista dados coletados, finalidade e base legal, operadores e direitos do titular', () => {
    render(
      <MemoryRouter>
        <Privacidade />
      </MemoryRouter>,
    );

    expect(screen.getByRole('region', { name: '2. Dados que coletamos' })).toHaveTextContent(/Nome e e-mail/);
    expect(screen.getByRole('region', { name: '2. Dados que coletamos' })).toHaveTextContent(/Dados financeiros/);
    expect(screen.getByRole('region', { name: '3. Para que usamos e em que base legal' })).toHaveTextContent(
      /LGPD art\. 7º/,
    );
    const operadores = screen.getByRole('region', { name: '4. Com quem compartilhamos' });
    for (const nome of ['Cloudflare', 'Neon', 'Resend', 'Asaas', 'Sentry']) {
      expect(operadores).toHaveTextContent(nome);
    }
    const direitos = screen.getByRole('region', { name: '7. Seus direitos' });
    expect(direitos).toHaveTextContent('LGPD (art. 18)');
    expect(direitos).toHaveTextContent('Ajustes, Conta');
  });

  it('mostra a versão do aceite e o aviso de rascunho sujeito a revisão jurídica', () => {
    render(
      <MemoryRouter>
        <Privacidade />
      </MemoryRouter>,
    );

    expect(screen.getByRole('heading', { level: 1, name: 'Política de privacidade' })).toBeInTheDocument();
    expect(screen.getByText(`Versão ${VERSAO_PRIVACIDADE}`)).toBeInTheDocument();
    expect(screen.getByText(/revisão jurídica/)).toBeInTheDocument();
  });
});

describe('Termos de uso', () => {
  it('têm a versão do aceite, o aviso de rascunho e falam de planos, exclusão e foro', () => {
    render(
      <MemoryRouter>
        <Termos />
      </MemoryRouter>,
    );

    expect(screen.getByRole('heading', { level: 1, name: 'Termos de uso' })).toBeInTheDocument();
    expect(screen.getByText(`Versão ${VERSAO_TERMOS}`)).toBeInTheDocument();
    expect(screen.getByText(/revisão jurídica/)).toBeInTheDocument();
    expect(screen.getByRole('region', { name: '3. Planos e pagamento' })).toHaveTextContent('R$ 9,90');
    expect(screen.getByRole('region', { name: '3. Planos e pagamento' })).toHaveTextContent('14 dias');
    expect(screen.getByRole('region', { name: '5. Encerrar a conta' })).toHaveTextContent('30 dias');
  });

  it('a navegação do rodapé leva à landing, aos dois textos e ao acesso', () => {
    render(
      <MemoryRouter>
        <Termos />
      </MemoryRouter>,
    );

    const nav = within(screen.getByRole('navigation', { name: 'Outras páginas' }));
    expect(nav.getByRole('link', { name: 'Página inicial' })).toHaveAttribute('href', '/');
    expect(nav.getByRole('link', { name: 'Termos de uso' })).toHaveAttribute('href', '/termos');
    expect(nav.getByRole('link', { name: 'Política de privacidade' })).toHaveAttribute('href', '/privacidade');
    expect(nav.getByRole('link', { name: 'Entrar' })).toHaveAttribute('href', '/entrar');
  });
});

describe('dados a preencher (pendência rastreável)', () => {
  // Muda de propósito, e só quando o dado real entrar no texto: o teste obriga a mexer neste lugar.
  it('a lista é exatamente esta: razão social, CNPJ, endereço, contato, encarregado e foro', () => {
    expect(PENDENCIAS_A_PREENCHER).toEqual([
      '[A PREENCHER: razão social do controlador]',
      '[A PREENCHER: CNPJ]',
      '[A PREENCHER: endereço]',
      '[A PREENCHER: e-mail de contato para dúvidas e direitos do titular]',
      '[A PREENCHER: nome do encarregado de dados (DPO)]',
      '[A PREENCHER: foro da comarca]',
    ]);
  });

  it('todo marcador da lista aparece no texto publicado, e nenhum marcador fora da lista existe', () => {
    const publicado = `${textoDe(<Termos />)}\n${textoDe(<Privacidade />)}`;

    for (const pendencia of PENDENCIAS_A_PREENCHER) expect(publicado, pendencia).toContain(pendencia);
    const achados = new Set(publicado.match(/\[A PREENCHER[^\]]*\]/g));
    expect([...achados].sort()).toEqual([...PENDENCIAS_A_PREENCHER].sort());
  });
});
