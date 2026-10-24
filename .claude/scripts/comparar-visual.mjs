#!/usr/bin/env node
// Compara, tela a tela e por tamanho de tela, o mockup aprovado com a aplicação rodando.
//
// Para cada tela × estado × tamanho do mapa telas.json:
//   1. abre a página do mockup (arquivo local) e tira um print da página inteira;
//   2. abre a rota da aplicação (com a flag da interface nova ligada, se o mapa disser como)
//      e, se o mapa trouxer respostas, intercepta as chamadas de API e responde com os mesmos
//      dados do mockup; tira o print;
//   3. conta os pixels diferentes dentro do próprio navegador (canvas) e grava
//      <id>-<estado>-<tamanho>--mockup.png, --app.png e --diff.png (vermelho = diferente).
//
// Com --so-app, só captura a aplicação (inventário do estado atual, sem mockup).
// Com --listar, só confere o mapa e lista as comparações (não precisa do Playwright).
//
// Única dependência: `playwright` (ou `@playwright/test`) instalado no projeto, com o navegador
// baixado (`npx playwright install chromium`), resolvido a partir de --pacote (padrão: pasta atual).
//
// Uso:
//   node .claude/scripts/comparar-visual.mjs --base-url http://localhost:5173
//        [--config .specs/mockup/telas.json] [--tela T1[,T2]] [--viewport pc|celular]
//        [--saida <pasta>] [--limite 1] [--limiar 0.1] [--navegador chromium|firefox|webkit]
//        [--flag ligada|desligada] [--so-app] [--pacote web] [--iniciar "npm run dev"]
//   node .claude/scripts/comparar-visual.mjs --listar [--config ...]
//
//   --limite   porcentagem máxima de pixels diferentes por comparação (padrão 1; a tela pode
//              ter "limite" próprio no mapa)
//   --limiar   diferença mínima por canal (0 a 1) para um pixel contar como diferente
//              (padrão 0.1; absorve a suavização de fonte)
//   --saida    padrão: <pasta do telas.json>/comparacao/<AAAA-MM-DD>
//   --flag     desligada ignora o bloco "flag" do mapa (captura a interface antiga)
//   --iniciar  comando que sobe a aplicação; o script espera --base-url responder e derruba
//              o processo no fim
//
// Formato de telas.json (caminhos relativos à pasta dele):
// {
//   "viewports": { "pc": { "width": 1440, "height": 900 }, "celular": { "width": 390, "height": 844 } },
//   "flag": { "consulta": "ui=nova", "cookies": [{ "name": "ui", "value": "nova" }],
//             "localStorage": { "ui": "nova" } },          // como ligar a interface nova (opcional)
//   "respostas": [ { "url": "**/api/resumo", "arquivo": "respostas/resumo.json" } ],  // todas as telas
//   "ocultar": [".relogio"],                               // escondidos nos dois lados (conteúdo variável)
//   "telas": [
//     { "id": "T1", "nome": "Pedidos", "estado": "sucesso", "mockup": "telas/pedidos--sucesso.html",
//       "rota": "/pedidos", "viewports": ["pc", "celular"], "esperar": "main table", "limite": 2,
//       "respostas": [ { "url": "**/api/pedidos*", "arquivo": "respostas/pedidos.json" } ] },
//     { "id": "T1", "estado": "erro", "mockup": "telas/pedidos--erro.html", "rota": "/pedidos",
//       "respostas": [ { "url": "**/api/pedidos*", "status": 500, "arquivo": "respostas/erro.json" } ] },
//     { "id": "T1", "estado": "carregando", "mockup": "telas/pedidos--carregando.html",
//       "rota": "/pedidos", "respostas": [ { "url": "**/api/pedidos*", "pendente": true } ] }
//   ]
// }
// Por tela, opcionais: "recorte": { "mockup": "<seletor>", "app": "<seletor>" } compara só o
// elemento indicado em cada lado; "userAgent" vale só do lado da aplicação. Respostas da tela têm
// prioridade sobre as globais; "pendente": true nunca responde (mantém "carregando").
//
// Saída: 0 = tudo dentro do limite; 1 = alguma comparação acima do limite ou com erro;
// 2 = uso incorreto, mapa inválido ou dependência ausente.
//
// Adaptado de .claude_legado/scripts/comparar-visual.mjs (do usuário).

import { spawn, execSync } from "node:child_process";
import { createRequire } from "node:module";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { pathToFileURL } from "node:url";

export const NAVEGADORES = ["chromium", "firefox", "webkit"];

