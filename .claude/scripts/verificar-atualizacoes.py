#!/usr/bin/env python3
"""Verifica se as dependências externas listadas em .claude/fontes.json têm atualização.

Só verifica: nunca atualiza nada. Atualizar é decisão do usuário (skill /atualizacoes).

Uso:
  python .claude/scripts/verificar-atualizacoes.py              tabela completa
  python .claude/scripts/verificar-atualizacoes.py --silencioso uma linha, no máximo a cada N dias (hook)
  python .claude/scripts/verificar-atualizacoes.py --json       resultado em JSON (para a skill)

Tipos de fonte:
  pacote      skill instalada pelo CLI do Tech Leads Club: hash do lockfile contra o registro publicado
  plugin      plugin do Claude Code: versão instalada contra a maior tag do repositório
  adaptado    código nosso derivado de outro repositório: arquivos de origem mudaram desde o commit registrado?
  referencia  clone somente leitura: commit local contra o remoto
"""

import argparse
import json
import re
import subprocess
import sys
import urllib.request
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timedelta
from pathlib import Path

RAIZ = Path(__file__).resolve().parents[2]
MANIFESTO = RAIZ / ".claude" / "fontes.json"
CACHE = RAIZ / ".claude" / ".cache" / "ultima-verificacao.json"
PLUGINS_INSTALADOS = Path.home() / ".claude" / "plugins" / "installed_plugins.json"
TIMEOUT = 15

EM_DIA = "em dia"
DESATUALIZADO = "desatualizado"
ORIGEM_MUDOU = "origem mudou"
NAO_VERIFICADO = "não verificado"


def baixar_json(url):
    pedido = urllib.request.Request(url, headers={"User-Agent": "verificar-atualizacoes", "Accept": "application/json"})
    with urllib.request.urlopen(pedido, timeout=TIMEOUT) as resposta:
        return json.load(resposta)


def git(*args):
    saida = subprocess.run(["git", *args], capture_output=True, text=True, timeout=TIMEOUT)
    if saida.returncode != 0:
        raise RuntimeError(saida.stderr.strip() or f"git {args[0]} falhou")
    return saida.stdout.strip()


def repo_github(url):
    m = re.match(r"https://github\.com/([^/]+)/([^/]+?)(?:\.git)?/?$", url)
    if not m:
        raise ValueError(f"origem não é um repositório do GitHub: {url}")
    return m.group(1), m.group(2)


def versao_tupla(texto):
    return tuple(int(n) for n in re.findall(r"\d+", texto)[:3])


def verificar_pacote(fonte):
    lock = json.loads((RAIZ / fonte["lockfile"]).read_text(encoding="utf-8"))
    instalado = lock["skills"][fonte["nome"]]["contentHash"]
    registro = baixar_json(fonte["registro"])
    publicado = next((s for s in registro["skills"] if s["name"] == fonte["nome"]), None)
    if publicado is None:
        return NAO_VERIFICADO, "não está mais no registro publicado", ""
    if publicado["contentHash"] == instalado:
        return EM_DIA, f"versão {publicado.get('version', '?')}", ""
    return DESATUALIZADO, f"publicada {publicado.get('version', '?')} (instalada {fonte.get('versao', '?')})", fonte.get("atualizar_com", "")


def verificar_plugin(fonte):
    instalados = json.loads(PLUGINS_INSTALADOS.read_text(encoding="utf-8"))["plugins"]
    entradas = instalados.get(fonte["plugin_id"])
    if not entradas:
        return NAO_VERIFICADO, "plugin não está instalado", ""
    atual = entradas[0]["version"]
    tags = git("ls-remote", "--tags", fonte["origem"])
    versoes = {re.sub(r"\^\{\}$", "", linha.split("refs/tags/")[-1]) for linha in tags.splitlines() if "refs/tags/" in linha}
    versoes = [v for v in versoes if re.match(r"^v?\d+\.\d+", v)]
    if not versoes:
        return NAO_VERIFICADO, "repositório sem tags de versão", ""
    ultima = max(versoes, key=versao_tupla)
    if versao_tupla(ultima) <= versao_tupla(atual):
        return EM_DIA, f"versão {atual}", ""
    salto = "MAIOR (pode quebrar)" if versao_tupla(ultima)[0] > versao_tupla(atual)[0] else "menor"
    return DESATUALIZADO, f"instalada {atual}, última {ultima}, mudança {salto}", f"{fonte['origem']}/releases"


