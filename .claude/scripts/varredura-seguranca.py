#!/usr/bin/env python3
"""Varredura de segurança: roda as ferramentas disponíveis e as sondas de teste ativo.

Usado pela skill `auditoria-seguranca` (fases 4, 6 e 8) e pelo agente
`auditor-seguranca`. Não corrige nada e não interpreta: executa, guarda a saída
bruta e resume. Quem confirma e classifica os achados é o auditor.

Subcomandos:

  ferramentas — dependências, segredos (histórico do git) e análise estática:
    python .claude/scripts/varredura-seguranca.py ferramentas --saida DIR
        [--raiz R] [--semgrep-config p/default,...] [--docker] [--pular semgrep,...] [--estrito]

  sondas — requisições de teste contra a aplicação rodando (teste ativo e reteste):
    python .claude/scripts/varredura-seguranca.py sondas --alvo URL --sondas ARQ.json --saida DIR
        [--permitir-host HOST] [--estrito]

Regras de segurança embutidas:
  - Ferramenta ausente sai como NÃO EXECUTADO, nunca é pulada em silêncio
    (--pular registra PULADO, por decisão explícita).
  - Docker só com --docker: baixar uma imagem é instalar, e instalar é decisão do usuário.
  - gitleaks roda com --redact; a busca embutida de segredos nunca grava o valor.
  - Sondas só contra localhost; outro host exige --permitir-host igual ao host do alvo
    (o endereço autorizado em escopo.md). Sem repetição, sem carga.
  - --estrito: código 1 se houver ferramenta não executada ou com falha, achado alto
    ou crítico, segredo ou sonda reprovada (para o CI).

Formato de sondas.json:
{
  "cabecalhos_esperados": {"X-Content-Type-Options": "nosniff", "Content-Security-Policy": null},
  "cors_aberto_proibido": true,
  "sondas": [
    {"nome": "SEC-001 conta B lê pedido da conta A", "metodo": "GET", "caminho": "/api/pedidos/1",
     "cabecalhos": {"Authorization": "Bearer <token de teste B>"}, "status_esperado": [403, 404]},
    {"nome": "injeção no filtro", "metodo": "GET", "caminho": "/api/busca?q=%27%20OR%201%3D1--",
     "status_esperado": [200, 400], "nao_contem": ["SQLSTATE"]}
  ]
}
`cabecalhos_esperados`: null = basta existir; texto = precisa conter. Toda resposta também
é conferida contra padrões de vazamento (stack trace, erro de SQL, caminho interno).
"""

from __future__ import annotations

import argparse
import datetime as dt
import json
import re
import shutil
import subprocess
import sys
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path

TEMPO_LIMITE_FERRAMENTA = 900
TEMPO_LIMITE_SONDA = 20
MAX_SONDAS = 200
SEMGREP_PADRAO = "p/default,p/secrets,p/owasp-top-ten"
HOSTS_LOCAIS = {"localhost", "127.0.0.1", "::1"}

PADROES_VAZAMENTO = [
    (r"at \S+ \(?[^\s()]+:\d+:\d+\)?", "stack trace JS"),
    (r"Traceback \(most recent call last\)", "stack trace Python"),
    (r"\b(?:SQLITE_|SQLSTATE|syntax error at or near)", "erro de SQL"),
    (r"\bSELECT\s+.+\s+FROM\s+\w+", "SQL na resposta"),
    (r"node_modules[/\\]", "caminho interno"),
    (r"/(?:home|usr|var|app|src)/[\w./-]+\.(?:js|ts|py)\b", "caminho de arquivo"),
]

