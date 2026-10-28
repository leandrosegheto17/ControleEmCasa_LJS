#!/usr/bin/env python3
"""Progresso do trabalho, do produto até a tarefa: Produto > Feature > Phase > Tarefa.

Só lê. Soma as tarefas de todos os `tasks.md` em `.specs/` (features, refatorações, performance,
redesign etc.) e mostra, por exemplo:

    Produto: Faltam 6 de 18 etapas: 67% concluído
    Em andamento: 12 Front: telas do app
    Feature atual (.specs/features/importar-extrato): Faltam 3 de 4 tarefas: 25% concluído
    Phase atual (Phase 2: Core): Falta 1 de 2 tarefas: 50% concluído
    Tarefa atual: T3 — Importar o arquivo (estimada 1h)
    Última tarefa: T2 há 12 min (38 min; estimada 1h)
    Ritmo: 4,1 tarefas/h · faltam ~3h de trabalho humano estimado · previsão ~1h no ritmo atual
    Projeto: Faltam 45 de 180 tarefas: 75% concluído   (só quando há mais de um tasks.md)

As linhas de Feature para baixo vêm dos `tasks.md`. As duas primeiras vêm de
`.specs/projeto/roadmap.md`, quando existir: uma tabela com uma linha por etapa ou feature e uma
coluna `Situação` com Concluída, Em andamento ou Não começada. É o que cobre o que ainda não virou
tarefa.

Uma tarefa é o título `### T<n>:` do `tasks.md`. Conta como concluída quando todas as caixas
`- [ ]` dela estão marcadas; sem caixas, quando a linha `**Status**:` diz concluída (Done,
Concluída, Complete ou ✅). Caixa aberta vence o status. Checklists fora das tarefas não contam.
A Phase de cada tarefa vem dos diagramas `### Phase N:` do Execution Plan.

Tempo: o `git log` do `tasks.md` diz quando cada tarefa foi concluída. O tempo de uma tarefa é o
intervalo desde a conclusão anterior (aproximação: inclui o que o orquestrador fez entre as duas);
intervalo acima de PAUSA_MIN conta como pausa e a tarefa fica sem tempo medido. Sem git, o tempo
some e o resto continua.

Lote: Phases inteiras seguidas que somam até LOTE_HORAS de `**Estimativa**` (tarefa sem
estimativa conta 1h). Serve para o resumo, os marcos de troca de sessão e o V2 do lote.

Avisos: tarefa com `**Estimativa**` acima de 2h (LIMITE_HORAS) e, em tasks.md que já usa o campo,
tarefa sem estimativa. Não há limite de quantidade de tarefas; o limite é o tamanho de cada uma.

Feature atual: o argumento --item; senão o `**Item**` da seção `## Retomada` de `.specs/STATE.md`;
senão o único item com tarefas em aberto (ou o único item, se tudo estiver concluído). Sem tarefas,
mostra a fase do fluxo da Retomada.

Uso:
  python .claude/scripts/progresso.py [--raiz DIR] [--item PASTA] [--json]
  python .claude/scripts/progresso.py --tarefa [T12]   # V2 da tarefa (padrão: a última concluída)
  python .claude/scripts/progresso.py --lote [N]       # V2 do lote (padrão: o da última concluída)

Sai com 0, com 1 quando a tarefa ou o lote pedido não existe e com 2 quando a raiz não existe.
"""

from __future__ import annotations

import argparse
import json
import re
import subprocess
import sys
import time
from pathlib import Path

