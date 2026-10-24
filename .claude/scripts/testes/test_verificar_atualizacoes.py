import json
import tempfile
import unittest
from datetime import datetime, timedelta
from pathlib import Path

from apoio import carregar, commitar, git, repo_git

v = carregar("verificar-atualizacoes.py")


class TestFuncoes(unittest.TestCase):
    def test_versao_tupla(self):
        self.assertEqual(v.versao_tupla("v7.0.1"), (7, 0, 1))
        self.assertGreater(v.versao_tupla("v7.0.1"), v.versao_tupla("6.3.0"))
        self.assertGreater(v.versao_tupla("6.10.0"), v.versao_tupla("6.9.9"))

    def test_repo_github(self):
        self.assertEqual(v.repo_github("https://github.com/obra/superpowers"), ("obra", "superpowers"))
        self.assertEqual(v.repo_github("https://github.com/github/spec-kit.git"), ("github", "spec-kit"))
        with self.assertRaises(ValueError):
            v.repo_github("https://gitlab.com/a/b")

    def test_adaptado_de_origem_local_fica_congelado(self):
        r = v.verificar({"nome": "x", "tipo": "adaptado", "origem": ".claude_legado", "commit": "-", "arquivos_origem": []})
        self.assertEqual(r["situacao"], v.EM_DIA)

    def test_erro_vira_nao_verificado(self):
        r = v.verificar({"nome": "x", "tipo": "pacote", "lockfile": "nao/existe.json", "registro": "file:///nao/existe"})
        self.assertEqual(r["situacao"], v.NAO_VERIFICADO)


class TestPacote(unittest.TestCase):
    def setUp(self):
        self._tmp = tempfile.TemporaryDirectory()
        self.dir = Path(self._tmp.name)
        (self.dir / "lock.json").write_text(json.dumps({"skills": {"s": {"contentHash": "abc"}}}), encoding="utf-8")

    def tearDown(self):
        self._tmp.cleanup()

    def registro(self, hash_publicado):
        arquivo = self.dir / "registro.json"
        arquivo.write_text(json.dumps({"skills": [{"name": "s", "version": "2.0.0", "contentHash": hash_publicado}]}), encoding="utf-8")
        return arquivo.as_uri()

    def fonte(self, hash_publicado):
        return {"nome": "s", "tipo": "pacote", "lockfile": str(self.dir / "lock.json"),
                "registro": self.registro(hash_publicado), "versao": "1.0.0"}

    def test_hash_igual_esta_em_dia(self):
        self.assertEqual(v.verificar(self.fonte("abc"))["situacao"], v.EM_DIA)

    def test_hash_diferente_esta_desatualizado(self):
        r = v.verificar(self.fonte("xyz"))
        self.assertEqual(r["situacao"], v.DESATUALIZADO)
        self.assertIn("2.0.0", r["detalhe"])


class TestReferencia(unittest.TestCase):
    def setUp(self):
        self._tmp = tempfile.TemporaryDirectory()
        base = Path(self._tmp.name)
        self.origem = base / "origem"
        self.origem.mkdir()
        repo_git(self.origem)
        (self.origem / "a.txt").write_text("1", encoding="utf-8")
        commitar(self.origem)
        self.clone = base / "clone"
        git(base, "clone", "-q", str(self.origem), str(self.clone))
        self.fonte = {"nome": "r", "tipo": "referencia", "pasta": str(self.clone), "origem": str(self.origem)}

    def tearDown(self):
        self._tmp.cleanup()

    def test_mesmo_commit_esta_em_dia(self):
        self.assertEqual(v.verificar(self.fonte)["situacao"], v.EM_DIA)

    def test_commit_novo_na_origem_esta_desatualizado(self):
        (self.origem / "a.txt").write_text("2", encoding="utf-8")
        commitar(self.origem, "novo")
        self.assertEqual(v.verificar(self.fonte)["situacao"], v.DESATUALIZADO)

    def test_clone_ausente(self):
        fonte = dict(self.fonte, pasta=str(Path(self._tmp.name) / "nao-existe"))
        self.assertEqual(v.verificar(fonte)["situacao"], v.NAO_VERIFICADO)


class TestIntervalo(unittest.TestCase):
    def setUp(self):
        self._tmp = tempfile.TemporaryDirectory()
        self.original = v.CACHE
        v.CACHE = Path(self._tmp.name) / "cache.json"

    def tearDown(self):
        v.CACHE = self.original
        self._tmp.cleanup()

    def gravar(self, quando):
        v.CACHE.write_text(json.dumps({"verificado_em": quando.isoformat()}), encoding="utf-8")

    def test_sem_cache_esta_fora_do_intervalo(self):
        self.assertFalse(v.dentro_do_intervalo(7))

    def test_verificacao_recente_esta_dentro(self):
        self.gravar(datetime.now() - timedelta(days=2))
        self.assertTrue(v.dentro_do_intervalo(7))

    def test_verificacao_antiga_esta_fora(self):
        self.gravar(datetime.now() - timedelta(days=8))
        self.assertFalse(v.dentro_do_intervalo(7))


if __name__ == "__main__":
    unittest.main()
