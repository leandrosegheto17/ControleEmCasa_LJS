import type { EntradaCriarLar, SaidaLar, SaidaLarDetalhe } from '@controle/contrato';
import {
  assinaturaInicial,
  CATEGORIAS_INICIAIS_CONJUNTAS,
  CATEGORIAS_INICIAIS_INDIVIDUAIS,
  NOME_EX_MEMBRO,
  nomeLarPadrao,
} from '@controle/dominio';
import { ErroApi } from '../../erros';
import { inserirAssinatura, marcarTrialUsado, trialJaUsado } from '../../infraestrutura/db/repositorios/assinaturas';
import { inserirCategorias } from '../../infraestrutura/db/repositorios/categorias';
import { buscarPendenteDoLar } from '../../infraestrutura/db/repositorios/convites';
import {
  buscarLarAtual,
  inserirLar,
  renomearLarAtual,
  travarVinculoDoUsuario,
} from '../../infraestrutura/db/repositorios/lares';
import { apagarPartePrivadaDoMembro } from '../../infraestrutura/db/repositorios/lancamentos';
import { inserirMembro, listarAtivosDoLar, marcarSaida } from '../../infraestrutura/db/repositorios/membros';
import { buscarPorId } from '../../infraestrutura/db/repositorios/usuarios';
import { derivarVinculo } from '../../infraestrutura/db/transacao';
import { erroRegistroInvalido, erroTitularObrigatorio, vinculoDe, type DepsLar } from './comum';

/**
 * Primeiro acesso (RN-22; SDD 6.1 #3 `POST /api/lar`). Idempotente: quem já tem lar recebe o lar atual (200).
 * Cria o lar, o titular, as categorias iniciais (6 conjuntas + 7 individuais; RN-17) e a assinatura (RN-24): `trial`
 * de 14 dias (CA-22.1, CA-24.1), ou `free` para quem já foi titular com trial (CA-24.10; o trial fica marcado no
 * usuário). A trava por usuário garante um único lar mesmo com dois primeiros acessos simultâneos (CA-22.3).
 */
export async function criarLar(deps: DepsLar, entrada: EntradaCriarLar): Promise<{ criado: boolean; lar: SaidaLar }> {
  const { tx, sessao, agora } = deps;
  await travarVinculoDoUsuario(tx, sessao.usuarioId);
  const atual = await derivarVinculo(tx, sessao.usuarioId);
  if (atual) {
    const lar = await buscarLarAtual(tx);
    if (!lar) throw new Error('vinculo_sem_lar');
    return { criado: false, lar };
  }

  const usuario = await buscarPorId(tx, sessao.usuarioId);
  if (!usuario) throw new ErroApi(401, 'sessao_expirada', 'Sessão expirada. Entre novamente.');
  const nome = entrada.nome ?? nomeLarPadrao(usuario.nome);
  const larId = await inserirLar(tx, { nome, criadoPor: sessao.usuarioId, agora });
  await inserirMembro(tx, { larId, usuarioId: sessao.usuarioId, nome: usuario.nome, papel: 'titular', agora });
  const vinculo = await derivarVinculo(tx, sessao.usuarioId);
  if (!vinculo) throw new Error('vinculo_nao_derivado');
  await inserirCategorias(tx, { larId, donoId: null, categorias: CATEGORIAS_INICIAIS_CONJUNTAS });
  await inserirCategorias(tx, { larId, donoId: vinculo.membroId, categorias: CATEGORIAS_INICIAIS_INDIVIDUAIS });
  const assinatura = assinaturaInicial(agora, await trialJaUsado(tx, sessao.usuarioId));
  await inserirAssinatura(tx, { larId, ...assinatura, agora });
  if (assinatura.situacao === 'trial') await marcarTrialUsado(tx, sessao.usuarioId, agora);
  return { criado: true, lar: { id: larId, nome } };
}

