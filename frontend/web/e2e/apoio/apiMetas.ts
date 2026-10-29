import { readFileSync } from 'node:fs';
import type { Page } from '@playwright/test';

/**
 * API simulada por `page.route` para os e2e de metas, convite de membro e sair de todos (etapa 12, lote 4): estado em
 * memória e cada escrita registrada. As respostas seguem o contrato (`backend/contrato`) e as regras do PRD-TECNICO
 * (RN-08, RN-09, CA-09.1, CA-23.x); os e2e com o Worker e o banco são da etapa 16.
 */

const RESPOSTAS = new URL('../../test/fixtures/respostas/', import.meta.url);
const ler = <T>(nome: string): T => JSON.parse(readFileSync(new URL(nome, RESPOSTAS), 'utf8')) as T;

export const ID_USUARIO = '00000000-0000-4000-8000-0000000000a1';
export const ID_VIAGEM = '00000000-0000-4000-8000-000000000902';
export const ID_CONVITE = '00000000-0000-4000-8000-000000000c01';
const HOJE = '2026-10-09';

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

interface Meta {
  id: string;
  nome: string;
  escopo: 'conjunto' | 'individual';
  alvo: number;
  prazo: string | null;
}
interface Movimento {
  id: string;
  metaId: string;
  tipo: 'aporte' | 'retirada';
  valor: number;
  data: string;
  local: string;
  conta?: string;
}
interface Lar {
  lar: { id: string; nome: string };
  membros: Array<{ id: string; nome: string; papel: 'titular' | 'membro'; sou_eu: boolean }>;
  convite_pendente?: { id: string; email: string; expira_em: string };
}

export interface Escrita {
  metodo: string;
  url: string;
  corpo: unknown;
  cabecalhos: Record<string, string>;
}

const mesesEntre = (de: string, ate: string) => {
  const [a, m] = de.split('-').map(Number) as [number, number];
  const [pa, pm] = ate.split('-').map(Number) as [number, number];
  return (pa - a) * 12 + (pm - m);
};

/**
 * `lar-sozinha`: o convite só faz sentido com um membro; `lar-dois-membros`: a casa cheia, com Ana titular;
 * `lar-como-membro`: a mesma casa, com a sessão de Beatriz, o membro.
 */
