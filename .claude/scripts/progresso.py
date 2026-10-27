#!/usr/bin/env python3
"""Progresso do trabalho: quantas tarefas já foram concluídas, no item atual e no projeto.

Só lê. Soma as tarefas de todos os `tasks.md` em `.specs/` (features, refatorações, performance,
redesign etc.) e mostra, por exemplo:

    Plano: Faltam 6 de 18 etapas: 67% concluído
    Em andamento: 12 Front: telas do app
    Item atual (.specs/features/importar-extrato): Faltam 3 de 4 tarefas: 25% concluído
    Projeto: Faltam 45 de 180 tarefas: 75% concluído

As duas últimas linhas vêm dos `tasks.md`. As duas primeiras vêm de `.specs/projeto/roadmap.md`,
quando existir: uma tabela com uma linha por etapa ou feature e uma coluna `Situação` com
Concluída, Em andamento ou Não começada. É o que cobre o que ainda não virou tarefa.

Uma tarefa é o título `### T<n>:` do `tasks.md`. Conta como concluída quando todas as caixas
`- [ ]` dela estão marcadas; sem caixas, quando a linha `**Status**:` diz concluída (Done,
Concluída, Complete ou ✅). Caixa aberta vence o status. Checklists fora das tarefas não contam.

Item atual: o argumento --item; senão o `**Item**` da seção `## Retomada` de `.specs/STATE.md`;
senão o único item com tarefas em aberto. Sem tarefas, mostra a fase do fluxo da Retomada.

Uso:
  python .claude/scripts/progresso.py [--raiz DIR] [--item PASTA] [--json]

Sai com 0 e com 2 quando a raiz não existe.
"""

from __future__ import annotations

import argparse
import json
import re
import sys
from pathlib import Path

ROADMAP = ".specs/projeto/roadmap.md"
PASTAS_FORA = {"node_modules", "evidencias", "codigo", ".git", "__pycache__"}
TITULO_TAREFA = re.compile(r"^(#{2,4})\s+T\d+\s*:", re.IGNORECASE)
TITULO = re.compile(r"^(#{1,6})\s")
CAIXA = re.compile(r"^\s*[-*]\s+\[([ xX])\]")
STATUS = re.compile(r"^\s*\*\*Status\*\*\s*:\s*(.*)$", re.IGNORECASE)
STATUS_FEITO = re.compile(r"✅|\b(done|complete|completed|conclu[ií]d[oa]s?)\b", re.IGNORECASE)
CAMPO_RETOMADA = re.compile(r"^\s*-\s+\*\*(Fluxo|Item|Fase aprovada|Próxima fase)\*\*\s*:\s*(.+?)\s*$")


def contar_tarefas(texto: str) -> tuple[int, int]:
    """(total, feitas) das tarefas `### T<n>:` de um tasks.md."""
    blocos: list[list[str]] = []
    atual: list[str] | None = None
    nivel = 0
    for linha in texto.splitlines():
        achou = TITULO_TAREFA.match(linha)
        if achou:
            atual = []
            blocos.append(atual)
            nivel = len(achou.group(1))
            continue
        titulo = TITULO.match(linha)
        if titulo and len(titulo.group(1)) <= nivel:
            atual = None
        if atual is not None:
            atual.append(linha)
    return len(blocos), sum(1 for b in blocos if _tarefa_feita(b))


def _tarefa_feita(linhas: list[str]) -> bool:
    caixas = [m.group(1) for m in map(CAIXA.match, linhas) if m]
    if caixas:
        return all(c in "xX" for c in caixas)
    for linha in linhas:
        status = STATUS.match(linha)
        if status:
            return bool(STATUS_FEITO.search(status.group(1)))
    return False


