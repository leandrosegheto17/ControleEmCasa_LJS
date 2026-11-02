import json
import tempfile
import unittest
from pathlib import Path

from apoio import carregar

ml = carregar("medir-lotes.py")


def chamada(id_, hora, entrada=10, leitura=0, escrita=0, saida=5):
    return {"type": "assistant", "timestamp": hora, "uuid": id_,
            "message": {"id": id_, "usage": {"input_tokens": entrada, "cache_read_input_tokens": leitura,
                                             "cache_creation_input_tokens": escrita, "output_tokens": saida}}}


def agente(pasta, nome, registros, descricao="Lote X"):
    sub = Path(pasta) / "sessao1" / "subagents"
    sub.mkdir(parents=True, exist_ok=True)
    (sub / f"{nome}.jsonl").write_text("\n".join(json.dumps(r) for r in registros) + "\nlinha quebrada\n", encoding="utf-8")
    (sub / f"{nome}.meta.json").write_text(json.dumps({"description": descricao, "agentType": "implementador"}), encoding="utf-8")
    return sub / f"{nome}.jsonl"


class TestMedirLotes(unittest.TestCase):
    def setUp(self):
        self._tmp = tempfile.TemporaryDirectory()
        self.pasta = Path(self._tmp.name)

    def tearDown(self):
        self._tmp.cleanup()

    def test_contexto_final_e_a_ultima_chamada_e_leitura_de_cache_soma_todas(self):
        arq = agente(self.pasta, "agent-a", [
            chamada("m1", "2026-10-31T10:00:00Z", entrada=5, leitura=1000, escrita=500, saida=10),
            chamada("m2", "2026-10-31T10:05:00Z", entrada=7, leitura=2000, escrita=300, saida=20),
        ])
        m = ml.medir_agente(arq)
        self.assertEqual(m["chamadas"], 2)
        self.assertEqual(m["contexto_final"], 7 + 2000 + 300)
        self.assertEqual(m["leitura_cache"], 3000)
        self.assertEqual(m["saida"], 30)
        self.assertEqual(round(m["minutos"]), 5)
        self.assertEqual(m["descricao"], "Lote X")

    def test_registro_repetido_da_mesma_resposta_conta_uma_chamada(self):
        arq = agente(self.pasta, "agent-a", [
            chamada("m1", "2026-10-31T10:00:00Z", leitura=1000),
            chamada("m1", "2026-10-31T10:00:02Z", leitura=1000),
        ])
        m = ml.medir_agente(arq)
        self.assertEqual((m["chamadas"], m["leitura_cache"]), (1, 1000))

    def test_acusa_pausa_longa_como_lote_parado(self):
        arq = agente(self.pasta, "agent-a", [
            chamada("m1", "2026-10-31T23:45:00Z"),
            chamada("m2", "2026-11-01T21:14:00Z"),
        ])
        m = ml.medir_agente(arq)
        self.assertGreater(m["maior_pausa_min"], ml.PARADO_MIN)
        self.assertIn("PAROU", ml.formatar([m]))

    def test_sem_pausa_longa_nao_marca_parado_e_contexto_grande_e_marcado(self):
        arq = agente(self.pasta, "agent-a", [
            chamada("m1", "2026-10-31T10:00:00Z", leitura=100),
            chamada("m2", "2026-10-31T10:10:00Z", leitura=ml.AVISO_CONTEXTO + 1),
        ])
        saida = ml.formatar([ml.medir_agente(arq)])
        self.assertNotIn("PAROU", saida)
        self.assertIn("CONTEXTO GRANDE", saida)

    def test_agente_sem_chamadas_e_ignorado(self):
        agente(self.pasta, "agent-vazio", [{"type": "user", "timestamp": "2026-10-31T10:00:00Z"}])
        self.assertEqual(ml.agentes_do_projeto(self.pasta), [])

    def test_acha_pasta_de_registros_pelo_caminho_do_projeto(self):
        raiz = self.pasta / "projects"
        (raiz / "c--Leandro-Projetos-GestaoDaPelada-LJS").mkdir(parents=True)
        achou = ml.pasta_de_registros(r"C:\Leandro\Projetos\GestaoDaPelada_LJS", raiz)
        self.assertEqual(achou.name, "c--Leandro-Projetos-GestaoDaPelada-LJS")
        self.assertIsNone(ml.pasta_de_registros(r"C:\outro\projeto", raiz))

    def test_ordena_por_inicio_e_limita_aos_ultimos(self):
        agente(self.pasta, "agent-b", [chamada("b", "2026-10-31T12:00:00Z")], descricao="Segundo")
        agente(self.pasta, "agent-a", [chamada("a", "2026-10-31T10:00:00Z")], descricao="Primeiro")
        self.assertEqual([m["descricao"] for m in ml.agentes_do_projeto(self.pasta)], ["Primeiro", "Segundo"])


if __name__ == "__main__":
    unittest.main()
