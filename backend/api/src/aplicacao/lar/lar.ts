import type { EntradaCriarLar, SaidaLar, SaidaLarDetalhe } from '@controle/contrato';
import {
  CATEGORIAS_INICIAIS_CONJUNTAS,
  CATEGORIAS_INICIAIS_INDIVIDUAIS,
  NOME_EX_MEMBRO,
  nomeLarPadrao,
} from '@controle/dominio';
import { ErroApi } from '../../erros';
import { inserirCategorias } from '../../infraestrutura/db/repositorios/categorias';
import { buscarPendenteDoLar } from '../../infraestrutura/db/repositorios/convites';
import {
  buscarLarAtual,
  inserirLar,
  renomearLarAtual,
  travarVinculoDoUsuario,
} from '../../infraestrutura/db/repositorios/lares';
import { inserirMembro, listarAtivosDoLar, marcarSaida } from '../../infraestrutura/db/repositorios/membros';
import { buscarPorId } from '../../infraestrutura/db/repositorios/usuarios';
import { derivarVinculo } from '../../infraestrutura/db/transacao';
import { erroRegistroInvalido, erroTitularObrigatorio, vinculoDe, type DepsLar } from './comum';

/**
 * Primeiro acesso (RN-22; SDD 6.1 #3 `POST /api/lar`). Idempotente: quem já tem lar recebe o lar atual (200).
 * Cria o lar, o titular e as categorias iniciais (6 conjuntas + 7 individuais; RN-17). A trava por usuário
 * garante um único lar mesmo com dois primeiros acessos simultâneos (CA-22.3).
 * SPEC_DEVIATION: o SDD (§6.1 #3) e o CA-22.1 também criam a assinatura `trial`; a tabela `assinatura` é da
 * etapa 13 (PLANO), que acrescenta o trial a este mesmo caso de uso.
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
 * As tabelas de negócio das etapas 7 a 10 (lançamento_pagamento, movimento de meta) acrescentam aqui o
 * apagamento da parte privada; o individual é purgado em 30 dias pela purga (etapa 14).
 */
export async function sairDoLar(deps: DepsLar): Promise<void> {
  const vinculo = vinculoDe(deps);
  if (vinculo.papel !== 'membro') throw erroRegistroInvalido();
  const afetados = await marcarSaida(deps.tx, {
    membroId: vinculo.membroId,
    papel: 'membro',
    nome: NOME_EX_MEMBRO,
    agora: deps.agora,
  });
  if (afetados !== 1) throw erroRegistroInvalido();
}