def coletar(raiz: Path) -> list[dict]:
    """Um registro por tasks.md com tarefas em `.specs/`: item, total e feitas."""
    specs = Path(raiz) / ".specs"
    itens = []
    if not specs.is_dir():
        return itens
    for arquivo in sorted(specs.rglob("tasks.md")):
        relativo = arquivo.relative_to(raiz)
        if PASTAS_FORA & set(relativo.parts):
            continue
        total, feitas = contar_tarefas(arquivo.read_text(encoding="utf-8", errors="replace"))
        if total:
            itens.append({"item": relativo.parent.as_posix(), "total": total, "feitas": feitas})
    return itens


def frase(feitas: int, total: int, unidade: str = "tarefas") -> str:
    if total == 0:
        return "Sem tarefas ainda"
    faltam = total - feitas
    pct = round(feitas * 100 / total)
    if faltam:
        pct = min(pct, 99)
        verbo = "Falta 1" if faltam == 1 else f"Faltam {faltam}"
        return f"{verbo} de {total} {unidade}: {pct}% concluído"
    return f"Todas as {total} {unidade} concluídas: 100% concluído"


def _celulas(linha: str) -> list[str]:
    return [c.strip() for c in linha.strip().strip("|").split("|")]


def _limpo(celula: str) -> str:
    return re.sub(r"[*`]", "", celula).strip()


def ler_roadmap(texto: str) -> dict | None:
    """Unidades (etapas, features) de uma tabela com coluna `Situação`: total, feitas, nome e em andamento."""
    total = feitas = 0
    nome, em_andamento = None, []
    situacao = None
    for linha in texto.splitlines():
        if not linha.lstrip().startswith("|"):
            situacao = None
            continue
        celulas = _celulas(linha)
        if situacao is None:
            cabecalho = [_limpo(c).lower() for c in celulas]
            situacao = next((i for i, c in enumerate(cabecalho) if c in ("situação", "situacao")), None)
            if situacao is not None and nome is None:
                rotulo = next((c for i, c in enumerate(cabecalho)
                               if i != situacao and c not in ("#", "n", "nº", "no", "id", "")), None)
                nome = (rotulo + ("" if rotulo.endswith("s") else "s")) if rotulo else "unidades"
            continue
        if set(linha.replace("|", "").strip()) <= set("-: "):
            continue
        if situacao >= len(celulas):
            continue
        estado = _limpo(celulas[situacao]).lower()
        total += 1
        if re.search(r"conclu[ií]d[oa]", estado):
            feitas += 1
        elif "andamento" in estado:
            partes = [_limpo(c) for i, c in enumerate(celulas[:2]) if i != situacao and _limpo(c)]
            em_andamento.append(" ".join(partes))
    if not total:
        return None
    return {"nome": nome or "unidades", "total": total, "feitas": feitas, "em_andamento": em_andamento}


def ler_retomada(texto: str) -> dict:
    """Campos da seção `## Retomada` do STATE.md: fluxo, item, fase_aprovada, proxima_fase."""
    chaves = {"Fluxo": "fluxo", "Item": "item", "Fase aprovada": "fase_aprovada", "Próxima fase": "proxima_fase"}
    dentro, campos = False, {}
    for linha in texto.splitlines():
        if linha.startswith("## "):
            dentro = linha.strip() == "## Retomada"
            continue
        achou = CAMPO_RETOMADA.match(linha) if dentro else None
        if achou:
            valor = achou.group(2)
            if achou.group(1) == "Item":
                valor = _caminho_do_item(valor)
            else:
                valor = re.sub(r"\s+—\s+skill `[^`]*`.*$", "", valor)
            campos[chaves[achou.group(1)]] = valor
    return campos


def _caminho_do_item(valor: str) -> str:
    """O campo Item traz o caminho, às vezes seguido de texto (lista de arquivos, observação)."""
    achou = re.search(r"`([^`]+)`", valor)
    caminho = achou.group(1) if achou else valor.split()[0]
    return caminho.rstrip("/")


