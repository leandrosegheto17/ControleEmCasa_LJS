import 'fake-indexeddb/auto';
import { IDBFactory } from 'fake-indexeddb';
import { createStore, values } from 'idb-keyval';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  A,
  B,
  EXIBICAO,
  RESPOSTA_GRAVADA as RESPOSTA,
  argsDeDespesa as args,
  criarServidorDeSessao,
} from './apoioTeste';

const { lancarDespesa } = vi.hoisted(() => ({ lancarDespesa: vi.fn() }));
const sessaoSimulada = vi.hoisted(() => ({ atual: undefined as undefined | ReturnType<typeof criarServidorDeSessao> }));

vi.mock('../comandos/lancarDespesa', () => ({ lancarDespesa }));
vi.mock('../sessao', () => ({
  obterSessao: () => sessaoSimulada.atual!.obterSessao(),
  donoLembrado: () => sessaoSimulada.atual!.donoLembrado(),
}));

const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type Fila = Awaited<ReturnType<typeof carregarFila>>;

async function carregarFila() {
  vi.resetModules();
  return (await import('./fila')).fila;
}

/** O usuário `id` fica com a sessão (o front consultou `GET /api/sessao`); `null` = sem sessão. */
async function sessaoDe(id: string | null) {
  sessaoSimulada.atual!.estado.usuario = id;
  await sessaoSimulada.atual!.obterSessao().catch(() => undefined);
}

const itensGuardados = () => values(createStore('controle-em-casa-fila', 'itens'));
const descricoesEnviadas = () => lancarDespesa.mock.calls.map(([a]) => (a as { descricao: string }).descricao);
const esperar = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function enfileirarTres(fila: Fila) {
  await fila.enfileirar(args('primeiro'), EXIBICAO);
  await esperar(2);
  await fila.enfileirar(args('segundo'), EXIBICAO);
  await esperar(2);
  await fila.enfileirar(args('terceiro'), EXIBICAO);
}

beforeEach(async () => {
  globalThis.indexedDB = new IDBFactory();
  lancarDespesa.mockReset();
  sessaoSimulada.atual = criarServidorDeSessao();
  await sessaoDe(A);
});

describe('fila.enfileirar', () => {
  it('grava o item completo antes de qualquer envio, com dono, uuid v4 e data', async () => {
    lancarDespesa.mockReturnValue(new Promise(() => {}));
    const fila = await carregarFila();

    const item = await fila.enfileirar(args('Feira'), EXIBICAO);
    void fila.esvaziar();

    const [guardado] = (await itensGuardados()) as Array<{ args: Record<string, unknown>; criadoEm: unknown }>;
    expect(guardado).toMatchObject({
      id: item.id,
      dono: A,
      situacao: 'aguardando',
      exibicao: EXIBICAO,
      args: { ...args('Feira'), id: item.id },
    });
    expect(guardado?.args.id).toMatch(UUID_V4);
    expect(guardado?.args.data).toBe('2026-10-09');
    expect(typeof guardado?.criadoEm).toBe('number');
  });

  it('não envia sozinho', async () => {
    const fila = await carregarFila();
    await fila.enfileirar(args('Feira'), EXIBICAO);
    expect(lancarDespesa).not.toHaveBeenCalled();
  });

  it('sem sessão recusa e não grava', async () => {
    await sessaoDe(null);
    const fila = await carregarFila();

    await expect(fila.enfileirar(args('Feira'), EXIBICAO)).rejects.toBeDefined();
    expect(await itensGuardados()).toHaveLength(0);
  });

  it('o dono vem da sessão, não de quem chama', async () => {
    const fila = await carregarFila();
    await fila.enfileirar({ ...args('Feira'), dono: B } as never, EXIBICAO);
    const [guardado] = (await itensGuardados()) as Array<{ dono: string; args: Record<string, unknown> }>;
    expect(guardado?.dono).toBe(A);
    expect(guardado?.args).not.toHaveProperty('dono');
  });

  it('sem rede ainda guarda, com o dono da última sessão confirmada pelo servidor (offline-first)', async () => {
    const fila = await carregarFila();
    sessaoSimulada.atual!.estado.semRede = true;

    const item = await fila.enfileirar(args('Feira'), EXIBICAO);

    expect(item.dono).toBe(A);
    expect(await itensGuardados()).toHaveLength(1);
  });

  it('recusa acima do limite por dono, sem apagar nada', async () => {
    const fila = await carregarFila();
    const { LIMITE_ITENS } = await import('./fila');
    for (let i = 0; i < LIMITE_ITENS; i += 1) await fila.enfileirar(args(`item ${i}`), EXIBICAO);

    await expect(fila.enfileirar(args('a mais'), EXIBICAO)).rejects.toThrow('fila_cheia');
    expect(await itensGuardados()).toHaveLength(LIMITE_ITENS);

    await sessaoDe(B);
    await expect(fila.enfileirar(args('do B'), EXIBICAO)).resolves.toBeDefined();
  }, 30_000);
});

