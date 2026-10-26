import { ehErroDados, type ErroDados } from '../erros';
import { lancarDespesa } from '../comandos/lancarDespesa';
import { donoLembrado, obterSessao } from '../sessao';
import { gravarItem, lerItem, lerTodos, removerItem } from './armazem';
import type { ArgsNovoItem, EventoFila, ExibicaoItem, ItemFila } from './tipos';

/** Teto por usuário: acima disso o lançamento é recusado em vez de crescer sem limite no aparelho. */
export const LIMITE_ITENS = 200;

const TRAVA_ENTRE_ABAS = 'controle-em-casa-fila';

const ouvintes = new Set<(evento: EventoFila) => void>();
let emCurso: Promise<void> | undefined;

function emitir(evento: EventoFila) {
  for (const ouvinte of [...ouvintes]) ouvinte(evento);
}

/**
 * O dono é sempre a sessão atual, nunca um parâmetro de quem chama nem algo que venha do item (G-38).
 * Para listar e enfileirar (que precisam funcionar sem rede) vale o `usuario.id` da última resposta de
 * `GET /api/sessao`; para enviar, o servidor é consultado na hora (`rodada`).
 */
function donoAtual(): string | undefined {
  return donoLembrado();
}

function lerErro(e: unknown): ErroDados {
  return ehErroDados(e) ? e : { tipo: 'desconhecido' };
}

async function marcarFalha(item: ItemFila, erro: ErroDados) {
  const motivo = erro.tipo === 'regra' ? erro.codigo : 'desconhecido';
  await gravarItem({ ...item, situacao: 'falhou', motivo });
  emitir({ tipo: 'mudou' });
}

/** Dono confirmado pelo servidor agora; sem rede ou sem sessão não há envio (e nada é tocado). */
async function donoConfirmado(): Promise<string | undefined> {
  try {
    return (await obterSessao())?.usuario.id;
  } catch {
    return undefined;
  }
}

/**
 * Um item por vez, em ordem, só os do usuário da sessão confirmada. Rede, indisponível e autenticação encerram a
 * rodada com o item intacto; falha de regra não bloqueia os demais.
 */
async function rodada() {
  const dono = await donoConfirmado();
  if (!dono) return;
  const pendentes = (await lerTodos()).filter((i) => i.dono === dono && i.situacao === 'aguardando');
  for (const pendente of pendentes) {
    const item = await lerItem(pendente.id);
    if (item?.dono !== dono || item.situacao !== 'aguardando') continue;
    try {
      const resposta = await lancarDespesa(item.args);
      await removerItem(item.id);
      emitir({ tipo: 'enviado', item, resposta });
      emitir({ tipo: 'mudou' });
    } catch (e) {
      const erro = lerErro(e);
      if (erro.tipo === 'rede' || erro.tipo === 'indisponivel' || erro.tipo === 'autenticacao') return;
      await marcarFalha(item, erro);
    }
  }
}

async function esvaziar(): Promise<void> {
  if (emCurso) return emCurso;
  const locks = typeof navigator === 'undefined' ? undefined : navigator.locks;
  const execucao = locks ? Promise.resolve(locks.request(TRAVA_ENTRE_ABAS, rodada)).then(() => undefined) : rodada();
  emCurso = execucao.finally(() => {
    emCurso = undefined;
  });
  return emCurso;
}

/** Grava a chamada completa (com `id` novo) antes de qualquer envio. Não envia. */
async function enfileirar(args: ArgsNovoItem, exibicao: ExibicaoItem): Promise<ItemFila> {
  const dono = donoAtual();
  if (!dono) throw new Error('sem_sessao');
  const meus = (await lerTodos()).filter((i) => i.dono === dono);
  if (meus.length >= LIMITE_ITENS) throw new Error('fila_cheia');
  const id = crypto.randomUUID();
  const item: ItemFila = {
    id,
    dono,
    args: {
      id,
      valor_centavos: args.valor_centavos,
      categoria_id: args.categoria_id,
      forma_id: args.forma_id,
      parcelas: args.parcelas,
      data: args.data,
      descricao: args.descricao,
    },
    exibicao: { ...exibicao },
    criadoEm: Date.now(),
    situacao: 'aguardando',
  };
  await gravarItem(item);
  emitir({ tipo: 'mudou' });
  return item;
}

/** Só os itens do usuário da sessão; os de outro usuário ficam retidos e invisíveis (G-38). */
async function listar(): Promise<ItemFila[]> {
  const dono = donoAtual();
  return dono ? (await lerTodos()).filter((i) => i.dono === dono) : [];
}

/** Único caminho que apaga sem envio: exige confirmação explícita e só do próprio dono. */
async function descartar(id: string, opcoes: { confirmado: true }): Promise<void> {
  if (opcoes?.confirmado !== true) throw new Error('descarte_sem_confirmacao');
  const item = await lerItem(id);
  if (!item) return;
  if (item.dono !== donoAtual()) throw new Error('item_de_outro_usuario');
  await removerItem(id);
  emitir({ tipo: 'mudou' });
}

/** Devolve à espera os itens com falha do dono atual, mantendo `id` (o reenvio segue idempotente). Não envia. */
async function reativarFalhas(): Promise<void> {
  const dono = donoAtual();
  if (!dono) return;
  const falhas = (await lerTodos()).filter((i) => i.dono === dono && i.situacao === 'falhou');
  for (const falha of falhas) {
    const { motivo: _motivo, ...resto } = falha;
    await gravarItem({ ...resto, situacao: 'aguardando' });
  }
  if (falhas.length > 0) emitir({ tipo: 'mudou' });
}

/**
 * Exclusão de conta confirmada (RN-26): apaga os itens que ainda esperam envio do usuário lembrado neste aparelho, pois
 * a conta deixou de existir e o envio seria recusado. Só os itens do próprio dono; os de outro usuário seguem retidos (G-38).
 */
async function apagarDoDono(): Promise<void> {
  const dono = donoAtual();
  if (!dono) return;
  const doDono = (await lerTodos()).filter((i) => i.dono === dono);
  for (const item of doDono) await removerItem(item.id);
  if (doDono.length > 0) emitir({ tipo: 'mudou' });
}

function assinar(ouvinte: (evento: EventoFila) => void): () => void {
  ouvintes.add(ouvinte);
  return () => {
    ouvintes.delete(ouvinte);
  };
}

export const fila = { enfileirar, esvaziar, listar, descartar, reativarFalhas, apagarDoDono, assinar };