ROADMAP = ".specs/projeto/roadmap.md"
LIMITE_HORAS = 2.0  # tarefa acima disso é grande demais: avise e peça para dividir (não há limite de quantidade)
LOTE_HORAS = 14.0  # lote = Phases inteiras somando até isso (7 tarefas de 2h, a capacidade que o tlc calibrou)
HORAS_SEM_ESTIMATIVA = 1.0  # peso da tarefa sem Estimativa ao montar o lote
PAUSA_MIN = 90  # intervalo maior entre duas conclusões é pausa, não tempo de trabalho
JANELA_RITMO = 10  # o ritmo e o fator de calibração usam as últimas tarefas com tempo medido
LIMITE_COMMITS = 80  # quantos commits do tasks.md o git log lê
PASTAS_FORA = {"node_modules", "evidencias", "codigo", ".git", "__pycache__"}
TITULO_TAREFA = re.compile(r"^(#{2,4})\s+(T\d+)\s*:", re.IGNORECASE)
ESTIMATIVA = re.compile(r"^\s*\*\*Estimativa\*\*\s*:\s*(.*?)\s*$", re.IGNORECASE)
DURACAO = re.compile(r"(\d+(?:[.,]\d+)?)\s*(h(?:oras?)?|min(?:utos?)?)\b", re.IGNORECASE)
TITULO = re.compile(r"^(#{1,6})\s")
CAIXA = re.compile(r"^\s*[-*]\s+\[([ xX])\]")
STATUS = re.compile(r"^\s*\*\*Status\*\*\s*:\s*(.*)$", re.IGNORECASE)
STATUS_FEITO = re.compile(r"✅|\b(done|complete|completed|conclu[ií]d[oa]s?)\b", re.IGNORECASE)
CAMPO_RETOMADA = re.compile(r"^\s*-\s+\*\*(Fluxo|Item|Fase aprovada|Próxima fase)\*\*\s*:\s*(.+?)\s*$")
TITULO_FASE = re.compile(r"^(#{2,4})\s+(?:Phase|Fase)\s+(\d+)\b[:.\-—]?\s*(.*?)\s*$", re.IGNORECASE)
DEPENDE = re.compile(r"^\s*\*\*Depends on\*\*\s*:\s*(.*)$", re.IGNORECASE)
ID_TAREFA = re.compile(r"\bT\d+\b", re.IGNORECASE)


def _blocos(texto: str) -> list[tuple[str, list[str]]]:
    """Cada tarefa `### T<n>:` de um tasks.md: (id, linhas do bloco)."""
    blocos: list[tuple[str, list[str]]] = []
    atual: list[str] | None = None
    nivel = 0
    for linha in texto.splitlines():
        achou = TITULO_TAREFA.match(linha)
        if achou:
            atual = []
            blocos.append((achou.group(2).upper(), atual))
            nivel = len(achou.group(1))
            continue
        titulo = TITULO.match(linha)
        if titulo and len(titulo.group(1)) <= nivel:
            atual = None
        if atual is not None:
            atual.append(linha)
    return blocos


def contar_tarefas(texto: str) -> tuple[int, int]:
    """(total, feitas) das tarefas `### T<n>:` de um tasks.md."""
    blocos = _blocos(texto)
    return len(blocos), sum(1 for _, b in blocos if _tarefa_feita(b))


def ler_estimativa(valor: str) -> float | None:
    """Horas de trabalho humano de um campo `**Estimativa**` (ex.: 2h, 1,5h, 90 min); None se ilegível."""
    achou = DURACAO.search(valor or "")
    if not achou:
        return None
    numero = float(achou.group(1).replace(",", "."))
    return numero / 60 if achou.group(2).lower().startswith("min") else numero


def estimativas(texto: str) -> list[tuple[str, float | None]]:
    """(id, horas ou None) de cada tarefa do tasks.md."""
    resultado = []
    for id_, linhas in _blocos(texto):
        horas = None
        for linha in linhas:
            achou = ESTIMATIVA.match(linha)
            if achou:
                horas = ler_estimativa(achou.group(1))
                break
        resultado.append((id_, horas))
    return resultado


def _tarefa_feita(linhas: list[str]) -> bool:
    caixas = [m.group(1) for m in map(CAIXA.match, linhas) if m]
    if caixas:
        return all(c in "xX" for c in caixas)
    for linha in linhas:
        status = STATUS.match(linha)
        if status:
            return bool(STATUS_FEITO.search(status.group(1)))
    return False


def _numero(id_: str) -> int:
    return int(id_[1:])


