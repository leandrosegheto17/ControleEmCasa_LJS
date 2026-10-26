import { hojeEmSaoPaulo, NOME_EX_MEMBRO } from '@controle/dominio';
import type { Kysely } from 'kysely';
import type { Sessao } from '../../env';
import { ErroApi } from '../../erros';
import type { ClienteAsaas } from '../../infraestrutura/asaas';
import { buscarAssinaturaAtual } from '../../infraestrutura/db/repositorios/assinaturas';
import { cancelarPendentesDoLar } from '../../infraestrutura/db/repositorios/convites';
import { abrirPedido, confirmarPedido, convidadoAtivoDoLarAtual } from '../../infraestrutura/db/repositorios/exclusoes';
import { apagarPartePrivadaDoMembro } from '../../infraestrutura/db/repositorios/lancamentos';
import { marcarSaida } from '../../infraestrutura/db/repositorios/membros';
import { apagarDoUsuario } from '../../infraestrutura/db/repositorios/sessoes';
import { descartarFalha, reservarFalha } from '../../infraestrutura/db/repositorios/tentativas';
import { consumirToken, emitirToken, ultimoEmitidoEm } from '../../infraestrutura/db/repositorios/tokens-email';
import { buscarPorId, verificarCredenciais } from '../../infraestrutura/db/repositorios/usuarios';
import type { DB } from '../../infraestrutura/db/tipos';
import { assumirIdentidade } from '../../infraestrutura/db/transacao';
import type { EnviadorDeEmail } from '../../infraestrutura/email';
import { hashEmail, hashIp, type ChaveHmac } from '../../infraestrutura/seguranca/hmac';
import { gerarToken, hashToken, tokenTemFormato } from '../../infraestrutura/seguranca/token';
import { agendarEmail, INTERVALO_REENVIO_MS, linkComToken } from '../acesso/comum';
import { cancelarAssinaturaDoLarDescartado } from '../plano/plano';

/**
 * Exclusão de conta (RN-26; SDD 6.2 "Conta", E-1, E-2; CA-26.1 a CA-26.9; G-49; ADR-013).
 * - Pedir (`POST /api/conta/exclusao`, A0): confere a senha e manda o link. Nada muda na conta (CA-26.1).
 * - Confirmar (`POST /api/conta/exclusao/confirmar`, P): numa transação, consome o token, confirma o pedido com a
 *   purga em 30 dias, revoga todas as sessões e aplica o efeito no lar:
 *   - titular: revoga o convite pendente, avisa o convidado ativo (D1, CA-26.7) e cancela a assinatura no Asaas;
 *   - convidado: sai do lar como na saída voluntária (CA-23.12): a parte privada dos pagamentos some na hora;
 *   - sem lar: nada além.
 * A purga (`backend/scripts/purgar.ts`, owner) apaga os dados em 30 dias.
 */

/** Caminho da tela que lê o token do fragmento e confirma (lote 2 da etapa 14). */
export const CAMINHO_CONFIRMAR_EXCLUSAO = '/confirmar-exclusao';
/** Destino do link do aviso ao membro: o app (o aviso também aparece em `GET /api/sessao`). */
export const CAMINHO_APP = '/app';

export interface DepsExclusao {
  db: Kysely<DB>;
  agora: Date;
  chaveHmac: ChaveHmac;
  email: EnviadorDeEmail;
  urlPublica: string;
  agendar: (trabalho: Promise<unknown>) => void;
  /** Criado só se o lar do titular tiver assinatura no Asaas a cancelar. */
  asaas: () => ClienteAsaas;
}

const erroLinkExpirado = () => new ErroApi(400, 'link_expirado', 'O link expirou ou já foi usado. Peça um novo.');
const erroCredenciais = () => new ErroApi(400, 'credenciais_invalidas', 'Senha incorreta.');

/**
 * Pedido de exclusão (CA-26.1). A senha passa pelo mesmo bloqueio do entrar (5 falhas em 15 min por e-mail ou IP →
 * `muitas_tentativas`; G-20), porque uma sessão roubada não pode testar senhas à vontade. Senha certa: abre o pedido (um
 * em aberto por usuário) e emite o link de 30 min, no máximo um e-mail a cada 2 min (o link novo invalida o anterior).
 */
