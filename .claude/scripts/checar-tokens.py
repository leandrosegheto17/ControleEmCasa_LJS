#!/usr/bin/env python3
"""Procura cores e fontes definidas fora do tokens.css no código de interface.

Garante que a implementação use só as variáveis do guia de estilo aprovado
(.specs/mockup/tokens.css). Não checa espaçamentos: números em px aparecem em
contextos demais (bordas de 1px, ícones) e gerariam ruído.

Uso:
  python .claude/scripts/checar-tokens.py <pasta ou arquivo> [<pasta ou arquivo> ...] [--permitir arquivo1,arquivo2]

Aceita várias pastas e arquivos: no redesign, só o código da interface nova é checado
enquanto a antiga convive com ela (ex.: a pasta dos componentes novos e as telas novas).

Sai com código 1 se encontrar valores soltos, listando arquivo:linha, e com 2 se algum
caminho não existir. Arquivos chamados tokens.css são sempre permitidos.
"""

import argparse
import re
import sys
from pathlib import Path

ESTILO = {".css", ".scss", ".sass", ".less"}
EXTENSOES = ESTILO | {".html", ".vue", ".svelte", ".jsx", ".tsx", ".js", ".ts"}
IGNORAR_PASTAS = {"node_modules", "dist", "build", ".next", ".nuxt", ".svelte-kit", "coverage", ".git", ".specs", "vendor"}

HEX = r"#(?:[0-9a-fA-F]{8}|[0-9a-fA-F]{6}|[0-9a-fA-F]{3,4})\b"
COMUNS = {
    "cor rgb/hsl": re.compile(r"\b(?:rgba?|hsla?|oklch|oklab)\(\s*\d"),
    "fonte solta": re.compile(r"font-?[fF]amily\s*:\s*(?![\s'\"]*(?:var\(|(?:inherit|initial|unset)\b))[^;,}]+"),
}
# Em folha de estilo, qualquer #hex é cor. Em HTML/JS, só quando aparece como valor
# (entre aspas ou depois de ":"), para não confundir com âncoras (#topo) ou referências (#123).
HEX_ESTILO = re.compile(r"(?<![\w&/-])" + HEX)
HEX_VALOR = re.compile(r"(?:[:'\"`]\s*)" + HEX)


def linhas_suspeitas(arquivo):
    try:
        texto = arquivo.read_text(encoding="utf-8")
    except (UnicodeDecodeError, OSError):
        return
    padroes = {"cor hexadecimal": HEX_ESTILO if arquivo.suffix in ESTILO else HEX_VALOR, **COMUNS}
    for numero, linha in enumerate(texto.splitlines(), start=1):
        for nome, padrao in padroes.items():
            if padrao.search(linha):
                yield numero, nome, linha.strip()[:120]
                break


def main():
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("caminhos", nargs="+", help="pastas ou arquivos do código de interface (ex.: src, web/src/ui-nova)")
    parser.add_argument("--permitir", default="", help="nomes de arquivo permitidos, separados por vírgula")
    args = parser.parse_args()

    ausentes = [c for c in args.caminhos if not Path(c).exists()]
    if ausentes:
        print("Caminho não encontrado: " + ", ".join(ausentes))
        return 2
    permitidos = {"tokens.css", *filter(None, (n.strip() for n in args.permitir.split(",")))}

    arquivos = {}
    for caminho in map(Path, args.caminhos):
        if caminho.is_file():
            arquivos[caminho.resolve()] = caminho
            continue
        for arquivo in caminho.rglob("*"):
            if arquivo.is_file() and not any(parte in IGNORAR_PASTAS for parte in arquivo.relative_to(caminho).parts):
                arquivos[arquivo.resolve()] = arquivo

    achados = []
    for arquivo in sorted(arquivos.values(), key=lambda a: a.as_posix()):
        if arquivo.suffix not in EXTENSOES or arquivo.name in permitidos:
            continue
        for numero, tipo, trecho in linhas_suspeitas(arquivo):
            achados.append(f"{arquivo.as_posix()}:{numero}  [{tipo}]  {trecho}")

    if not achados:
        print("OK: nenhuma cor ou fonte fora do tokens.css.")
        return 0
    print(f"{len(achados)} valor(es) fora do tokens.css:")
    print("\n".join(achados))
    return 1


if __name__ == "__main__":
    sys.stdout.reconfigure(encoding="utf-8")
    sys.exit(main())
