#!/usr/bin/env python3
"""Propriedade do código pelo histórico do git: fator ônibus, atividade e código sensível sem dono.

Usado na fase 8 da skill avaliar-terceiros, sobre a cópia local do código de um terceiro.
Só lê o histórico (git log, git ls-files): não executa nada do repositório analisado.

    python .claude/scripts/propriedade-git.py --repo <cópia> --saida <pasta de evidências>
        [--desde "3 years ago"] [--sensiveis regras.csv] [--dias-parado 365] [--ignorar-autor REGEX]

Grava <saida>/propriedade.json (com e-mails: dado pessoal, mantenha fora do git) e
<saida>/propriedade.md (só nomes), e mostra o resumo.

Adaptado de security-ownership-map (github.com/openai/skills, via tech-leads-club/agent-skills,
Apache License 2.0): regras de caminho sensível, robôs ignorados, código sensível com um só
autor e parado, donos ocultos. Sem grafo, comunidades e exportação para Neo4j; fator ônibus
do projeto e atividade mensal acrescentados. Atribuição em
.claude/skills/avaliar-terceiros/references/ATRIBUICAO.md.
"""

from __future__ import annotations

import argparse
import datetime as dt
import fnmatch
import json
import re
import subprocess
import sys
from collections import defaultdict
from pathlib import Path

REGRAS_PADRAO: list[tuple[str, str]] = [
    ("**/auth/**", "autenticacao"),
    ("**/oauth/**", "autenticacao"),
    ("**/rbac/**", "autenticacao"),
    ("**/session/**", "autenticacao"),
    ("**/token/**", "autenticacao"),
    ("**/iam/**", "autenticacao"),
    ("**/sso/**", "autenticacao"),
    ("**/crypto/**", "criptografia"),
    ("**/tls/**", "criptografia"),
    ("**/ssl/**", "criptografia"),
    ("**/secrets/**", "segredos"),
    ("**/keys/**", "segredos"),
    ("**/*.pem", "segredos"),
    ("**/*.key", "segredos"),
    ("**/*.p12", "segredos"),
    ("**/*.pfx", "segredos"),
]

ROBOS = r"\[bot\]|dependabot|renovate|github-actions"
DIAS_ATIVO = 180
MESES_ATIVIDADE = 24
SEP_COMMIT, SEP_CAMPO = "\x1e", "\x1f"


# ------------------------------------------------------------------ leitura


def git(repo: Path, *args: str) -> str:
    proc = subprocess.run(
        ["git", "-c", "core.quotepath=off", "-C", str(repo), *args],
        capture_output=True, text=True, encoding="utf-8", errors="replace",
    )
    if proc.returncode != 0:
        raise RuntimeError(proc.stderr.strip() or f"git {' '.join(args)} falhou")
    return proc.stdout


def ler_commits(repo: Path, desde: str | None = None) -> list[dict]:
    """Commits sem merge, com autor, data e arquivos tocados."""
    args = ["log", "--no-merges", "--no-renames", "--name-only",
            f"--format={SEP_COMMIT}%H{SEP_CAMPO}%an{SEP_CAMPO}%ae{SEP_CAMPO}%aI"]
    if desde:
        args.append(f"--since={desde}")
    commits = []
    for bloco in git(repo, *args).split(SEP_COMMIT):
        linhas = [l for l in bloco.splitlines() if l.strip()]
        if not linhas:
            continue
        campos = linhas[0].split(SEP_CAMPO)
        if len(campos) < 4:
            continue
        commits.append({
            "hash": campos[0],
            "nome": campos[1],
            "email": campos[2].lower(),
            "data": dt.datetime.fromisoformat(campos[3]),
            "arquivos": linhas[1:],
        })
    return commits


def arquivos_atuais(repo: Path) -> set[str]:
    return {l for l in git(repo, "ls-files").splitlines() if l.strip()}


def carregar_regras(caminho: Path) -> list[tuple[str, str]]:
    regras = []
    for linha in Path(caminho).read_text(encoding="utf-8").splitlines():
        linha = linha.strip()
        if not linha or linha.startswith("#"):
            continue
        partes = [p.strip() for p in linha.split(",")]
        regras.append((partes[0], partes[1] if len(partes) > 1 and partes[1] else "sensivel"))
    return regras


# ------------------------------------------------------------------ cálculo


def etiquetas(caminho: str, regras: list[tuple[str, str]]) -> list[str]:
    posix = caminho.replace("\\", "/")
    achadas = set()
    for padrao, etiqueta in regras:
        candidatos = [padrao, padrao[3:]] if padrao.startswith("**/") else [padrao]
        if any(fnmatch.fnmatchcase(posix, c) for c in candidatos):
            achadas.add(etiqueta)
    return sorted(achadas)


