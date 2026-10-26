import { QueryClient } from '@tanstack/react-query';
import { describe, expect, it } from 'vitest';
import { esvaziarCache } from './esvaziarCache';

function clienteComDados() {
  const cliente = new QueryClient();
  cliente.setQueryData(['sessao'], { usuario: { id: 'a' } });
  cliente.setQueryData(['lancamentos', '2026-10-01'], [{ id: 1 }]);
  cliente.setQueryData(['resumo'], { total: 100 });
  return cliente;
}

describe('esvaziarCache (G-39)', () => {
  it('remove todos os dados de API do cache', () => {
    const cliente = clienteComDados();

    esvaziarCache(cliente, { sessaoAcabou: true });

    expect(cliente.getQueryData(['lancamentos', '2026-10-01'])).toBeUndefined();
    expect(cliente.getQueryData(['resumo'])).toBeUndefined();
  });

  it('com a sessão encerrada, a consulta da sessão vira null (e continua observável)', () => {
    const cliente = clienteComDados();
    esvaziarCache(cliente, { sessaoAcabou: true });
    expect(cliente.getQueryData(['sessao'])).toBeNull();
  });

  it('sem encerrar a sessão (saída que falhou), a sessão fica como está', () => {
    const cliente = clienteComDados();
    esvaziarCache(cliente, { sessaoAcabou: false });
    expect(cliente.getQueryData(['sessao'])).toEqual({ usuario: { id: 'a' } });
    expect(cliente.getQueryData(['resumo'])).toBeUndefined();
  });
});