describe('fila.esvaziar', () => {
  it('envia na ordem de criação, um por vez, e remove só os enviados', async () => {
    let emCurso = 0;
    let maximo = 0;
    lancarDespesa.mockImplementation(async () => {
      emCurso += 1;
      maximo = Math.max(maximo, emCurso);
      await esperar(5);
      emCurso -= 1;
      return RESPOSTA;
    });
    const fila = await carregarFila();
    await enfileirarTres(fila);

    await fila.esvaziar();

    expect(descricoesEnviadas()).toEqual(['primeiro', 'segundo', 'terceiro']);
    expect(maximo).toBe(1);
    expect(await fila.listar()).toHaveLength(0);
  });

  it('envia a chamada completa guardada, com o id do item', async () => {
    lancarDespesa.mockResolvedValue(RESPOSTA);
    const fila = await carregarFila();
    const item = await fila.enfileirar(args('Feira'), EXIBICAO);

    await fila.esvaziar();

    expect(lancarDespesa).toHaveBeenCalledWith({ ...args('Feira'), id: item.id });
  });

  it('autenticação (401) no 2º para a rodada: 1º removido, 2º e 3º aguardando e sem motivo', async () => {
    lancarDespesa.mockResolvedValueOnce(RESPOSTA).mockRejectedValueOnce({ tipo: 'autenticacao' });
    const fila = await carregarFila();
    await enfileirarTres(fila);
    await fila.esvaziar();
    expect(lancarDespesa).toHaveBeenCalledTimes(2);
    const restantes = (await itensGuardados()) as { args: { descricao: string }; situacao: string; motivo?: string }[];
    expect(restantes.map((i) => [i.args.descricao, i.situacao, i.motivo]).sort()).toEqual([
      ['segundo', 'aguardando', undefined],
      ['terceiro', 'aguardando', undefined],
    ]);
  });

  it('rede no 2º para a rodada: 1º removido, 2º e 3º intactos; nova rodada envia os dois', async () => {
    lancarDespesa.mockResolvedValueOnce(RESPOSTA).mockRejectedValueOnce({ tipo: 'rede' }).mockResolvedValue(RESPOSTA);
    const fila = await carregarFila();
    await enfileirarTres(fila);

    await fila.esvaziar();

    expect(descricoesEnviadas()).toEqual(['primeiro', 'segundo']);
    const restantes = await fila.listar();
    expect(restantes.map((i) => i.args.descricao)).toEqual(['segundo', 'terceiro']);
    expect(restantes.map((i) => i.situacao)).toEqual(['aguardando', 'aguardando']);

    await fila.esvaziar();

    expect(descricoesEnviadas()).toEqual(['primeiro', 'segundo', 'segundo', 'terceiro']);
    expect(await fila.listar()).toHaveLength(0);
  });

  it('serviço indisponível deixa o item intacto e para', async () => {
    lancarDespesa.mockRejectedValue({ tipo: 'indisponivel' });
    const fila = await carregarFila();
    await enfileirarTres(fila);

    await fila.esvaziar();

    expect(lancarDespesa).toHaveBeenCalledTimes(1);
    expect((await fila.listar()).map((i) => i.situacao)).toEqual(['aguardando', 'aguardando', 'aguardando']);
  });

  it('rejeição de regra vira falha com o motivo e os seguintes são enviados', async () => {
    lancarDespesa.mockRejectedValueOnce({ tipo: 'regra', codigo: 'registro_invalido' }).mockResolvedValue(RESPOSTA);
    const fila = await carregarFila();
    await enfileirarTres(fila);

    await fila.esvaziar();

    expect(descricoesEnviadas()).toEqual(['primeiro', 'segundo', 'terceiro']);
    const restantes = await fila.listar();
    expect(restantes).toHaveLength(1);
    expect(restantes[0]).toMatchObject({ situacao: 'falhou', motivo: 'registro_invalido' });
    expect(restantes[0]?.args.descricao).toBe('primeiro');
  });

  it('erro desconhecido vira falha "desconhecido" e não é reenviado na rodada seguinte', async () => {
    lancarDespesa.mockRejectedValue({ tipo: 'desconhecido' });
    const fila = await carregarFila();
    await fila.enfileirar(args('Feira'), EXIBICAO);

    await fila.esvaziar();
    await fila.esvaziar();

    expect(lancarDespesa).toHaveBeenCalledTimes(1);
    expect(await fila.listar()).toEqual([expect.objectContaining({ situacao: 'falhou', motivo: 'desconhecido' })]);
  });

  it('resposta perdida: o reenvio usa o mesmo id e a idempotência evita duplicata', async () => {
    const gravadosNoServidor = new Set<string>();
    let perderResposta = true;
    lancarDespesa.mockImplementation(async (a: { id: string }) => {
      const jaExistia = gravadosNoServidor.has(a.id);
      gravadosNoServidor.add(a.id);
      if (perderResposta) {
        perderResposta = false;
        throw { tipo: 'rede' };
      }
      return { ...RESPOSTA, ja_existia: jaExistia };
    });
    const fila = await carregarFila();
    await fila.enfileirar(args('Feira'), EXIBICAO);

    await fila.esvaziar();
    expect(await fila.listar()).toHaveLength(1);

    await fila.esvaziar();

    const ids = lancarDespesa.mock.calls.map(([a]) => (a as { id: string }).id);
    expect(ids).toHaveLength(2);
    expect(ids[1]).toBe(ids[0]);
    expect(gravadosNoServidor.size).toBe(1);
    expect(await fila.listar()).toHaveLength(0);
  });

  it('duas chamadas simultâneas enviam cada item uma vez só', async () => {
    lancarDespesa.mockImplementation(async () => {
      await esperar(5);
      return RESPOSTA;
    });
    const fila = await carregarFila();
    await enfileirarTres(fila);

    await Promise.all([fila.esvaziar(), fila.esvaziar()]);

    expect(descricoesEnviadas()).toEqual(['primeiro', 'segundo', 'terceiro']);
  });

  it('sem rede para consultar a sessão, não envia nada e não mexe na fila', async () => {
    const fila = await carregarFila();
    await fila.enfileirar(args('Feira'), EXIBICAO);
    sessaoSimulada.atual!.estado.semRede = true;

    await fila.esvaziar();

    expect(lancarDespesa).not.toHaveBeenCalled();
    expect(await itensGuardados()).toHaveLength(1);
  });

  it('o servidor diz que não há sessão: não envia nada', async () => {
    const fila = await carregarFila();
    await fila.enfileirar(args('Feira'), EXIBICAO);
    sessaoSimulada.atual!.estado.usuario = null;

    await fila.esvaziar();

    expect(lancarDespesa).not.toHaveBeenCalled();
    expect(await itensGuardados()).toHaveLength(1);
  });
});