def verificar_adaptado(fonte):
    if not fonte["origem"].startswith("http"):
        return EM_DIA, "origem local congelada", ""
    dono, repo = repo_github(fonte["origem"])
    base = fonte["commit"]
    comparacao = baixar_json(f"https://api.github.com/repos/{dono}/{repo}/compare/{base}...HEAD")
    alterados = {a["filename"] for a in comparacao.get("files", [])}
    mudaram = [arq for arq in fonte["arquivos_origem"] if arq in alterados]
    link = f"{fonte['origem']}/compare/{base[:12]}...HEAD"
    if not mudaram:
        return EM_DIA, f"{comparacao.get('ahead_by', 0)} commits novos na origem, nenhum nos arquivos usados", ""
    return ORIGEM_MUDOU, "mudaram: " + ", ".join(mudaram), link


def verificar_referencia(fonte):
    pasta = RAIZ / fonte["pasta"]
    if not (pasta / ".git").exists():
        return NAO_VERIFICADO, "clone ausente", ""
    local = git("-C", str(pasta), "rev-parse", "HEAD")
    remoto = git("ls-remote", fonte["origem"], "HEAD").split()[0]
    if local == remoto:
        return EM_DIA, f"commit {local[:7]}", ""
    return DESATUALIZADO, f"local {local[:7]}, remoto {remoto[:7]}", f"{fonte['origem']}/compare/{local[:12]}...{remoto[:12]}"


VERIFICADORES = {
    "pacote": verificar_pacote,
    "plugin": verificar_plugin,
    "adaptado": verificar_adaptado,
    "referencia": verificar_referencia,
}


def verificar(fonte):
    try:
        situacao, detalhe, link = VERIFICADORES[fonte["tipo"]](fonte)
    except Exception as erro:  # rede, API ou arquivo ausente: registra e segue
        situacao, detalhe, link = NAO_VERIFICADO, str(erro)[:120], ""
    return {"nome": fonte["nome"], "tipo": fonte["tipo"], "situacao": situacao, "detalhe": detalhe, "link": link}


def dentro_do_intervalo(dias):
    try:
        ultima = datetime.fromisoformat(json.loads(CACHE.read_text(encoding="utf-8"))["verificado_em"])
    except (OSError, ValueError, KeyError):
        return False
    return datetime.now() - ultima < timedelta(days=dias)


def gravar_cache(resultados):
    CACHE.parent.mkdir(parents=True, exist_ok=True)
    CACHE.write_text(json.dumps({"verificado_em": datetime.now().isoformat(timespec="seconds"), "resultados": resultados},
                                ensure_ascii=False, indent=2), encoding="utf-8")


def main():
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--silencioso", action="store_true", help="uma linha só se houver novidade; respeita o intervalo")
    parser.add_argument("--json", action="store_true", help="imprime o resultado em JSON")
    args = parser.parse_args()

    manifesto = json.loads(MANIFESTO.read_text(encoding="utf-8"))
    if args.silencioso and dentro_do_intervalo(manifesto.get("intervalo_dias", 7)):
        return

    with ThreadPoolExecutor(max_workers=8) as pool:
        resultados = list(pool.map(verificar, manifesto["fontes"]))
    gravar_cache(resultados)

    pendentes = [r for r in resultados if r["situacao"] in (DESATUALIZADO, ORIGEM_MUDOU)]
    if args.silencioso:
        if pendentes:
            nomes = ", ".join(r["nome"] for r in pendentes)
            print(f"Atualizações disponíveis em {len(pendentes)} dependência(s) ({nomes}). Rode /atualizacoes para ver o que mudou.")
        return
    if args.json:
        print(json.dumps(resultados, ensure_ascii=False, indent=2))
        return

    print("| Dependência | Tipo | Situação | Detalhe | Ver |")
    print("|---|---|---|---|---|")
    for r in resultados:
        print(f"| {r['nome']} | {r['tipo']} | {r['situacao']} | {r['detalhe']} | {r['link']} |")
    print(f"\n{len(pendentes)} com atualização, {sum(r['situacao'] == NAO_VERIFICADO for r in resultados)} não verificada(s).")


if __name__ == "__main__":
    sys.stdout.reconfigure(encoding="utf-8")
    main()
