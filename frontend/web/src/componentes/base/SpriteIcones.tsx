/** Sprite com os símbolos dos ícones; montado uma vez na raiz e referenciado por <Icone>. */
export function SpriteIcones() {
  return (
    <svg width="0" height="0" aria-hidden="true" style={{ position: 'absolute' }}>
      <symbol id="i-adicionar" viewBox="0 0 24 24">
        <rect x="4" y="4" width="16" height="16" rx="3" />
        <path d="M12 8v8M8 12h8" />
      </symbol>
      <symbol id="i-ajustes" viewBox="0 0 24 24">
        <circle cx="12" cy="12" r="3" />
        <path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9 7 7M17 17l2.1 2.1M4.9 19.1 7 17M17 7l2.1-2.1" />
      </symbol>
      <symbol id="i-alerta" viewBox="0 0 24 24">
        <path d="M12 3 2 20h20L12 3z" />
        <path d="M12 10v4M12 17h.01" />
      </symbol>
      <symbol id="i-alvo" viewBox="0 0 24 24">
        <circle cx="12" cy="12" r="9" />
        <circle cx="12" cy="12" r="5" />
        <circle cx="12" cy="12" r="1" />
      </symbol>
      <symbol id="i-aviso" viewBox="0 0 24 24">
        <circle cx="12" cy="12" r="9" />
        <path d="M12 8v5M12 16h.01" />
      </symbol>
      <symbol id="i-baixo" viewBox="0 0 24 24">
        <path d="m6 9 6 6 6-6" />
      </symbol>
      <symbol id="i-banco" viewBox="0 0 24 24">
        <path d="M12 3 3 8h18L12 3zM5 10v8M9.5 10v8M14.5 10v8M19 10v8M3 21h18" />
      </symbol>
      <symbol id="i-busca" viewBox="0 0 24 24">
        <circle cx="11" cy="11" r="7" />
        <path d="m20 20-4-4" />
      </symbol>
      <symbol id="i-calendario" viewBox="0 0 24 24">
        <rect x="3" y="5" width="18" height="16" rx="2" />
        <path d="M3 10h18M8 3v4M16 3v4" />
      </symbol>
      <symbol id="i-cartao" viewBox="0 0 24 24">
        <rect x="2" y="5" width="20" height="14" rx="2" />
        <path d="M2 10h20" />
      </symbol>
      <symbol id="i-casa" viewBox="0 0 24 24">
        <path d="M3 10.5 12 3l9 7.5" />
        <path d="M5 9.5V21h14V9.5" />
        <path d="M10 21v-6h4v6" />
      </symbol>
      <symbol id="i-compartilhar" viewBox="0 0 24 24">
        <path d="M12 3v12M8 7l4-4 4 4" />
        <path d="M5 12v8h14v-8" />
      </symbol>
      <symbol id="i-dir" viewBox="0 0 24 24">
        <path d="m9 18 6-6-6-6" />
      </symbol>
      <symbol id="i-editar" viewBox="0 0 24 24">
        <path d="M4 20h4L19 9l-4-4L4 16v4z" />
      </symbol>
      <symbol id="i-envio" viewBox="0 0 24 24">
        <path d="M7 18h10a4 4 0 0 0 .5-7.97A6 6 0 0 0 6 9a4.5 4.5 0 0 0 1 9z" />
        <path d="M12 16v-5M9.5 13.5 12 11l2.5 2.5" />
      </symbol>
      <symbol id="i-esq" viewBox="0 0 24 24">
        <path d="m15 18-6-6 6-6" />
      </symbol>
      <symbol id="i-estrela" viewBox="0 0 24 24">
        <path d="m12 3 2.8 5.7 6.2.9-4.5 4.4 1 6.2L12 17.3 6.5 20.2l1-6.2L3 9.6l6.2-.9z" />
      </symbol>
      <symbol id="i-fechar" viewBox="0 0 24 24">
        <path d="M6 6l12 12M18 6 6 18" />
      </symbol>
      <symbol id="i-grafico" viewBox="0 0 24 24">
        <path d="M4 20V10M10 20V4M16 20v-7M22 20H2" />
      </symbol>
      <symbol id="i-lista" viewBox="0 0 24 24">
        <path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01" />
      </symbol>
      <symbol id="i-lixo" viewBox="0 0 24 24">
        <path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3" />
      </symbol>
      <symbol id="i-mais" viewBox="0 0 24 24">
        <path d="M12 5v14M5 12h14" />
      </symbol>
      <symbol id="i-marcado" viewBox="0 0 24 24">
        <path d="m5 12 5 5 9-10" />
      </symbol>
      <symbol id="i-offline" viewBox="0 0 24 24">
        <path d="M3 3l18 18" />
        <path d="M8.5 8.6A6 6 0 0 0 6 9a4.5 4.5 0 0 0 1 9h10" />
        <path d="M12.2 6.2A6 6 0 0 1 17.5 10a4 4 0 0 1 2.4 6.6" />
      </symbol>
      <symbol id="i-ok" viewBox="0 0 24 24">
        <circle cx="12" cy="12" r="9" />
        <path d="m8 12 3 3 5-6" />
      </symbol>
      <symbol id="i-olho" viewBox="0 0 24 24">
        <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z" />
        <circle cx="12" cy="12" r="3" />
      </symbol>
      <symbol id="i-pessoa" viewBox="0 0 24 24">
        <circle cx="12" cy="8" r="4" />
        <path d="M4 21c0-4.4 3.6-7 8-7s8 2.6 8 7" />
      </symbol>
      <symbol id="i-recarregar" viewBox="0 0 24 24">
        <path d="M20 11a8 8 0 1 0-2.3 5.7" />
        <path d="M20 4v7h-7" />
      </symbol>
      <symbol id="i-relogio" viewBox="0 0 24 24">
        <circle cx="12" cy="12" r="9" />
        <path d="M12 7v5l3 2" />
      </symbol>
      <symbol id="i-sair" viewBox="0 0 24 24">
        <path d="M15 4h4v16h-4M10 8l-4 4 4 4M6 12h11" />
      </symbol>
    </svg>
  );
}