def fator_onibus(contagens: dict[str, int]) -> int:
    """Menor número de pessoas que, somadas, fizeram mais da metade das mudanças."""
    total = sum(contagens.values())
    soma = 0
    for n, valor in enumerate(sorted(contagens.values(), reverse=True), start=1):
        soma += valor
        if soma * 2 > total:
            return n
    return 0


def meses_ate(agora: dt.datetime, quantidade: int) -> list[str]:
    ano, mes = agora.year, agora.month
    meses = []
    for _ in range(quantidade):
        meses.append(f"{ano:04d}-{mes:02d}")
        mes -= 1
        if mes == 0:
            ano, mes = ano - 1, 12
    return list(reversed(meses))


def resumir(commits: list[dict], atuais: set[str], agora: dt.datetime,
            regras: list[tuple[str, str]] | None = None, dias_parado: int = 365,
            ignorar: str = ROBOS, limiar_dono: float = 0.5) -> dict:
    regras = REGRAS_PADRAO if regras is None else regras
    filtro = re.compile(ignorar, re.IGNORECASE) if ignorar else None
    limite_12 = agora - dt.timedelta(days=365)
    meses = meses_ate(agora, MESES_ATIVIDADE)
    atividade = {m: 0 for m in meses}

    pessoas: dict[str, dict] = {}
    toques: dict[str, int] = defaultdict(int)
    toques_12: dict[str, int] = defaultdict(int)
    por_arquivo: dict[str, dict] = {}
    ignorados = 0

    for c in commits:
        quem = c["email"] or c["nome"]
        if filtro and filtro.search(f"{c['nome']} {c['email']}"):
            ignorados += 1
            continue
        p = pessoas.setdefault(quem, {"pessoa": quem, "nome": c["nome"], "commits": 0, "toques": 0,
                                      "primeiro": c["data"], "ultimo": c["data"]})
        p["commits"] += 1
        p["primeiro"] = min(p["primeiro"], c["data"])
        p["ultimo"] = max(p["ultimo"], c["data"])
        mes = c["data"].astimezone(dt.timezone.utc).strftime("%Y-%m")
        if mes in atividade:
            atividade[mes] += 1
        for arq in set(c["arquivos"]):
            if arq not in atuais:
                continue
            p["toques"] += 1
            toques[quem] += 1
            if c["data"] >= limite_12:
                toques_12[quem] += 1
            a = por_arquivo.setdefault(arq, {"autores": defaultdict(int), "ultimo": c["data"]})
            a["autores"][quem] += 1
            a["ultimo"] = max(a["ultimo"], c["data"])

    total_toques = sum(toques.values())
    lista_pessoas = []
    for p in sorted(pessoas.values(), key=lambda x: (-x["toques"], -x["commits"], x["nome"])):
        lista_pessoas.append({
            **p,
            "parcela": round(p["toques"] / total_toques, 4) if total_toques else 0.0,
            "ativo": (agora - p["ultimo"]).days <= DIAS_ATIVO,
            "primeiro": p["primeiro"].isoformat(),
            "ultimo": p["ultimo"].isoformat(),
        })

    sensiveis = []
    por_etiqueta: dict[str, dict[str, int]] = defaultdict(lambda: defaultdict(int))
    for arq, a in sorted(por_arquivo.items()):
        tags = etiquetas(arq, regras)
        if not tags:
            continue
        for tag in tags:
            for quem, n in a["autores"].items():
                por_etiqueta[tag][quem] += n
        autores = len(a["autores"])
        dono = max(a["autores"].items(), key=lambda item: item[1])[0]
        parado = (agora - a["ultimo"]).days
        sensiveis.append({
            "caminho": arq, "etiquetas": tags, "autores": autores,
            "dono": dono, "nome_dono": pessoas[dono]["nome"],
            "ultima_mudanca": a["ultimo"].isoformat(), "dias_parado": parado,
            "orfao": autores <= 1 and parado >= dias_parado,
        })

    donos_ocultos = []
    for tag, contagem in sorted(por_etiqueta.items()):
        total = sum(contagem.values())
        quem, n = max(contagem.items(), key=lambda item: item[1])
        if total and n / total >= limiar_dono:
            donos_ocultos.append({"etiqueta": tag, "pessoa": quem, "nome": pessoas[quem]["nome"],
                                  "parcela": round(n / total, 4)})

    datas = [c["data"] for c in commits]
    return {
        "gerado_em": agora.isoformat(),
        "totais": {
            "commits": len(commits) - ignorados,
            "commits_ignorados": ignorados,
            "pessoas": len(pessoas),
            "arquivos_atuais": len(atuais),
            "primeiro_commit": min(datas).isoformat() if datas else None,
            "ultimo_commit": max(datas).isoformat() if datas else None,
        },
        "fator_onibus": fator_onibus(toques),
        "fator_onibus_12_meses": fator_onibus(toques_12),
        "arquivos_um_autor": {
            "total": len(por_arquivo),
            "um_autor": sum(1 for a in por_arquivo.values() if len(a["autores"]) == 1),
        },
        "atividade_mensal": atividade,
        "pessoas": lista_pessoas,
        "sensiveis": [s for s in sensiveis if s["autores"] <= 1],
        "donos_ocultos": donos_ocultos,
    }


