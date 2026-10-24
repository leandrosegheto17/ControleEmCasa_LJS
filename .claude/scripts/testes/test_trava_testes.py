import json
import os
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

from apoio import SCRIPTS, carregar, commitar, git, repo_git

t = carregar("trava-testes.py")
SCRIPT = SCRIPTS / "trava-testes.py"
PASSA = 'python -c "import sys; sys.exit(0)"'
FALHA = 'python -c "import sys; print(\'1 falhou\'); sys.exit(1)"'


class TestReconhecerComando(unittest.TestCase):
    def test_push_e_pr_de_verdade(self):
        for cmd in ("git push origin main", "cd x && git push", "gh pr create --fill", "git status; git push"):
            self.assertTrue(t.PUSH_OU_PR.search(cmd), cmd)

    def test_texto_que_so_menciona_push(self):
        for cmd in ("git commit -m 'antes do git push'", "echo git push", "printf '{\"command\":\"git push\"}' | python x"):
            self.assertFalse(t.PUSH_OU_PR.search(cmd), cmd)

    def test_alvo_do_merge(self):
        self.assertEqual(t.MERGE.search("git merge --no-ff -q feat").group("alvo"), "feat")
        self.assertEqual(t.MERGE.search("git status; git merge feat").group("alvo"), "feat")
        self.assertIsNone(t.MERGE.search("git merge --abort"))


class TestTrava(unittest.TestCase):
    def setUp(self):
        self._tmp = tempfile.TemporaryDirectory()
        self.repo = Path(self._tmp.name)
        repo_git(self.repo)
        (self.repo / "a.txt").write_text("a", encoding="utf-8")
        commitar(self.repo)

    def tearDown(self):
        self._tmp.cleanup()

    def config(self, conteudo):
        pasta = self.repo / ".specs" / "projeto"
        pasta.mkdir(parents=True, exist_ok=True)
        (pasta / "testes.json").write_text(json.dumps(conteudo), encoding="utf-8")
        commitar(self.repo, "config")

    def hook(self, comando):
        entrada = json.dumps({"tool_input": {"command": comando}, "cwd": str(self.repo)})
        env = dict(os.environ, CLAUDE_PROJECT_DIR=str(self.repo))
        r = subprocess.run([sys.executable, str(SCRIPT)], input=entrada, capture_output=True, text=True,
                           encoding="utf-8", env=env)
        return r.returncode, r.stderr

    def rodar(self):
        env = dict(os.environ, CLAUDE_PROJECT_DIR=str(self.repo))
        r = subprocess.run([sys.executable, str(SCRIPT), "--rodar"], capture_output=True, text=True,
                           encoding="utf-8", env=env)
        return r.returncode, r.stdout

    def test_comando_comum_passa_direto(self):
        self.assertEqual(self.hook("git status")[0], 0)

    def test_push_sem_configuracao_bloqueia(self):
        codigo, erro = self.hook("git push origin main")
        self.assertEqual(codigo, 2)
        self.assertIn("testes.json", erro)

    def test_push_com_suite_verde_libera(self):
        self.config({"comando": PASSA})
        self.assertEqual(self.hook("git push origin main")[0], 0)

    def test_pr_com_suite_falhando_bloqueia(self):
        self.config({"comando": FALHA})
        codigo, erro = self.hook("gh pr create --fill")
        self.assertEqual(codigo, 2)
        self.assertIn("suíte falhou", erro)

    def test_merge_de_branch_nao_testada_bloqueia_e_testada_libera(self):
        self.config({"comando": PASSA})
        git(self.repo, "checkout", "-q", "-b", "feat")
        (self.repo / "b.txt").write_text("b", encoding="utf-8")
        commitar(self.repo, "feat")
        git(self.repo, "checkout", "-q", "main")
        self.assertEqual(self.hook("git merge --no-ff feat")[0], 2)
        git(self.repo, "checkout", "-q", "feat")
        self.assertEqual(self.rodar()[0], 0)
        git(self.repo, "checkout", "-q", "main")
        self.assertEqual(self.hook("git merge --no-ff feat")[0], 0)

    def test_rodar_com_falha_nao_registra_verde(self):
        self.config({"comando": FALHA})
        codigo, saida = self.rodar()
        self.assertEqual(codigo, 1)
        self.assertIn("SUÍTE FALHOU", saida)
        self.assertEqual(self.hook("git push")[0], 2)

    def test_dispensado_libera(self):
        self.config({"dispensado": True, "motivo": "teste"})
        self.assertEqual(self.hook("git push")[0], 0)


if __name__ == "__main__":
    unittest.main()
