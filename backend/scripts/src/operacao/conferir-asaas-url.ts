/**
 * Confere, no deploy, o endereço do Asaas que vai para o Worker (publicacao-deploy T17; ADR-012; ADR-015). O valor vem
 * da variável `ASAAS_API_URL` do environment `producao` (a mesma da purga) e só passa se for, caractere a caractere,
 * o de produção ou o do sandbox. Vazio, ausente, `http://`, outro host, barra final ou espaço: falha. Passo do
 * `.github/workflows/deploy.yml` logo depois da instalação, antes de qualquer passo que toque a produção.
 *
 * A mensagem de erro não repete o valor recebido (nada vindo de fora vira comando do workflow no log).
 */

export const ASAAS_URLS_PERMITIDAS: readonly string[] = [
  'https://api.asaas.com/v3',
  'https://api-sandbox.asaas.com/v3',
];

/** Devolve o valor se ele estiver na lista permitida; senão lança. */
export function conferirAsaasUrl(valor: string | undefined): string {
  if (valor === undefined || !ASAAS_URLS_PERMITIDAS.includes(valor)) {
    throw new Error(`ASAAS_API_URL fora da lista permitida: use exatamente ${ASAAS_URLS_PERMITIDAS.join(' ou ')}.`);
  }
  return valor;
}

export function main(ambiente: NodeJS.ProcessEnv = process.env): number {
  try {
    const url = conferirAsaasUrl(ambiente['ASAAS_API_URL']);
    console.info(`Endereço do Asaas permitido: ${url}`);
    return 0;
  } catch (erro) {
    console.error(`::error title=Endereço do Asaas recusado::${(erro as Error).message}`);
    return 1;
  }
}

if (import.meta.main) {
  process.exitCode = main();
}