export async function simularApiMetas(
  page: Page,
  larInicial: 'lar-sozinha.json' | 'lar-dois-membros.json' | 'lar-como-membro.json' = 'lar-sozinha.json',
) {
  const dados = ler<Record<string, unknown>>('dados-lancamento.json');
  const metas: Meta[] = ler<
    Array<{ id: string; nome: string; escopo: Meta['escopo']; alvo_centavos: number; prazo: string | null }>
  >('metas.json').map((m) => ({ id: m.id, nome: m.nome, escopo: m.escopo, alvo: m.alvo_centavos, prazo: m.prazo }));
  const movimentos: Movimento[] = ler<
    Array<{
      id: string;
      tipo: Movimento['tipo'];
      valor_centavos: number;
      data: string;
      local: string;
      conta?: { nome: string };
    }>
  >('movimentos-meta.json').map((m) => ({
    id: m.id,
    metaId: ID_VIAGEM,
    tipo: m.tipo,
    valor: m.valor_centavos,
    data: m.data,
    local: m.local,
    ...(m.conta && { conta: m.conta.nome }),
  }));
  // Um aporte único em cada uma das outras metas, para o guardado das fixtures valer.
  for (const [metaId, valor, local] of [
    ['00000000-0000-4000-8000-000000000901', 1850000, 'Poupança'],
    ['00000000-0000-4000-8000-000000000903', 240000, 'Caixinha Nubank'],
    ['00000000-0000-4000-8000-000000000904', 180000, 'Caixinha Nubank'],
  ] as const) {
    movimentos.push({ id: crypto.randomUUID(), metaId, tipo: 'aporte', valor, data: '2026-09-01', local });
  }
  const lar = ler<Lar>(larInicial);
  const escritas: Escrita[] = [];
  /** `saiuDoLar`: depois de `POST /api/lar/sair`, a sessão vem sem lar (CA-23.13). */
  const estado = { sessaoAtiva: true, saiuDoLar: false };
  const souTitular = () => lar.membros.find((m) => m.sou_eu)?.papel === 'titular';
  const registroInvalido = () => json({ code: 'registro_invalido', message: 'x' }, 400);

  const guardado = (id: string, local?: string) =>
    movimentos
      .filter((m) => m.metaId === id && (local === undefined || m.local === local))
      .reduce((t, m) => t + (m.tipo === 'aporte' ? m.valor : -m.valor), 0);

  const linha = (m: Meta, comLocais: boolean) => {
    const g = guardado(m.id);
    const atingida = g >= m.alvo;
    const falta = Math.max(0, m.alvo - g);
    const meses = m.prazo === null ? null : Math.max(1, mesesEntre(HOJE.slice(0, 7), m.prazo));
    const locais = [...new Set(movimentos.filter((x) => x.metaId === m.id).map((x) => x.local))]
      .map((local) => ({ local, guardado_centavos: guardado(m.id, local) }))
      .sort((a, b) => b.guardado_centavos - a.guardado_centavos);
    return {
      id: m.id,
      nome: m.nome,
      escopo: m.escopo,
      alvo_centavos: m.alvo,
      guardado_centavos: g,
      falta_centavos: falta,
      percentual: atingida ? 100 : Math.min(99, Math.round((100 * g) / m.alvo)),
      prazo: m.prazo,
      mensal_necessario_centavos: meses === null || falta === 0 ? null : Math.ceil(falta / meses),
      atingida,
      ...(comLocais && { por_local: locais }),
    };
  };

  await page.route('**/api/**', async (rota) => {
    const pedido = rota.request();
    const url = new URL(pedido.url());
    const { pathname } = url;
    const metodo = pedido.method();
    const corpo = metodo === 'GET' ? undefined : (pedido.postDataJSON() as Record<string, unknown> | null);
    if (metodo !== 'GET') escritas.push({ metodo, url: pathname, corpo, cabecalhos: pedido.headers() });

    if (pathname === '/api/sessao') {
      if (!estado.sessaoAtiva) return rota.fulfill(json({ code: 'sessao_expirada', message: 'x' }, 401));
      return rota.fulfill(json(estado.saiuDoLar ? { ...SESSAO, membro: null, lar: null } : SESSAO));
    }
    if (pathname === '/api/sessao/sair-de-todos' && metodo === 'POST') {
      estado.sessaoAtiva = false;
      return rota.fulfill({ status: 204 });
    }
    if (pathname === '/api/lancamentos/dados') return rota.fulfill(json(dados));

    if (pathname === '/api/metas' && metodo === 'GET') {
      const lista = metas.map((m) => linha(m, false));
      lista.sort((a, b) => Number(a.atingida) - Number(b.atingida) || a.nome.localeCompare(b.nome, 'pt-BR'));
      return rota.fulfill(json(lista));
    }
    if (pathname === '/api/metas/locais') {
      return rota.fulfill(
        json([...new Set([...movimentos].sort((a, b) => b.data.localeCompare(a.data)).map((m) => m.local))]),
      );
    }
    const m = /^\/api\/metas\/([^/]+)(?:\/(movimentos))?$/.exec(pathname);
    if (m) {
      const id = m[1]!;
      const meta = metas.find((x) => x.id === id);
      if (metodo === 'PUT' && !m[2]) {
        const c = corpo ?? {};
        const prazo = typeof c.prazo === 'string' ? c.prazo.slice(0, 7) : null;
        if (meta) Object.assign(meta, { nome: c.nome, alvo: c.alvo_centavos, prazo });
        else {
          metas.push({
            id,
            nome: String(c.nome),
            escopo: c.escopo as Meta['escopo'],
            alvo: Number(c.alvo_centavos),
            prazo,
          });
        }
        return rota.fulfill(json({ id }, meta ? 200 : 201));
      }
      if (!meta) return rota.fulfill(json({ code: 'registro_invalido', message: 'x' }, 404));
      if (metodo === 'GET' && !m[2]) return rota.fulfill(json(linha(meta, true)));
      if (metodo === 'GET' && m[2]) {
        const lista = movimentos
          .filter((x) => x.metaId === id)
          .sort((a, b) => b.data.localeCompare(a.data))
          .map((x) => ({
            id: x.id,
            tipo: x.tipo,
            valor_centavos: x.valor,
            data: x.data,
            local: x.local,
            autor: { nome: 'Ana', sou_eu: true },
            ...(x.conta && { conta: { nome: x.conta } }),
          }));
        return rota.fulfill(json(lista));
      }
      if (metodo === 'POST' && m[2]) {
        const c = corpo ?? {};
        const valor = Number(c.valor_centavos);
        const local = String(c.local);
        // CA-09.1: o limite da retirada é o guardado naquele local.
        if (c.tipo === 'retirada' && valor > guardado(id, local)) {
          return rota.fulfill(json({ code: 'retirada_maior_que_guardado', message: 'x' }, 422));
        }
        movimentos.push({
          id: String(c.id),
          metaId: id,
          tipo: c.tipo as Movimento['tipo'],
          valor,
          data: typeof c.data === 'string' ? c.data : HOJE,
          local,
        });
        return rota.fulfill(json({ id: c.id }, 201));
      }
    }

    if (pathname === '/api/lar' && metodo === 'GET') return rota.fulfill(json(lar));
    if (pathname === '/api/lar/convites' && metodo === 'POST') {
      const email = String((corpo ?? {}).email)
        .trim()
        .toLowerCase();
      const expira = new Date(Date.parse(`${HOJE}T15:00:00-03:00`) + 7 * 24 * 3600 * 1000).toISOString();
      lar.convite_pendente = { id: ID_CONVITE, email, expira_em: expira };
      return rota.fulfill(json({ id: ID_CONVITE, email, expira_em: expira }, 201));
    }
    if (pathname === `/api/lar/convites/${ID_CONVITE}` && metodo === 'DELETE') {
      delete lar.convite_pendente;
      return rota.fulfill({ status: 204 });
    }
    // CA-23.14: o titular remove o outro membro ativo; o resto (inclusive quem já saiu) é `registro_invalido`.
    const remover = /^\/api\/lar\/membros\/([^/]+)$/.exec(pathname);
    if (remover && metodo === 'DELETE') {
      const alvo = lar.membros.find((m) => m.id === remover[1]);
      if (!souTitular() || !alvo || alvo.sou_eu) return rota.fulfill(registroInvalido());
      lar.membros = lar.membros.filter((m) => m !== alvo);
      return rota.fulfill({ status: 204 });
    }
    // CA-23.12, CA-23.13: o membro sai; o titular não sai por aqui.
    if (pathname === '/api/lar/sair' && metodo === 'POST') {
      if (souTitular()) return rota.fulfill(registroInvalido());
      estado.saiuDoLar = true;
      return rota.fulfill({ status: 204 });
    }
    return rota.fulfill(json({ code: 'rota_inexistente', message: 'x' }, 404));
  });

  return { escritas, metas, movimentos, lar, estado };
}

/** Fixa o relógio do navegador: o app lê a data de hoje (São Paulo) para a data do movimento e o prazo. */
export async function fixarRelogio(page: Page, instante = '2026-10-09T15:00:00-03:00') {
  await page.clock.setFixedTime(new Date(instante));
}
