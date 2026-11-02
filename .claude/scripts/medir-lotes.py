#!/usr/bin/env python3
"""Mede o que cada subagente (lote) de um projeto consumiu, lendo os registros do Claude Code.

Para cada agente mostra: chamadas, contexto final (o número do "Agent map"), leitura de
cache acumulada (o que pesa de verdade no consumo: cada chamada relê o contexto inteiro),
saída gerada, duração e o maior intervalo sem atividade (acima de PARADO_MIN = lote que
travou, como uma resposta cortada no meio). Serve para calibrar o teto de horas do lote.

Uso:
  python .claude/scripts/medir-lotes.py <pasta do projeto> [--sessao <id>] [--ultimos N]

A pasta do projeto é a do código (ex.: C:\\Leandro\\Projetos\\GestaoDaPelada_LJS); os
registros ficam em ~/.claude/projects/<pasta com os símbolos trocados por hífen>/. Sem
--sessao, usa todas as sessões. Somente leitura.
"""

import argparse
import json
import re
import sys
from datetime import datetime
from pathlib import Path

PARADO_MIN = 30  # intervalo sem registro acima disso é lote parado, não trabalho lento
AVISO_CONTEXTO = 250_000  # contexto final acima disso: lote grande demais


def pasta_de_registros(projeto, raiz=None):
    """Acha a pasta de registros do projeto (nome = caminho com símbolos virando hífen, sem diferenciar maiúsculas)."""
    raiz = Path(raiz) if raiz else Path.home() / ".claude" / "projects"
    alvo = re.sub(r"[^A-Za-z0-9]", "-", str(projeto)).lower()
    if not raiz.is_dir():
        return None
    for pasta in raiz.iterdir():
        if pasta.is_dir() and pasta.name.lower() == alvo:
            return pasta
    return None


def _hora(texto):
    return datetime.fromisoformat(texto.replace("Z", "+00:00"))


def medir_agente(arquivo):
    """Lê um agent-*.jsonl e devolve as medidas, ou None se não houver chamadas."""
    chamadas = {}
    horas = []
    for linha in Path(arquivo).read_text(encoding="utf-8", errors="replace").splitlines():
        try:
            reg = json.loads(linha)
        except ValueError:
            continue
        if reg.get("timestamp"):
            horas.append(_hora(reg["timestamp"]))
        msg = reg.get("message")
        if reg.get("type") == "assistant" and isinstance(msg, dict) and msg.get("usage"):
            chamadas[msg.get("id") or reg.get("uuid")] = msg["usage"]
    if not chamadas or not horas:
        return None

    def soma(campo):
        return sum(u.get(campo) or 0 for u in chamadas.values())

    ultimo = list(chamadas.values())[-1]
    contexto = sum(ultimo.get(c) or 0 for c in ("input_tokens", "cache_read_input_tokens", "cache_creation_input_tokens"))
    horas.sort()
    maior = max((b - a for a, b in zip(horas, horas[1:])), default=None)
    meta = {}
    meta_arq = Path(str(arquivo)[: -len(".jsonl")] + ".meta.json")
    if meta_arq.is_file():
        try:
            meta = json.loads(meta_arq.read_text(encoding="utf-8"))
        except ValueError:
            pass
    return {
        "descricao": meta.get("description", Path(arquivo).stem),
        "tipo": meta.get("agentType", "?"),
        "chamadas": len(chamadas),
        "contexto_final": contexto,
        "leitura_cache": soma("cache_read_input_tokens"),
        "escrita_cache": soma("cache_creation_input_tokens"),
        "saida": soma("output_tokens"),
        "minutos": (horas[-1] - horas[0]).total_seconds() / 60,
        "maior_pausa_min": maior.total_seconds() / 60 if maior else 0,
        "inicio": horas[0],
    }


def agentes_do_projeto(pasta, sessao=None):
    padrao = f"{sessao}/subagents/agent-*.jsonl" if sessao else "*/subagents/agent-*.jsonl"
    medidas = [m for m in (medir_agente(a) for a in sorted(pasta.glob(padrao))) if m]
    return sorted(medidas, key=lambda m: m["inicio"])


def _k(n):
    return f"{n / 1000:.0f}k"


def formatar(medidas):
    linhas = ["Agente | Chamadas | Contexto final | Leitura de cache | Saída | Duração | Maior pausa"]
    for m in medidas:
        marcas = []
        if m["maior_pausa_min"] > PARADO_MIN:
            marcas.append("PAROU")
        if m["contexto_final"] > AVISO_CONTEXTO:
            marcas.append("CONTEXTO GRANDE")
        linhas.append(
            f"{m['descricao'][:48]} | {m['chamadas']} | {_k(m['contexto_final'])} | {m['leitura_cache'] / 1e6:.1f}M | "
            f"{_k(m['saida'])} | {m['minutos']:.0f} min | {m['maior_pausa_min']:.0f} min"
            + (f"  <- {', '.join(marcas)}" if marcas else "")
        )
    if medidas:
        n = len(medidas)
        ctx = sorted(m["contexto_final"] for m in medidas)
        linhas.append(
            f"\n{n} agentes · contexto final: mediana {_k(ctx[n // 2])}, máximo {_k(ctx[-1])} · "
            f"leitura de cache total {sum(m['leitura_cache'] for m in medidas) / 1e6:.1f}M · "
            f"{sum(m['maior_pausa_min'] > PARADO_MIN for m in medidas)} com pausa acima de {PARADO_MIN} min"
        )
    return "\n".join(linhas)


def main(argv=None):
    p = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    p.add_argument("projeto", help="pasta do código do projeto")
    p.add_argument("--sessao", help="id da sessão (nome da pasta dentro dos registros)")
    p.add_argument("--ultimos", type=int, help="só os N agentes mais recentes")
    p.add_argument("--raiz", help="pasta dos registros (padrão: ~/.claude/projects)")
    args = p.parse_args(argv)
    pasta = pasta_de_registros(args.projeto, args.raiz)
    if not pasta:
        print(f"Sem registros do Claude Code para {args.projeto}.", file=sys.stderr)
        return 2
    medidas = agentes_do_projeto(pasta, args.sessao)
    if args.ultimos:
        medidas = medidas[-args.ultimos:]
    if not medidas:
        print("Nenhum subagente com chamadas nos registros.")
        return 0
    print(formatar(medidas))
    return 0


if __name__ == "__main__":
    sys.stdout.reconfigure(encoding="utf-8")
    sys.exit(main())
