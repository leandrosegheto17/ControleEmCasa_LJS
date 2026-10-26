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
  /** Cobrança nova do plano Pro (RN-24): valor, vencimento e o link da tela Meu plano (o Pix fica no app). */
  cobranca_gerada: { nome: string; valorCentavos: number; vencimento: string; link: string };
  /** Pagamento confirmado (RN-24). */
  pagamento_confirmado: { nome: string; valorCentavos: number; link: string };
  /** Cobrança vencida sem pagamento (RN-24, CA-24.9): o Pro continua durante a carência. */
  atraso: { nome: string; vencimento: string; diasCarencia: number; link: string };
  /** Link de confirmação da exclusão da conta (`/confirmar-exclusao#t=<token>`), válido por 30 min (RN-26). */
  exclusao: { nome: string; link: string };
  /**
   * Aviso ao membro de que o titular excluiu a conta (D1, CA-26.7): na data da purga (AAAA-MM-DD) o lar, o conjunto e
   * o individual dele serão apagados. Sem o nome do titular e sem dado financeiro.
   */
  lar_encerrado: { nome: string; dataPurga: string; link: string };
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

/** Centavos em reais no formato brasileiro (990 → "R$ 9,90"). */
function reais(centavos: number): string {
  const [inteiro, fracao] = (Math.round(centavos) / 100).toFixed(2).split('.');
  return `R$ ${(inteiro ?? '0').replace(/\B(?=(\d{3})+(?!\d))/g, '.')},${fracao ?? '00'}`;
}

/** Data AAAA-MM-DD em DD/MM/AAAA. */
function dataBr(data: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(data);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : data;
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
    case 'cobranca_gerada': {
      const d = dados as DadosPorModelo['cobranca_gerada'];
      const valor = reais(d.valorCentavos);
      const vencimento = dataBr(d.vencimento);
      return {
        assunto: `Sua cobrança do ${APP} Pro`,
        texto: `Olá, ${textoSeguro(d.nome)}.

A cobrança do plano Pro de ${valor}, com vencimento em ${vencimento}, já está disponível. Para pagar por Pix, abra a tela Meu plano:
${d.link}`,
        html: pagina(
          [
            `Olá, ${htmlSeguro(d.nome)}.`,
            `A cobrança do plano Pro de ${valor}, com vencimento em ${vencimento}, já está disponível. Para pagar por Pix, abra a tela Meu plano.`,
          ],
          { href: d.link, rotulo: 'Ver meu plano' },
        ),
      };
    }
    case 'pagamento_confirmado': {
      const d = dados as DadosPorModelo['pagamento_confirmado'];
      const valor = reais(d.valorCentavos);
      return {
        assunto: `Pagamento confirmado no ${APP}`,
        texto: `Olá, ${textoSeguro(d.nome)}.

Recebemos o pagamento de ${valor}. O plano Pro do seu lar está ativo.
${d.link}`,
        html: pagina(
          [`Olá, ${htmlSeguro(d.nome)}.`, `Recebemos o pagamento de ${valor}. O plano Pro do seu lar está ativo.`],
          { href: d.link, rotulo: 'Ver meu plano' },
        ),
      };
    }
    case 'atraso': {
      const d = dados as DadosPorModelo['atraso'];
      const vencimento = dataBr(d.vencimento);
      const aviso = `A cobrança do plano Pro com vencimento em ${vencimento} ainda não foi paga. O Pro continua por ${d.diasCarencia} dias depois do vencimento; depois disso, orçamento e metas ficam somente leitura (nada é apagado).`;
      return {
        assunto: `Cobrança em atraso no ${APP}`,
        texto: `Olá, ${textoSeguro(d.nome)}.

${aviso}

Para pagar por Pix, abra a tela Meu plano:
${d.link}`,
        html: pagina([`Olá, ${htmlSeguro(d.nome)}.`, aviso, 'Para pagar por Pix, abra a tela Meu plano.'], {
          href: d.link,
          rotulo: 'Pagar agora',
        }),
      };
    }
    case 'exclusao': {
      const d = dados as DadosPorModelo['exclusao'];
      const aviso =
        'Recebemos o pedido para excluir a sua conta. Para confirmar, abra o link abaixo em até 30 minutos. Depois da confirmação, você sai de todos os aparelhos, não consegue mais entrar e os seus dados são apagados em 30 dias.';
      return {
        assunto: `Confirme a exclusão da sua conta no ${APP}`,
        texto: `Olá, ${textoSeguro(d.nome)}.\n\n${aviso}\n${d.link}\n\nSe não foi você, ignore este e-mail: nada muda na sua conta.`,
        html: pagina(
          [`Olá, ${htmlSeguro(d.nome)}.`, aviso, 'Se não foi você, ignore este e-mail: nada muda na sua conta.'],
          {
            href: d.link,
            rotulo: 'Confirmar a exclusão',
          },
        ),
      };
    }
    case 'lar_encerrado': {
      const d = dados as DadosPorModelo['lar_encerrado'];
      const data = dataBr(d.dataPurga);
      const aviso = `O titular do seu lar excluiu a conta. Em ${data}, o lar será encerrado e apagado por inteiro: os lançamentos e dados conjuntos e também os seus dados individuais (contas, formas de pagamento, lançamentos, orçamentos e metas individuais). Até lá, você continua usando o app normalmente.`;
      const depois = 'Depois dessa data, ao entrar, você começa um lar novo e vazio, como titular.';
      return {
        assunto: `Seu lar no ${APP} será encerrado`,
        texto: `Olá, ${textoSeguro(d.nome)}.\n\n${aviso}\n\n${depois}\n${d.link}`,
        html: pagina([`Olá, ${htmlSeguro(d.nome)}.`, aviso, depois], { href: d.link, rotulo: 'Abrir o app' }),
      };
    }
    default: {
      const nunca: never = modelo;
      throw new Error(`modelo desconhecido: ${String(nunca)}`);
    }
  }
}
