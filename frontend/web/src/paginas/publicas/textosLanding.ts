/** Textos da landing (PRD §3 e §5.3). O preço e o trial seguem RN-24: Pro R$ 9,90/mês, 14 dias sem cartão. */

export const PROPOSTA_DE_VALOR = 'Saiba quanto a casa gasta de verdade, sem expor o que é só seu.';
export const SUBTITULO_LANDING =
  'O Controle em Casa é o app de finanças para quem divide a casa: lance um gasto em segundos, até sem internet, e veja o total do casal e o seu individual no mês.';
export const DESCRICAO_LANDING =
  'Controle em Casa: lance gastos em segundos, veja o total do casal e o seu individual, com orçamento e metas. Comece grátis, com 14 dias de Pro sem cartão.';

export const PASSOS_COMO_FUNCIONA = [
  {
    titulo: 'Crie a conta e a casa',
    texto: 'Cadastre-se grátis, confirme o e-mail e convide a outra pessoa da casa. Cada um entra com a própria conta.',
  },
  {
    titulo: 'Lance os gastos',
    texto:
      'Registre uma despesa em poucos toques, inclusive sem internet: ela fica guardada e vai sozinha quando a rede volta.',
  },
  {
    titulo: 'Acompanhe o mês',
    texto: 'Veja o total da casa, o seu individual, o crédito parcelado já comprometido, o orçamento e as metas.',
  },
] as const;

export const PLANOS = [
  {
    nome: 'Free',
    preco: 'R$ 0',
    periodo: 'para sempre',
    destaque: false,
    itens: [
      'Lançamentos, despesas fixas e resumo do mês',
      'Contas, formas de pagamento e categorias',
      'Convite para a segunda pessoa da casa',
      'Orçamento e metas só para consulta',
    ],
  },
  {
    nome: 'Pro',
    preco: 'R$ 9,90',
    periodo: 'por mês, no Pix',
    destaque: true,
    itens: [
      'Tudo do Free',
      'Orçamento por categoria e metas de poupança',
      '14 dias de teste, sem cartão',
      'Quem paga é o titular; a outra pessoa da casa usa o Pro sem pagar',
    ],
  },
] as const;