def _estrutura(texto: str) -> tuple[list[dict], dict[str, str]]:
    """Phases do tasks.md e título de cada tarefa.

    A Phase de uma tarefa vem do diagrama `### Phase N:` do Execution Plan (os `T<n>` que aparecem
    sob o título) ou, quando a tarefa está escrita dentro da Phase (título mais fundo), da posição.
    """
    fases: list[dict] = []
    titulos: dict[str, str] = {}
    donas: dict[str, int] = {}
    atual: int | None = None
    nivel = 0
    em_tarefa = False
    for linha in texto.splitlines():
        titulo = TITULO.match(linha)
        if not titulo:
            if atual is not None and not em_tarefa:
                for achado in ID_TAREFA.findall(linha):
                    donas.setdefault(achado.upper(), atual)
            continue
        n = len(titulo.group(1))
        fase = TITULO_FASE.match(linha)
        if fase:
            nome = f"Phase {fase.group(2)}" + (f": {fase.group(3)}" if fase.group(3) else "")
            fases.append({"numero": int(fase.group(2)), "nome": nome, "ids": []})
            atual, nivel, em_tarefa = len(fases) - 1, n, False
            continue
        tarefa = TITULO_TAREFA.match(linha)
        if tarefa:
            id_ = tarefa.group(2).upper()
            titulos[id_] = linha.split(":", 1)[1].strip()
            if atual is not None and n > nivel:
                donas.setdefault(id_, atual)
                em_tarefa = True
                continue
        if atual is not None and n <= nivel:
            atual = None
        em_tarefa = bool(tarefa)
    for id_, indice in donas.items():
        fases[indice]["ids"].append(id_)
    for fase in fases:
        fase["ids"] = sorted(set(fase["ids"]), key=_numero)
    return fases, titulos


def tarefas_de(texto: str) -> tuple[list[dict], list[dict]]:
    """(tarefas, fases) de um tasks.md; cada tarefa: id, titulo, fase, est, feita, deps."""
    fases, titulos = _estrutura(texto)
    estimadas = dict(estimativas(texto))
    fase_de = {id_: f for f in fases for id_ in f["ids"]}
    tarefas = []
    for id_, linhas in _blocos(texto):
        deps: list[str] = []
        for linha in linhas:
            achou = DEPENDE.match(linha)
            if achou:
                deps = [d.upper() for d in ID_TAREFA.findall(achou.group(1))]
                break
        fase = fase_de.get(id_)
        tarefas.append({"id": id_, "titulo": titulos.get(id_, ""), "fase": fase["numero"] if fase else None,
                        "est": estimadas.get(id_), "feita": _tarefa_feita(linhas), "deps": deps})
    return tarefas, [f for f in fases if f["ids"]]


def lotes_de(tarefas: list[dict], fases: list[dict]) -> list[dict]:
    """Lotes: Phases inteiras seguidas somando até LOTE_HORAS (sem Estimativa, a tarefa conta 1h).

    Sem Phases, cada tarefa é uma unidade. Um lote final com até 2 tarefas vira parte do anterior.
    """
    por_id = {t["id"]: t for t in tarefas}
    unidades = []
    vistos: set[str] = set()
    for fase in fases:
        ids = [i for i in fase["ids"] if i in por_id]
        if ids:
            unidades.append((fase["numero"], ids))
            vistos.update(ids)
    resto = [t["id"] for t in tarefas if t["id"] not in vistos]
    unidades += [(None, [i]) for i in resto] if not fases else ([(None, resto)] if resto else [])

    def peso(ids: list[str]) -> float:
        return sum(por_id[i]["est"] if por_id[i]["est"] is not None else HORAS_SEM_ESTIMATIVA for i in ids)

    lotes: list[dict] = []
    atual: dict | None = None
    for posicao, (numero, ids) in enumerate(unidades):
        if atual is None:
            atual = {"fases": [], "tarefas": [], "horas": 0.0}
        if numero is not None:
            atual["fases"].append(numero)
        atual["tarefas"] += ids
        atual["horas"] += peso(ids)
        if atual["horas"] >= LOTE_HORAS and posicao < len(unidades) - 1:
            lotes.append(atual)
            atual = None
    if atual is not None:
        lotes.append(atual)
    if len(lotes) > 1 and len(lotes[-1]["tarefas"]) <= 2:
        ultimo = lotes.pop()
        lotes[-1]["fases"] += ultimo["fases"]
        lotes[-1]["tarefas"] += ultimo["tarefas"]
        lotes[-1]["horas"] += ultimo["horas"]
    for numero, lote in enumerate(lotes, 1):
        lote["numero"] = numero
    return lotes


def _git(pasta: Path, *args: str, entrada: bytes | None = None) -> bytes | None:
    try:
        r = subprocess.run(["git", "-C", str(pasta), *args], input=entrada, capture_output=True, timeout=60)
    except (OSError, subprocess.SubprocessError):
        return None
    return r.stdout if r.returncode == 0 else None


