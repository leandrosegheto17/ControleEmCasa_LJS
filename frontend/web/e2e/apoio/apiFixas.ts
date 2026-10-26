import { readFileSync } from 'node:fs';
import type { Page } from '@playwright/test';

/**
 * API simulada por `page.route` para os e2e de despesas fixas e de orçamento (etapa 12, lote 3): estado em memória e
 * cada escrita registrada. As respostas seguem o contrato (`backend/contrato`) e as regras do PRD-TECNICO (RN-15,
 * RN-16); os e2e com o Worker e o banco são da etapa 16.
 */

const RESPOSTAS = new URL('../../test/fixtures/respostas/', import.meta.url);
const ler = <T>(nome: string): T => JSON.parse(readFileSync(new URL(nome, RESPOSTAS), 'utf8')) as T;

export const ID_USUARIO = '00000000-0000-4000-8000-0000000000a1';
export const ID_ALUGUEL = '00000000-0000-4000-8000-000000000701';
export const ID_OC_INTERNET = '00000000-0000-4000-8000-000000000804';
export const ID_OC_AGUA = '00000000-0000-4000-8000-000000000806';
export const ID_PIX = '00000000-0000-4000-8000-000000000301';
export const ID_CONTAS_CASA = '00000000-0000-4000-8000-000000000404';
export const ID_DELIVERY = '00000000-0000-4000-8000-000000000402';

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

interface Modelo {
  id: string;
  descricao: string;
  categoria_id: string;
  categoria: string;
  valor_previsto_centavos: number;
  dia_vencimento: number;
  encerrada_em: string | null;
}
interface Ocorrencia {
  id: string;
  despesa_fixa_id: string;
  descricao: string;
  categoria: string;
  vencimento: string;
  valor_previsto_centavos: number;
  valor_pago_centavos: number | null;
  situacao: 'paga' | 'atrasada' | 'pendente';
  pagador: { nome: string; sou_eu: boolean } | null;
}
interface LinhaOrcamento {
  categoria_id: string;
  nome: string;
  orcado_centavos: number;
  realizado_centavos: number;
  percentual: number;
  situacao: 'dentro' | 'atencao' | 'estourado';
}
interface OrcamentoFixture {
  linhas: LinhaOrcamento[];
}

export interface Escrita {
  metodo: string;
  url: string;
  corpo: unknown;
  cabecalhos: Record<string, string>;
}

const HOJE = '2026-10-09';
const mesDe = (data: string) => `${data.slice(0, 7)}-01`;
const CATEGORIAS_CASA = [
  { id: '00000000-0000-4000-8000-000000000401', nome: 'Mercado' },
  { id: ID_DELIVERY, nome: 'Delivery/iFood do casal' },
  { id: '00000000-0000-4000-8000-000000000403', nome: 'Moradia' },
  { id: ID_CONTAS_CASA, nome: 'Contas da casa' },
  { id: '00000000-0000-4000-8000-000000000405', nome: 'Outros da casa' },
];

const situacaoOrcamento = (orcado: number, realizado: number) =>
  realizado * 100 < orcado * 80 ? 'dentro' : realizado <= orcado ? 'atencao' : 'estourado';