# ------------------------------------------------------------------ saída


def markdown(resumo: dict, limite_pessoas: int = 10) -> str:
    """Resumo legível, só com nomes (sem e-mails)."""
    t = resumo["totais"]
    um = resumo["arquivos_um_autor"]
    pct = f"{100 * um['um_autor'] / um['total']:.0f}%" if um["total"] else "—"
    linhas = [
        f"# Propriedade do código ({resumo['gerado_em'][:10]})", "",
        f"- Commits analisados: {t['commits']} (robôs ignorados: {t['commits_ignorados']}) · "
        f"pessoas: {t['pessoas']} · de {(t['primeiro_commit'] or '—')[:10]} a {(t['ultimo_commit'] or '—')[:10]}",
        f"- **Fator ônibus**: {resumo['fator_onibus']} · nos últimos 12 meses: {resumo['fator_onibus_12_meses']}",
        f"- Arquivos atuais com um só autor: {um['um_autor']} de {um['total']} ({pct})", "",
        "## Pessoas", "", "| Pessoa | Commits | Parcela das mudanças | Último commit | Ativa |", "|---|---|---|---|---|",
    ]
    for p in resumo["pessoas"][:limite_pessoas]:
        linhas.append(f"| {p['nome']} | {p['commits']} | {100 * p['parcela']:.0f}% | {p['ultimo'][:10]} | "
                      f"{'sim' if p['ativo'] else 'não'} |")
    linhas += ["", "## Atividade por mês", "", "| Mês | Commits |", "|---|---|"]
    linhas += [f"| {m} | {n} |" for m, n in resumo["atividade_mensal"].items()]
    linhas += ["", "## Código sensível com um só autor", ""]
    if resumo["sensiveis"]:
        linhas += ["| Arquivo | Área | Dono | Última mudança | Órfão |", "|---|---|---|---|---|"]
        linhas += [f"| `{s['caminho']}` | {', '.join(s['etiquetas'])} | {s['nome_dono']} | "
                   f"{s['ultima_mudanca'][:10]} | {'sim' if s['orfao'] else 'não'} |" for s in resumo["sensiveis"]]
    else:
        linhas.append("Nenhum (pelas regras usadas).")
    linhas += ["", "## Donos ocultos", ""]
    linhas += [f"- {d['etiqueta']}: {d['nome']} com {100 * d['parcela']:.0f}% das mudanças"
               for d in resumo["donos_ocultos"]] or ["Nenhum."]
    return "\n".join(linhas) + "\n"


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(description="Fator ônibus e propriedade do código pelo histórico do git.")
    ap.add_argument("--repo", required=True, help="pasta da cópia (com .git)")
    ap.add_argument("--saida", required=True, help="pasta de evidências (fora do git)")
    ap.add_argument("--desde", help='limita o histórico, ex.: "3 years ago"')
    ap.add_argument("--sensiveis", help="CSV padrão,etiqueta com caminhos sensíveis (substitui o padrão)")
    ap.add_argument("--dias-parado", type=int, default=365, help="dias sem mudança para código sensível ser órfão")
    ap.add_argument("--ignorar-autor", default=ROBOS, help="regex de autores ignorados (robôs)")
    args = ap.parse_args(argv)

    repo = Path(args.repo)
    if not (repo / ".git").exists():
        print(f"erro: {repo} não tem histórico do git (.git); registre em 'Não visto'.", file=sys.stderr)
        return 2
    try:
        commits = ler_commits(repo, args.desde)
        atuais = arquivos_atuais(repo)
        raso = git(repo, "rev-parse", "--is-shallow-repository").strip() == "true"
    except RuntimeError as erro:
        print(f"erro: {erro}", file=sys.stderr)
        return 2
    regras = carregar_regras(Path(args.sensiveis)) if args.sensiveis else None
    resumo = resumir(commits, atuais, dt.datetime.now(dt.timezone.utc), regras,
                     args.dias_parado, args.ignorar_autor)
    resumo["historico_raso"] = raso

    saida = Path(args.saida)
    saida.mkdir(parents=True, exist_ok=True)
    (saida / "propriedade.json").write_text(json.dumps(resumo, ensure_ascii=False, indent=2), encoding="utf-8")
    texto = markdown(resumo)
    if raso:
        texto += "\n> Histórico raso (clone com --depth): os números valem só para o trecho baixado.\n"
    (saida / "propriedade.md").write_text(texto, encoding="utf-8")
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    print(texto)
    return 0


if __name__ == "__main__":
    sys.exit(main())
