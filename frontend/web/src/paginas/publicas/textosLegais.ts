import { PRAZO_PURGA_DIAS, RETENCAO_BACKUP_DIAS } from '../../comum/conta';

/**
 * Dados do controlador que só o dono do produto conhece (razão social, CNPJ, endereço, contato). Nada aqui é inventado:
 * cada um aparece no texto como marcador visível `[A PREENCHER: ...]`. A lista é conferida por teste; ao preencher um
 * dado, o item sai daqui e do teste de propósito, e a mudança fica no histórico (pendência rastreável, RNF-14).
 */
export const PENDENCIAS_A_PREENCHER = [
  '[A PREENCHER: razão social do controlador]',
  '[A PREENCHER: CNPJ]',
  '[A PREENCHER: endereço]',
  '[A PREENCHER: e-mail de contato para dúvidas e direitos do titular]',
  '[A PREENCHER: nome do encarregado de dados (DPO)]',
  '[A PREENCHER: foro da comarca]',
] as const;

const [RAZAO_SOCIAL, CNPJ, ENDERECO, EMAIL_CONTATO, ENCARREGADO, FORO] = PENDENCIAS_A_PREENCHER;
export { CNPJ, EMAIL_CONTATO, ENCARREGADO, ENDERECO, FORO, RAZAO_SOCIAL };

export const AVISO_RASCUNHO =
  'Texto provisório. Este é um rascunho, sujeito a revisão jurídica antes da publicação do Controle em Casa.';

/** Seção de texto legal: título e parágrafos (ou itens de lista, quando `itens`). */
export interface SecaoLegal {
  titulo: string;
  paragrafos?: readonly string[];
  itens?: readonly string[];
}

export const SECOES_TERMOS: readonly SecaoLegal[] = [
  {
    titulo: '1. O serviço',
    paragrafos: [
      'O Controle em Casa é um aplicativo para registrar e acompanhar as despesas, receitas, orçamento e metas da casa, sozinho ou com mais uma pessoa. Ele organiza o que você digita; não é consultoria financeira nem substitui o extrato do seu banco.',
    ],
  },
  {
    titulo: '2. Conta e responsabilidades',
    paragrafos: [
      'Para usar, você cria uma conta com nome, e-mail e senha e confirma o e-mail. Você é responsável pela veracidade dos dados que registra e pela guarda da sua senha. Avise-nos se achar que alguém acessou a sua conta.',
      'Cada lar tem um titular e, se quiser, uma segunda pessoa convidada. O titular decide quem entra e pode remover quem convidou.',
    ],
  },
  {
    titulo: '3. Planos e pagamento',
    paragrafos: [
      'O plano Free é gratuito. O plano Pro custa R$ 9,90 por mês, pago por Pix por meio do Asaas, e vale para a casa toda: quem paga é o titular. Cada novo lar tem 14 dias de Pro, sem cartão.',
      'Ao cancelar, o Pro continua até o fim do período já pago; depois, a casa passa ao Free, e orçamento e metas ficam só para consulta. Nada do que você registrou é apagado por isso.',
    ],
  },
  {
    titulo: '4. Seus dados',
    paragrafos: [
      'Os dados que você registra são seus. Como os tratamos está na Política de privacidade, que faz parte destes termos.',
    ],
  },
  {
    titulo: '5. Encerrar a conta',
    paragrafos: [
      `Você pode excluir a sua conta quando quiser, em Ajustes, Conta. Confirmada a exclusão pelo link enviado por e-mail, a conta fica bloqueada por ${PRAZO_PURGA_DIAS} dias e depois os dados são apagados. Se você é o titular e há outra pessoa na casa, o lar dela também é encerrado.`,
    ],
  },
  {
    titulo: '6. Disponibilidade e limites',
    paragrafos: [
      'Trabalhamos para manter o serviço no ar, mas ele pode ser alterado ou interrompido para manutenção e não há garantia de funcionamento sem falhas. Nos limites da lei, não respondemos por decisões financeiras tomadas a partir dos dados do app.',
    ],
  },
  {
    titulo: '7. Mudanças nestes termos',
    paragrafos: [
      'Se os termos mudarem de forma relevante, pediremos um novo aceite no seu próximo acesso. A versão que você aceitou fica registrada.',
    ],
  },
  {
    titulo: '8. Quem somos e como falar com a gente',
    paragrafos: [
      `Controlador: ${RAZAO_SOCIAL}, ${CNPJ}, ${ENDERECO}. Contato: ${EMAIL_CONTATO}.`,
      `Estes termos seguem a lei brasileira. Para resolver conflitos, fica eleito o foro de ${FORO}, ressalvados os direitos do consumidor.`,
    ],
  },
];