# Busca embutida de segredos (piso quando o gitleaks não existe). Valor nunca é gravado.
PADROES_SEGREDO = [
    (re.compile(r"AKIA[0-9A-Z]{16}"), "chave de acesso AWS"),
    (re.compile(r"-----BEGIN (?:RSA |EC |OPENSSH |DSA |PGP )?PRIVATE KEY"), "chave privada"),
    (re.compile(r"gh[pousr]_[A-Za-z0-9]{36,}"), "token do GitHub"),
    (re.compile(r"xox[abprs]-[A-Za-z0-9-]{10,}"), "token do Slack"),
    (re.compile(r"sk_live_[A-Za-z0-9]{16,}"), "chave de produção Stripe"),
    (re.compile(r"AIza[0-9A-Za-z_\-]{35}"), "chave de API Google"),
    (re.compile(r"[a-z][a-z0-9+]*://[^:\s/@]+:[^@\s/]{3,}@"), "URL com senha"),
    (re.compile(r"(?i)(?:api[_-]?key|secret|token|passw(?:or)?d|senha)\s*[:=]\s*['\"][^'\"\s]{8,}['\"]"),
     "atribuição de segredo"),
]


# ---------------------------------------------------------------- utilitários


def rodar(argv: list[str], cwd: Path, arquivo_saida: Path | None = None) -> dict:
    """Executa e devolve {codigo, stdout, stderr, erro}. Grava stdout em arquivo_saida se pedido."""
    try:
        r = subprocess.run(argv, cwd=cwd, capture_output=True, timeout=TEMPO_LIMITE_FERRAMENTA,
                           text=True, encoding="utf-8", errors="replace")
    except FileNotFoundError as e:
        return {"codigo": None, "stdout": "", "stderr": "", "erro": f"não encontrado: {e}"}
    except subprocess.TimeoutExpired:
        return {"codigo": None, "stdout": "", "stderr": "", "erro": f"tempo esgotado ({TEMPO_LIMITE_FERRAMENTA}s)"}
    if arquivo_saida is not None and r.stdout:
        arquivo_saida.write_text(r.stdout, encoding="utf-8")
    return {"codigo": r.returncode, "stdout": r.stdout, "stderr": r.stderr, "erro": None}


def docker_disponivel() -> bool:
    caminho = shutil.which("docker")
    if not caminho:
        return False
    try:
        return subprocess.run([caminho, "info"], capture_output=True, timeout=30).returncode == 0
    except (OSError, subprocess.TimeoutExpired):
        return False


def carregar_json(texto: str):
    try:
        return json.loads(texto)
    except ValueError:
        inicios = [i for i in (texto.find("{"), texto.find("[")) if i >= 0]
        if not inicios:
            return None
        try:
            return json.loads(texto[min(inicios):])
        except ValueError:
            return None


def item(nome, status, comando="", resumo="", arquivo="", contagem=None):
    return {"nome": nome, "status": status, "comando": comando, "resumo": resumo,
            "arquivo": arquivo, "contagem": contagem or {}}


def mascarar(valor: str) -> str:
    return valor[:4] + "****"


# ---------------------------------------------------------------- ferramentas


