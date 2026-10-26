import { clear, createStore, del, get, set } from 'idb-keyval';
import type { SaidaDadosLancamento as DadosLancamento } from '@controle/contrato';
import { registrarLimpeza } from '../aparelho';

/** Banco próprio: a fila de envio mora em outro banco e nunca é tocada por este cache. */
const armazem = createStore('controle-em-casa-cache', 'dados');
const CHAVE = 'dados_lancamento';

export type CacheDadosLancamento = { dados: DadosLancamento; salvoEm: number };

type Registro = CacheDadosLancamento & { usuarioId: string };

export async function salvarCache(usuarioId: string, dados: DadosLancamento): Promise<void> {
  const registro: Registro = { usuarioId, dados, salvoEm: Date.now() };
  await set(CHAVE, registro, armazem);
}

/**
 * Só devolve se o cache for do mesmo usuário. Registro de outro usuário é apagado (só este
 * armazém), para que os dados do primeiro não fiquem em disco quando a sessão acabou sem sair().
 */
export async function lerCache(usuarioId: string): Promise<CacheDadosLancamento | undefined> {
  const registro = await get<Registro>(CHAVE, armazem);
  if (!registro) return undefined;
  if (registro.usuarioId !== usuarioId) {
    await del(CHAVE, armazem);
    return undefined;
  }
  return { dados: registro.dados, salvoEm: registro.salvoEm };
}

/** Sem IndexedDB no ambiente não há o que apagar. */
export async function apagarCache(): Promise<void> {
  if (typeof indexedDB === 'undefined') return;
  await clear(armazem);
}

/** Ao sair ou perder a sessão o aparelho deixa de guardar os cadastros do usuário (G-39). */
registrarLimpeza(apagarCache);