export const SECOES_PRIVACIDADE: readonly SecaoLegal[] = [
  {
    titulo: '1. Quem é o controlador',
    paragrafos: [
      `O controlador dos seus dados é ${RAZAO_SOCIAL}, ${CNPJ}, ${ENDERECO}. Contato do encarregado de dados: ${ENCARREGADO}, ${EMAIL_CONTATO}.`,
    ],
  },
  {
    titulo: '2. Dados que coletamos',
    itens: [
      'Nome e e-mail do cadastro.',
      'Senha: guardada apenas de forma embaralhada (hash), nunca em texto.',
      'Dados financeiros que você digita: lançamentos, contas, formas de pagamento, categorias, despesas fixas, orçamento e metas. Não pedimos senha de banco nem acesso a contas bancárias.',
      'CPF ou CNPJ do titular, apenas ao assinar o Pro. Ele é repassado ao Asaas para gerar a cobrança e não é guardado por nós.',
      'Dados técnicos de segurança: sessões de acesso, tentativas de login e registros de erro, para proteger a conta e corrigir falhas.',
    ],
  },
  {
    titulo: '3. Para que usamos e em que base legal',
    itens: [
      'Prestar o serviço que você contratou: criar a conta, guardar e calcular os seus registros (execução de contrato, LGPD art. 7º, V).',
      'Cobrar o plano Pro e cumprir obrigações legais ligadas ao pagamento (execução de contrato e obrigação legal, art. 7º, V e II).',
      'Proteger a conta e o serviço contra acesso indevido e abuso, e registrar erros (legítimo interesse, art. 7º, IX).',
      'Guardar o aceite dos termos e da política, com a versão (cumprimento de obrigação legal e exercício regular de direitos, art. 7º, II e VI).',
    ],
  },
  {
    titulo: '4. Com quem compartilhamos',
    paragrafos: [
      'Não vendemos os seus dados e não usamos análise de uso nem anúncios. Usamos fornecedores (operadores) que tratam dados em nosso nome, só para o serviço funcionar:',
    ],
    itens: [
      'Cloudflare: hospedagem e entrega do aplicativo.',
      'Neon: banco de dados, em região do Brasil quando o fornecedor permite.',
      'Resend: envio dos e-mails do serviço (confirmação, recuperação de senha, convite, cobrança, exclusão).',
      'Asaas: cobrança e pagamento por Pix do plano Pro.',
      'Sentry: monitoramento de erros.',
    ],
  },
  {
    titulo: '5. O que a outra pessoa da casa vê',
    paragrafos: [
      'Quem divide o lar com você vê os registros da casa (conjuntos). Os seus registros individuais não são visíveis para ela.',
    ],
  },
  {
    titulo: '6. Por quanto tempo guardamos',
    itens: [
      'Enquanto a conta existir. Você pode excluir a conta quando quiser, em Ajustes, Conta.',
      `Ao confirmar a exclusão pelo link do e-mail, a conta fica bloqueada por ${PRAZO_PURGA_DIAS} dias e, depois, os dados são apagados. Se você é o titular e há outra pessoa na casa, o lar dela também é encerrado e apagado na mesma data, com aviso a ela.`,
      'Contas que nunca confirmaram o e-mail são apagadas em 7 dias.',
      `Cópias de segurança (backups) cifradas guardam os dados por até ${RETENCAO_BACKUP_DIAS} dias depois do apagamento. Passado esse prazo, eles também somem.`,
      'Registros de eventos de pagamento ficam por 12 meses, sem os dados do pagador.',
    ],
  },
  {
    titulo: '7. Seus direitos',
    paragrafos: [
      'Pela LGPD (art. 18), você pode pedir: confirmação de que tratamos seus dados, acesso, correção, anonimização, bloqueio ou eliminação do que for desnecessário, portabilidade, informação sobre com quem compartilhamos e a revogação de consentimento, quando for o caso.',
      `Como exercer: escreva para ${EMAIL_CONTATO}. Acesso e portabilidade são atendidos por e-mail, em formato legível, no prazo da lei. A exclusão você faz sozinho no app, em Ajustes, Conta. Você também pode reclamar à Autoridade Nacional de Proteção de Dados (ANPD).`,
    ],
  },
  {
    titulo: '8. Segurança',
    paragrafos: [
      'A conexão é protegida (HTTPS), a sessão usa um cookie próprio do acesso, sem rastreamento, e os dados de cada lar ficam isolados dos outros no banco de dados. Nenhum sistema é 100% seguro; se houver incidente que afete você, avisaremos como a lei manda.',
    ],
  },
  {
    titulo: '9. Mudanças nesta política',
    paragrafos: [
      'Se esta política mudar de forma relevante, pediremos um novo aceite no seu próximo acesso. A versão que você aceitou fica registrada.',
    ],
  },
];