def dependencias(raiz: Path, saida: Path, docker: bool) -> list[dict]:
    itens = []
    if (raiz / "package.json").exists():
        if (raiz / "pnpm-lock.yaml").exists() and shutil.which("pnpm"):
            argv, cmd = [shutil.which("pnpm"), "audit", "--prod", "--json"], "pnpm audit --prod --json"
        elif shutil.which("npm"):
            argv, cmd = [shutil.which("npm"), "audit", "--omit=dev", "--json"], "npm audit --omit=dev --json"
        else:
            argv = None
        if argv is None:
            itens.append(item("Dependências (Node)", "NÃO EXECUTADO", resumo="npm/pnpm não encontrado"))
        else:
            arq = saida / "dependencias-node.json"
            r = rodar(argv, raiz, arq)
            dados = carregar_json(r["stdout"])
            if r["erro"] or not isinstance(dados, dict):
                itens.append(item("Dependências (Node)", "FALHOU", cmd,
                                  r["erro"] or (r["stderr"] or "saída não é JSON")[:200], arq.name))
            else:
                vul = (dados.get("metadata") or {}).get("vulnerabilities") or {}
                cont = {k: int(vul.get(k, 0) or 0) for k in ("critical", "high", "moderate", "low")}
                itens.append(item("Dependências (Node)", "ACHADOS" if any(cont.values()) else "OK", cmd,
                                  ", ".join(f"{k}: {v}" for k, v in cont.items()), arq.name, cont))

    if any((raiz / f).exists() for f in ("requirements.txt", "pyproject.toml", "Pipfile.lock")):
        if shutil.which("pip-audit"):
            arq = saida / "dependencias-python.json"
            r = rodar([shutil.which("pip-audit"), "-f", "json"], raiz, arq)
            dados = carregar_json(r["stdout"])
            if r["erro"] or dados is None:
                itens.append(item("Dependências (Python)", "FALHOU", "pip-audit -f json",
                                  r["erro"] or r["stderr"][:200], arq.name))
            else:
                deps = dados.get("dependencies", []) if isinstance(dados, dict) else dados
                n = sum(len(d.get("vulns", [])) for d in deps if isinstance(d, dict))
                itens.append(item("Dependências (Python)", "ACHADOS" if n else "OK", "pip-audit -f json",
                                  f"{n} vulnerabilidade(s)", arq.name, {"sem_severidade": n}))
        else:
            itens.append(item("Dependências (Python)", "NÃO EXECUTADO", resumo="pip-audit não encontrado"))

    arq = saida / "osv-scanner.json"
    if shutil.which("osv-scanner"):
        r = rodar([shutil.which("osv-scanner"), "scan", "source", "-r", "--format", "json", "."], raiz, arq)
        cmd = "osv-scanner scan source -r --format json ."
    elif docker:
        r = rodar(["docker", "run", "--rm", "-v", f"{raiz}:/src", "ghcr.io/google/osv-scanner:latest",
                   "scan", "source", "-r", "--format", "json", "/src"], raiz, arq)
        cmd = "docker run ... osv-scanner scan source -r /src"
    else:
        itens.append(item("Dependências (OSV, todos os lockfiles)", "NÃO EXECUTADO",
                          resumo="osv-scanner não encontrado (Docker só com --docker)"))
        return itens
    dados = carregar_json(r["stdout"])
    if r["erro"] or not isinstance(dados, dict):
        itens.append(item("Dependências (OSV, todos os lockfiles)", "FALHOU", cmd,
                          r["erro"] or (r["stderr"] or "saída não é JSON")[:200], arq.name))
    else:
        n = sum(len(p.get("vulnerabilities", []))
                for res in dados.get("results", []) for p in res.get("packages", []))
        itens.append(item("Dependências (OSV, todos os lockfiles)", "ACHADOS" if n else "OK", cmd,
                          f"{n} vulnerabilidade(s) (severidade no arquivo bruto)", arq.name, {"sem_severidade": n}))
    return itens


def segredos_gitleaks(raiz: Path, saida: Path, docker: bool) -> dict:
    nome = "Segredos (gitleaks, histórico inteiro)"
    arq = saida / "gitleaks.json"
    if shutil.which("gitleaks"):
        r = rodar([shutil.which("gitleaks"), "git", "--redact", "--report-format", "json",
                   "--report-path", str(arq), "--no-banner", "."], raiz)
        cmd = "gitleaks git --redact ."
    elif docker:
        r = rodar(["docker", "run", "--rm", "-v", f"{raiz}:/repo", "-v", f"{saida}:/saida",
                   "zricethezav/gitleaks:latest", "git", "--redact", "--report-format", "json",
                   "--report-path", "/saida/gitleaks.json", "--no-banner", "/repo"], raiz)
        cmd = "docker run ... gitleaks git --redact /repo"
    else:
        return item(nome, "NÃO EXECUTADO", resumo="gitleaks não encontrado (busca embutida abaixo cobre o básico)")
    if r["erro"] or r["codigo"] not in (0, 1):
        return item(nome, "FALHOU", cmd, r["erro"] or r["stderr"][:200], arq.name)
    dados = carregar_json(arq.read_text(encoding="utf-8")) if arq.exists() else []
    n = len(dados) if isinstance(dados, list) else 0
    return item(nome, "ACHADOS" if n else "OK", cmd, f"{n} segredo(s)", arq.name, {"segredos": n})