def _curto(texto: str, limite: int = 100) -> str:
    return texto if len(texto) <= limite else texto[: limite - 1].rstrip() + "…"


def _normalizar(item: str) -> str:
    return item.strip().strip("`").replace("\\", "/").rstrip("/")


def relatorio(raiz: Path, item: str | None = None) -> dict:
    raiz = Path(raiz)
    itens = coletar(raiz)
    state = raiz / ".specs" / "STATE.md"
    retomada = ler_retomada(state.read_text(encoding="utf-8", errors="replace")) if state.exists() else {}

    nome = _normalizar(item) if item else retomada.get("item")
    por_nome = {i["item"]: i for i in itens}
    atual = None
    if nome:
        achado = por_nome.get(nome, {"total": 0, "feitas": 0})
        atual = {"nome": nome, "total": achado["total"], "feitas": achado["feitas"]}
    else:
        abertos = [i for i in itens if i["feitas"] < i["total"]]
        if len(abertos) == 1:
            atual = {"nome": abertos[0]["item"], "total": abertos[0]["total"], "feitas": abertos[0]["feitas"]}

    arquivo_roadmap = raiz / ROADMAP
    plano = ler_roadmap(arquivo_roadmap.read_text(encoding="utf-8", errors="replace")) if arquivo_roadmap.exists() else None

    total = sum(i["total"] for i in itens)
    feitas = sum(i["feitas"] for i in itens)
    return {"plano": plano, "item": atual, "projeto": {"total": total, "feitas": feitas},
            "retomada": retomada, "itens": itens}


def formatar(rel: dict) -> str:
    projeto = rel["projeto"]
    plano = rel.get("plano")
    linhas = []
    if plano:
        linhas.append(f"Plano: {frase(plano['feitas'], plano['total'], plano['nome'])}")
        if plano["em_andamento"]:
            linhas.append("Em andamento: " + "; ".join(_curto(e, 60) for e in plano["em_andamento"]))
    if projeto["total"] == 0:
        if plano:
            return "\n".join(linhas + [f"Projeto: {frase(0, 0)}"])
        linhas.append(frase(0, 0))
        r = rel["retomada"]
        if r:
            linhas.append(f"Fluxo: {_curto(r.get('fluxo', '?'))}")
            if "fase_aprovada" in r:
                linhas.append(f"Fase aprovada: {_curto(r['fase_aprovada'])}")
            if "proxima_fase" in r:
                linhas.append(f"Próxima fase: {_curto(r['proxima_fase'])}")
        else:
            linhas.append("(nenhum tasks.md em .specs/ e nenhuma Retomada gravada)")
        return "\n".join(linhas)
    if rel["item"]:
        linhas.append(f"Item atual ({rel['item']['nome']}): {frase(rel['item']['feitas'], rel['item']['total'])}")
    linhas.append(f"Projeto: {frase(projeto['feitas'], projeto['total'])}")
    return "\n".join(linhas)


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(description="Progresso: tarefas concluídas no item atual e no projeto.")
    ap.add_argument("--raiz", default=".", help="raiz do projeto, onde fica .specs/ (padrão: pasta atual)")
    ap.add_argument("--item", help="pasta do item atual (ex.: .specs/features/importar-extrato)")
    ap.add_argument("--json", action="store_true", help="saída em JSON")
    args = ap.parse_args(argv)
    for fluxo in (sys.stdout, sys.stderr):  # em pipe no Windows o padrão é cp1252; quem lê espera UTF-8
        if hasattr(fluxo, "reconfigure"):
            fluxo.reconfigure(encoding="utf-8")
    raiz = Path(args.raiz)
    if not raiz.is_dir():
        print(f"Raiz não encontrada: {raiz}", file=sys.stderr)
        return 2
    rel = relatorio(raiz, args.item)
    print(json.dumps(rel, ensure_ascii=False, indent=2) if args.json else formatar(rel))
    return 0


if __name__ == "__main__":
    sys.exit(main())
