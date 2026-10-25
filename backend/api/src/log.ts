/**
 * Logger único (G-46). Único lugar autorizado a usar `console`.
 * Só aceita campos escalares escolhidos pelo chamador: nunca e-mail, valor, token, corpo nem IP completo.
 * Por defesa em profundidade, todo texto passa pela limpeza: e-mails e sequências com cara de token
 * (32 ou mais caracteres base64url/hex, como os tokens de 256 bits e seus hashes) viram `[removido]`.
 */
export type CamposDeLog = Record<string, string | number | boolean>;

const EMAIL = /[^\s@"'<>(),;:]+@[^\s@"'<>(),;:]+\.[^\s@"'<>(),;:]+/g;
const TOKEN = /[A-Za-z0-9_-]{32,}/g;
/** O id de correlação (UUID) fica: é ele que liga o log à resposta de erro (G-46). */
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const REMOVIDO = '[removido]';

export function limparTexto(texto: string): string {
  return texto.replace(EMAIL, REMOVIDO).replace(TOKEN, (trecho) => (UUID.test(trecho) ? trecho : REMOVIDO));
}

function limparCampos(campos: CamposDeLog): CamposDeLog {
  const limpos: CamposDeLog = {};
  for (const [chave, valor] of Object.entries(campos)) {
    limpos[limparTexto(chave)] = typeof valor === 'string' ? limparTexto(valor) : valor;
  }
  return limpos;
}

export function logar(nivel: 'info' | 'warn' | 'error', evento: string, campos: CamposDeLog = {}): void {
  const linha = JSON.stringify({ nivel, evento: limparTexto(evento), ...limparCampos(campos) });
  if (nivel === 'error') console.error(linha);
  else if (nivel === 'warn') console.warn(linha);
  else console.info(linha);
}

/**
 * SÓ PARA `AMBIENTE=local` sem `RESEND_API_KEY` (SDD 11.2: "em local, um transporte de console basta"):
 * mostra o link do e-mail no terminal do `wrangler dev` para o desenvolvedor confirmar a conta.
 * Não passa pela limpeza (o link precisa do token) e não mostra o destinatário. Quem escolhe este
 * caminho é `transporteDoAmbiente`, que nunca o usa em `teste` nem em `producao` (testado).
 */
export function exibirLinkLocal(assunto: string, links: string[]): void {
  console.info(JSON.stringify({ nivel: 'info', evento: 'email_local', assunto, links }));
}
