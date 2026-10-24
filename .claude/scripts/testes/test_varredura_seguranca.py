import json
import tempfile
import threading
import unittest
from http.server import BaseHTTPRequestHandler, HTTPServer
from pathlib import Path
from unittest import mock

from apoio import carregar, commitar, repo_git

vs = carregar("varredura-seguranca.py")

CHAVE_FALSA = "AKIA" + "ABCDEFGHIJKLMNOP"  # montada em partes para não disparar varreduras deste repositório


class Manipulador(BaseHTTPRequestHandler):
    def log_message(self, *args):
        pass

    def do_GET(self):
        if self.path == "/ok":
            corpo, status, extras = "tudo certo", 200, {"X-Content-Type-Options": "nosniff"}
        elif self.path == "/erro":
            corpo, status, extras = "Traceback (most recent call last):\n  File x", 500, {}
        elif self.path == "/cors":
            corpo, status, extras = "{}", 200, {"Access-Control-Allow-Origin": "*", "X-Content-Type-Options": "nosniff"}
        else:
            corpo, status, extras = "dados de outra conta", 200, {"X-Content-Type-Options": "nosniff"}
        self.send_response(status)
        for k, v in extras.items():
            self.send_header(k, v)
        self.end_headers()
        self.wfile.write(corpo.encode("utf-8"))


class TestHostPermitido(unittest.TestCase):
    def test_localhost_sempre(self):
        for url in ("http://localhost:8000", "http://127.0.0.1/x", "http://[::1]:3000", "http://app.localhost"):
            self.assertTrue(vs.host_permitido(url, None), url)

    def test_outro_host_so_com_permissao_igual(self):
        self.assertFalse(vs.host_permitido("https://staging.exemplo.com", None))
        self.assertFalse(vs.host_permitido("https://producao.exemplo.com", "staging.exemplo.com"))
        self.assertTrue(vs.host_permitido("https://staging.exemplo.com/api", "staging.exemplo.com"))

    def test_esquema_nao_http_recusado(self):
        self.assertFalse(vs.host_permitido("file:///etc/passwd", None))
        self.assertFalse(vs.host_permitido("ftp://localhost/", None))


