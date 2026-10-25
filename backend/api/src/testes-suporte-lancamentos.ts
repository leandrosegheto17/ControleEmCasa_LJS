import { sql } from 'kysely';
import type { OpcoesDoApp } from './app';
import { criarConta, criarForma, larParaCadastros, listar, novoId, type App } from './testes-suporte-cadastros';
import { json, linhasComoOwner, pedir, type Pessoa } from './testes-suporte-lar';

/** Utilitários dos testes de lançamento (etapa 8). Só para testes: fora da varredura de código de produção. */

export { novoId, type App };

interface LinhaCategoria {
  id: string;
  nome: string;
  tipo: 'despesa' | 'receita';
  escopo: 'conjunto' | 'individual';
}

/** Cadastros de um membro prontos para lançar. */
export interface Cadastros {
  conta: string;
  pix: string;
  credito: string;
  /** Categorias iniciais visíveis a ele (RN-17). */
  mercado: string;
  lazer: string;
  salario: string;
}

async function cadastrosDe(app: App, quem: Pessoa, prefixo: string): Promise<Cadastros> {
  const conta = await criarConta(app, quem, { nome: `Conta ${prefixo}`, saldo_inicial_centavos: 100_000 });
  const pix = await criarForma(app, quem, { nome: `Pix ${prefixo}`, tipo: 'pix', conta_id: conta });
  const credito = await criarForma(app, quem, { nome: `Cartão ${prefixo}`, tipo: 'credito', dia_vencimento: 10 });
  const categorias = await listar<LinhaCategoria>(app, '/api/categorias', quem);
  const achar = (nome: string, tipo: string, escopo: string) => {
    const c = categorias.find((x) => x.nome === nome && x.tipo === tipo && x.escopo === escopo);
    if (!c) throw new Error(`categoria ${nome} não encontrada`);
    return c.id;
  };
  return {
    conta,
    pix,
    credito,
    mercado: achar('Mercado', 'despesa', 'conjunto'),
    lazer: achar('Lazer pessoal', 'despesa', 'individual'),
    salario: achar('Salário', 'receita', 'individual'),
  };
}

/** Lar com Ana (titular) e Bruno (membro), cada um com conta, Pix, Cartão (dia 10) e as categorias iniciais. */
export async function larParaLancar(prefixo: string, opcoes: OpcoesDoApp & { agora?: Date } = {}) {
  const base = await larParaCadastros(prefixo, opcoes);
  const ana = await cadastrosDe(base.app, base.titular, 'Ana');
  const bruno = await cadastrosDe(base.app, base.membro, 'Bruno');
  return { ...base, ana, bruno };
}

export interface CorpoDespesa {
  id?: string;
  valor_centavos: number;
  categoria_id: string;
  forma_id: string;
  parcelas?: number;
  data?: string;
  descricao?: string | null;
}

/** Lança uma despesa e devolve o id; falha o teste se não for 201. */
export async function lancarDespesa(app: App, quem: Pessoa, corpo: CorpoDespesa): Promise<string> {
  const id = corpo.id ?? novoId();
  const r = await pedir(app, 'POST', '/api/lancamentos/despesas', quem, { ...corpo, id });
  if (r.status !== 201) throw new Error(`lançar despesa falhou: ${r.status} ${await r.text()}`);
  return id;
}

export async function lancarReceita(
  app: App,
  quem: Pessoa,
  corpo: { id?: string; valor_centavos: number; categoria_id: string; conta_id: string; data?: string },
): Promise<string> {
  const id = corpo.id ?? novoId();
  const r = await pedir(app, 'POST', '/api/lancamentos/receitas', quem, { ...corpo, id });
  if (r.status !== 201) throw new Error(`lançar receita falhou: ${r.status} ${await r.text()}`);
  return id;
}

export async function detalhe<T = Record<string, unknown>>(app: App, quem: Pessoa, id: string): Promise<T> {
  const r = await pedir(app, 'GET', `/api/lancamentos/${id}`, quem);
  if (r.status !== 200) throw new Error(`detalhe falhou: ${r.status} ${await r.text()}`);
  return json<T>(r);
}

export interface ParcelaVista {
  id: string;
  numero: number;
  valor_centavos: number;
  data: string;
  data_ajustada: boolean;
}

/** Parcelas como o owner as vê (inspeção, fora da RLS). */
export async function parcelasNoBanco(lancamentoId: string): Promise<ParcelaVista[]> {
  const r = await linhasComoOwner(
    sql<{ id: string; numero: number; valor: string; data: string; data_ajustada: boolean }>`
      select id, numero::int as numero, valor_centavos::text as valor, data::text as data, data_ajustada
        from app.parcela where lancamento_id = ${lancamentoId} order by numero`,
  );
  return r.map((p) => ({
    id: p.id,
    numero: p.numero,
    valor_centavos: Number(p.valor),
    data: p.data,
    data_ajustada: p.data_ajustada,
  }));
}

/** Parte privada como o owner a vê (inspeção). */
export async function pagamentoNoBanco(lancamentoId: string) {
  const r = await linhasComoOwner(
    sql<{ forma_pagamento_id: string | null; conta_id: string | null; data_operacao: string; dia: number | null }>`
      select forma_pagamento_id, conta_id, data_operacao::text as data_operacao, dia_vencimento_aplicado::int as dia
        from app.lancamento_pagamento where lancamento_id = ${lancamentoId}`,
  );
  return r[0] ?? null;
}

/** Cabeçalho como o owner o vê (inspeção). */
export async function lancamentoNoBanco(id: string) {
  const r = await linhasComoOwner(
    sql<{
      escopo: string;
      categoria_id: string;
      descricao: string | null;
      valor: string;
      num_parcelas: number;
      alterado_por: string | null;
      alterado_em: Date | null;
    }>`
      select escopo, categoria_id, descricao, valor_total_centavos::text as valor, num_parcelas::int as num_parcelas,
             alterado_por, alterado_em
        from app.lancamento where id = ${id}`,
  );
  return r[0] ?? null;
}

/** Id de membro da pessoa (owner). */
export async function membroDe(quem: Pessoa): Promise<string> {
  const r = await linhasComoOwner(
    sql<{ id: string }>`select id from app.membro where usuario_id = ${quem.id} and saiu_em is null`,
  );
  return r[0]!.id;
}

/** Saldo atual da conta pela rota (RN-12). */
export async function saldoDe(app: App, quem: Pessoa, contaId: string): Promise<number> {
  const contas = await listar<{ id: string; saldo_centavos: number }>(app, '/api/contas', quem);
  const c = contas.find((x) => x.id === contaId);
  if (!c) throw new Error('conta não encontrada');
  return c.saldo_centavos;
}