/** `GET /api/lar` (SDD 6.2): o lar, os membros ativos e, só para o titular, o convite pendente. */
export async function detalheLar(deps: DepsLar): Promise<SaidaLarDetalhe> {
  const vinculo = vinculoDe(deps);
  const lar = await buscarLarAtual(deps.tx);
  if (!lar) throw new Error('vinculo_sem_lar');
  const membros = await listarAtivosDoLar(deps.tx);
  const detalhe: SaidaLarDetalhe = {
    lar,
    membros: membros.map((m) => ({ id: m.id, nome: m.nome, papel: m.papel, sou_eu: m.id === vinculo.membroId })),
  };
  if (vinculo.papel === 'titular') {
    const pendente = await buscarPendenteDoLar(deps.tx, deps.agora);
    if (pendente) {
      detalhe.convite_pendente = { id: pendente.id, email: pendente.email, expira_em: pendente.expiraEm.toISOString() };
    }
  }
  return detalhe;
}

/** `PATCH /api/lar` (titular). Membro → `titular_obrigatorio` (PRD-TECNICO 1.1: ação só do titular). */
export async function renomearLar(deps: DepsLar, nome: string): Promise<void> {
  const vinculo = vinculoDe(deps);
  if (vinculo.papel !== 'titular') throw erroTitularObrigatorio();
  if ((await renomearLarAtual(deps.tx, nome)) !== 1) throw new Error('lar_nao_renomeado');
}

/**
 * `DELETE /api/lar/membros/:id` (titular; CA-23.14): remove o convidado com o mesmo efeito da saída (CA-23.12).
 * Não titular, o próprio titular, membro de outro lar, inexistente ou que já saiu: `registro_invalido`.
 * SPEC_DEVIATION (decisão do usuário de 2026-10-25, etapa 8): o CA-23.12 apaga a parte privada dos pagamentos
 * (`lancamento_pagamento`) do membro na hora; na REMOÇÃO pelo titular ela fica até a purga de 30 dias pela role
 * owner (etapa 14), porque a RLS só do dono (G-10) não deixa o titular apagá-la e a RLS não muda. Depois da saída,
 * o id daquele membro nunca mais é o `app.membro_id` de ninguém: a linha fica inacessível à API até a purga.
 * Pendência da etapa 14: a purga apaga `lancamento_pagamento` dos membros removidos.
 */
export async function removerMembro(deps: DepsLar, membroId: string): Promise<void> {
  const vinculo = vinculoDe(deps);
  if (vinculo.papel !== 'titular' || membroId === vinculo.membroId) throw erroRegistroInvalido();
  const afetados = await marcarSaida(deps.tx, { membroId, papel: 'membro', nome: NOME_EX_MEMBRO, agora: deps.agora });
  if (afetados !== 1) throw erroRegistroInvalido();
}

/**
 * `POST /api/lar/sair` (membro; CA-23.12, CA-23.13): o convidado sai; no próximo acesso cai no primeiro acesso.
 * O titular não sai por aqui: `registro_invalido` (decisão desta etapa; ver ADR-009).
 * A parte privada dos pagamentos dele (`lancamento_pagamento`) é apagada na hora (CA-23.12): as conjuntas que ele
 * pagou ficam no lar com o pagador "Ex-membro". Os movimentos de meta conjunta dele ficam com o autor "Ex-membro"
 * (o nome é trocado abaixo); o movimento de CONTA ligado a eles é imutável pelo grant (SDD 4) e do dono, então
 * fica inacessível à API (ninguém mais será o dono) e some na purga de 30 dias, com o individual (etapa 14).
 * `GET /api/metas/:id/movimentos` só devolve `conta` ao próprio autor: a conta nunca aparece para ninguém.
 */
export async function sairDoLar(deps: DepsLar): Promise<void> {
  const vinculo = vinculoDe(deps);
  if (vinculo.papel !== 'membro') throw erroRegistroInvalido();
  await apagarPartePrivadaDoMembro(deps.tx, vinculo.membroId);
  const afetados = await marcarSaida(deps.tx, {
    membroId: vinculo.membroId,
    papel: 'membro',
    nome: NOME_EX_MEMBRO,
    agora: deps.agora,
  });
  if (afetados !== 1) throw erroRegistroInvalido();
}
