import { PRECO_PRO_CENTAVOS, type SaidaMeuPlano } from '@controle/contrato';
import { assinaturaInicial, hojeEmSaoPaulo, planoEfetivo, situacaoAoAssinar } from '@controle/dominio';
import { ErroApi } from '../../erros';
import { ErroAsaas } from '../../infraestrutura/asaas';
import {
  buscarAssinaturaAtual,
  gravarAssinatura,
  inserirAssinatura,
  type LinhaAssinatura,
} from '../../infraestrutura/db/repositorios/assinaturas';
import { buscarPorId } from '../../infraestrutura/db/repositorios/usuarios';
import { logar } from '../../log';
import { vinculoDe } from '../lar/comum';
import {
  erroAssinaturaAtiva,
  erroSemAssinatura,
  estadoDe,
  maisAntigaEmAberto,
  situacaoDaCobranca,
  type DepsPlano,
} from './comum';

/**
 * Plano do lar (RN-24; SDD 6.2 "Plano", 8.5; CA-24.6, CA-24.7, CA-24.11; G-31, G-34).
 * Só o titular assina e cancela (a rota recusa o convidado com `registro_invalido` antes de ler o corpo).
 * O CPF/CNPJ entra em `assinar`, vai ao Asaas e morre aqui: não é gravado, devolvido nem registrado em log.
 */

const DESCRICAO_ASSINATURA = 'Controle em Casa Pro (mensal)';

/** A assinatura do lar atual; um lar sem linha (criado antes da etapa 13) ganha uma em `free`, sem trial. */
async function assinaturaDoLar(deps: DepsPlano, travar: boolean): Promise<LinhaAssinatura> {
  const atual = await buscarAssinaturaAtual(deps.tx, travar);
  if (atual) return atual;
  const larId = vinculoDe(deps).larId;
  const inicial = assinaturaInicial(deps.agora, true);
  await inserirAssinatura(deps.tx, { larId, ...inicial, agora: deps.agora });
  const criada = await buscarAssinaturaAtual(deps.tx, travar);
  if (!criada) throw new Error('assinatura_nao_criada');
  return criada;
}

/** Pix da cobrança em aberto, direto do Asaas. Falha do Asaas não derruba a tela: o Pix vem nulo. */
async function pixDe(deps: DepsPlano, cobrancaId: string): Promise<{ copiaCola: string | null; qr: string | null }> {
  try {
    const pix = await deps.asaas.buscarPix(cobrancaId);
    return { copiaCola: pix.copiaCola, qr: pix.qrPngBase64 };
  } catch (erro) {
    if (!(erro instanceof ErroAsaas)) throw erro;
    logar('warn', 'asaas_pix_indisponivel', { motivo: erro.motivo, status: erro.status ?? 0 });
    return { copiaCola: null, qr: null };
  }
}

async function meuPlano(deps: DepsPlano, linha: LinhaAssinatura): Promise<SaidaMeuPlano> {
  const souTitular = vinculoDe(deps).papel === 'titular';
  const saida: SaidaMeuPlano = {
    plano: planoEfetivo(estadoDe(linha), deps.agora),
    situacao: linha.situacao,
    trial_ate: linha.trialAte.toISOString(),
    periodo_ate: linha.periodoAte ? linha.periodoAte.toISOString() : null,
    preco_centavos: PRECO_PRO_CENTAVOS,
    sou_titular: souTitular,
  };
  // O convidado vê só o plano e a validade (PRD-TECNICO §2; G-31).
  const emAberto = linha.cobrancaSituacao === 'pendente' || linha.cobrancaSituacao === 'vencida';
  if (
    souTitular &&
    emAberto &&
    linha.cobrancaId &&
    linha.cobrancaVencimento &&
    linha.cobrancaValorCentavos !== null &&
    linha.situacao !== 'cancelada'
  ) {
    const pix = await pixDe(deps, linha.cobrancaId);
    saida.cobranca = {
      vencimento: linha.cobrancaVencimento,
      valor_centavos: linha.cobrancaValorCentavos,
      situacao: linha.cobrancaSituacao === 'vencida' ? 'vencida' : 'pendente',
      pix_copia_cola: pix.copiaCola,
      qr_png_base64: pix.qr,
    };
  }
  return saida;
}

/** `GET /api/plano` (A): os dois membros; o plano efetivo é calculado agora (CA-24.2: o trial vence sem evento). */
export async function obterPlano(deps: DepsPlano): Promise<SaidaMeuPlano> {
  const atual = await buscarAssinaturaAtual(deps.tx);
  if (atual) return meuPlano(deps, atual);
  // Lar sem linha (criado antes da etapa 13): Free, sem gravar nada numa leitura (o convidado nem poderia gravar).
  const inicial = assinaturaInicial(deps.agora, true);
  return meuPlano(deps, {
    larId: vinculoDe(deps).larId,
    ...inicial,
    periodoAte: null,
    asaasClienteId: null,
    asaasAssinaturaId: null,
    cobrancaId: null,
    cobrancaVencimento: null,
    cobrancaValorCentavos: null,
    cobrancaSituacao: null,
    ultimoEventoEm: null,
  });
}