def _versoes(topo: Path, pedidos: list[str]) -> list[str]:
    """Conteúdo de cada `commit:caminho` (vazio quando não existe), em uma só chamada ao git."""
    saida = _git(topo, "cat-file", "--batch", entrada=("\n".join(pedidos) + "\n").encode("utf-8"))
    if saida is None:
        return [""] * len(pedidos)
    textos, posicao = [], 0
    for _ in pedidos:
        fim = saida.find(b"\n", posicao)
        if fim < 0:
            textos.append("")
            continue
        cabecalho = saida[posicao:fim].split()
        posicao = fim + 1
        if len(cabecalho) >= 3 and cabecalho[1] == b"blob":
            tamanho = int(cabecalho[2])
            textos.append(saida[posicao:posicao + tamanho].decode("utf-8", errors="replace"))
            posicao += tamanho + 1
        else:
            textos.append("")
    return textos


def conclusoes(arquivo: Path, limite: int = LIMITE_COMMITS) -> list[tuple[int, list[str]]]:
    """[(epoch, ids concluídos nesse commit)] do mais antigo ao mais novo, pelo git log do tasks.md."""
    topo = _git(arquivo.parent, "rev-parse", "--show-toplevel")
    if not topo:
        return []
    topo_path = Path(topo.decode("utf-8", errors="replace").strip())
    try:
        relativo = arquivo.resolve().relative_to(topo_path.resolve()).as_posix()
    except ValueError:
        return []
    log = _git(topo_path, "log", f"-n{limite}", "--format=%H %ct", "--", relativo)
    commits = [l.split() for l in (log or b"").decode("utf-8", errors="replace").splitlines() if l.strip()]
    if not commits:
        return []
    pedidos = [f"{h}:{relativo}" for h, _ in commits] + [f"{commits[-1][0]}^:{relativo}"]
    feitas = [{i for i, b in _blocos(t) if _tarefa_feita(b)} for t in _versoes(topo_path, pedidos)]
    eventos = []
    for posicao, (_, ts) in enumerate(commits):
        novas = sorted(feitas[posicao] - feitas[posicao + 1], key=_numero)
        if novas:
            eventos.append((int(ts), novas))
    return eventos[::-1]


def duracoes(eventos: list[tuple[int, list[str]]]) -> dict[str, dict]:
    """Por tarefa concluída: quando (epoch) e segundos desde a conclusão anterior (None: sem medida)."""
    medidas: dict[str, dict] = {}
    anterior = None
    for ts, ids in eventos:
        intervalo = None if anterior is None else ts - anterior
        if intervalo is not None and intervalo > PAUSA_MIN * 60:
            intervalo = None
        for id_ in ids:
            medidas[id_] = {"quando": ts, "segundos": None if intervalo is None else intervalo / len(ids)}
        anterior = ts
    return medidas


def ritmo_de(tarefas: list[dict]) -> dict | None:
    """Tarefas por hora e fator real/estimado das últimas tarefas com tempo medido."""
    medidas = [t for t in tarefas if t.get("segundos") is not None]
    medidas.sort(key=lambda t: t["quando"])
    janela = medidas[-JANELA_RITMO:]
    segundos = sum(t["segundos"] for t in janela)
    if not janela or segundos <= 0:
        return None
    com_estimativa = [t for t in janela if t["est"]]
    fator = None
    if com_estimativa:
        fator = sum(t["segundos"] for t in com_estimativa) / 3600 / sum(t["est"] for t in com_estimativa)
    return {"por_hora": len(janela) * 3600 / segundos, "fator": fator, "amostra": len(janela)}


def detalhar(arquivo: Path) -> dict:
    """Tarefas (com Phase, estimativa, conclusão e tempo), fases, lotes e ritmo de um tasks.md."""
    tarefas, fases = tarefas_de(arquivo.read_text(encoding="utf-8", errors="replace"))
    medidas = duracoes(conclusoes(arquivo))
    for t in tarefas:
        medida = medidas.get(t["id"]) if t["feita"] else None
        t["quando"] = medida["quando"] if medida else None
        t["segundos"] = medida["segundos"] if medida else None
    return {"tarefas": tarefas, "fases": fases, "lotes": lotes_de(tarefas, fases), "ritmo": ritmo_de(tarefas)}


