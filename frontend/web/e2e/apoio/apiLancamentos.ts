import { readFileSync } from 'node:fs';
import type { Page, Route } from '@playwright/test';

/**
 * API simulada por `page.route` para os e2e de lançamentos (etapa 12, lote 2): estado em memória e cada escrita
 * registrada. As respostas seguem o contrato (`backend/contrato`); os e2e com o Worker e o banco são da etapa 16.
 */

const RESPOSTAS = new URL('../../test/fixtures/respostas/', import.meta.url);
const ler = <T>(nome: string): T => JSON.parse(readFileSync(new URL(nome, RESPOSTAS), 'utf8')) as T;

export const ID_USUARIO = '00000000-0000-4000-8000-0000000000a1';
export const ID_LANCAMENTO = '00000000-0000-4000-8000-000000000520';
export const ID_PARCELA_1 = '00000000-0000-4000-8000-000000000620';
export const ID_MERCADO = '00000000-0000-4000-8000-000000000401';
export const ID_CREDITO = '00000000-0000-4000-8000-000000000303';

const SESSAO = {
  usuario: { id: ID_USUARIO, nome: 'Ana', email: 'ana@exemplo.com' },
  membro: { id: ID_USUARIO, nome: 'Ana', papel: 'titular' },
  lar: { id: '00000000-0000-4000-8000-0000000000b1', nome: 'Casa' },
  plano: null,
  termos_pendentes: false,
};

const json = (corpo: unknown, status = 200) => ({
  status,
  contentType: 'application/json',
  body: JSON.stringify(corpo),
});

const comoUsuario = <T>(valor: T): T =>
  JSON.parse(JSON.stringify(valor).replaceAll('00000000-0000-4000-8000-000000000101', ID_USUARIO)) as T;

interface Parcela {
  id: string;
  numero: number;
  valor_centavos: number;
  data: string;
  data_ajustada: boolean;
}
interface Detalhe {
  id: string;
  tipo: 'despesa' | 'receita';
  escopo: 'conjunto' | 'individual';
  descricao: string | null;
  categoria: { id: string; nome: string; escopo: 'conjunto' | 'individual' };
  valor_total_centavos: number;
  num_parcelas: number;
  parcelas: Parcela[];
  [chave: string]: unknown;
}
interface Item {
  parcela_id: string;
  lancamento_id: string;
  data: string;
  descricao: string | null;
  tipo: 'despesa' | 'receita';
  escopo: 'conjunto' | 'individual';
  categoria: { id: string; nome: string; variavel: boolean | null };
  valor_centavos: number;
  parcela_numero: number;
  total_parcelas: number;
  pagador: { id: string; nome: string };
}

export interface Escrita {
  metodo: string;
  url: string;
  corpo: unknown;
  cabecalhos: Record<string, string>;
}

