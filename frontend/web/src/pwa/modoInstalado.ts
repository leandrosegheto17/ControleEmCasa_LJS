/** O app está rodando como aplicativo instalado (Android/desktop: display-mode; iOS: `navigator.standalone`). */
export function estaInstalado(): boolean {
  if (window.matchMedia?.('(display-mode: standalone)').matches) return true;
  return (navigator as Navigator & { standalone?: boolean }).standalone === true;
}
