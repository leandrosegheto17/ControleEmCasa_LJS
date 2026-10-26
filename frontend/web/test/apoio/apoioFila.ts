import { fila } from '../../src/dados/fila/fila';

/**
 * Fila de envio do aparelho para os testes de tela: `paginas/` não importa `dados/` (SDD 9.1; `eslint.fronteiras.js`),
 * então as telas testadas a observam por aqui, pela mesma instância que o app usa.
 */
export { fila };

/** Esvazia a fila do usuário lembrado, para cada teste começar sem item de outro. */
export async function limparFila(): Promise<void> {
  for (const item of await fila.listar()) await fila.descartar(item.id, { confirmado: true });
}
