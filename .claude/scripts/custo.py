#!/usr/bin/env python3
"""Soma o consumo de tokens das sessões do Claude Code de um projeto.

Lê só as transcrições (`~/.claude/projects/<pasta>/**/*.jsonl`); não altera nada. Serve para
medir o custo de uma feature, de uma fase ou de um fluxo, e para comparar dois fluxos na mesma
tarefa. Separa a sessão principal dos subagentes e agrupa por modelo, agente, dia ou branch.

Uso:
  python .claude/scripts/custo.py [--projeto <pasta em ~/.claude/projects> | --pasta <caminho>] [--desde AAAA-MM-DD[THH:MM]]
      [--ate AAAA-MM-DD[THH:MM]] [--por modelo|agente|dia|branch|sessao] [--branch <nome>]
      [--tabela precos.json] [--json]

Sem --projeto, usa a pasta do projeto atual. Horários em UTC, como gravados nas transcrições.
`--tabela` é um JSON `{"<modelo>": {"entrada": 0, "saida": 0, "cache_lido": 0, "cache_gravado": 0}}` com o
preço por milhão de tokens; sem ele, só os tokens são mostrados (o script não conhece preços).
"""

import argparse
import json
import re
import sys
from collections import defaultdict
from datetime import datetime, timezone
from pathlib import Path

CAMPOS = ("entrada", "saida", "cache_lido", "cache_gravado", "chamadas")


def pasta_do_projeto(cwd: Path) -> str:
    """Nome que o Claude Code dá à pasta de transcrições de um diretório de trabalho."""
    return re.sub(r"[^A-Za-z0-9]", "-", str(cwd))


def instante(texto: str | None, fim: bool = False) -> datetime | None:
    if not texto:
        return None
    if len(texto) == 10:
        texto += "T23:59:59" if fim else "T00:00:00"
    return datetime.fromisoformat(texto).replace(tzinfo=timezone.utc)


def agente_do_arquivo(arquivo: Path) -> str:
    """Tipo do subagente (meta.json ao lado da transcrição); 'principal' para a sessão."""
    if "subagents" not in arquivo.parts:
        return "principal"
    meta = arquivo.with_suffix(".meta.json")
    try:
        return json.loads(meta.read_text(encoding="utf-8")).get("agentType") or "subagente"
    except (OSError, ValueError):
        return "subagente"


def ler(raiz: Path, desde=None, ate=None, branch=None):
    """Gera um registro por chamada ao modelo, sem repetir a mesma resposta."""
    vistos = set()
    for arquivo in sorted(raiz.rglob("*.jsonl")):
        agente = agente_do_arquivo(arquivo)
        sessao = arquivo.parent.parent.name if "subagents" in arquivo.parts else arquivo.stem
        for linha in arquivo.open(encoding="utf-8", errors="ignore"):
            try:
                d = json.loads(linha)
            except ValueError:
                continue
            msg = d.get("message")
            if not isinstance(msg, dict) or msg.get("role") != "assistant" or not msg.get("usage"):
                continue
            chave = (msg.get("id"), d.get("requestId"))
            if chave in vistos:
                continue
            vistos.add(chave)
            try:
                quando = datetime.fromisoformat(d["timestamp"].replace("Z", "+00:00"))
            except (KeyError, ValueError):
                continue
            if (desde and quando < desde) or (ate and quando > ate):
                continue
            if branch and d.get("gitBranch") != branch:
                continue
            uso = msg["usage"]
            modelo = (msg.get("model") or "?").replace("claude-", "")
            if modelo == "<synthetic>":
                continue
            yield {
                "modelo": modelo, "agente": agente, "dia": quando.date().isoformat(), "sessao": sessao,
                "branch": d.get("gitBranch") or "?",
                "entrada": uso.get("input_tokens", 0), "saida": uso.get("output_tokens", 0),
                "cache_lido": uso.get("cache_read_input_tokens", 0),
                "cache_gravado": uso.get("cache_creation_input_tokens", 0),
            }


def somar(registros, por):
    grupos = defaultdict(lambda: dict.fromkeys(CAMPOS, 0))
    for r in registros:
        chaves = [r[p] for p in por]
        g = grupos[tuple(chaves)]
        for c in CAMPOS[:4]:
            g[c] += r[c]
        g["chamadas"] += 1
    return grupos


def custo(g, modelo, tabela):
    preco = tabela.get(modelo)
    if not preco:
        return None
    return sum(g[c] * preco.get(c, 0) for c in CAMPOS[:4]) / 1_000_000


def main(argv=None):
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument("--projeto")
    p.add_argument("--pasta", help="caminho completo da pasta de transcrições (no lugar de --projeto)")
    p.add_argument("--desde")
    p.add_argument("--ate")
    p.add_argument("--por", default="modelo,agente", help="uma ou mais chaves separadas por vírgula")
    p.add_argument("--branch")
    p.add_argument("--tabela")
    p.add_argument("--json", action="store_true")
    a = p.parse_args(argv)
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8")

    raiz = Path(a.pasta) if a.pasta else Path.home() / ".claude" / "projects" / (a.projeto or pasta_do_projeto(Path.cwd()))
    if not raiz.is_dir():
        print(f"Sem transcrições em {raiz}", file=sys.stderr)
        return 2
    por = [c.strip() for c in a.por.split(",") if c.strip()]
    invalidas = set(por) - {"modelo", "agente", "dia", "branch", "sessao"}
    if invalidas or not por:
        print(f"--por inválido: {', '.join(sorted(invalidas)) or 'vazio'}", file=sys.stderr)
        return 2
    tabela = json.loads(Path(a.tabela).read_text(encoding="utf-8")) if a.tabela else {}

    grupos = somar(ler(raiz, instante(a.desde), instante(a.ate, fim=True), a.branch), por)
    linhas = []
    for chaves, g in sorted(grupos.items()):
        modelo = chaves[por.index("modelo")] if "modelo" in por else None
        linhas.append({**dict(zip(por, chaves)), **g, "custo": custo(g, modelo, tabela) if modelo else None})
    total = {c: sum(l[c] for l in linhas) for c in CAMPOS}

    if a.json:
        print(json.dumps({"linhas": linhas, "total": total}, ensure_ascii=False, indent=2))
        return 0
    for l in linhas:
        rotulo = " | ".join(str(l[c]) for c in por)
        extra = f" | custo {l['custo']:.2f}" if l["custo"] is not None else ""
        print(f"{rotulo}: saída {l['saida']:,} | cache lido {l['cache_lido']:,} | cache gravado {l['cache_gravado']:,}"
              f" | entrada {l['entrada']:,} | chamadas {l['chamadas']}{extra}")
    print(f"TOTAL: saída {total['saida']:,} | cache lido {total['cache_lido']:,} | cache gravado {total['cache_gravado']:,}"
          f" | entrada {total['entrada']:,} | chamadas {total['chamadas']}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