describe('fila e o dono dos itens (G-38)', () => {
  it('item de outro usuário não é enviado, nem apagado, nem listado; volta o dono e é enviado', async () => {
    lancarDespesa.mockResolvedValue(RESPOSTA);
    const fila = await carregarFila();
    await fila.enfileirar(args('Do A'), EXIBICAO);

    await sessaoDe(B);
    await fila.esvaziar();

    expect(lancarDespesa).not.toHaveBeenCalled();
    expect(await fila.listar()).toEqual([]);
    expect(await itensGuardados()).toHaveLength(1);

    await sessaoDe(A);
    await fila.esvaziar();

    expect(descricoesEnviadas()).toEqual(['Do A']);
    expect(await itensGuardados()).toHaveLength(0);
  });

  it('P5: A enfileira sem rede, a sessão expira, B entra no mesmo aparelho e nada do A é enviado nem exibido; A volta e a fila sai sem duplicata', async () => {
    lancarDespesa.mockResolvedValue(RESPOSTA);
    const fila = await carregarFila();
    sessaoSimulada.atual!.estado.semRede = true;
    await fila.enfileirar(args('Do A 1'), EXIBICAO);
    await esperar(2);
    await fila.enfileirar(args('Do A 2'), EXIBICAO);

    // Volta a rede, mas a sessão do A expirou: o servidor responde 401.
    sessaoSimulada.atual!.estado.semRede = false;
    await sessaoDe(null);
    await fila.esvaziar();
    expect(lancarDespesa).not.toHaveBeenCalled();
    expect(await fila.listar()).toEqual([]);

    // B entra no mesmo aparelho.
    await sessaoDe(B);
    await fila.enfileirar(args('Do B'), EXIBICAO);
    await fila.esvaziar();
    expect(descricoesEnviadas()).toEqual(['Do B']);
    expect(await fila.listar()).toEqual([]);
    expect(await itensGuardados()).toHaveLength(2);

    // A entra de novo: os itens dele saem uma vez cada.
    lancarDespesa.mockClear();
    await sessaoDe(A);
    expect((await fila.listar()).map((i) => i.args.descricao)).toEqual(['Do A 1', 'Do A 2']);
    await fila.esvaziar();
    await fila.esvaziar();
    expect(descricoesEnviadas()).toEqual(['Do A 1', 'Do A 2']);
    expect(await itensGuardados()).toHaveLength(0);
  });

  it('o corpo enviado não leva dono: só os campos do contrato (o servidor ignora qualquer dono, G-26)', async () => {
    lancarDespesa.mockResolvedValue(RESPOSTA);
    const fila = await carregarFila();
    await fila.enfileirar(args('Do A'), EXIBICAO);

    await fila.esvaziar();

    const corpo = lancarDespesa.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(corpo).not.toHaveProperty('dono');
    expect(Object.keys(corpo).sort()).toEqual([
      'categoria_id',
      'data',
      'descricao',
      'forma_id',
      'id',
      'parcelas',
      'valor_centavos',
    ]);
  });
});