def segredos_embutido(raiz: Path, saida: Path) -> dict:
    """Procura padrões de segredo nas linhas adicionadas em todo o histórico do git."""
    nome = "Segredos (busca embutida, histórico inteiro)"
    cmd = "git log -p --all (padrões de PADROES_SEGREDO)"
    r = rodar(["git", "log", "-p", "--all", "--no-color", "--unified=0", "--format=@@commit %h"], raiz)
    if r["erro"] or r["codigo"] != 0:
        return item(nome, "FALHOU", cmd, r["erro"] or r["stderr"][:200] or "não é repositório git")
    achados, commit, arquivo = [], "", ""
    for linha in r["stdout"].splitlines():
        if linha.startswith("@@commit "):
            commit = linha.split(" ", 1)[1]
        elif linha.startswith("+++ "):
            arquivo = linha[6:] if linha.startswith("+++ b/") else linha[4:]
        elif linha.startswith("+"):
            for padrao, rotulo in PADROES_SEGREDO:
                m = padrao.search(linha)
                if m:
                    achados.append({"commit": commit, "arquivo": arquivo, "padrao": rotulo,
                                    "trecho": mascarar(m.group(0))})
    arq = saida / "segredos-historico.json"
    arq.write_text(json.dumps(achados, ensure_ascii=False, indent=2), encoding="utf-8")
    return item(nome, "ACHADOS" if achados else "OK", cmd,
                f"{len(achados)} ocorrência(s), valores mascarados", arq.name, {"segredos": len(achados)})


def sast(raiz: Path, saida: Path, docker: bool, configs: str) -> dict:
    nome = "Análise estática (semgrep)"
    arq = saida / "semgrep.json"
    args_cfg = [a for c in configs.split(",") if c.strip() for a in ("--config", c.strip())]
    if shutil.which("semgrep"):
        r = rodar([shutil.which("semgrep"), "scan", *args_cfg, "--json", "--metrics=off",
                   "--output", str(arq)], raiz)
        cmd = f"semgrep scan {' '.join(args_cfg)} --json --metrics=off"
    elif docker:
        r = rodar(["docker", "run", "--rm", "-v", f"{raiz}:/src", "-v", f"{saida}:/saida",
                   "semgrep/semgrep:latest", "semgrep", "scan", *args_cfg, "--json", "--metrics=off",
                   "--output", "/saida/semgrep.json", "/src"], raiz)
        cmd = f"docker run ... semgrep scan {' '.join(args_cfg)}"
    else:
        return item(nome, "NÃO EXECUTADO", resumo="semgrep não encontrado (Docker só com --docker)")
    if r["erro"] or not arq.exists():
        return item(nome, "FALHOU", cmd, r["erro"] or r["stderr"][:200], arq.name)
    dados = carregar_json(arq.read_text(encoding="utf-8")) or {}
    cont = {"ERROR": 0, "WARNING": 0, "INFO": 0}
    for res in dados.get("results", []):
        sev = (res.get("extra") or {}).get("severity", "INFO")
        cont[sev] = cont.get(sev, 0) + 1
    return item(nome, "ACHADOS" if any(cont.values()) else "OK", cmd,
                f"ERROR: {cont['ERROR']}, WARNING: {cont['WARNING']}, INFO: {cont['INFO']}", arq.name,
                {"high": cont["ERROR"], "moderate": cont["WARNING"], "low": cont["INFO"]})


# ---------------------------------------------------------------- sondas


def host_permitido(url: str, permitir: str | None) -> bool:
    partes = urllib.parse.urlsplit(url)
    if partes.scheme not in ("http", "https") or not partes.hostname:
        return False
    host = partes.hostname.lower()
    return host in HOSTS_LOCAIS or host.endswith(".localhost") or (permitir is not None and host == permitir.lower())