export async function simularApiFixas(page: Page) {
  const dados = ler<Record<string, unknown>>('dados-lancamento.json');
  const modelos = ler<Modelo[]>('despesas-fixas.json');
  const ocorrencias = ler<{ ocorrencias: Ocorrencia[] }>('ocorrencias-mes.json').ocorrencias;
  const pagamentos = new Map<string, string>();
  const escritas: Escrita[] = [];

  // Orçado e realizado por "AAAA-MM-01|categoria": outubro vem da fixture; novembro começa sem orçamento.
  const orcado = new Map<string, number>();
  const realizado = new Map<string, number>();
  for (const l of ler<OrcamentoFixture>('orcamento-mes.json').linhas) {
    orcado.set(`2026-10-01|${l.categoria_id}`, l.orcado_centavos);
    realizado.set(`2026-10-01|${l.categoria_id}`, l.realizado_centavos);
  }

  const doMes = (mes: string) => {
    if (mes !== '2026-10-01' && !ocorrencias.some((o) => mesDe(o.vencimento) === mes)) {
      for (const m of modelos) {
        ocorrencias.push({
          id: crypto.randomUUID(),
          despesa_fixa_id: m.id,
          descricao: m.descricao,
          categoria: m.categoria,
          vencimento: `${mes.slice(0, 7)}-${String(m.dia_vencimento).padStart(2, '0')}`,
          valor_previsto_centavos: m.valor_previsto_centavos,
          valor_pago_centavos: null,
          situacao: 'pendente',
          pagador: null,
        });
      }
    }
    for (const o of ocorrencias) o.situacao = o.pagador ? 'paga' : o.vencimento < HOJE ? 'atrasada' : 'pendente';
    const lista = ocorrencias.filter((o) => mesDe(o.vencimento) === mes);
    const grupo = (o: Ocorrencia) => (o.situacao === 'atrasada' ? 0 : o.situacao === 'pendente' ? 1 : 2);
    lista.sort(
      (a, b) =>
        grupo(a) - grupo(b) ||
        (grupo(a) === 2 ? b.vencimento.localeCompare(a.vencimento) : a.vencimento.localeCompare(b.vencimento)),
    );
    const naoPagas = lista.filter((o) => o.situacao !== 'paga');
    return {
      mes,
      pagas: lista.length - naoPagas.length,
      total: lista.length,
      previsto_a_pagar_centavos: naoPagas.reduce((t, o) => t + o.valor_previsto_centavos, 0),
      ocorrencias: lista,
    };
  };

  const mesAnterior = (mes: string) => {
    const [a, m] = mes.split('-').map(Number) as [number, number];
    return new Date(Date.UTC(a, m - 2, 1)).toISOString().slice(0, 10);
  };

  const orcamentoDoMes = (mes: string) => {
    const linhas = CATEGORIAS_CASA.filter((c) => orcado.has(`${mes}|${c.id}`))
      .map((c) => {
        const o = orcado.get(`${mes}|${c.id}`)!;
        const r = realizado.get(`${mes}|${c.id}`) ?? 0;
        return {
          categoria_id: c.id,
          nome: c.nome,
          orcado_centavos: o,
          realizado_centavos: r,
          percentual: Math.round((100 * r) / o),
          situacao: situacaoOrcamento(o, r),
        };
      })
      .sort((a, b) => b.percentual - a.percentual || a.nome.localeCompare(b.nome));
    const orcadoTotal = linhas.reduce((t, l) => t + l.orcado_centavos, 0);
    const realizadoTotal = CATEGORIAS_CASA.reduce((t, c) => t + (realizado.get(`${mes}|${c.id}`) ?? 0), 0);
    const anterior = mesAnterior(mes);
    const doAnterior = [...orcado.entries()].filter(([k]) => k.startsWith(`${anterior}|`));
    const pode = linhas.length === 0 && doAnterior.length > 0;
    return {
      mes,
      escopo: 'conjunto',
      pode_copiar_anterior: { conjunto: pode, individual: false },
      ...(pode && {
        anterior: {
          mes: anterior,
          orcado_centavos: doAnterior.reduce((t, [, v]) => t + v, 0),
          categorias: doAnterior.length,
        },
      }),
      total:
        linhas.length === 0
          ? null
          : {
              orcado_centavos: orcadoTotal,
              realizado_centavos: realizadoTotal,
              percentual: Math.round((100 * realizadoTotal) / orcadoTotal),
              situacao: situacaoOrcamento(orcadoTotal, realizadoTotal),
              resultado_centavos: orcadoTotal - realizadoTotal,
              parcial: true,
            },
      linhas,
      sem_orcamento: CATEGORIAS_CASA.filter((c) => !orcado.has(`${mes}|${c.id}`))
        .map((c) => ({ categoria_id: c.id, nome: c.nome }))
        .sort((a, b) => a.nome.localeCompare(b.nome)),
    };
  };

  await page.route('**/api/**', async (rota) => {
    const pedido = rota.request();
    const url = new URL(pedido.url());
    const { pathname } = url;
    const metodo = pedido.method();
    const corpo =
      metodo === 'GET' || metodo === 'DELETE' ? undefined : (pedido.postDataJSON() as Record<string, unknown> | null);
    if (metodo !== 'GET') escritas.push({ metodo, url: pathname, corpo, cabecalhos: pedido.headers() });

    if (pathname === '/api/sessao') return rota.fulfill(json(SESSAO));
    if (pathname === '/api/lancamentos/dados') return rota.fulfill(json(dados));
    if (pathname === '/api/resumo') return rota.fulfill(json(ler('resumo-mes.json')));
    if (pathname === '/api/categorias') {
      return rota.fulfill(
        json(
          CATEGORIAS_CASA.map((c) => ({
            id: c.id,
            nome: c.nome,
            tipo: 'despesa',
            escopo: 'conjunto',
            variavel: false,
            arquivada: false,
            pode_excluir: false,
          })),
        ),
      );
    }
    if (pathname === '/api/fixas' && metodo === 'GET') return rota.fulfill(json(modelos));
    if (pathname === '/api/fixas/ocorrencias') {
      return rota.fulfill(json(doMes(mesDe(url.searchParams.get('mes') ?? HOJE))));
    }
    const fixa = /^\/api\/fixas\/([^/]+)(?:\/(encerrar))?$/.exec(pathname);
    if (fixa && metodo === 'PUT' && corpo) {
      const id = fixa[1]!;
      const categoria = CATEGORIAS_CASA.find((c) => c.id === corpo.categoria_id)!;
      const campos = {
        descricao: String(corpo.descricao),
        categoria_id: categoria.id,
        categoria: categoria.nome,
        valor_previsto_centavos: Number(corpo.valor_previsto_centavos),
        dia_vencimento: Number(corpo.dia_vencimento),
      };
      const existente = modelos.find((m) => m.id === id);
      if (existente) Object.assign(existente, campos);
      else modelos.push({ id, encerrada_em: null, ...campos });
      return rota.fulfill(json({ id }, existente ? 200 : 201));
    }
    if (fixa && metodo === 'POST' && fixa[2]) {
      const m = modelos.find((x) => x.id === fixa[1]);
      if (m && m.encerrada_em === null) m.encerrada_em = HOJE;
      return rota.fulfill({ status: 204 });
    }
    const pagamento = /^\/api\/ocorrencias\/([^/]+)\/pagamento$/.exec(pathname);
    if (pagamento) {
      const o = ocorrencias.find((x) => x.id === pagamento[1]);
      if (!o) return rota.fulfill(json({ code: 'registro_invalido', message: 'x' }, 404));
      if (metodo === 'DELETE') {
        o.pagador = null;
        o.valor_pago_centavos = null;
        return rota.fulfill({ status: 204 });
      }
      const id = String(corpo?.id);
      if (o.pagador) {
        if (pagamentos.get(o.id) !== id) return rota.fulfill(json({ code: 'ocorrencia_paga', message: 'x' }, 409));
      } else {
        pagamentos.set(o.id, id);
        o.pagador = { nome: 'Ana', sou_eu: true };
        o.valor_pago_centavos = Number(corpo?.valor_centavos ?? o.valor_previsto_centavos);
      }
      return rota.fulfill(
        json(
          {
            ocorrencia_id: o.id,
            lancamento_id: id,
            situacao: 'paga',
            valor_pago_centavos: o.valor_pago_centavos,
            vencimento: o.vencimento,
            ja_existia: false,
          },
          201,
        ),
      );
    }
    if (pathname === '/api/orcamento' && metodo === 'GET') {
      return rota.fulfill(json(orcamentoDoMes(mesDe(url.searchParams.get('mes') ?? HOJE))));
    }
    const copia = /^\/api\/orcamento\/(\d{4}-\d{2}-\d{2})\/copiar$/.exec(pathname);
    if (copia && metodo === 'POST') {
      const mes = copia[1]!;
      let copiadas = 0;
      for (const [k, v] of [...orcado.entries()]) {
        if (!k.startsWith(`${mesAnterior(mes)}|`)) continue;
        const nova = `${mes}|${k.split('|')[1]}`;
        if (orcado.has(nova)) continue;
        orcado.set(nova, v);
        copiadas += 1;
      }
      return rota.fulfill(json({ copiadas }));
    }
    const valor = /^\/api\/orcamento\/(\d{4}-\d{2}-\d{2})\/([^/]+)$/.exec(pathname);
    if (valor && metodo === 'PUT') {
      const chave = `${valor[1]}|${valor[2]}`;
      if (corpo?.valor_centavos === null || corpo?.valor_centavos === undefined) orcado.delete(chave);
      else orcado.set(chave, Number(corpo.valor_centavos));
      return rota.fulfill({ status: 204 });
    }
    return rota.fulfill(json({ code: 'rota_inexistente', message: 'x' }, 404));
  });

  return { escritas, modelos, ocorrencias, orcado };
}

/** Fixa o relógio do navegador: o app lê a data de hoje (São Paulo) para o mês e a data do pagamento. */
export async function fixarRelogio(page: Page, instante = '2026-10-09T15:00:00-03:00') {
  await page.clock.setFixedTime(new Date(instante));
}
