import { readFileSync } from 'node:fs';

const RESPOSTAS = new URL('../fixtures/respostas/', import.meta['url']);

/**
 * Lê uma resposta de `test/fixtures/respostas/`: formas de resposta da API (SDD 6.1), copiadas do legado e conferidas
 * contra o contrato Zod por `test/fixtures.test.ts`. Fonte única das fixtures dos testes de tela e de componente.
 */
export function lerResposta<T = unknown>(nome: string): T {
  return JSON.parse(readFileSync(new URL(nome, RESPOSTAS), 'utf8')) as T;
}