def requisitar(url: str, metodo: str, corpo, cabecalhos: dict):
    dados = corpo.encode("utf-8") if isinstance(corpo, str) else None
    req = urllib.request.Request(url, data=dados, method=metodo.upper(), headers=cabecalhos or {})
    try:
        with urllib.request.urlopen(req, timeout=TEMPO_LIMITE_SONDA) as resp:
            return resp.status, dict(resp.headers.items()), resp.read(200_000).decode("utf-8", "replace"), None
    except urllib.error.HTTPError as e:
        with e:
            return e.code, dict(e.headers.items()), e.read(200_000).decode("utf-8", "replace"), None
    except (urllib.error.URLError, OSError) as e:
        return None, {}, "", str(e)


def rodar_sondas(base: str, config: dict) -> tuple[list[dict], list[str]]:
    esperados = config.get("cabecalhos_esperados", {})
    cors_proibido = config.get("cors_aberto_proibido", True)
    resultados, faltando = [], set()
    for sonda in config.get("sondas", [])[:MAX_SONDAS]:
        url = urllib.parse.urljoin(base.rstrip("/") + "/", sonda["caminho"].lstrip("/"))
        status, cab, corpo, erro = requisitar(url, sonda.get("metodo", "GET"),
                                              sonda.get("corpo"), sonda.get("cabecalhos", {}))
        falhas = []
        if erro:
            falhas.append(f"sem resposta: {erro}")
        else:
            esp = sonda.get("status_esperado")
            if esp and status not in esp:
                falhas.append(f"status {status}, esperado {esp}")
            for t in sonda.get("nao_contem", []):
                if t.lower() in corpo.lower():
                    falhas.append(f"resposta contém '{t}'")
            for t in sonda.get("contem", []):
                if t.lower() not in corpo.lower():
                    falhas.append(f"resposta não contém '{t}'")
            for padrao, rotulo in PADROES_VAZAMENTO:
                if re.search(padrao, corpo):
                    falhas.append(f"vazamento: {rotulo}")
            cab_min = {k.lower(): v for k, v in cab.items()}
            for nome, valor in esperados.items():
                atual = cab_min.get(nome.lower())
                if atual is None or (valor and valor.lower() not in atual.lower()):
                    faltando.add(nome)
            if cors_proibido and cab_min.get("access-control-allow-origin") == "*":
                falhas.append("CORS aberto (Access-Control-Allow-Origin: *)")
        resultados.append({"nome": sonda.get("nome", sonda["caminho"]), "metodo": sonda.get("metodo", "GET"),
                           "caminho": sonda["caminho"], "status": status, "falhas": falhas})
    gerais = []
    if faltando:
        gerais.append("cabeçalhos ausentes ou errados em ao menos uma resposta: " + ", ".join(sorted(faltando)))
    return resultados, gerais


# ---------------------------------------------------------------- relatório


def tabela(itens: list[dict]) -> list[str]:
    linhas = ["| Item | Situação | Comando | Resultado | Saída bruta |", "|---|---|---|---|---|"]
    for i in itens:
        resumo = (i["resumo"] or "-").replace("|", "\\|").replace("\n", " ")
        linhas.append(f"| {i['nome']} | **{i['status']}** | `{i['comando'] or '-'}` | {resumo} | {i['arquivo'] or '-'} |")
    return linhas


def bloqueia(itens: list[dict]) -> bool:
    for i in itens:
        if i["status"] in ("NÃO EXECUTADO", "FALHOU"):
            return True
        c = i["contagem"]
        if c.get("critical") or c.get("high") or c.get("sem_severidade") or c.get("segredos"):
            return True
    return False


