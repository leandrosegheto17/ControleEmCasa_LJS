import { describe, expect, it } from 'vitest';
import {
  AVISO_JA_NAO_ESTA,
  AVISO_MEMBRO_REMOVIDO,
  AVISO_PRECISA_CONEXAO,
  AVISO_SAIU_DA_CASA,
  TEXTO_SAIDA,
  TITULO_SAIDA,
  textoRemocao,
  tituloRemocao,
} from './lar';

/** Os quatro efeitos que a spec exige nas duas confirmações (remover, critério 2; sair, critério 2). */
function confereEfeitos(texto: string) {
  expect(texto).toMatch(/perde o acesso ao que é do conjunto/);
  expect(texto).toMatch(/some em 30 dias/);
  expect(texto).toMatch(/despesas conjuntas .* ficam como "Ex-membro"/);
  expect(texto).toMatch(/só com um novo convite/);
}

describe('rotulos/lar', () => {
  it('remoção: título e texto trazem o nome do membro dado, não um nome fixo', () => {
    for (const nome of ['Bia', 'José Augusto']) {
      expect(tituloRemocao(nome)).toContain(nome);
      expect(textoRemocao(nome)).toContain(nome);
    }
    expect(textoRemocao('Bia')).not.toContain('José Augusto');
  });

  it('remoção: o texto traz os quatro efeitos', () => {
    confereEfeitos(textoRemocao('Bia'));
  });

  it('saída: título e texto, com os quatro efeitos', () => {
    expect(TITULO_SAIDA).toBe('Sair da casa?');
    confereEfeitos(TEXTO_SAIDA);
  });

  it('os quatro avisos têm o texto exato da spec', () => {
    expect(AVISO_MEMBRO_REMOVIDO).toBe('Membro removido');
    expect(AVISO_SAIU_DA_CASA).toBe('Você saiu da casa');
    expect(AVISO_JA_NAO_ESTA).toBe('Este membro já não está na casa');
    expect(AVISO_PRECISA_CONEXAO).toBe('Precisa de conexão para esta ação');
  });
});
