import 'vitest';

// Valores que o globalSetup (testes/banco-global.ts) entrega aos testes por `inject`.
declare module 'vitest' {
  export interface ProvidedContext {
    urlBancoOwner: string;
    urlBancoApp: string;
    bancoDisponivel: boolean;
  }
}
