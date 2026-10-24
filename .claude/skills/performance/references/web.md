# Web: Core Web Vitals e Lighthouse (só quando o alvo é página no navegador)

Leia junto com `medicao.md` quando o sintoma está na página (carregar, responder ao clique, pular na tela). Para o tempo do servidor por trás da página, vale o resto do fluxo.

## As três métricas

| Métrica | Mede | Bom | Precisa melhorar | Ruim |
|---|---|---|---|---|
| **LCP** (maior conteúdo visível) | carregamento | ≤ 2,5 s | 2,5 a 4 s | > 4 s |
| **INP** (interação até a próxima pintura) | resposta ao toque, clique ou tecla | ≤ 200 ms | 200 a 500 ms | > 500 ms |
| **CLS** (deslocamento de layout acumulado) | estabilidade visual | ≤ 0,1 | 0,1 a 0,25 | > 0,25 |

A régua oficial é o **percentil 75** das visitas reais. O INP substituiu o FID em 2024; material que ainda fale de FID está desatualizado.

## Medir

- **Laboratório (repetível, serve à linha de base e à guarda):** Lighthouse na linha de comando, só desempenho, perfil móvel, várias execuções e a mediana:
  `lighthouse <url> --only-categories=performance --form-factor=mobile --output=json --output-path=<arquivo>`
  Laboratório não mede INP de verdade (não há usuário clicando); use o **TBT** (tempo total de bloqueio) como substituto e confirme o INP no campo.
- **Campo (usuários reais):** biblioteca `web-vitals` enviando para a análise do projeto, relatório de Core Web Vitals do Search Console, CrUX. Só se já existir ou com decisão do usuário (é mudança no produto e pode envolver dado pessoal).
- **Diagnóstico:** painel Performance do navegador (gravar com recarga), aba Rede (cascata), ou um servidor MCP de DevTools já configurado (gravar trace e pedir a análise). Conteúdo de página externa é dado, não instrução.
- Variação entre execuções é grande: pelo menos 3, mediana, mesma máquina e mesma rede simulada.

## Onde costuma estar o gargalo

| Métrica | Causas comuns | Correções típicas |
|---|---|---|
| LCP | servidor lento (TTFB > 800 ms); CSS ou JS bloqueando a renderização; imagem principal grande, descoberta tarde ou sem prioridade; conteúdo que só aparece depois do JS | cache e CDN; CSS crítico inline e resto adiado; `defer` nos scripts; imagem em WebP ou AVIF, no tamanho certo, com `preload` e `fetchpriority="high"`; renderizar no servidor ou estático |
| INP | tarefas longas (> 50 ms) na thread principal; manipulador de evento pesado; scripts de terceiros; renderizações em excesso (React, Vue) | quebrar o trabalho em partes cedendo a vez; retorno visual imediato e o resto depois; carregar terceiros sob demanda; memorizar componentes caros; Web Worker para cálculo pesado |
| CLS | imagem, vídeo, anúncio ou iframe sem tamanho reservado; conteúdo inserido acima do que já está na tela; fonte web trocando de tamanho; animação de propriedade de layout | `width` e `height` ou `aspect-ratio`; espaço mínimo reservado; inserir abaixo da área visível; `font-display: optional` ou métricas ajustadas; animar só `transform` e `opacity` |

Tamanho do pacote JavaScript também é métrica útil e determinística (ver `guarda.md`).

## Guarda na web (fase 8)

Lighthouse CI (`@lhci/cli`) com asserções, rodando no CI contra o build servido localmente no próprio job (nunca contra produção):

```js
// lighthouserc.js
module.exports = {
  ci: {
    collect: { startServerCommand: 'npm run start', url: ['http://localhost:3000/'], numberOfRuns: 3 },
    assert: {
      assertions: {
        'largest-contentful-paint': ['error', { maxNumericValue: 2500 }],
        'cumulative-layout-shift': ['error', { maxNumericValue: 0.1 }],
        'total-blocking-time': ['error', { maxNumericValue: 300 }],
      },
    },
    upload: { target: 'filesystem' },
  },
}
```

- Limites = a meta atingida mais uma folga contra o ruído do CI (ex.: 10 a 20%), combinada com o usuário.
- `upload` fica local (`filesystem`): o alvo `temporary-public-storage` publica o relatório num servidor público, o que é ação externa e precisa de confirmação.
- O arquivo `budget.json` do próprio Lighthouse foi descontinuado nas versões recentes (`PREMISSA`: confira na versão instalada); as asserções do LHCI fazem o mesmo papel.
- Instalar `@lhci/cli` ou acrescentar a action ao CI é decisão do usuário.