def _dur(horas: float) -> str:
    minutos = max(1, round(horas * 60))
    if minutos < 60:
        return f"{minutos} min"
    h, m = divmod(minutos, 60)
    return f"{h}h{m:02d}" if m else f"{h}h"


def _decimal(valor: float) -> str:
    return f"{valor:.1f}".replace(".", ",")


def _ha(segundos: float) -> str:
    if segundos < 90:
        return "agora há pouco"
    if segundos < 3600:
        return f"há {round(segundos / 60)} min"
    if segundos < 86400:
        return f"há {round(segundos / 3600)}h"
    return f"há {round(segundos / 86400)} dias"


def _proxima(tarefas: list[dict]) -> dict | None:
    """Primeira tarefa pendente com as dependências prontas (senão, a primeira pendente)."""
    feitas = {t["id"] for t in tarefas if t["feita"]}
    todas = {t["id"] for t in tarefas}
    pendentes = [t for t in tarefas if not t["feita"]]
    for t in pendentes:
        if all(d in feitas or d not in todas for d in t["deps"]):
            return t
    return pendentes[0] if pendentes else None


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
        texto = arquivo.read_text(encoding="utf-8", errors="replace")
        total, feitas = contar_tarefas(texto)
        if total:
            horas = estimativas(texto)
            adotou = any(h is not None for _, h in horas)
            itens.append({"item": relativo.parent.as_posix(), "total": total, "feitas": feitas,
                          "acima": [i for i, h in horas if h is not None and h > LIMITE_HORAS],
                          "sem_estimativa": [i for i, h in horas if h is None] if adotou else []})
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


def relatorio(raiz: Path, item: str | None = None, agora: float | None = None) -> dict:
    raiz = Path(raiz)
    agora = time.time() if agora is None else agora
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
        unico = abertos if abertos else itens  # tudo concluído: o único item ainda é o atual
        if len(unico) == 1:
            atual = {"nome": unico[0]["item"], "total": unico[0]["total"], "feitas": unico[0]["feitas"]}

    arquivo_roadmap = raiz / ROADMAP
    plano = ler_roadmap(arquivo_roadmap.read_text(encoding="utf-8", errors="replace")) if arquivo_roadmap.exists() else None

    total = sum(i["total"] for i in itens)
    feitas = sum(i["feitas"] for i in itens)
    avisos = []
    for i in itens:
        for tipo in ("acima", "sem_estimativa"):
            if i[tipo]:
                avisos.append({"item": i["item"], "tipo": tipo, "tarefas": i[tipo]})
    detalhe = None
    if atual and atual["total"]:
        detalhe = detalhar(raiz / atual["nome"] / "tasks.md")
    return {"plano": plano, "item": atual, "projeto": {"total": total, "feitas": feitas},
            "retomada": retomada, "itens": itens, "avisos": avisos, "detalhe": detalhe, "agora": agora}


def formatar(rel: dict) -> str:
    texto = _formatar_linhas(rel)
    avisos = [_aviso(a) for a in rel.get("avisos", [])]
    return "\n".join([texto, *avisos])


def _contagem(tarefas: list[dict]) -> str:
    return frase(sum(1 for t in tarefas if t["feita"]), len(tarefas))


