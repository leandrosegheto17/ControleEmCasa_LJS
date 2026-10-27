import {
  BrowserClient,
  breadcrumbsIntegration,
  browserApiErrorsIntegration,
  captureException,
  dedupeIntegration,
  defaultStackParser,
  getCurrentScope,
  globalHandlersIntegration,
  httpContextIntegration,
  linkedErrorsIntegration,
  makeFetchTransport,
  type BrowserOptions,
} from '@sentry/react';

/**
 * Só o que o app usa do `@sentry/react`, num módulo próprio carregado por `import()` preguiçoso: o bundler descarta o
 * resto do SDK. O cliente é montado à mão (forma documentada pelo Sentry para ambientes compartilhados), com as
 * integrações listadas aqui: erros globais, migalhas (passam pela limpeza), erros de APIs do navegador, erros
 * encadeados, deduplicação e o contexto HTTP da página (também limpo). Sem sessões, tracing nem replay.
 */
export function init(opcoes: BrowserOptions): void {
  const cliente = new BrowserClient({
    ...opcoes,
    transport: opcoes.transport ?? makeFetchTransport,
    stackParser: defaultStackParser,
    integrations: [
      globalHandlersIntegration(),
      breadcrumbsIntegration(),
      browserApiErrorsIntegration(),
      linkedErrorsIntegration(),
      dedupeIntegration(),
      httpContextIntegration(),
    ],
  });
  getCurrentScope().setClient(cliente);
  cliente.init();
}

export { captureException };
