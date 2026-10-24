import contextlib
import datetime as dt
import io
import json
import os
import subprocess
import tempfile
import unittest
from pathlib import Path

from apoio import carregar, repo_git

pg = carregar("propriedade-git.py")

AGORA = dt.datetime(2026, 10, 1, 12, 0, tzinfo=dt.timezone.utc)


def commit_como(pasta, nome, email, quando, mensagem="mudança"):
    """Commit com autor e data definidos (data em ISO, ex.: 2026-09-01T10:00:00+00:00)."""
    env = {**os.environ, "GIT_AUTHOR_DATE": quando, "GIT_COMMITTER_DATE": quando}
    subprocess.run(["git", "add", "-A"], cwd=pasta, check=True, capture_output=True)
    subprocess.run(
        ["git", "commit", "-q", "-m", mensagem, "--author", f"{nome} <{email}>"],
        cwd=pasta, check=True, capture_output=True, env=env,
    )


def escrever(pasta, caminho, texto):
    arq = Path(pasta) / caminho
    arq.parent.mkdir(parents=True, exist_ok=True)
    arq.write_text(texto, encoding="utf-8")


class TestFatorOnibus(unittest.TestCase):
    def test_uma_pessoa_com_mais_da_metade(self):
        self.assertEqual(pg.fator_onibus({"a": 6, "b": 3, "c": 1}), 1)

    def test_metade_exata_nao_basta(self):
        self.assertEqual(pg.fator_onibus({"a": 5, "b": 5}), 2)

    def test_precisa_somar_varias(self):
        self.assertEqual(pg.fator_onibus({"a": 4, "b": 4, "c": 2}), 2)

    def test_sem_mudancas(self):
        self.assertEqual(pg.fator_onibus({}), 0)


class TestSensivel(unittest.TestCase):
    def test_padroes_padrao(self):
        self.assertEqual(pg.etiquetas("src/auth/login.py", pg.REGRAS_PADRAO), ["autenticacao"])
        self.assertEqual(pg.etiquetas("auth/x.py", pg.REGRAS_PADRAO), ["autenticacao"])
        self.assertEqual(pg.etiquetas("config/certs/server.pem", pg.REGRAS_PADRAO), ["segredos"])
        self.assertEqual(pg.etiquetas("src/app.py", pg.REGRAS_PADRAO), [])

    def test_regras_do_usuario(self):
        with tempfile.TemporaryDirectory() as tmp:
            arq = Path(tmp) / "regras.csv"
            arq.write_text("# padrão,etiqueta\n**/pagamento/**,pagamento\n", encoding="utf-8")
            regras = pg.carregar_regras(arq)
        self.assertEqual(pg.etiquetas("src/pagamento/cobranca.py", regras), ["pagamento"])


