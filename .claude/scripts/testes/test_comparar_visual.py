"""Testes de comparar-visual.mjs (Node).

A suíte é Python; o script é Node porque roda no projeto da interface, onde o Playwright já
está. Aqui se testam as partes puras (importadas como módulo) e a linha de comando sem o
Playwright (--listar, erros de uso, dependência ausente). Precisa do `node` no PATH.
"""

import json
import shutil
import subprocess
import tempfile
import unittest
from pathlib import Path

from apoio import SCRIPTS

SCRIPT = SCRIPTS / "comparar-visual.mjs"
NODE = shutil.which("node")


def node_json(expressao):
    """Importa o script como módulo, avalia a expressão e devolve o resultado em JSON."""
    codigo = f"import * as m from {json.dumps(SCRIPT.as_uri())};\nconsole.log(JSON.stringify({expressao}));"
    r = subprocess.run([NODE, "--input-type=module", "-e", codigo], capture_output=True, text=True, encoding="utf-8")
    if r.returncode != 0:
        raise AssertionError(r.stderr)
    return json.loads(r.stdout)


def rodar(*args, cwd=None):
    r = subprocess.run([NODE, str(SCRIPT), *args], capture_output=True, text=True, encoding="utf-8", cwd=cwd)
    return r.returncode, r.stdout + r.stderr


MAPA = {
    "viewports": {"pc": {"width": 1440, "height": 900}, "celular": {"width": 390, "height": 844}},
    "telas": [
        {"id": "T1", "nome": "Pedidos", "mockup": "telas/pedidos.html", "rota": "/pedidos"},
        {"id": "T1", "estado": "erro", "mockup": "telas/pedidos--erro.html", "rota": "/pedidos", "viewports": ["pc"]},
        {"id": "T2", "mockup": "telas/perfil.html?aba=dados", "rota": "/perfil", "limite": 3},
    ],
}


class TestNodeDisponivel(unittest.TestCase):
    def test_node_no_path(self):
        self.assertIsNotNone(NODE, "node não encontrado no PATH: necessário para testar comparar-visual.mjs")


@unittest.skipIf(NODE is None, "node ausente (ver TestNodeDisponivel, que falha)")
class TestFuncoes(unittest.TestCase):
    def test_ler_args(self):
        r = node_json('m.lerArgs(["--base-url", "http://x", "--so-app", "--tela", "T1,T2"])')
        self.assertEqual(r, {"base-url": "http://x", "so-app": "true", "tela": "T1,T2"})

    def test_listar_expande_viewports_e_filtra(self):
        mapa = json.dumps(MAPA)
        todas = node_json(f"m.listarComparacoes({mapa}).map(c => c.rotulo)")
        self.assertEqual(todas, ["T1-sucesso-pc", "T1-sucesso-celular", "T1-erro-pc", "T2-sucesso-pc", "T2-sucesso-celular"])
        filtradas = node_json(f'm.listarComparacoes({mapa}, {{telas: "T2", viewport: "celular"}}).map(c => c.rotulo)')
        self.assertEqual(filtradas, ["T2-sucesso-celular"])

    def test_validar_mapa(self):
        self.assertEqual(node_json(f"m.validarMapa({json.dumps(MAPA)}, null)"), [])
        ruim = {"viewports": {"pc": {"width": 0}}, "telas": [{"id": "T9", "viewports": ["tablet"], "limite": -1}]}
        erros = " | ".join(node_json(f"m.validarMapa({json.dumps(ruim)}, null)"))
        for trecho in ('viewport "pc"', 'falta "rota"', 'falta "mockup"', 'viewport "tablet"', '"limite" inválido'):
            self.assertIn(trecho, erros)
        self.assertNotIn("mockup", " ".join(node_json(f"m.validarMapa({json.dumps(ruim)}, null, {{soApp: true}})")))
        self.assertIn('falta "telas"', node_json('m.validarMapa({viewports: {}}, null)')[1])

    def test_comparar_pixels(self):
        # dois pixels RGBA: o primeiro igual, o segundo difere em 40 no vermelho
        a, b = "[10,10,10,255, 100,100,100,255]", "[10,10,10,255, 140,100,100,255]"
        self.assertEqual(node_json(f"m.compararPixels({a}, {b}, 25.5)"), 1)
        self.assertEqual(node_json(f"m.compararPixels({a}, {b}, 50)"), 0)
        mascara = node_json(f"(() => {{ const s = new Array(8).fill(0); m.compararPixels({a}, {b}, 25.5, s); return s; }})()")
        self.assertEqual(mascara[4:], [255, 0, 0, 255])
        self.assertEqual(mascara[3], 255)
        self.assertGreaterEqual(mascara[0], 200)

    def test_avaliar_exige_limite_e_mesmo_tamanho(self):
        self.assertTrue(node_json('m.avaliar({porcentagem: 0.5, tamanhoMockup: "1x1", tamanhoApp: "1x1"}, 1)'))
        self.assertFalse(node_json('m.avaliar({porcentagem: 1.5, tamanhoMockup: "1x1", tamanhoApp: "1x1"}, 1)'))
        self.assertFalse(node_json('m.avaliar({porcentagem: 0, tamanhoMockup: "1x1", tamanhoApp: "1x2"}, 1)'))

    def test_url_app_com_flag(self):
        self.assertEqual(node_json('m.urlApp("http://x/", "/p", null)'), "http://x/p")
        self.assertEqual(node_json('m.urlApp("http://x", "/p", "ui=nova")'), "http://x/p?ui=nova")
        self.assertEqual(node_json('m.urlApp("http://x", "/p?a=1#topo", "ui=nova")'), "http://x/p?a=1&ui=nova#topo")

    def test_relatorio(self):
        texto = node_json(
            'm.montarRelatorio({data: "2026-10-23", baseUrl: "http://x", limite: 1, limiar: 0.1, navegador: "chromium",'
            ' saida: "C:\\\\a\\\\b", linhas: ["| T1 | sucesso | pc | 0.00% | 1×1 / 1×1 | 1% | **OK** | `x` |"], soApp: false})'
        )
        self.assertIn("Comparação visual mockup × aplicação (2026-10-23)", texto)
        self.assertIn("**OK**", texto)
        self.assertIn("`C:/a/b`", texto)
        so_app = node_json(
            'm.montarRelatorio({data: "d", baseUrl: "u", limite: 1, limiar: 0.1, navegador: "firefox", saida: "s", linhas: [], soApp: true})'
        )
        self.assertIn("Capturas da aplicação", so_app)
        self.assertNotIn("Limite padrão", so_app)