def _linhas_detalhe(rel: dict) -> list[str]:
    """V3 (Phase e Tarefa atuais) e V1 (última tarefa, ritmo e previsão) do item atual."""
    det = rel.get("detalhe")
    if not det:
        return []
    tarefas = det["tarefas"]
    linhas = []
    pendentes = [t for t in tarefas if not t["feita"]]
    fase = next((f for f in det["fases"] if any(not t["feita"] for t in tarefas if t["fase"] == f["numero"])), None)
    if fase:
        da_fase = [t for t in tarefas if t["fase"] == fase["numero"]]
        linhas.append(f"Phase atual ({_curto(fase['nome'], 60)}): {_contagem(da_fase)}")
    proxima = _proxima(tarefas)
    if proxima:
        est = f" (estimada {_dur(proxima['est'])})" if proxima["est"] else ""
        titulo = f" — {_curto(proxima['titulo'], 70)}" if proxima["titulo"] else ""
        linhas.append(f"Tarefa atual: {proxima['id']}{titulo}{est}")
    concluidas = sorted((t for t in tarefas if t["quando"]), key=lambda t: t["quando"])
    if concluidas:
        ultima = concluidas[-1]
        medida = _dur(ultima["segundos"] / 3600) if ultima["segundos"] is not None else "tempo não medido"
        est = f"; estimada {_dur(ultima['est'])}" if ultima["est"] else ""
        linhas.append(f"Última tarefa: {ultima['id']} {_ha(rel['agora'] - ultima['quando'])} ({medida}{est})")
    ritmo = det["ritmo"]
    if pendentes and (ritmo or any(t["est"] for t in pendentes)):
        partes = []
        if ritmo:
            partes.append(f"{_decimal(ritmo['por_hora'])} tarefas/h")
        horas = sum(t["est"] for t in pendentes if t["est"])
        if horas:
            partes.append(f"faltam ~{_dur(horas)} de trabalho humano estimado")
        if ritmo:
            previsao = horas * ritmo["fator"] if horas and ritmo["fator"] else len(pendentes) / ritmo["por_hora"]
            partes.append(f"previsão ~{_dur(previsao)} no ritmo atual")
        linhas.append("Ritmo: " + " · ".join(partes))
    return linhas


def _escolher_lote(det: dict, numero: int | None) -> dict | None:
    lotes = det["lotes"]
    if numero is not None:
        return next((l for l in lotes if l["numero"] == numero), None)
    por_id = {t["id"]: t for t in det["tarefas"]}
    ultima = max((t for t in det["tarefas"] if t["quando"]), key=lambda t: t["quando"], default=None)
    alvo = ultima["id"] if ultima else (_proxima(det["tarefas"]) or {}).get("id")
    return next((l for l in lotes if alvo in l["tarefas"] and alvo in por_id), lotes[0] if lotes else None)


def linha_tarefa(rel: dict, id_: str | None = None) -> str | None:
    """V2 da tarefa: tempo gasto, tempo estimado e onde ela está na Phase e na feature; None se não existe."""
    det = rel.get("detalhe")
    if not det:
        return None
    tarefas = det["tarefas"]
    if id_:
        t = next((t for t in tarefas if t["id"] == id_.upper()), None)
    else:
        t = max((t for t in tarefas if t["quando"]), key=lambda t: t["quando"], default=None)
    if t is None:
        return None
    if not t["feita"]:
        return f"{t['id']} ainda não concluída"
    gasto = _dur(t["segundos"] / 3600) if t["segundos"] is not None else "tempo não medido"
    est = f" (estimada {_dur(t['est'])})" if t["est"] else ""
    partes = [f"{t['id']} concluída: {gasto}{est}"]
    da_fase = [x for x in tarefas if x["fase"] == t["fase"]] if t["fase"] is not None else []
    if da_fase:
        nome = next(f["nome"] for f in det["fases"] if f["numero"] == t["fase"]).split(":")[0]
        partes.append(f"{nome}: {sum(1 for x in da_fase if x['feita'])} de {len(da_fase)} tarefas")
    item = rel["item"]
    pct = min(99, round(item["feitas"] * 100 / item["total"])) if item["feitas"] < item["total"] else 100
    partes.append(f"Feature: {item['feitas']} de {item['total']} tarefas ({pct}%)")
    return " · ".join(partes)


def linha_lote(rel: dict, numero: int | None = None) -> str | None:
    """V2 do lote: tarefas, tempo gasto e estimado, e o andamento da feature; None se não existe."""
    det = rel.get("detalhe")
    if not det:
        return None
    lote = _escolher_lote(det, numero)
    if lote is None:
        return None
    por_id = {t["id"]: t for t in det["tarefas"]}
    do_lote = [por_id[i] for i in lote["tarefas"]]
    feitas = [t for t in do_lote if t["feita"]]
    medidas = [t for t in feitas if t["segundos"] is not None]
    gasto = _dur(sum(t["segundos"] for t in medidas) / 3600) if medidas else "tempo não medido"
    conhecidas = [t["est"] for t in do_lote if t["est"]]
    sem = len(do_lote) - len(conhecidas)
    estimado = f"estimado {_dur(sum(conhecidas))}" if conhecidas else "sem estimativa"
    if conhecidas and sem:
        estimado += f" + {sem} sem estimativa"
    if len(feitas) == len(do_lote):
        corpo = f"concluído: {len(do_lote)} tarefas em {gasto} ({estimado})"
    else:
        corpo = f"em andamento: {len(feitas)} de {len(do_lote)} tarefas, {gasto} até agora ({estimado})"
    if medidas and len(medidas) < len(feitas):
        corpo += f"; tempo medido em {len(medidas)} de {len(feitas)}"
    item = rel["item"]
    pct = min(99, round(item["feitas"] * 100 / item["total"])) if item["feitas"] < item["total"] else 100
    return (f"Lote {lote['numero']} de {len(det['lotes'])} {corpo} · "
            f"Feature: {item['feitas']} de {item['total']} tarefas ({pct}%)")


