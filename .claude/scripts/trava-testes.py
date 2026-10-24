#!/usr/bin/env python3
"""Trava de testes: nada sai da branch sem a suíte verde.

Dois modos:

  python .claude/scripts/trava-testes.py --rodar
      Roda a suíte do projeto no commit atual (HEAD), mostra o resultado e, se passar,
      registra o commit como verde. É a "checagem final" dos fluxos.

  (hook PreToolUse do Bash, lendo o JSON da ferramenta pela entrada padrão)
      git push / gh pr create : libera se HEAD já está verde; senão roda a suíte agora
                                e bloqueia se falhar.
      git merge <branch>      : libera só se o último commit de <branch> já está verde;
                                senão bloqueia e diz como testar a branch.
      Outros comandos passam direto.

O comando da suíte fica em .specs/projeto/testes.json:
  {"comando": "npm test"}
  {"dispensado": true, "motivo": "repositório só de configuração"}   (com aprovação do usuário)

Bloquear = sair com código 2 e explicar na saída de erro (o Claude Code mostra ao modelo).
"""

import json
import os
import re
import subprocess
import sys
from datetime import datetime
from pathlib import Path

# Só conta quando é o comando de fato: no início ou depois de ;, &&, ||, | ou (.
# Texto "git push" dentro de uma string (ex.: um echo) não dispara a trava.
INICIO = r"(?:^|[;&|(])\s*"
PUSH_OU_PR = re.compile(INICIO + r"(?:git\s+push\b|gh\s+pr\s+create\b)")
MERGE = re.compile(INICIO + r"git\s+merge\s+(?:-[^\s]+\s+)*(?P<alvo>[^\s;&|\"'-][^\s;&|\"']*)")


def raiz_projeto(dados=None):
    base = os.environ.get("CLAUDE_PROJECT_DIR") or (dados or {}).get("cwd") or os.getcwd()
    return Path(base)


def config_testes(raiz):
    arquivo = raiz / ".specs" / "projeto" / "testes.json"
    if not arquivo.exists():
        return None
    return json.loads(arquivo.read_text(encoding="utf-8"))


def cache_verdes(raiz):
    return raiz / ".claude" / ".cache" / "suite-verde.json"


def ler_verdes(raiz):
    try:
        return json.loads(cache_verdes(raiz).read_text(encoding="utf-8"))
    except (OSError, ValueError):
        return {}


def gravar_verde(raiz, commit, resumo):
    verdes = ler_verdes(raiz)
    verdes[commit] = {"em": datetime.now().isoformat(timespec="seconds"), "resumo": resumo}
    caminho = cache_verdes(raiz)
    caminho.parent.mkdir(parents=True, exist_ok=True)
    caminho.write_text(json.dumps(verdes, ensure_ascii=False, indent=2), encoding="utf-8")


def git(raiz, *args):
    r = subprocess.run(["git", *args], cwd=raiz, capture_output=True, text=True)
    return r.stdout.strip() if r.returncode == 0 else None


def arvore_limpa(raiz):
    return git(raiz, "status", "--porcelain", "--untracked-files=no") == ""


def rodar_suite(raiz, config):
    """Roda a suíte. Devolve (passou, últimas linhas da saída)."""
    r = subprocess.run(config["comando"], cwd=raiz, shell=True, capture_output=True, text=True,
                       encoding="utf-8", errors="replace")
    saida = (r.stdout + r.stderr).strip().splitlines()
    return r.returncode == 0, "\n".join(saida[-15:])


def bloquear(mensagem):
    print(mensagem, file=sys.stderr)
    sys.exit(2)


def sem_config(raiz):
    bloquear(
        "Trava de testes: falta .specs/projeto/testes.json com o comando da suíte.\n"
        "Rode a skill `inventario` (ela registra o comando) ou crie o arquivo com "
        '{"comando": "<comando da suíte>"}. Projeto sem testes de propósito: '
        '{"dispensado": true, "motivo": "..."}, só com aprovação do usuário.'
    )


def modo_rodar():
    raiz = raiz_projeto()
    config = config_testes(raiz)
    if config is None:
        print("Falta .specs/projeto/testes.json (rode a skill inventario).")
        return 2
    if config.get("dispensado"):
        print(f"Testes dispensados neste projeto: {config.get('motivo', 'sem motivo registrado')}")
        return 0
    commit = git(raiz, "rev-parse", "HEAD")
    print(f"Rodando a suíte no commit {commit[:7] if commit else '?'}: {config['comando']}")
    passou, final = rodar_suite(raiz, config)
    print(final)
    if not passou:
        print("\nSUÍTE FALHOU. Nada de integrar ou implantar.")
        return 1
    if commit and arvore_limpa(raiz):
        gravar_verde(raiz, commit, final.splitlines()[-1] if final else "ok")
        print(f"\nSUÍTE VERDE. Commit {commit[:7]} registrado como verde.")
    else:
        print("\nSUÍTE VERDE, mas há mudanças não commitadas: faça o commit e rode de novo para registrar.")
    return 0


def modo_hook():
    dados = json.load(sys.stdin)
    comando = (dados.get("tool_input") or {}).get("command", "")
    merge = MERGE.search(comando)
    if not (PUSH_OU_PR.search(comando) or merge):
        return 0

    raiz = raiz_projeto(dados)
    config = config_testes(raiz)
    if config is None:
        sem_config(raiz)
    if config.get("dispensado"):
        return 0
    verdes = ler_verdes(raiz)

    if merge:
        alvo = merge.group("alvo")
        commit = git(raiz, "rev-parse", alvo)
        if commit is None or commit in verdes:
            return 0
        bloquear(
            f"Trava de testes: o último commit de `{alvo}` ({commit[:7]}) não tem a suíte verde registrada.\n"
            f"Teste a branch antes do merge: `git checkout {alvo}` e "
            "`python .claude/scripts/trava-testes.py --rodar`; depois volte e faça o merge."
        )

    commit = git(raiz, "rev-parse", "HEAD")
    if commit in verdes:
        return 0
    if not arvore_limpa(raiz):
        bloquear("Trava de testes: há mudanças não commitadas. Faça o commit e rode a suíte antes de enviar.")
    passou, final = rodar_suite(raiz, config)
    if passou:
        gravar_verde(raiz, commit, final.splitlines()[-1] if final else "ok")
        return 0
    bloquear(f"Trava de testes: a suíte falhou no commit {commit[:7]}. Envio bloqueado.\n{final}")


if __name__ == "__main__":
    sys.stdout.reconfigure(encoding="utf-8")
    sys.stderr.reconfigure(encoding="utf-8")
    sys.exit(modo_rodar() if "--rodar" in sys.argv else modo_hook())