export function lerArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i++) {
    if (!argv[i].startsWith("--")) continue;
    const chave = argv[i].slice(2);
    const valor = argv[i + 1] && !argv[i + 1].startsWith("--") ? argv[++i] : "true";
    args[chave] = valor;
  }
  return args;
}

function semConsulta(caminho) {
  return caminho.split(/[?#]/)[0];
}

// Devolve a lista de problemas do mapa (vazia = válido). Com soApp, o mockup não é exigido.
export function validarMapa(mapa, pastaConfig, { soApp = false } = {}) {
  const erros = [];
  if (!mapa || typeof mapa !== "object") return ["o mapa não é um objeto JSON"];
  const viewports = mapa.viewports ?? {};
  if (!Object.keys(viewports).length) erros.push('falta "viewports"');
  for (const [nome, v] of Object.entries(viewports)) {
    if (!(v?.width > 0 && v?.height > 0)) erros.push(`viewport "${nome}" sem width e height positivos`);
  }
  if (!Array.isArray(mapa.telas) || !mapa.telas.length) erros.push('falta "telas" (lista não vazia)');
  for (const [i, tela] of (mapa.telas ?? []).entries()) {
    const rotulo = `tela ${i + 1}${tela?.id ? ` (${tela.id})` : ""}`;
    if (!tela?.id) erros.push(`${rotulo}: falta "id"`);
    if (!tela?.rota) erros.push(`${rotulo}: falta "rota"`);
    if (!soApp) {
      if (!tela?.mockup) erros.push(`${rotulo}: falta "mockup"`);
      else if (pastaConfig && !existsSync(join(pastaConfig, semConsulta(tela.mockup)))) {
        erros.push(`${rotulo}: mockup não encontrado: ${tela.mockup}`);
      }
    }
    for (const nome of tela?.viewports ?? []) {
      if (!viewports[nome]) erros.push(`${rotulo}: viewport "${nome}" não definido`);
    }
    if (tela?.limite !== undefined && !(Number(tela.limite) >= 0)) erros.push(`${rotulo}: "limite" inválido`);
  }
  return erros;
}

// Expande telas × viewports, aplicando os filtros de --tela e --viewport.
export function listarComparacoes(mapa, { telas = null, viewport = null } = {}) {
  const filtro = telas ? new Set(String(telas).split(",")) : null;
  const lista = [];
  for (const tela of mapa.telas ?? []) {
    if (filtro && !filtro.has(tela.id)) continue;
    const estado = tela.estado ?? "sucesso";
    for (const nomeViewport of tela.viewports ?? Object.keys(mapa.viewports ?? {})) {
      if (viewport && viewport !== nomeViewport) continue;
      lista.push({ tela, estado, nomeViewport, rotulo: `${tela.id}-${estado}-${nomeViewport}` });
    }
  }
  return lista;
}

export function urlApp(baseUrl, rota, consulta) {
  const base = baseUrl.replace(/\/$/, "") + rota;
  if (!consulta) return base;
  const [semAncora, ancora] = base.split("#");
  const junta = semAncora.includes("?") ? "&" : "?";
  return semAncora + junta + consulta + (ancora !== undefined ? `#${ancora}` : "");
}

// Conta pixels diferentes entre dois RGBA do mesmo tamanho. Se `saida` vier, pinta nela a
// máscara: vermelho onde difere, cinza claro onde é igual. Não usa nada de fora da função
// porque também é injetada no navegador.
export function compararPixels(pa, pb, corte, saida) {
  let diferentes = 0;
  for (let i = 0; i < pa.length; i += 4) {
    const difere =
      Math.abs(pa[i] - pb[i]) > corte || Math.abs(pa[i + 1] - pb[i + 1]) > corte || Math.abs(pa[i + 2] - pb[i + 2]) > corte;
    if (difere) diferentes++;
    if (saida) {
      if (difere) {
        saida[i] = 255; saida[i + 1] = 0; saida[i + 2] = 0;
      } else {
        const cinza = 200 + ((pa[i] + pa[i + 1] + pa[i + 2]) / 3) * 0.2;
        saida[i] = cinza; saida[i + 1] = cinza; saida[i + 2] = cinza;
      }
      saida[i + 3] = 255;
    }
  }
  return diferentes;
}

export function avaliar(resultado, limite) {
  return resultado.porcentagem <= limite && resultado.tamanhoMockup === resultado.tamanhoApp;
}

export function montarRelatorio({ data, baseUrl, limite, limiar, navegador, saida, linhas, soApp }) {
  const cabecalho = soApp
    ? ["| Tela | Estado | Tamanho | Resultado | Captura |", "|---|---|---|---|---|"]
    : [
        "| Tela | Estado | Tamanho | Pixels diferentes | Tamanho mockup / app | Limite | Resultado | Diferença |",
        "|---|---|---|---|---|---|---|---|",
      ];
  const nota = soApp
    ? "Capturas só da aplicação (sem mockup)."
    : "DIVERGE = acima do limite **ou** página com tamanho diferente do mockup. Abra o `--diff.png` " +
      "(vermelho = pixel diferente) e os prints `--mockup.png` e `--app.png` lado a lado antes de concluir.";
  return [
    `# ${soApp ? "Capturas da aplicação" : "Comparação visual mockup × aplicação"} (${data})`,
    "",
    `Aplicação: \`${baseUrl}\` · Navegador: ${navegador}` +
      (soApp ? "" : ` · Limite padrão: ${limite}% de pixels · Limiar por canal: ${limiar}`) +
      ` · Imagens: \`${saida.replace(/\\/g, "/")}\``,
    "",
    ...cabecalho,
    ...linhas,
    "",
    nota,
  ].join("\n");
}

async function carregarPlaywright(pasta, navegador) {
  for (const nome of ["playwright", "@playwright/test"]) {
    try {
      const require = createRequire(join(resolve(pasta), "package.json"));
      const modulo = await import(pathToFileURL(require.resolve(nome)).href);
      const tipo = modulo[navegador] ?? modulo.default?.[navegador];
      if (tipo) return tipo;
    } catch {
      // tenta o próximo
    }
  }
  return null;
}

async function esperarUrl(url, segundos) {
  const fim = Date.now() + segundos * 1000;
  while (Date.now() < fim) {
    try {
      if ((await fetch(url)).status < 500) return true;
    } catch {
      // ainda subindo
    }
    await new Promise((r) => setTimeout(r, 1000));
  }
  return false;
}

function derrubar(processo) {
  if (!processo || processo.exitCode !== null) return;
  try {
    if (process.platform === "win32") execSync(`taskkill /pid ${processo.pid} /T /F`, { stdio: "ignore" });
    else process.kill(-processo.pid, "SIGTERM");
  } catch {
    // já terminou
  }
}

const CSS_ESTAVEL = `*, *::before, *::after {
  animation: none !important; transition: none !important; caret-color: transparent !important; }`;

async function registrarRespostas(pagina, respostas, pastaConfig) {
  // No Playwright, a última rota registrada tem prioridade: registra em ordem inversa para as
  // respostas da tela (que vêm primeiro na lista) ganharem das globais.
  for (const r of [...respostas].reverse()) {
    await pagina.route(r.url, async (rota) => {
      if (r.pendente) return;
      const corpo = r.arquivo ? readFileSync(join(pastaConfig, r.arquivo), "utf8") : "";
      await rota.fulfill({
        status: r.status ?? 200,
        contentType: r.contentType ?? (r.status >= 400 ? "application/problem+json" : "application/json"),
        body: corpo,
      });
    });
  }
}

async function capturar(navegador, viewport, url, o) {
  const contexto = await navegador.newContext({
    viewport, deviceScaleFactor: 1, reducedMotion: "reduce", ...(o.userAgent ? { userAgent: o.userAgent } : {}),
  });
  if (o.flag?.cookies?.length) {
    await contexto.addCookies(o.flag.cookies.map((c) => (c.domain ? c : { url: o.baseUrl, ...c })));
  }
  if (o.flag?.localStorage) {
    await contexto.addInitScript((itens) => {
      for (const [k, v] of Object.entries(itens)) window.localStorage.setItem(k, v);
    }, o.flag.localStorage);
  }
  const pagina = await contexto.newPage();
  if (o.respostas?.length) await registrarRespostas(pagina, o.respostas, o.pastaConfig);
  await pagina.goto(url, { waitUntil: o.pendente ? "domcontentloaded" : "networkidle" });
  if (o.esperar) await pagina.waitForSelector(o.esperar, { timeout: 15000 }).catch(() => {});
  const ocultar = o.ocultar.length ? `${o.ocultar.join(",")} { visibility: hidden !important; }` : "";
  await pagina.addStyleTag({ content: CSS_ESTAVEL + ocultar });
  await pagina.evaluate(() => document.fonts.ready);
  await pagina.waitForTimeout(o.pendente ? 1500 : 300);
  // O mockup é estático, sem foco; tira o foco que o app põe ao abrir.
  await pagina.evaluate(() => document.activeElement instanceof HTMLElement && document.activeElement.blur());
  let png;
  if (o.recorte) {
    const alvo = pagina.locator(o.recorte).first();
    await alvo.waitFor({ state: "visible", timeout: 15000 });
    png = await alvo.screenshot();
  } else {
    png = await pagina.screenshot({ fullPage: true });
  }
  await contexto.close();
  return png;
}

async function diferenca(navegador, pngA, pngB, limiar) {
  const pagina = await navegador.newPage();
  await pagina.addScriptTag({ content: `window.compararPixels = ${compararPixels.toString()};` });
  const resultado = await pagina.evaluate(
    async ({ a, b, corte }) => {
      const carregar = (src) =>
        new Promise((ok, erro) => {
          const img = new Image();
          img.onload = () => ok(img);
          img.onerror = erro;
          img.src = src;
        });
      const [ia, ib] = await Promise.all([carregar(a), carregar(b)]);
      const w = Math.max(ia.width, ib.width);
      const h = Math.max(ia.height, ib.height);
      const pixels = (img) => {
        const c = new OffscreenCanvas(w, h);
        const ctx = c.getContext("2d");
        ctx.fillStyle = "#ff00ff"; // área que só existe numa das imagens conta como diferente
        ctx.fillRect(0, 0, w, h);
        ctx.drawImage(img, 0, 0);
        return ctx.getImageData(0, 0, w, h).data;
      };
      const saida = new OffscreenCanvas(w, h);
      const ctx = saida.getContext("2d");
      const dados = ctx.createImageData(w, h);
      const diferentes = window.compararPixels(pixels(ia), pixels(ib), corte, dados.data);
      ctx.putImageData(dados, 0, 0);
      const bytes = new Uint8Array(await (await saida.convertToBlob({ type: "image/png" })).arrayBuffer());
      let binario = "";
      for (let i = 0; i < bytes.length; i += 0x8000) binario += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
      return {
        porcentagem: (diferentes / (w * h)) * 100,
        tamanhoMockup: `${ia.width}×${ia.height}`,
        tamanhoApp: `${ib.width}×${ib.height}`,
        diffBase64: btoa(binario),
      };
    },
    { a: `data:image/png;base64,${pngA.toString("base64")}`, b: `data:image/png;base64,${pngB.toString("base64")}`, corte: limiar * 255 },
  );
  await pagina.close();
  return resultado;
}

function erroUso(mensagem) {
  console.error(mensagem);
  process.exit(2);
}

async function main() {
  const args = lerArgs(process.argv.slice(2));
  const listar = args.listar === "true";
  const soApp = args["so-app"] === "true";
  if (!listar && !args["base-url"]) {
    erroUso("Uso: node .claude/scripts/comparar-visual.mjs --base-url <URL da aplicação> [opções] | --listar (ver cabeçalho)");
  }
  const config = resolve(args.config ?? join(".specs", "mockup", "telas.json"));
  if (!existsSync(config)) erroUso(`Mapa de telas não encontrado: ${config}`);
  const pastaConfig = dirname(config);
  let mapa;
  try {
    mapa = JSON.parse(readFileSync(config, "utf8"));
  } catch (erro) {
    erroUso(`Mapa de telas não é JSON válido: ${erro.message}`);
  }
  const erros = validarMapa(mapa, pastaConfig, { soApp });
  if (erros.length) erroUso(`Mapa de telas inválido (${config}):\n- ${erros.join("\n- ")}`);
  const comparacoes = listarComparacoes(mapa, { telas: args.tela ?? null, viewport: args.viewport ?? null });
  if (listar) {
    console.log(`${comparacoes.length} comparação(ões) em ${config}:`);
    for (const c of comparacoes) console.log(`- ${c.rotulo}  ${c.tela.rota}${soApp ? "" : `  ← ${c.tela.mockup}`}`);
    process.exit(0);
  }

  const limite = Number(args.limite ?? 1);
  const limiar = Number(args.limiar ?? 0.1);
  const nomeNavegador = args.navegador ?? "chromium";
  if (!NAVEGADORES.includes(nomeNavegador)) erroUso(`--navegador deve ser um de: ${NAVEGADORES.join(", ")}`);
  const flag = args.flag === "desligada" ? null : mapa.flag ?? null;
  const hoje = new Date().toISOString().slice(0, 10);
  const saida = resolve(args.saida ?? join(pastaConfig, "comparacao", hoje));
  const baseUrl = args["base-url"].replace(/\/$/, "");

  const tipoNavegador = await carregarPlaywright(args.pacote ?? ".", nomeNavegador);
  if (!tipoNavegador) {
    erroUso(
      "Playwright não encontrado a partir de --pacote. Instalar é decisão do usuário: no pacote da interface, " +
        "`npm add -D playwright` e `npx playwright install " + nomeNavegador + "`.",
    );
  }
  mkdirSync(saida, { recursive: true });

  let servidor = null;
  if (args.iniciar) {
    servidor = spawn(args.iniciar, { shell: true, stdio: "ignore", detached: process.platform !== "win32" });
    if (!(await esperarUrl(baseUrl, 120))) {
      derrubar(servidor);
      console.error(`A aplicação não respondeu em ${baseUrl} em 120 s.`);
      process.exit(1);
    }
  }

  let navegador;
  try {
    navegador = await tipoNavegador.launch();
  } catch (erro) {
    derrubar(servidor);
    erroUso(
      `Não foi possível abrir o ${nomeNavegador} do Playwright (instalar é decisão do usuário: ` +
        `\`npx playwright install ${nomeNavegador}\`). Erro: ${String(erro.message ?? erro).split("\n")[0]}`,
    );
  }
  const linhas = [];
  let falhou = false;
  try {
    for (const { tela, estado, nomeViewport, rotulo } of comparacoes) {
      const viewport = mapa.viewports[nomeViewport];
      const respostas = [...(tela.respostas ?? []), ...(mapa.respostas ?? [])];
      const pendente = respostas.some((r) => r.pendente);
      const ocultar = [...(mapa.ocultar ?? []), ...(tela.ocultar ?? [])];
      const consulta = flag?.consulta ?? null;
      const nome = `${tela.id} ${tela.nome ?? ""}`.trim();
      try {
        const pngApp = await capturar(navegador, viewport, urlApp(baseUrl, tela.rota, consulta), {
          ocultar, esperar: pendente ? null : tela.esperar, respostas, pendente, pastaConfig,
          recorte: tela.recorte?.app, userAgent: tela.userAgent, flag, baseUrl,
        });
        writeFileSync(join(saida, `${rotulo}--app.png`), pngApp);
        if (soApp) {
          linhas.push(`| ${nome} | ${estado} | ${nomeViewport} | capturada | \`${rotulo}--app.png\` |`);
          continue;
        }
        const arquivoMockup = join(pastaConfig, semConsulta(tela.mockup));
        const urlMockup = pathToFileURL(arquivoMockup).href + (tela.mockup.match(/[?#].*$/)?.[0] ?? "");
        const pngMockup = await capturar(navegador, viewport, urlMockup, {
          ocultar, esperar: null, pastaConfig, recorte: tela.recorte?.mockup,
        });
        const r = await diferenca(navegador, pngMockup, pngApp, limiar);
        writeFileSync(join(saida, `${rotulo}--mockup.png`), pngMockup);
        writeFileSync(join(saida, `${rotulo}--diff.png`), Buffer.from(r.diffBase64, "base64"));
        const limiteTela = tela.limite !== undefined ? Number(tela.limite) : limite;
        const ok = avaliar(r, limiteTela);
        if (!ok) falhou = true;
        linhas.push(
          `| ${nome} | ${estado} | ${nomeViewport} | ${r.porcentagem.toFixed(2)}% | ${r.tamanhoMockup} / ${r.tamanhoApp} | ` +
            `${limiteTela}% | **${ok ? "OK" : "DIVERGE"}** | \`${rotulo}--diff.png\` |`,
        );
      } catch (erro) {
        falhou = true;
        const msg = String(erro.message ?? erro).replace(/\|/g, "\\|").split("\n")[0];
        linhas.push(soApp ? `| ${nome} | ${estado} | ${nomeViewport} | **ERRO** | ${msg} |` : `| ${nome} | ${estado} | ${nomeViewport} | — | — | — | **ERRO** | ${msg} |`);
      }
    }
  } finally {
    await navegador.close();
    derrubar(servidor);
  }

  const relatorio = montarRelatorio({ data: hoje, baseUrl, limite, limiar, navegador: nomeNavegador, saida, linhas, soApp });
  writeFileSync(join(saida, "resumo.md"), relatorio + "\n", "utf8");
  console.log(relatorio);
  process.exit(falhou ? 1 : 0);
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  main().catch((erro) => {
    console.error(erro);
    process.exit(1);
  });
}