def _aviso(a: dict) -> str:
    ids = a["tarefas"]
    lista = ", ".join(ids[:5]) + (f" e mais {len(ids) - 5}" if len(ids) > 5 else "")
    n = len(ids)
    if a["tipo"] == "acima":
        return (f"Aviso: {a['item']}: {n} tarefa{'s' if n > 1 else ''} acima de {LIMITE_HORAS:g}h ({lista}); "
                f"divida em tarefas de até {LIMITE_HORAS:g}h.")
    return f"Aviso: {a['item']}: {n} tarefa{'s' if n > 1 else ''} sem **Estimativa** ({lista})."


def _formatar_linhas(rel: dict) -> str:
    projeto = rel["projeto"]
    plano = rel.get("plano")
    linhas = []
    if plano:
        linhas.append(f"Produto: {frase(plano['feitas'], plano['total'], plano['nome'])}")
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
    item = rel["item"]
    if item:
        linhas.append(f"Feature atual ({item['nome']}): {frase(item['feitas'], item['total'])}")
        linhas += _linhas_detalhe(rel)
    if not item or (item["total"], item["feitas"]) != (projeto["total"], projeto["feitas"]):
        linhas.append(f"Projeto: {frase(projeto['feitas'], projeto['total'])}")
    return "\n".join(linhas)


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(description="Progresso: do produto à tarefa (Produto > Feature > Phase > Tarefa).")
    ap.add_argument("--raiz", default=".", help="raiz do projeto, onde fica .specs/ (padrão: pasta atual)")
    ap.add_argument("--item", help="pasta da feature atual (ex.: .specs/features/importar-extrato)")
    ap.add_argument("--json", action="store_true", help="saída em JSON")
    ap.add_argument("--tarefa", nargs="?", const="", metavar="T12",
                    help="V2 da tarefa: tempo gasto e estimado (sem ID, a última concluída)")
    ap.add_argument("--lote", nargs="?", const="", metavar="N",
                    help="V2 do lote: tempo gasto e estimado (sem número, o da última concluída)")
    args = ap.parse_args(argv)
    for fluxo in (sys.stdout, sys.stderr):  # em pipe no Windows o padrão é cp1252; quem lê espera UTF-8
        if hasattr(fluxo, "reconfigure"):
            fluxo.reconfigure(encoding="utf-8")
    raiz = Path(args.raiz)
    if not raiz.is_dir():
        print(f"Raiz não encontrada: {raiz}", file=sys.stderr)
        return 2
    rel = relatorio(raiz, args.item)
    if args.tarefa is not None or args.lote is not None:
        if args.lote is not None and not (args.lote == "" or args.lote.isdigit()):
            print(f"Lote inválido: {args.lote} (use o número do lote)", file=sys.stderr)
            return 2
        if args.tarefa is not None:
            linha = linha_tarefa(rel, args.tarefa or None)
            falta = f"Tarefa {args.tarefa or '(nenhuma concluída)'} não encontrada na feature atual"
        else:
            linha = linha_lote(rel, int(args.lote) if args.lote else None)
            falta = f"Lote {args.lote or '(atual)'} não encontrado na feature atual"
        if linha is None:
            print(falta, file=sys.stderr)
            return 1
        print(json.dumps({"linha": linha}, ensure_ascii=False) if args.json else linha)
        return 0
    print(json.dumps(rel, ensure_ascii=False, indent=2) if args.json else formatar(rel))
    return 0


if __name__ == "__main__":
    sys.exit(main())
