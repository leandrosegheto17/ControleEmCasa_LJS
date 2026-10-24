"""Apoio comum aos testes dos scripts de .claude/scripts."""

import importlib.util
import subprocess
from pathlib import Path

SCRIPTS = Path(__file__).resolve().parents[1]


def carregar(nome_arquivo):
    """Importa um script com hífen no nome (ex.: trava-testes.py) como módulo."""
    caminho = SCRIPTS / nome_arquivo
    spec = importlib.util.spec_from_file_location(nome_arquivo.replace("-", "_")[:-3], caminho)
    modulo = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(modulo)
    return modulo


def git(pasta, *args):
    subprocess.run(["git", *args], cwd=pasta, check=True, capture_output=True, text=True)


def repo_git(pasta):
    """Cria um repositório git vazio, com autor configurado e branch principal 'main'."""
    git(pasta, "init", "-q", "-b", "main")
    git(pasta, "config", "user.email", "teste@exemplo.com")
    git(pasta, "config", "user.name", "teste")
    git(pasta, "config", "core.autocrlf", "false")


def commitar(pasta, mensagem="commit"):
    git(pasta, "add", "-A")
    git(pasta, "commit", "-q", "-m", mensagem)