class TestSondas(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.servidor = HTTPServer(("127.0.0.1", 0), Manipulador)
        cls.base = f"http://127.0.0.1:{cls.servidor.server_port}"
        threading.Thread(target=cls.servidor.serve_forever, daemon=True).start()

    @classmethod
    def tearDownClass(cls):
        cls.servidor.shutdown()
        cls.servidor.server_close()

    def setUp(self):
        self._tmp = tempfile.TemporaryDirectory()
        self.pasta = Path(self._tmp.name)

    def tearDown(self):
        self._tmp.cleanup()

    def gravar_sondas(self, config):
        arq = self.pasta / "sondas.json"
        arq.write_text(json.dumps(config), encoding="utf-8")
        return arq

    def test_detecta_status_vazamento_cors_e_cabecalho(self):
        config = {
            "cabecalhos_esperados": {"X-Content-Type-Options": "nosniff"},
            "sondas": [
                {"nome": "ok", "caminho": "/ok", "status_esperado": [200]},
                {"nome": "SEC-001 conta B lê pedido de A", "caminho": "/pedidos/1", "status_esperado": [403, 404]},
                {"nome": "erro", "caminho": "/erro"},
                {"nome": "cors", "caminho": "/cors"},
            ],
        }
        resultados, gerais = vs.rodar_sondas(self.base, config)
        por_nome = {r["nome"]: r["falhas"] for r in resultados}
        self.assertEqual(por_nome["ok"], [])
        self.assertTrue(any("status 200" in f for f in por_nome["SEC-001 conta B lê pedido de A"]))
        self.assertTrue(any("stack trace Python" in f for f in por_nome["erro"]))
        self.assertTrue(any("CORS aberto" in f for f in por_nome["cors"]))
        self.assertTrue(any("X-Content-Type-Options" in g for g in gerais))

    def test_cli_estrito_reprova_e_grava_resumo(self):
        arq = self.gravar_sondas({"sondas": [{"nome": "erro", "caminho": "/erro"}]})
        codigo = vs.main(["sondas", "--alvo", self.base, "--sondas", str(arq), "--saida", str(self.pasta / "ev"),
                          "--estrito"])
        self.assertEqual(codigo, 1)
        self.assertIn("1 reprovada", (self.pasta / "ev" / "resumo-sondas.md").read_text(encoding="utf-8"))

    def test_cli_recusa_host_externo_sem_requisitar(self):
        arq = self.gravar_sondas({"sondas": [{"nome": "x", "caminho": "/"}]})
        with mock.patch.object(vs, "requisitar") as requisitar:
            codigo = vs.main(["sondas", "--alvo", "https://exemplo.com", "--sondas", str(arq),
                              "--saida", str(self.pasta / "ev")])
        self.assertEqual(codigo, 2)
        requisitar.assert_not_called()


class TestFerramentas(unittest.TestCase):
    def setUp(self):
        self._tmp = tempfile.TemporaryDirectory()
        self.repo = Path(self._tmp.name) / "repo"
        self.repo.mkdir()
        repo_git(self.repo)
        (self.repo / "leia.txt").write_text("projeto\n", encoding="utf-8")
        commitar(self.repo, "inicio")
        self.saida = Path(self._tmp.name) / "ev"

    def tearDown(self):
        self._tmp.cleanup()

    def test_segredo_removido_continua_no_historico_e_sai_mascarado(self):
        (self.repo / "config.py").write_text(f'CHAVE = "{CHAVE_FALSA}"\n', encoding="utf-8")
        commitar(self.repo, "adiciona config")
        (self.repo / "config.py").write_text('import os\nCHAVE = os.environ["CHAVE"]\n', encoding="utf-8")
        commitar(self.repo, "remove chave")
        self.saida.mkdir()
        resultado = vs.segredos_embutido(self.repo, self.saida)
        self.assertEqual(resultado["status"], "ACHADOS")
        bruto = (self.saida / "segredos-historico.json").read_text(encoding="utf-8")
        achados = json.loads(bruto)
        self.assertEqual(achados[0]["arquivo"], "config.py")
        self.assertEqual(achados[0]["padrao"], "chave de acesso AWS")
        self.assertNotIn(CHAVE_FALSA, bruto)

    def test_sem_segredo_ok(self):
        self.saida.mkdir()
        self.assertEqual(vs.segredos_embutido(self.repo, self.saida)["status"], "OK")

    def test_ferramenta_ausente_nao_executado_e_bloqueia_no_estrito(self):
        with mock.patch.object(vs.shutil, "which", return_value=None):
            codigo = vs.main(["ferramentas", "--raiz", str(self.repo), "--saida", str(self.saida), "--estrito"])
        itens = json.loads((self.saida / "resultado-ferramentas.json").read_text(encoding="utf-8"))
        situacao = {i["nome"]: i["status"] for i in itens}
        self.assertEqual(situacao["Análise estática (semgrep)"], "NÃO EXECUTADO")
        self.assertEqual(situacao["Segredos (busca embutida, histórico inteiro)"], "OK")
        self.assertEqual(codigo, 1)

    def test_pular_registra_e_nao_bloqueia(self):
        with mock.patch.object(vs.shutil, "which", return_value=None):
            codigo = vs.main(["ferramentas", "--raiz", str(self.repo), "--saida", str(self.saida), "--estrito",
                              "--pular", "dependencias,gitleaks,semgrep"])
        itens = json.loads((self.saida / "resultado-ferramentas.json").read_text(encoding="utf-8"))
        self.assertEqual(sum(1 for i in itens if i["status"] == "PULADO"), 3)
        self.assertEqual(codigo, 0)

    def test_docker_so_com_opcao(self):
        chamadas = []

        def falso_rodar(argv, cwd, arquivo_saida=None):
            chamadas.append(argv)
            return {"codigo": 0, "stdout": "", "stderr": "", "erro": None}

        with mock.patch.object(vs.shutil, "which", return_value=None), \
                mock.patch.object(vs, "docker_disponivel", return_value=True), \
                mock.patch.object(vs, "rodar", side_effect=falso_rodar):
            vs.main(["ferramentas", "--raiz", str(self.repo), "--saida", str(self.saida)])
        self.assertFalse(any(argv and argv[0] == "docker" for argv in chamadas))

    def test_npm_audit_com_alto_e_achado(self):
        (self.repo / "package.json").write_text("{}", encoding="utf-8")
        saida_npm = json.dumps({"metadata": {"vulnerabilities": {"critical": 0, "high": 2, "moderate": 1, "low": 0}}})
        self.saida.mkdir()
        with mock.patch.object(vs.shutil, "which", side_effect=lambda n: "npm" if n == "npm" else None), \
                mock.patch.object(vs, "rodar", return_value={"codigo": 1, "stdout": saida_npm, "stderr": "", "erro": None}):
            itens = vs.dependencias(self.repo, self.saida, docker=False)
        node = next(i for i in itens if i["nome"] == "Dependências (Node)")
        self.assertEqual(node["status"], "ACHADOS")
        self.assertEqual(node["contagem"]["high"], 2)
        self.assertTrue(vs.bloqueia([node]))


if __name__ == "__main__":
    unittest.main()
