/**
 * Único lugar da API que lê o relógio (SDD 2.2 `relogio/`). Os testes injetam um relógio controlado
 * para provar a inatividade de 15 min, as 12 h absolutas, a janela de bloqueio e a validade dos links.
 */
export type Relogio = () => Date;

export const relogioDoSistema: Relogio = () => new Date();