def cmd_ferramentas(args) -> int:
    raiz = (args.raiz or Path.cwd()).resolve()
    saida = args.saida.resolve()
    saida.mkdir(parents=True, exist_ok=True)
    docker = bool(args.docker) and docker_disponivel()
    pular = {p.strip() for p in (args.pular or "").split(",") if p.strip()}

    itens = [] if "dependencias" in pular else dependencias(raiz, saida, docker)
    if "gitleaks" not in pular:
        itens.append(segredos_gitleaks(raiz, saida, docker))
    itens.append(segredos_embutido(raiz, saida))
    if "semgrep" not in pular:
        itens.append(sast(raiz, saida, docker, args.semgrep_config))
    for p in sorted(pular):
        itens.append(item(f"{p} (pulado)", "PULADO", resumo="pulado por decisão registrada"))

    hoje = dt.date.today().isoformat()
    linhas = [f"# Varredura de segurança: ferramentas ({hoje})\n",
              f"Raiz: `{raiz.as_posix()}` · Docker: {'sim' if docker else 'não'} · Saídas brutas: `{saida.as_posix()}`\n",
              *tabela(itens), "",
              "OK = rodou sem achado · ACHADOS = confirmar cada um na saída bruta · "
              "NÃO EXECUTADO/FALHOU = registrar; instalar ferramenta é decisão do usuário."]
    (saida / "resumo-ferramentas.md").write_text("\n".join(linhas) + "\n", encoding="utf-8")
    (saida / "resultado-ferramentas.json").write_text(json.dumps(itens, ensure_ascii=False, indent=2), encoding="utf-8")
    print("\n".join(linhas))
    return 1 if (args.estrito and bloqueia(itens)) else 0


def cmd_sondas(args) -> int:
    if not host_permitido(args.alvo, args.permitir_host):
        print(f"Alvo recusado: {args.alvo}. Sondas só contra localhost; outro host exige "
              "--permitir-host com o host autorizado em escopo.md (http ou https).")
        return 2
    if not args.sondas.exists():
        print(f"Arquivo de sondas não encontrado: {args.sondas}")
        return 2
    saida = args.saida.resolve()
    saida.mkdir(parents=True, exist_ok=True)
    config = json.loads(args.sondas.read_text(encoding="utf-8"))
    resultados, gerais = rodar_sondas(args.alvo, config)
    reprovadas = [r for r in resultados if r["falhas"]]
    hoje = dt.date.today().isoformat()
    linhas = [f"# Varredura de segurança: sondas ({hoje})\n", f"Alvo: `{args.alvo}`\n",
              f"## {len(resultados)} sonda(s), {len(reprovadas)} reprovada(s)\n",
              "| Sonda | Método | Caminho | Status | Falhas |", "|---|---|---|---|---|"]
    for r in resultados:
        falhas = "; ".join(r["falhas"]).replace("|", "\\|") or "—"
        linhas.append(f"| {r['nome']} | {r['metodo']} | `{r['caminho']}` | {r['status']} | {falhas} |")
    if gerais:
        linhas += ["", "## Problemas gerais", *[f"- {g}" for g in gerais]]
    (saida / "resumo-sondas.md").write_text("\n".join(linhas) + "\n", encoding="utf-8")
    (saida / "resultado-sondas.json").write_text(json.dumps(resultados, ensure_ascii=False, indent=2), encoding="utf-8")
    print("\n".join(linhas))
    return 1 if (args.estrito and (reprovadas or gerais)) else 0


def main(argv=None) -> int:
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8")
    p = argparse.ArgumentParser(description="Varredura de segurança (evidência executada, sem correção).")
    sub = p.add_subparsers(dest="comando", required=True)
    f = sub.add_parser("ferramentas", help="dependências, segredos e análise estática")
    f.add_argument("--raiz", type=Path, default=None)
    f.add_argument("--saida", type=Path, required=True)
    f.add_argument("--semgrep-config", default=SEMGREP_PADRAO)
    f.add_argument("--docker", action="store_true", help="permite imagens Docker (baixar imagem é instalar)")
    f.add_argument("--pular", default="", help="dependencias,gitleaks,semgrep (decisão registrada)")
    f.add_argument("--estrito", action="store_true")
    s = sub.add_parser("sondas", help="requisições de teste contra a aplicação rodando")
    s.add_argument("--alvo", required=True)
    s.add_argument("--sondas", type=Path, required=True)
    s.add_argument("--saida", type=Path, required=True)
    s.add_argument("--permitir-host", default=None)
    s.add_argument("--estrito", action="store_true")
    args = p.parse_args(argv)
    return cmd_ferramentas(args) if args.comando == "ferramentas" else cmd_sondas(args)


if __name__ == "__main__":
    sys.exit(main())