/**
 * `POST /api/plano/assinar` (titular). Idempotente: com uma assinatura do Asaas já esperando o 1º pagamento (trial
 * ou free), devolve a mesma cobrança, sem criar outra. Ativa ou atrasada: 409 `assinatura_ativa`.
 * Ordem: trava a linha → cliente no Asaas (reaproveitado se o lar já tem) → assinatura Pix mensal de R$ 9,90 com
 * 1º vencimento hoje (SP) → 1ª cobrança e Pix. Queda do Asaas ANTES de a assinatura existir: 503 `indisponivel` (nada
 * gravado). DEPOIS de criada, nada mais falha por causa do Asaas: grava o que tem (a cobrança chega pelo webhook).
 */
export async function assinar(deps: DepsPlano, cpfCnpj: string): Promise<SaidaMeuPlano> {
  const vinculo = vinculoDe(deps);
  const linha = await assinaturaDoLar(deps, true);
  if (linha.situacao === 'ativa' || linha.situacao === 'atrasada') throw erroAssinaturaAtiva();
  if (linha.asaasAssinaturaId && linha.situacao !== 'cancelada') return meuPlano(deps, linha);

  const usuario = await buscarPorId(deps.tx, deps.sessao.usuarioId);
  if (!usuario) throw new ErroApi(401, 'sessao_expirada', 'Sessão expirada. Entre novamente.');
  const clienteId =
    linha.asaasClienteId ??
    (
      await deps.asaas.criarCliente({
        nome: usuario.nome,
        email: deps.sessao.email,
        cpfCnpj,
        referenciaExterna: vinculo.larId,
      })
    ).id;
  const { id: assinaturaId } = await deps.asaas.criarAssinatura({
    clienteId,
    valorCentavos: PRECO_PRO_CENTAVOS,
    vencimento: hojeEmSaoPaulo(deps.agora),
    descricao: DESCRICAO_ASSINATURA,
    referenciaExterna: vinculo.larId,
  });

  let primeira = null;
  try {
    primeira = maisAntigaEmAberto(await deps.asaas.listarCobrancasDaAssinatura(assinaturaId));
  } catch (erro) {
    if (!(erro instanceof ErroAsaas)) throw erro;
    logar('warn', 'asaas_cobranca_indisponivel', { motivo: erro.motivo, status: erro.status ?? 0 });
  }
  const situacaoPrimeira = primeira ? situacaoDaCobranca(primeira.status) : null;
  const nova: LinhaAssinatura = {
    ...linha,
    situacao: situacaoAoAssinar(linha, deps.agora),
    asaasClienteId: clienteId,
    asaasAssinaturaId: assinaturaId,
    cobrancaId: primeira?.id ?? null,
    cobrancaVencimento: primeira?.vencimento ?? null,
    cobrancaValorCentavos: primeira?.valorCentavos ?? null,
    cobrancaSituacao: situacaoPrimeira === 'vencida' ? 'vencida' : primeira ? 'pendente' : null,
    ultimoEventoEm: null,
  };
  await gravarAssinatura(deps.tx, nova, deps.agora);
  return meuPlano(deps, nova);
}

/**
 * `POST /api/plano/cancelar` (titular). Sem assinatura do Asaas, ou já cancelada: 409 `sem_assinatura`. Cancela no
 * Asaas (que apaga as cobranças em aberto; 404 = já não existe, dá no mesmo) e só então grava `cancelada`: o Pro
 * continua até o fim do período pago (CA-24.8). Queda do Asaas: 503 `indisponivel`, nada muda.
 */
export async function cancelar(deps: DepsPlano): Promise<void> {
  const linha = await assinaturaDoLar(deps, true);
  if (!linha.asaasAssinaturaId || linha.situacao === 'cancelada') throw erroSemAssinatura();
  await deps.asaas.cancelarAssinatura(linha.asaasAssinaturaId);
  const emAberto = linha.cobrancaSituacao === 'pendente' || linha.cobrancaSituacao === 'vencida';
  await gravarAssinatura(
    deps.tx,
    {
      ...linha,
      situacao: 'cancelada',
      ...(emAberto
        ? { cobrancaId: null, cobrancaVencimento: null, cobrancaValorCentavos: null, cobrancaSituacao: null }
        : {}),
    },
    deps.agora,
  );
}