class TestRepositorio(unittest.TestCase):
    """Histórico montado: Ana escreveu quase tudo (parou em março) e o login há dois anos; Bruno mexe pouco e recente."""

    @classmethod
    def setUpClass(cls):
        cls._tmp = tempfile.TemporaryDirectory()
        cls.repo = Path(cls._tmp.name) / "terceiro"
        cls.repo.mkdir()
        repo_git(cls.repo)
        r = cls.repo
        escrever(r, "src/auth/login.py", "v1")
        commit_como(r, "Ana", "ana@exemplo.com", "2024-09-01T10:00:00+00:00")
        for i, mes in enumerate(["2025-11", "2025-12", "2026-01", "2026-02", "2026-03"]):
            escrever(r, "src/app.py", f"v{i}")
            commit_como(r, "Ana", "ana@exemplo.com", f"{mes}-10T10:00:00+00:00")
        escrever(r, "src/app.py", "bruno")
        escrever(r, "README.md", "leia")
        commit_como(r, "Bruno", "bruno@exemplo.com", "2026-09-15T10:00:00+00:00")
        escrever(r, "package.json", "{}")
        commit_como(r, "dependabot[bot]", "49699333+dependabot[bot]@users.noreply.github.com",
                    "2026-09-20T10:00:00+00:00")
        escrever(r, "tmp/rascunho.txt", "x")
        commit_como(r, "Bruno", "bruno@exemplo.com", "2026-09-21T10:00:00+00:00")
        (r / "tmp" / "rascunho.txt").unlink()
        commit_como(r, "Bruno", "bruno@exemplo.com", "2026-09-22T10:00:00+00:00")
        commits = pg.ler_commits(r)
        cls.resumo = pg.resumir(commits, pg.arquivos_atuais(r), AGORA)

    @classmethod
    def tearDownClass(cls):
        cls._tmp.cleanup()

    def test_robo_ignorado(self):
        nomes = [p["nome"] for p in self.resumo["pessoas"]]
        self.assertEqual(nomes, ["Ana", "Bruno"])
        self.assertEqual(self.resumo["totais"]["commits_ignorados"], 1)

    def test_fator_onibus_e_arquivos_de_um_autor(self):
        self.assertEqual(self.resumo["fator_onibus"], 1)
        # atuais com histórico: login (Ana), app (Ana e Bruno), README (Bruno); package.json só do robô
        self.assertEqual(self.resumo["arquivos_um_autor"], {"total": 3, "um_autor": 2})

    def test_fator_onibus_12_meses_so_conta_o_recente(self):
        # nos 12 meses: app 5x Ana + 1x Bruno, README 1x Bruno -> Ana 5 de 7
        self.assertEqual(self.resumo["fator_onibus_12_meses"], 1)

    def test_arquivo_apagado_nao_conta(self):
        caminhos = {a["caminho"] for a in self.resumo["sensiveis"]}
        self.assertNotIn("tmp/rascunho.txt", caminhos)

    def test_codigo_sensivel_orfao_e_dono_oculto(self):
        self.assertEqual(len(self.resumo["sensiveis"]), 1)
        login = self.resumo["sensiveis"][0]
        self.assertEqual(login["caminho"], "src/auth/login.py")
        self.assertEqual(login["autores"], 1)
        self.assertTrue(login["orfao"])
        self.assertEqual(self.resumo["donos_ocultos"],
                         [{"etiqueta": "autenticacao", "pessoa": "ana@exemplo.com", "nome": "Ana", "parcela": 1.0}])

    def test_atividade_mensal_e_pessoas_ativas(self):
        atividade = self.resumo["atividade_mensal"]
        self.assertEqual(len(atividade), 24)
        self.assertEqual(atividade["2026-09"], 3)
        self.assertEqual(atividade["2024-11"], 0)
        ativos = {p["nome"]: p["ativo"] for p in self.resumo["pessoas"]}
        self.assertEqual(ativos, {"Ana": False, "Bruno": True})

    def test_markdown_sem_email(self):
        texto = pg.markdown(self.resumo)
        self.assertIn("Fator ônibus", texto)
        self.assertIn("Ana", texto)
        self.assertNotIn("@", texto)


class TestLinhaDeComando(unittest.TestCase):
    def test_grava_json_e_markdown(self):
        with tempfile.TemporaryDirectory() as tmp:
            repo = Path(tmp) / "repo"
            repo.mkdir()
            repo_git(repo)
            escrever(repo, "a.py", "1")
            commit_como(repo, "Ana", "ana@exemplo.com", dt.datetime.now(dt.timezone.utc).isoformat())
            saida = Path(tmp) / "evidencias"
            with contextlib.redirect_stdout(io.StringIO()):
                codigo = pg.main(["--repo", str(repo), "--saida", str(saida)])
            self.assertEqual(codigo, 0)
            dados = json.loads((saida / "propriedade.json").read_text(encoding="utf-8"))
            self.assertEqual(dados["fator_onibus"], 1)
            self.assertTrue((saida / "propriedade.md").exists())

    def test_pasta_sem_git_falha_com_mensagem(self):
        with tempfile.TemporaryDirectory() as tmp:
            with contextlib.redirect_stderr(io.StringIO()):
                codigo = pg.main(["--repo", tmp, "--saida", str(Path(tmp) / "saida")])
        self.assertEqual(codigo, 2)


if __name__ == "__main__":
    unittest.main()