@unittest.skipIf(NODE is None, "node ausente (ver TestNodeDisponivel, que falha)")
class TestLinhaDeComando(unittest.TestCase):
    def setUp(self):
        self._tmp = tempfile.TemporaryDirectory()
        self.pasta = Path(self._tmp.name)
        (self.pasta / "telas").mkdir()
        for nome in ("pedidos.html", "pedidos--erro.html", "perfil.html"):
            (self.pasta / "telas" / nome).write_text("<html></html>", encoding="utf-8")
        self.config = self.pasta / "telas.json"
        self.config.write_text(json.dumps(MAPA), encoding="utf-8")

    def tearDown(self):
        self._tmp.cleanup()

    def test_sem_base_url_e_sem_listar(self):
        codigo, saida = rodar("--config", str(self.config))
        self.assertEqual(codigo, 2)
        self.assertIn("Uso:", saida)

    def test_mapa_ausente(self):
        codigo, saida = rodar("--listar", "--config", str(self.pasta / "nao-existe.json"))
        self.assertEqual(codigo, 2)
        self.assertIn("não encontrado", saida)

    def test_listar_mapa_valido(self):
        codigo, saida = rodar("--listar", "--config", str(self.config), "--tela", "T1")
        self.assertEqual(codigo, 0, saida)
        self.assertIn("3 comparação(ões)", saida)
        self.assertIn("T1-erro-pc", saida)

    def test_listar_acusa_mockup_ausente_menos_no_so_app(self):
        (self.pasta / "telas" / "perfil.html").unlink()
        codigo, saida = rodar("--listar", "--config", str(self.config))
        self.assertEqual(codigo, 2)
        self.assertIn("mockup não encontrado: telas/perfil.html?aba=dados", saida)
        codigo, saida = rodar("--listar", "--so-app", "--config", str(self.config))
        self.assertEqual(codigo, 0, saida)

    def test_json_invalido(self):
        self.config.write_text("{ isto não é json", encoding="utf-8")
        codigo, saida = rodar("--listar", "--config", str(self.config))
        self.assertEqual(codigo, 2)
        self.assertIn("não é JSON válido", saida)

    def test_navegador_invalido(self):
        codigo, saida = rodar("--base-url", "http://localhost:1", "--config", str(self.config), "--navegador", "opera")
        self.assertEqual(codigo, 2)
        self.assertIn("--navegador", saida)

    def test_playwright_ausente(self):
        codigo, saida = rodar(
            "--base-url", "http://localhost:1", "--config", str(self.config), "--pacote", str(self.pasta), cwd=self.pasta
        )
        self.assertEqual(codigo, 2)
        self.assertIn("Playwright não encontrado", saida)
        self.assertFalse((self.pasta / "comparacao").exists(), "não deve criar a pasta de saída sem o Playwright")


if __name__ == "__main__":
    unittest.main()
