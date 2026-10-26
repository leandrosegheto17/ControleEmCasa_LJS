/**
 * Domínio puro (ADR-003): regras pequenas, sem I/O, sem relógio global e sem dependência de Worker
 * ou banco. O "hoje" e o instante entram por parâmetro. Agregações ficam em SQL, na API.
 */
export * from './resultado';
export * from './datas';
export * from './centavos';
export * from './parcelas';
export * from './permissoes';
export * from './orcamento';
export * from './metas';
export * from './percentuais';
export * from './fixas';
export * from './validacoes';
export * from './lar';
export * from './cadastros';
export * from './plano';
