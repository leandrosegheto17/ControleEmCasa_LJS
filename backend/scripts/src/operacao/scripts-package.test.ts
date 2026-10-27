import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/** Os runbooks citam estes comandos; sem a entrada no package.json o roteiro quebra em silêncio. */
const RAIZ_PACOTE = join(import.meta.dirname, '../..');
const { scripts } = JSON.parse(readFileSync(join(RAIZ_PACOTE, 'package.json'), 'utf8')) as {
  scripts: Record<string, string>;
};

describe('scripts de operação no package.json', () => {
  it.each(['conferir-banco', 'medir-cpu-publicado', 'medir-retomada-a-frio'])(
    '%s aponta para o arquivo de src/operacao/ de mesmo nome, e ele existe',
    (nome) => {
      const arquivo = `src/operacao/${nome}.ts`;
      const comando = scripts[nome] ?? '';
      const partes = comando.split(' ');
      expect(partes[0]).toBe('tsx');
      expect(partes.at(-1)).toBe(arquivo);
      expect(existsSync(join(RAIZ_PACOTE, arquivo))).toBe(true);
    },
  );
});
