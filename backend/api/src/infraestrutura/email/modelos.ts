/**
 * Modelos de e-mail transacional (SDD 2.2). Todo campo vindo do usuário é escapado no HTML e nunca vira link
 * (G-36, TM-RES-02): só os links montados pela API (a partir de `URL_PUBLICA`) são clicáveis.
 */
export interface DadosPorModelo {
  /** Link de confirmação do cadastro (`/confirmar#t=<token>`), válido por 30 min. */
  confirmacao: { nome: string; link: string };
  /** Link de redefinição de senha (`/redefinir-senha#t=<token>`), válido por 30 min. */
  recuperacao: { nome: string; link: string };
  /** Aviso a quem já tem conta e tentou se cadastrar de novo (anti-enumeração, RN-19). */
  conta_existente: { linkEntrar: string; linkRecuperar: string };
  /** Convite para o lar (`/convite#t=<token>`), válido por 7 dias. Só o nome do titular e o link (RN-23). */
  convite: { nomeTitular: string; link: string };
}

export type ModeloEmail = keyof DadosPorModelo;

export interface ConteudoEmail {
  assunto: string;
  texto: string;
  html: string;
}

const APP = 'Controle em Casa';

export function escaparHtml(texto: string): string {
  return texto
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Texto do usuário em e-mail de texto puro: sem quebra de linha e com os pontos de um endereço quebrados
 * por um espaço invisível, para o cliente de e-mail não transformar "site.com" em link (G-36).
 */
const ESPACO_INVISIVEL = String.fromCharCode(0x200b);

function textoSeguro(texto: string): string {
  return texto
    .replace(/[\r\n]+/g, ' ')
    .replace(/\./g, `.${ESPACO_INVISIVEL}`)
    .replace(/:\/\//g, `:${ESPACO_INVISIVEL}//`);
}

function htmlSeguro(texto: string): string {
  return escaparHtml(textoSeguro(texto));
}

function pagina(paragrafos: string[], link: { href: string; rotulo: string }): string {
  const corpo = paragrafos.map((p) => `<p>${p}</p>`).join('');
  return `<!doctype html><html lang="pt-BR"><body>${corpo}<p><a href="${escaparHtml(link.href)}">${escaparHtml(link.rotulo)}</a></p><p>${APP}</p></body></html>`;
}

export function montarConteudo<M extends ModeloEmail>(modelo: M, dados: DadosPorModelo[M]): ConteudoEmail {
  switch (modelo) {
    case 'confirmacao': {
      const d = dados as DadosPorModelo['confirmacao'];
      return {
        assunto: `Confirme seu e-mail no ${APP}`,
        texto: `Olá, ${textoSeguro(d.nome)}.\n\nPara ativar sua conta, abra o link abaixo em até 30 minutos:\n${d.link}\n\nSe não foi você, ignore este e-mail.`,
        html: pagina([`Olá, ${htmlSeguro(d.nome)}.`, 'Para ativar sua conta, abra o link abaixo em até 30 minutos.'], {
          href: d.link,
          rotulo: 'Confirmar e-mail',
        }),
      };
    }
    case 'recuperacao': {
      const d = dados as DadosPorModelo['recuperacao'];
      return {
        assunto: `Redefinir sua senha no ${APP}`,
        texto: `Olá, ${textoSeguro(d.nome)}.\n\nPara criar uma senha nova, abra o link abaixo em até 30 minutos:\n${d.link}\n\nSe não foi você, ignore este e-mail: sua senha continua a mesma.`,
        html: pagina(
          [`Olá, ${htmlSeguro(d.nome)}.`, 'Para criar uma senha nova, abra o link abaixo em até 30 minutos.'],
          { href: d.link, rotulo: 'Redefinir senha' },
        ),
      };
    }
    case 'conta_existente': {
      const d = dados as DadosPorModelo['conta_existente'];
      return {
        assunto: `Você já tem conta no ${APP}`,
        texto: `Alguém tentou criar uma conta com este e-mail, mas ele já está cadastrado.\n\nPara entrar: ${d.linkEntrar}\nEsqueceu a senha? ${d.linkRecuperar}\n\nSe não foi você, ignore este e-mail.`,
        html: pagina(
          [
            'Alguém tentou criar uma conta com este e-mail, mas ele já está cadastrado.',
            `Esqueceu a senha? <a href="${escaparHtml(d.linkRecuperar)}">Recuperar o acesso</a>.`,
          ],
          { href: d.linkEntrar, rotulo: 'Entrar' },
        ),
      };
    }
    case 'convite': {
      const d = dados as DadosPorModelo['convite'];
      // O nome do titular fica fora do assunto: o assunto não passa pela limpeza de texto (TM-RES-02).
      return {
        assunto: `Você recebeu um convite no ${APP}`,
        texto: `${textoSeguro(d.nomeTitular)} convidou você para organizar as contas da casa juntos no ${APP}.

Para aceitar, abra o link abaixo em até 7 dias (entre ou crie a conta com este mesmo e-mail):
${d.link}

Se não conhece quem convidou, ignore este e-mail.`,
        html: pagina(
          [
            `${htmlSeguro(d.nomeTitular)} convidou você para organizar as contas da casa juntos no ${APP}.`,
            'Para aceitar, abra o link abaixo em até 7 dias (entre ou crie a conta com este mesmo e-mail).',
          ],
          { href: d.link, rotulo: 'Ver o convite' },
        ),
      };
    }
    default: {
      const nunca: never = modelo;
      throw new Error(`modelo desconhecido: ${String(nunca)}`);
    }
  }
}