export async function simularApi(page: Page) {
  const dados = ler<{
    categorias_despesa: Array<{ id: string; nome: string; escopo: 'conjunto' | 'individual' }>;
    categorias_receita: Array<{ id: string; nome: string; escopo: 'conjunto' | 'individual' }>;
    formas: Array<{ id: string; nome: string; tipo: string }>;
  }>('dados-lancamento.json');
  const itens = comoUsuario(ler<{ itens: Item[] }>('lancamentos-mes.json').itens);
  const detalhes = new Map<string, Detalhe>([[ID_LANCAMENTO, comoUsuario(ler<Detalhe>('lancamento-pagador.json'))]]);
  const resumo = comoUsuario(ler<unknown>('resumo-mes.json'));
  const escritas: Escrita[] = [];

  const lancar = (rota: Route, tipo: 'despesa' | 'receita', corpo: Record<string, unknown>) => {
    const id = String(corpo.id);
    const lista = tipo === 'despesa' ? dados.categorias_despesa : dados.categorias_receita;
    const categoria = lista.find((c) => c.id === corpo.categoria_id)!;
    const parcelas = Number(corpo.parcelas ?? 1);
    const valor = Number(corpo.valor_centavos);
    const data = String(corpo.data ?? '2026-10-12');
    const existente = detalhes.get(id);
    const gravado = {
      id,
      escopo: categoria.escopo,
      categoria: categoria.nome,
      valor_total_centavos: valor,
      num_parcelas: parcelas,
      primeira_parcela_data: data,
      ja_existia: existente !== undefined,
    };
    if (!existente) {
      detalhes.set(id, {
        id,
        tipo,
        escopo: categoria.escopo,
        descricao: (corpo.descricao as string | undefined) || null,
        categoria: { id: categoria.id, nome: categoria.nome, escopo: categoria.escopo },
        valor_total_centavos: valor,
        num_parcelas: parcelas,
        parcelas: [{ id: `${id.slice(0, -4)}0001`, numero: 1, valor_centavos: valor, data, data_ajustada: false }],
      });
    }
    return rota.fulfill(json(gravado, existente ? 200 : 201));
  };

  await page.route('**/api/**', async (rota) => {
    const pedido = rota.request();
    const url = new URL(pedido.url());
    const { pathname } = url;
    const metodo = pedido.method();
    const corpo =
      metodo === 'GET' || metodo === 'DELETE' ? undefined : (pedido.postDataJSON() as Record<string, unknown>);
    if (metodo !== 'GET') escritas.push({ metodo, url: pathname, corpo, cabecalhos: pedido.headers() });

    if (pathname === '/api/sessao') return rota.fulfill(json(SESSAO));
    if (pathname === '/api/lancamentos/dados') return rota.fulfill(json(dados));
    if (pathname === '/api/resumo') return rota.fulfill(json(resumo));
    if (pathname === '/api/lancamentos' && metodo === 'GET') {
      const escopo = url.searchParams.get('escopo');
      const mes = (url.searchParams.get('mes') ?? '').slice(0, 7);
      const filtrados = itens.filter((i) => i.data.startsWith(mes) && (escopo === null || i.escopo === escopo));
      return rota.fulfill(
        json({
          mes: url.searchParams.get('mes'),
          filtros: { escopo, categoria_id: null, forma_id: null, variavel: null },
          total_filtrado_centavos: filtrados.reduce((t, i) => t + i.valor_centavos, 0),
          quantidade: filtrados.length,
          itens: filtrados,
        }),
      );
    }
    if (pathname === '/api/lancamentos/despesas' && corpo) return lancar(rota, 'despesa', corpo);
    if (pathname === '/api/lancamentos/receitas' && corpo) return lancar(rota, 'receita', corpo);
    const l = /^\/api\/lancamentos\/([^/]+)$/.exec(pathname);
    if (l) {
      const detalhe = detalhes.get(l[1]!);
      if (!detalhe) return rota.fulfill(json({ code: 'registro_invalido', message: 'x' }, 404));
      if (metodo === 'GET') return rota.fulfill(json(detalhe));
      if (metodo === 'DELETE') {
        detalhes.delete(l[1]!);
        return rota.fulfill({ status: 204 });
      }
      if (metodo === 'PATCH' && corpo) {
        if (typeof corpo.descricao === 'string') detalhe.descricao = corpo.descricao || null;
        return rota.fulfill(
          json({
            id: detalhe.id,
            escopo: detalhe.escopo,
            num_parcelas: detalhe.num_parcelas,
            alterado_em: '2026-10-12T15:00:00Z',
          }),
        );
      }
    }
    const p = /^\/api\/parcelas\/([^/]+)$/.exec(pathname);
    if (p && metodo === 'PATCH' && corpo) {
      for (const detalhe of detalhes.values()) {
        const parcela = detalhe.parcelas.find((x) => x.id === p[1]);
        if (parcela) {
          parcela.data = String(corpo.data);
          parcela.data_ajustada = true;
        }
      }
      return rota.fulfill({ status: 204 });
    }
    return rota.fulfill(json({ code: 'rota_inexistente', message: 'x' }, 404));
  });

  return { escritas, detalhes, itens };
}

/** Fixa o relógio do navegador: o app lê a data de hoje (São Paulo) para o mês e a data do lançamento. */
export async function fixarRelogio(page: Page, instante = '2026-10-12T15:00:00-03:00') {
  await page.clock.setFixedTime(new Date(instante));
}
