import { dataDoInstante } from '../formatacao/situacaoPlano';
import { Faixa } from './base/Faixa';

/**
 * Aviso global ao convidado cujo titular confirmou a exclusão da conta (RN-26, CA-26.7): o lar e os dados dele nele
 * serão apagados na data da purga (`encerramento.purga_em` de `GET /api/sessao`).
 */
export function FaixaEncerramento({ purgaEm }: { purgaEm: string }) {
  return (
    <Faixa variante="encerramento">
      {`O titular excluiu a conta: este lar e os seus dados nele serão apagados em ${dataDoInstante(purgaEm)}.`}
    </Faixa>
  );
}