export async function pedirExclusao(
  deps: DepsExclusao,
  dados: { sessao: Sessao; senha: string; ip: string | null },
): Promise<void> {
  const emailHash = await hashEmail(deps.chaveHmac, dados.sessao.email);
  const ipHash = dados.ip ? await hashIp(deps.chaveHmac, dados.ip) : null;
  const reserva = await reservarFalha(deps.db, { emailHash, ipHash, agora: deps.agora });
  if (reserva.bloqueado) {
    throw new ErroApi(429, 'muitas_tentativas', 'Muitas tentativas. Aguarde alguns minutos e tente de novo.');
  }
  const credenciais = await verificarCredenciais(deps.db, dados.sessao.email, dados.senha);
  if (!credenciais.ok || credenciais.usuario?.id !== dados.sessao.usuarioId) throw erroCredenciais();
  await descartarFalha(deps.db, reserva.id);
  const usuario = credenciais.usuario;

  const ultimo = await ultimoEmitidoEm(deps.db, usuario.id, 'exclusao');
  if (ultimo && deps.agora.getTime() - ultimo.getTime() < INTERVALO_REENVIO_MS) return;

  const token = gerarToken();
  const tokenHash = await hashToken(token);
  await deps.db.transaction().execute(async (trx) => {
    await abrirPedido(trx, usuario.id, deps.agora);
    await emitirToken(trx, { usuarioId: usuario.id, finalidade: 'exclusao', tokenHash, agora: deps.agora });
  });
  agendarEmail(deps, usuario.email, 'exclusao', {
    nome: usuario.nome,
    link: linkComToken(deps.urlPublica, CAMINHO_CONFIRMAR_EXCLUSAO, token),
  });
}

type AvisoAoConvidado = { nome: string; email: string; purgarEm: Date };

/**
 * Confirmação pelo link (CA-26.2, CA-26.7, CA-26.9). Token desconhecido, usado, vencido (30 min) ou de outra
 * finalidade, ou sem pedido em aberto: `link_expirado`, sem efeito. Tudo numa transação: ou a exclusão fica
 * confirmada com todos os efeitos, ou nada muda (o link continua valendo se a falha não foi dele).
 */
export async function confirmarExclusao(deps: DepsExclusao, token: string): Promise<void> {
  if (!tokenTemFormato(token)) throw erroLinkExpirado();
  const tokenHash = await hashToken(token);

  const aviso = await deps.db.transaction().execute(async (trx): Promise<AvisoAoConvidado | null | false> => {
    const usuarioId = await consumirToken(trx, { tokenHash, finalidade: 'exclusao', agora: deps.agora });
    if (!usuarioId) return false;
    const usuario = await buscarPorId(trx, usuarioId);
    if (!usuario) return false;
    const purgarEm = await confirmarPedido(trx, usuarioId, deps.agora);
    if (!purgarEm) return false;
    await apagarDoUsuario(trx, usuarioId);

    // Daqui em diante, como o próprio usuário: as políticas do lar valem como em qualquer rota dele (G-03).
    const sessao: Sessao = { usuarioId, email: usuario.email };
    const vinculo = await assumirIdentidade(trx, sessao);
    if (!vinculo) return null;

    if (vinculo.papel === 'membro') {
      // Mesmo efeito da saída voluntária (CA-23.12, RN-26 "convidado que exclui a conta").
      await apagarPartePrivadaDoMembro(trx, vinculo.membroId);
      const saiu = await marcarSaida(trx, {
        membroId: vinculo.membroId,
        papel: 'membro',
        nome: NOME_EX_MEMBRO,
        agora: deps.agora,
      });
      if (saiu !== 1) throw new Error('saida_falhou');
      return null;
    }

    // Titular (D1): ninguém mais entra num lar que vai ser apagado; o convidado é avisado; o Asaas para de cobrar.
    await cancelarPendentesDoLar(trx, deps.agora);
    const convidado = await convidadoAtivoDoLarAtual(trx);
    // Falha do Asaas não impede a confirmação: fica registrada no log e a purga cancela antes de apagar o lar.
    // O cliente do Asaas só é criado se houver o que cancelar.
    const assinatura = await buscarAssinaturaAtual(trx);
    if (assinatura?.asaasAssinaturaId && assinatura.situacao !== 'cancelada') {
      await cancelarAssinaturaDoLarDescartado({ tx: trx, agora: deps.agora, sessao, vinculo, asaas: deps.asaas() });
    }
    return convidado ? { ...convidado, purgarEm } : null;
  });

  if (aviso === false) throw erroLinkExpirado();
  if (aviso) {
    agendarEmail(deps, aviso.email, 'lar_encerrado', {
      nome: aviso.nome,
      dataPurga: hojeEmSaoPaulo(aviso.purgarEm),
      link: `${deps.urlPublica}${CAMINHO_APP}`,
    });
  }
}