describe('fila.descartar', () => {
  it('sem confirmação lança e mantém o item', async () => {
    const fila = await carregarFila();
    const item = await fila.enfileirar(args('Feira'), EXIBICAO);

    await expect(fila.descartar(item.id, {} as never)).rejects.toBeDefined();
    await expect(fila.descartar(item.id, undefined as never)).rejects.toBeDefined();

    expect(await fila.listar()).toHaveLength(1);
  });

  it('com { confirmado: true } remove', async () => {
    const fila = await carregarFila();
    const item = await fila.enfileirar(args('Feira'), EXIBICAO);

    await fila.descartar(item.id, { confirmado: true });

    expect(await fila.listar()).toHaveLength(0);
  });

  it('não descarta item de outro usuário', async () => {
    const fila = await carregarFila();
    const item = await fila.enfileirar(args('Do A'), EXIBICAO);

    await sessaoDe(B);
    await fila.descartar(item.id, { confirmado: true }).catch(() => undefined);

    expect(await itensGuardados()).toHaveLength(1);
  });
});

describe('fila.reativarFalhas', () => {
  const ERRO_REGRA = { tipo: 'regra', codigo: 'categoria_arquivada' };

  async function falharTudo(fila: Fila) {
    lancarDespesa.mockRejectedValue(ERRO_REGRA);
    await fila.esvaziar();
    lancarDespesa.mockReset();
  }

  it('volta os itens com falha do dono atual para "aguardando" e limpa o motivo', async () => {
    const fila = await carregarFila();
    await fila.enfileirar(args('Padaria'), EXIBICAO);
    await fila.enfileirar(args('Feira'), EXIBICAO);
    await falharTudo(fila);
    expect((await fila.listar()).map((i) => i.situacao)).toEqual(['falhou', 'falhou']);

    await fila.reativarFalhas();

    const itens = await fila.listar();
    expect(itens.map((i) => i.situacao)).toEqual(['aguardando', 'aguardando']);
    itens.forEach((i) => expect(i.motivo).toBeUndefined());
  });

  it('não mexe nos itens de outro dono', async () => {
    const fila = await carregarFila();
    await sessaoDe(B);
    await fila.enfileirar(args('Do B'), EXIBICAO);
    await falharTudo(fila);

    await sessaoDe(A);
    await fila.enfileirar(args('Do A'), EXIBICAO);
    await falharTudo(fila);

    await fila.reativarFalhas();
    expect((await fila.listar()).map((i) => i.situacao)).toEqual(['aguardando']);

    await sessaoDe(B);
    const doB = await fila.listar();
    expect(doB).toHaveLength(1);
    expect(doB[0]?.situacao).toBe('falhou');
    expect(doB[0]?.motivo).toBe('categoria_arquivada');
  });

  it('não envia nada sozinha e mantém o mesmo id (o reenvio continua idempotente)', async () => {
    const fila = await carregarFila();
    const item = await fila.enfileirar(args('Padaria'), EXIBICAO);
    await falharTudo(fila);

    await fila.reativarFalhas();

    expect(lancarDespesa).not.toHaveBeenCalled();
    const [depois] = await fila.listar();
    expect(depois?.id).toBe(item.id);
    expect(depois?.args.id).toBe(item.args.id);
    expect(depois?.dono).toBe(A);
  });

  it('sem sessão, não reativa nada', async () => {
    const fila = await carregarFila();
    await fila.enfileirar(args('Padaria'), EXIBICAO);
    await falharTudo(fila);

    await sessaoDe(null);
    await fila.reativarFalhas();

    await sessaoDe(A);
    expect((await fila.listar())[0]?.situacao).toBe('falhou');
  });
});

describe('fila.assinar', () => {
  it('avisa o envio com a resposta do servidor', async () => {
    lancarDespesa.mockResolvedValue(RESPOSTA);
    const fila = await carregarFila();
    const item = await fila.enfileirar(args('Feira'), EXIBICAO);
    const ouvinte = vi.fn();
    fila.assinar(ouvinte);

    await fila.esvaziar();

    expect(ouvinte).toHaveBeenCalledWith(
      expect.objectContaining({ tipo: 'enviado', resposta: RESPOSTA, item: expect.objectContaining({ id: item.id }) }),
    );
  });

  it('cancelar a assinatura para de avisar', async () => {
    lancarDespesa.mockResolvedValue(RESPOSTA);
    const fila = await carregarFila();
    const ouvinte = vi.fn();
    const cancelar = fila.assinar(ouvinte);
    cancelar();

    await fila.enfileirar(args('Feira'), EXIBICAO);
    await fila.esvaziar();

    expect(ouvinte).not.toHaveBeenCalled();
  });
});
