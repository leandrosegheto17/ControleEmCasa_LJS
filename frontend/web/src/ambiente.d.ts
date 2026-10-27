/** Versão do `package.json`, injetada pelo `define` do Vite. */
declare const __VERSAO_APP__: string;

/** Variáveis de build do Sentry (etapa 16; SDD 11.2): sem DSN, o Sentry fica desligado. */
interface ImportMetaEnv {
  readonly VITE_SENTRY_DSN?: string;
  /** SHA do commit publicado (o `deploy.yml` injeta). */
  readonly VITE_SENTRY_RELEASE?: string;
}
