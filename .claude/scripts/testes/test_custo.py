import json
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

from apoio import SCRIPTS, carregar

SCRIPT = SCRIPTS / "custo.py"
custo = carregar("custo.py")


def resposta(id_, modelo, saida, cache_lido, quando, branch="main", entrada=1, cache_gravado=0):
    return json.dumps({
        "type": "assistant", "requestId": f"req-{id_}", "timestamp": quando, "gitBranch": branch,
        "message": {"id": id_, "role": "assistant", "model": modelo, "usage": {
            "input_tokens": entrada, "output_tokens": saida,
            "cache_read_input_tokens": cache_lido, "cache_creation_input_tokens": cache_gravado}},
    })


class TestCusto(unittest.TestCase):
    def setUp(self):
        self._tmp = tempfile.TemporaryDirectory()
        self.raiz = Path(self._tmp.name) / "proj"
        (self.raiz / "sess1" / "subagents").mkdir(parents=True)

    def tearDown(self):
        self._tmp.cleanup()

    def principal(self, *linhas):
        (self.raiz / "sess1.jsonl").write_text("\n".join(linhas), encoding="utf-8")

    def subagente(self, agente, *linhas):
        base = self.raiz / "sess1" / "subagents" / f"agent-{agente}"
        base.with_suffix(".jsonl").write_text("\n".join(linhas), encoding="utf-8")
        base.with_suffix(".meta.json").write_text(json.dumps({"agentType": agente}), encoding="utf-8")

    def soma(self, por, **filtros):
        return custo.somar(custo.ler(self.raiz, **filtros), por)

    def test_separa_sessao_principal_e_subagente_por_modelo(self):
        self.principal(resposta("a", "claude-sonnet-5-5", 10, 100, "2026-11-02T10:00:00Z"))
        self.subagente("implementador-dominio", resposta("b", "claude-opus-5-5", 50, 900, "2026-11-02T11:00:00Z"))
        grupos = self.soma(["agente", "modelo"])
        self.assertEqual(grupos[("principal", "sonnet-5-5")]["saida"], 10)
        self.assertEqual(grupos[("implementador-dominio", "opus-5-5")]["cache_lido"], 900)

    def test_nao_conta_duas_vezes_a_mesma_resposta(self):
        linha = resposta("a", "claude-sonnet-5-5", 10, 100, "2026-11-02T10:00:00Z")
        self.principal(linha, linha)
        self.assertEqual(self.soma(["modelo"])[("sonnet-5-5",)]["chamadas"], 1)

    def test_filtra_por_intervalo_e_por_branch(self):
        self.principal(
            resposta("a", "claude-sonnet-5-5", 10, 0, "2026-10-30T10:00:00Z", branch="x"),
            resposta("b", "claude-sonnet-5-5", 20, 0, "2026-11-02T10:00:00Z", branch="y"),
        )
        so_novembro = self.soma(["modelo"], desde=custo.instante("2026-11-01"))
        self.assertEqual(so_novembro[("sonnet-5-5",)]["saida"], 20)
        so_x = self.soma(["modelo"], branch="x")
        self.assertEqual(so_x[("sonnet-5-5",)]["saida"], 10)
        ate_dia = self.soma(["modelo"], ate=custo.instante("2026-10-30", fim=True))
        self.assertEqual(ate_dia[("sonnet-5-5",)]["saida"], 10)

    def test_ignora_resposta_sintetica_e_linha_quebrada(self):
        self.principal("não é json", resposta("a", "<synthetic>", 5, 5, "2026-11-02T10:00:00Z"))
        self.assertEqual(self.soma(["modelo"]), {})

    def test_custo_usa_a_tabela_de_precos(self):
        g = {"entrada": 1_000_000, "saida": 1_000_000, "cache_lido": 2_000_000, "cache_gravado": 0}
        tabela = {"m": {"entrada": 1, "saida": 5, "cache_lido": 0.5}}
        self.assertEqual(custo.custo(g, "m", tabela), 1 + 5 + 1)
        self.assertIsNone(custo.custo(g, "outro", tabela))

    def test_cli_mostra_total_e_json(self):
        self.principal(resposta("a", "claude-sonnet-5-5", 10, 100, "2026-11-02T10:00:00Z"))
        base = [sys.executable, str(SCRIPT), "--pasta", str(self.raiz)]
        r = subprocess.run(base + ["--json"], capture_output=True, text=True, encoding="utf-8")
        self.assertEqual(r.returncode, 0, r.stderr)
        self.assertEqual(json.loads(r.stdout)["total"]["saida"], 10)
        r = subprocess.run(base, capture_output=True, text=True, encoding="utf-8")
        self.assertIn("TOTAL: saída 10", r.stdout)

    def test_cli_recusa_agrupamento_invalido_e_pasta_inexistente(self):
        r = subprocess.run([sys.executable, str(SCRIPT), "--pasta", str(self.raiz), "--por", "fase"],
                           capture_output=True, text=True, encoding="utf-8")
        self.assertEqual(r.returncode, 2)
        r = subprocess.run([sys.executable, str(SCRIPT), "--pasta", str(self.raiz / "nao-existe")],
                           capture_output=True, text=True, encoding="utf-8")
        self.assertEqual(r.returncode, 2)


if __name__ == "__main__":
    unittest.main()
