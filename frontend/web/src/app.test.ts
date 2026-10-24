import { describe, expect, it } from 'vitest';
import { NOME_APP } from './app';

describe('web', () => {
  it('o nome do app é Controle em Casa', () => expect(NOME_APP).toBe('Controle em Casa'));
});
