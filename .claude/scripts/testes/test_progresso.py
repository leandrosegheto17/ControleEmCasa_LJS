import contextlib
import io
import json
import os
import shutil
import subprocess
import tempfile
import unittest
from pathlib import Path

from apoio import carregar

pr = carregar("progresso.py")
pr_caminho = Path(__file__).resolve().parents[1] / "progresso.py"


def tarefa(numero, caixas, status=None, estimativa=None, depende=None):
    """Bloco de tarefa no formato do tasks.md do tlc-spec-driven; caixas = lista de True/False."""
    linhas = [f"### T{numero}: Tarefa {numero}", "", "**What**: algo", "**Where**: `src/a.py`"]
    if estimativa:
        linhas.append(f"**Estimativa**: {estimativa}")
    if depende:
        linhas.append(f"**Depends on**: {depende}")
    linhas.append("")
    if status:
        linhas += [f"**Status**: {status}", ""]
    linhas += ["**Done when**:", ""]
    linhas += [f"- [{'x' if c else ' '}] critério {i}" for i, c in enumerate(caixas)]
    linhas += ["", "**Tests**: unit", "**Gate**: quick", "", "---", ""]
    return "\n".join(linhas)


def tasks_md(*blocos, depois=""):
    return "# Tasks\n\n## Execution Plan\n\nT1 → T2\n\n## Task Breakdown\n\n" + "\n".join(blocos) + depois


def escrever(raiz, caminho, texto):
    arq = Path(raiz) / caminho
    arq.parent.mkdir(parents=True, exist_ok=True)
    arq.write_text(texto, encoding="utf-8")


class TestContarTarefas(unittest.TestCase):
    def test_tarefa_feita_quando_todas_as_caixas_marcadas(self):
        texto = tasks_md(tarefa(1, [True, True]), tarefa(2, [True, False]), tarefa(3, [False]))
        self.assertEqual(pr.contar_tarefas(texto), (3, 1))

    def test_maiuscula_x_conta_como_marcada(self):
        texto = tasks_md(tarefa(1, [True]).replace("[x]", "[X]"))
        self.assertEqual(pr.contar_tarefas(texto), (1, 1))

    def test_status_concluido_vale_quando_nao_ha_caixas(self):
        texto = tasks_md(tarefa(1, [], status="Done"), tarefa(2, [], status="Pendente"))
        self.assertEqual(pr.contar_tarefas(texto), (2, 1))

    def test_status_em_portugues_e_com_marca(self):
        texto = tasks_md(tarefa(1, [], status="Concluída"), tarefa(2, [], status="✅ Complete"))
        self.assertEqual(pr.contar_tarefas(texto), (2, 2))

    def test_caixa_aberta_vence_status_concluido(self):
        texto = tasks_md(tarefa(1, [True, False], status="Done"))
        self.assertEqual(pr.contar_tarefas(texto), (1, 0))

    def test_checklists_fora_das_tarefas_nao_contam(self):
        depois = "\n## Validação\n\n- [x] item solto\n- [x] outro\n"
        texto = tasks_md(tarefa(1, [False]), depois=depois)
        self.assertEqual(pr.contar_tarefas(texto), (1, 0))

    def test_sem_tarefas(self):
        self.assertEqual(pr.contar_tarefas("# Tasks\n\nnada aqui\n"), (0, 0))


class TestColetar(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.raiz = Path(self.tmp.name)
        self.addCleanup(self.tmp.cleanup)

    def test_soma_todos_os_tasks_md_de_specs(self):
        escrever(self.raiz, ".specs/features/a/tasks.md", tasks_md(tarefa(1, [True]), tarefa(2, [False])))
        escrever(self.raiz, ".specs/refatoracoes/b/tasks.md", tasks_md(tarefa(1, [False])))
        itens = pr.coletar(self.raiz)
        self.assertEqual({i["item"]: (i["total"], i["feitas"]) for i in itens},
                         {".specs/features/a": (2, 1), ".specs/refatoracoes/b": (1, 0)})

    def test_ignora_pastas_de_evidencias_codigo_e_dependencias(self):
        for pasta in (".specs/spikes/x/codigo", ".specs/seguranca/d/evidencias", "node_modules/p"):
            escrever(self.raiz, f"{pasta}/tasks.md", tasks_md(tarefa(1, [True])))
        self.assertEqual(pr.coletar(self.raiz), [])

    def test_arquivo_sem_tarefas_fica_de_fora(self):
        escrever(self.raiz, ".specs/features/a/tasks.md", "# Tasks\n")
        self.assertEqual(pr.coletar(self.raiz), [])

    def test_sem_pasta_specs(self):
        self.assertEqual(pr.coletar(self.raiz), [])


class TestFrase(unittest.TestCase):
    def test_formato_pedido(self):
        self.assertEqual(pr.frase(135, 180), "Faltam 45 de 180 tarefas: 75% concluído")

    def test_singular(self):
        self.assertEqual(pr.frase(11, 12), "Falta 1 de 12 tarefas: 92% concluído")

    def test_tudo_concluido(self):
        self.assertEqual(pr.frase(12, 12), "Todas as 12 tarefas concluídas: 100% concluído")

    def test_nada_concluido(self):
        self.assertEqual(pr.frase(0, 10), "Faltam 10 de 10 tarefas: 0% concluído")

    def test_sem_tarefas(self):
        self.assertEqual(pr.frase(0, 0), "Sem tarefas ainda")

    def test_percentual_nunca_arredonda_para_cem_antes_da_hora(self):
        self.assertEqual(pr.frase(999, 1000), "Falta 1 de 1000 tarefas: 99% concluído")


STATE = """# Estado

## Decisões

AD-001: algo

## Retomada

- **Fluxo**: 3 Feature em projeto feito com IA — skill `feature`
- **Item**: `.specs/features/importar-extrato/`
- **Fase aprovada**: 4, Plano em 2026-10-20
- **Próxima fase**: 5, Rede de proteção — modelo indicado: sonnet
"""


class TestRetomada(unittest.TestCase):
    def test_le_item_fluxo_e_fases(self):
        r = pr.ler_retomada(STATE)
        self.assertEqual(r["item"], ".specs/features/importar-extrato")
        self.assertEqual(r["fluxo"], "3 Feature em projeto feito com IA")
        self.assertIn("4, Plano", r["fase_aprovada"])
        self.assertIn("5, Rede de proteção", r["proxima_fase"])

    def test_item_com_texto_depois_do_caminho(self):
        estado = "## Retomada\n\n- **Item**: `.specs/features/x/` (`spec.md`, `context.md`, ...)\n"
        self.assertEqual(pr.ler_retomada(estado)["item"], ".specs/features/x")

    def test_item_sem_crases_com_observacao(self):
        estado = "## Retomada\n\n- **Item**: .specs/features/x/ (em andamento)\n"
        self.assertEqual(pr.ler_retomada(estado)["item"], ".specs/features/x")

    def test_sem_secao_retomada(self):
        self.assertEqual(pr.ler_retomada("# Estado\n\n## Decisões\n"), {})


class TestRelatorio(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.raiz = Path(self.tmp.name)
        self.addCleanup(self.tmp.cleanup)

    def test_item_atual_vem_da_retomada_e_projeto_soma_tudo(self):
        escrever(self.raiz, ".specs/STATE.md", STATE)
        escrever(self.raiz, ".specs/features/importar-extrato/tasks.md",
                 tasks_md(tarefa(1, [True]), tarefa(2, [False]), tarefa(3, [False]), tarefa(4, [False])))
        escrever(self.raiz, ".specs/features/outra/tasks.md", tasks_md(tarefa(1, [True]), tarefa(2, [True])))
        rel = pr.relatorio(self.raiz)
        self.assertEqual(rel["item"], {"nome": ".specs/features/importar-extrato", "total": 4, "feitas": 1})
        self.assertEqual(rel["projeto"], {"total": 6, "feitas": 3})
        texto = pr.formatar(rel)
        # V3: o rótulo "Item atual" virou "Feature atual" (vocabulário único do CLAUDE.md)
        self.assertIn("Feature atual (.specs/features/importar-extrato): Faltam 3 de 4 tarefas: 25% concluído", texto)
        self.assertIn("Projeto: Faltam 3 de 6 tarefas: 50% concluído", texto)

    def test_argumento_item_vence_a_retomada(self):
        escrever(self.raiz, ".specs/STATE.md", STATE)
        escrever(self.raiz, ".specs/features/importar-extrato/tasks.md", tasks_md(tarefa(1, [False])))
        escrever(self.raiz, ".specs/features/outra/tasks.md", tasks_md(tarefa(1, [True])))
        rel = pr.relatorio(self.raiz, item=".specs/features/outra/")
        self.assertEqual(rel["item"]["nome"], ".specs/features/outra")
        self.assertEqual(rel["item"]["feitas"], 1)

    def test_sem_retomada_usa_o_unico_item_em_aberto(self):
        escrever(self.raiz, ".specs/features/pronta/tasks.md", tasks_md(tarefa(1, [True])))
        escrever(self.raiz, ".specs/features/aberta/tasks.md", tasks_md(tarefa(1, [True]), tarefa(2, [False])))
        rel = pr.relatorio(self.raiz)
        self.assertEqual(rel["item"]["nome"], ".specs/features/aberta")

    def test_sem_retomada_e_com_tudo_concluido_usa_o_unico_item(self):
        escrever(self.raiz, ".specs/features/pronta/tasks.md", tasks_md(tarefa(1, [True]), tarefa(2, [True])))
        self.assertEqual(pr.relatorio(self.raiz)["item"], {"nome": ".specs/features/pronta", "total": 2, "feitas": 2})

    def test_varios_itens_concluidos_sem_retomada_nao_escolhem_um(self):
        escrever(self.raiz, ".specs/features/a/tasks.md", tasks_md(tarefa(1, [True])))
        escrever(self.raiz, ".specs/features/b/tasks.md", tasks_md(tarefa(1, [True])))
        self.assertIsNone(pr.relatorio(self.raiz)["item"])

    def test_varios_itens_em_aberto_sem_retomada_mostra_so_o_projeto(self):
        escrever(self.raiz, ".specs/features/a/tasks.md", tasks_md(tarefa(1, [False])))
        escrever(self.raiz, ".specs/features/b/tasks.md", tasks_md(tarefa(1, [False])))
        rel = pr.relatorio(self.raiz)
        self.assertIsNone(rel["item"])
        self.assertNotIn("Item atual", pr.formatar(rel))

    def test_item_sem_tasks_md_e_declarado_sem_tarefas(self):
        escrever(self.raiz, ".specs/STATE.md", STATE)
        rel = pr.relatorio(self.raiz)
        self.assertEqual(rel["item"], {"nome": ".specs/features/importar-extrato", "total": 0, "feitas": 0})

    def test_sem_tarefas_mostra_a_fase_do_fluxo(self):
        escrever(self.raiz, ".specs/STATE.md", STATE)
        texto = pr.formatar(pr.relatorio(self.raiz))
        self.assertIn("Sem tarefas ainda", texto)
        self.assertIn("Fluxo: 3 Feature em projeto feito com IA", texto)
        self.assertIn("Fase aprovada: 4, Plano em 2026-10-20", texto)
        self.assertIn("Próxima fase: 5, Rede de proteção", texto)
        self.assertNotIn("%", texto)

    def test_fase_longa_e_cortada(self):
        longa = "etapas 2 e 3 (" + ", ".join(f"`{i:07x}`" for i in range(40)) + ")"
        escrever(self.raiz, ".specs/STATE.md", "## Retomada\n\n- **Fase aprovada**: " + longa + "\n")
        linha = [l for l in pr.formatar(pr.relatorio(self.raiz)).splitlines() if l.startswith("Fase aprovada")][0]
        self.assertLessEqual(len(linha), 140)
        self.assertTrue(linha.endswith("…"))

    def test_sem_tarefas_e_sem_retomada(self):
        texto = pr.formatar(pr.relatorio(self.raiz))
        self.assertIn("Sem tarefas ainda", texto)
        self.assertIn("nenhum tasks.md", texto)

    def test_nao_escreve_nada(self):
        escrever(self.raiz, ".specs/features/a/tasks.md", tasks_md(tarefa(1, [False])))
        antes = sorted(p.relative_to(self.raiz).as_posix() for p in self.raiz.rglob("*"))
        pr.formatar(pr.relatorio(self.raiz))
        depois = sorted(p.relative_to(self.raiz).as_posix() for p in self.raiz.rglob("*"))
        self.assertEqual(antes, depois)


ROADMAP = """# Roadmap

| # | Etapa | Situação |
|---|---|---|
| 0 | Documentos | Concluída |
| 1 | **Esqueleto** | **Concluída** |
| 2 | Banco | concluida |
| 3 | API | Em andamento |
| 4 | Auth | Não começada |
| 5 | Domínio | Não começada |

Texto solto.

| Outra | Coisa |
|---|---|
| a | b |
"""


class TestRoadmap(unittest.TestCase):
    def test_conta_unidades_concluidas(self):
        r = pr.ler_roadmap(ROADMAP)
        self.assertEqual((r["total"], r["feitas"]), (6, 3))

    def test_nome_da_unidade_vem_do_cabecalho(self):
        self.assertEqual(pr.ler_roadmap(ROADMAP)["nome"], "etapas")
        feature = ROADMAP.replace("| # | Etapa |", "| # | Feature |")
        self.assertEqual(pr.ler_roadmap(feature)["nome"], "features")

    def test_lista_o_que_esta_em_andamento(self):
        self.assertEqual(pr.ler_roadmap(ROADMAP)["em_andamento"], ["3 API"])

    def test_tabela_sem_coluna_situacao_e_ignorada(self):
        self.assertIsNone(pr.ler_roadmap("| a | b |\n|---|---|\n| 1 | 2 |\n"))

    def test_texto_sem_tabela(self):
        self.assertIsNone(pr.ler_roadmap("# Roadmap\n\nvazio\n"))

    def test_situacao_desconhecida_conta_como_nao_concluida(self):
        texto = "| # | Etapa | Situação |\n|---|---|---|\n| 1 | A | ??? |\n| 2 | B | Concluída |\n"
        r = pr.ler_roadmap(texto)
        self.assertEqual((r["total"], r["feitas"]), (2, 1))

    def test_frase_usa_a_palavra_da_unidade(self):
        self.assertEqual(pr.frase(12, 18, "etapas"), "Faltam 6 de 18 etapas: 67% concluído")
        self.assertEqual(pr.frase(17, 18, "etapas"), "Falta 1 de 18 etapas: 94% concluído")
        self.assertEqual(pr.frase(18, 18, "etapas"), "Todas as 18 etapas concluídas: 100% concluído")


class TestRelatorioComRoadmap(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.raiz = Path(self.tmp.name)
        self.addCleanup(self.tmp.cleanup)

    def test_plano_aparece_antes_das_tarefas(self):
        escrever(self.raiz, ".specs/projeto/roadmap.md", ROADMAP)
        escrever(self.raiz, ".specs/features/a/tasks.md", tasks_md(tarefa(1, [True]), tarefa(2, [False])))
        texto = pr.formatar(pr.relatorio(self.raiz))
        linhas = texto.splitlines()
        # V3: a linha vira "Produto" e a "Projeto" some quando repete a feature atual
        self.assertEqual(linhas[0], "Produto: Faltam 3 de 6 etapas: 50% concluído")
        self.assertEqual(linhas[1], "Em andamento: 3 API")
        self.assertIn("Feature atual (.specs/features/a): Falta 1 de 2 tarefas: 50% concluído", texto)
        self.assertNotIn("Projeto:", texto)

    def test_so_roadmap_sem_tarefas_nao_mostra_fase_da_retomada(self):
        escrever(self.raiz, ".specs/projeto/roadmap.md", ROADMAP)
        escrever(self.raiz, ".specs/STATE.md", STATE)
        texto = pr.formatar(pr.relatorio(self.raiz))
        self.assertIn("Produto: Faltam 3 de 6 etapas: 50% concluído", texto)
        self.assertIn("Projeto: Sem tarefas ainda", texto)
        self.assertNotIn("Fase aprovada", texto)

    def test_sem_roadmap_nada_muda(self):
        escrever(self.raiz, ".specs/features/a/tasks.md", tasks_md(tarefa(1, [True])))
        rel = pr.relatorio(self.raiz)
        self.assertIsNone(rel["plano"])
        self.assertNotIn("Plano", pr.formatar(rel))

    def test_json_traz_o_plano(self):
        escrever(self.raiz, ".specs/projeto/roadmap.md", ROADMAP)
        plano = pr.relatorio(self.raiz)["plano"]
        self.assertEqual((plano["total"], plano["feitas"], plano["nome"]), (6, 3, "etapas"))


class TestEstimativa(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.raiz = Path(self.tmp.name)
        self.addCleanup(self.tmp.cleanup)

    def feature(self, *blocos):
        escrever(self.raiz, ".specs/features/a/tasks.md", tasks_md(*blocos))
        return pr.relatorio(self.raiz)

    def test_le_horas_e_minutos(self):
        self.assertEqual(pr.ler_estimativa("2h"), 2.0)
        self.assertEqual(pr.ler_estimativa("1,5h"), 1.5)
        self.assertEqual(pr.ler_estimativa("0.5 h"), 0.5)
        self.assertEqual(pr.ler_estimativa("90 min"), 1.5)
        self.assertEqual(pr.ler_estimativa("30min"), 0.5)
        self.assertEqual(pr.ler_estimativa("2 horas"), 2.0)

    def test_valor_ilegivel_e_ausente(self):
        self.assertIsNone(pr.ler_estimativa("depende"))
        self.assertIsNone(pr.ler_estimativa(""))

    def test_tarefa_acima_de_2h_avisa(self):
        rel = self.feature(tarefa(1, [False], estimativa="1h"), tarefa(2, [False], estimativa="3h"),
                           tarefa(3, [False], estimativa="2h"))
        self.assertEqual(rel["avisos"], [{"item": ".specs/features/a", "tipo": "acima", "tarefas": ["T2"]}])
        linha = pr.formatar(rel).splitlines()[-1]
        self.assertEqual(linha, "Aviso: .specs/features/a: 1 tarefa acima de 2h (T2); divida em tarefas de até 2h.")

    def test_exatamente_2h_nao_avisa(self):
        rel = self.feature(tarefa(1, [False], estimativa="2h"), tarefa(2, [False], estimativa="120 min"))
        self.assertEqual(rel["avisos"], [])
        self.assertNotIn("Aviso", pr.formatar(rel))

    def test_muitas_tarefas_pequenas_nao_avisam(self):
        rel = self.feature(*[tarefa(i, [False], estimativa="1h") for i in range(1, 171)])
        self.assertEqual(rel["avisos"], [])

    def test_lista_so_as_primeiras_e_conta_o_resto(self):
        rel = self.feature(*[tarefa(i, [False], estimativa="4h") for i in range(1, 8)])
        linha = pr.formatar(rel).splitlines()[-1]
        self.assertIn("7 tarefas acima de 2h (T1, T2, T3, T4, T5 e mais 2)", linha)

    def test_sem_estimativa_so_avisa_quando_o_arquivo_ja_adotou_o_campo(self):
        rel = self.feature(tarefa(1, [False], estimativa="1h"), tarefa(2, [False]))
        self.assertEqual(rel["avisos"], [{"item": ".specs/features/a", "tipo": "sem_estimativa", "tarefas": ["T2"]}])
        self.assertIn("Aviso: .specs/features/a: 1 tarefa sem **Estimativa** (T2)", pr.formatar(rel))

    def test_tasks_md_antigo_sem_nenhuma_estimativa_fica_quieto(self):
        rel = self.feature(tarefa(1, [False]), tarefa(2, [False]))
        self.assertEqual(rel["avisos"], [])
        self.assertNotIn("Aviso", pr.formatar(rel))

    def test_estimativa_ilegivel_conta_como_sem_estimativa(self):
        rel = self.feature(tarefa(1, [False], estimativa="1h"), tarefa(2, [False], estimativa="depende"))
        self.assertEqual(rel["avisos"][0]["tipo"], "sem_estimativa")
        self.assertEqual(rel["avisos"][0]["tarefas"], ["T2"])

    def test_cada_item_e_avaliado_sozinho(self):
        escrever(self.raiz, ".specs/features/a/tasks.md", tasks_md(tarefa(1, [False], estimativa="5h")))
        escrever(self.raiz, ".specs/features/b/tasks.md", tasks_md(tarefa(1, [False], estimativa="1h")))
        itens = [a["item"] for a in pr.relatorio(self.raiz)["avisos"]]
        self.assertEqual(itens, [".specs/features/a"])


def tasks_fases(*fases):
    """tasks.md com Phases no Execution Plan; cada fase = lista de (numero, caixas[, estimativa[, depende]])."""
    plano, corpo = ["## Execution Plan", ""], ["## Task Breakdown", ""]
    for n, tarefas in enumerate(fases, 1):
        plano += [f"### Phase {n}: Fase {n}", "", "```", " -> ".join(f"T{t[0]}" for t in tarefas), "```", ""]
        for t in tarefas:
            extra = list(t[2:]) + [None] * (2 - len(t[2:]))
            corpo.append(tarefa(t[0], t[1], estimativa=extra[0], depende=extra[1]))
    return "# Tasks\n\n" + "\n".join(plano) + "\n" + "\n".join(corpo)


class TestFasesETarefaAtual(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.raiz = Path(self.tmp.name)
        self.addCleanup(self.tmp.cleanup)

    def relatorio(self, texto):
        escrever(self.raiz, ".specs/features/a/tasks.md", texto)
        return pr.relatorio(self.raiz)

    def test_cada_tarefa_sabe_a_phase_do_diagrama(self):
        tarefas, fases = pr.tarefas_de(tasks_fases([(1, [True]), (2, [True])], [(3, [False]), (4, [False])]))
        self.assertEqual([(t["id"], t["fase"]) for t in tarefas], [("T1", 1), ("T2", 1), ("T3", 2), ("T4", 2)])
        self.assertEqual([f["nome"] for f in fases], ["Phase 1: Fase 1", "Phase 2: Fase 2"])

    def test_tarefa_escrita_dentro_da_phase_tambem_pertence_a_ela(self):
        texto = ("## Phase 1: Base\n\n### T1: a\n\n**Depends on**: T2\n\n- [x] ok\n\n"
                 "## Phase 2: Topo\n\n### T2: b\n\n- [ ] ok\n")
        tarefas, _ = pr.tarefas_de(texto)
        self.assertEqual([(t["id"], t["fase"]) for t in tarefas], [("T1", 1), ("T2", 2)])

    def test_sem_phases_nao_mostra_a_linha_de_phase(self):
        texto = pr.formatar(self.relatorio(tasks_md(tarefa(1, [True]), tarefa(2, [False]))))
        self.assertNotIn("Phase atual", texto)

    def test_phase_atual_e_a_primeira_com_tarefa_pendente(self):
        rel = self.relatorio(tasks_fases([(1, [True]), (2, [True])], [(3, [True]), (4, [False]), (5, [False])],
                                         [(6, [False])]))
        linhas = pr.formatar(rel).splitlines()
        self.assertIn("Feature atual (.specs/features/a): Faltam 3 de 6 tarefas: 50% concluído", linhas)
        self.assertIn("Phase atual (Phase 2: Fase 2): Faltam 2 de 3 tarefas: 33% concluído", linhas)

    def test_tarefa_atual_respeita_as_dependencias(self):
        rel = self.relatorio(tasks_fases([(1, [True]), (2, [False], "1h", "T3"), (3, [False], "30 min", "T1")]))
        self.assertIn("Tarefa atual: T3 — Tarefa 3 (estimada 30 min)", pr.formatar(rel).splitlines())

    def test_tarefa_atual_sem_dependencia_pronta_cai_na_primeira_pendente(self):
        rel = self.relatorio(tasks_fases([(1, [False], None, "T2"), (2, [False], None, "T1")]))
        self.assertIn("Tarefa atual: T1 — Tarefa 1", pr.formatar(rel).splitlines())

    def test_tudo_concluido_nao_tem_tarefa_nem_phase_atual(self):
        texto = pr.formatar(self.relatorio(tasks_fases([(1, [True]), (2, [True])])))
        self.assertNotIn("Tarefa atual", texto)
        self.assertNotIn("Phase atual", texto)

    def test_projeto_so_aparece_quando_difere_da_feature(self):
        escrever(self.raiz, ".specs/features/a/tasks.md", tasks_md(tarefa(1, [False])))
        self.assertNotIn("Projeto:", pr.formatar(pr.relatorio(self.raiz)))
        escrever(self.raiz, ".specs/features/b/tasks.md", tasks_md(tarefa(1, [True])))
        texto = pr.formatar(pr.relatorio(self.raiz, item=".specs/features/a"))
        self.assertIn("Feature atual (.specs/features/a): Falta 1 de 1 tarefas: 0% concluído", texto)
        self.assertIn("Projeto: Falta 1 de 2 tarefas: 50% concluído", texto)


class TestLotes(unittest.TestCase):
    def lotes(self, *fases):
        tarefas, fs = pr.tarefas_de(tasks_fases(*fases))
        return pr.lotes_de(tarefas, fs)

    def fase(self, primeira, quantas, estimativa="2h"):
        return [(primeira + i, [False], estimativa) for i in range(quantas)]

    def test_junta_phases_inteiras_ate_a_capacidade(self):
        # 14h = capacidade: duas Phases de 8h fecham o lote 1 (16h); a terceira abre o lote 2
        lotes = self.lotes(self.fase(1, 4), self.fase(5, 4), self.fase(9, 4), self.fase(13, 4))
        self.assertEqual([(l["fases"], len(l["tarefas"])) for l in lotes], [([1, 2], 8), ([3, 4], 8)])
        self.assertEqual([l["numero"] for l in lotes], [1, 2])

    def test_nunca_parte_uma_phase(self):
        lotes = self.lotes(self.fase(1, 10), self.fase(11, 3))  # 20h na Phase 1: passa da capacidade, mas fica inteira
        self.assertEqual([(l["fases"], len(l["tarefas"])) for l in lotes], [([1], 10), ([2], 3)])

    def test_cauda_de_ate_2_tarefas_entra_no_lote_anterior(self):
        lotes = self.lotes(self.fase(1, 8), self.fase(9, 2))
        self.assertEqual(len(lotes), 1)
        self.assertEqual(lotes[0]["fases"], [1, 2])

    def test_cauda_maior_fica_em_lote_proprio(self):
        lotes = self.lotes(self.fase(1, 8), self.fase(9, 3))
        self.assertEqual([l["fases"] for l in lotes], [[1], [2]])

    def test_sem_estimativa_cada_tarefa_conta_1h(self):
        lotes = self.lotes(self.fase(1, 7, None), self.fase(8, 7, None), self.fase(15, 7, None))
        self.assertEqual([l["fases"] for l in lotes], [[1, 2], [3]])
        self.assertEqual(lotes[0]["horas"], 14.0)

    def test_sem_phases_cada_tarefa_e_uma_unidade(self):
        tarefas, fs = pr.tarefas_de(tasks_md(*[tarefa(i, [False], estimativa="2h") for i in range(1, 17)]))
        lotes = pr.lotes_de(tarefas, fs)
        self.assertEqual([len(l["tarefas"]) for l in lotes], [7, 9])  # 7×2h = 14h; cauda de 2 foi absorvida


def _git(pasta, *args, quando=None):
    env = dict(os.environ)
    if quando is not None:
        env["GIT_AUTHOR_DATE"] = env["GIT_COMMITTER_DATE"] = f"{quando} +0000"
    subprocess.run(["git", "-c", "user.name=t", "-c", "user.email=t@t", "-c", "commit.gpgsign=false", *args],
                   cwd=pasta, env=env, check=True, capture_output=True)


@unittest.skipUnless(shutil.which("git"), "git não está instalado")
class TestTempo(unittest.TestCase):
    """Tempo por tarefa, lido do git log do tasks.md com datas controladas."""

    INICIO = 1_700_000_000

    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.raiz = Path(self.tmp.name)
        self.addCleanup(self.tmp.cleanup)
        _git(self.raiz, "init", "-q")
        self.tasks = self.raiz / ".specs/features/a/tasks.md"

    def versao(self, feitas, quando, total=5, estimativa="1h"):
        """Grava o tasks.md com as tarefas `feitas` marcadas e commita na data `quando`."""
        fases = [[(i, [i in feitas], estimativa) for i in range(1, 4)],
                 [(i, [i in feitas], estimativa) for i in range(4, total + 1)]]
        escrever(self.raiz, ".specs/features/a/tasks.md", tasks_fases(*fases))
        _git(self.raiz, "add", "-A")
        _git(self.raiz, "commit", "-q", "-m", f"feat(a): v{len(feitas)}", quando=self.INICIO + quando)

    def tarefas(self, agora=None):
        rel = pr.relatorio(self.raiz, agora=agora or self.INICIO + 10_000)
        return rel, {t["id"]: t for t in rel["detalhe"]["tarefas"]}

    def test_tempo_e_o_intervalo_desde_a_conclusao_anterior(self):
        self.versao(set(), 0)
        self.versao({1}, 600)
        self.versao({1, 2}, 1500)
        self.versao({1, 2, 3}, 1800)
        _, t = self.tarefas()
        self.assertIsNone(t["T1"]["segundos"])  # sem conclusão anterior para medir
        self.assertEqual(t["T2"]["segundos"], 900)
        self.assertEqual(t["T3"]["segundos"], 300)
        self.assertEqual(t["T3"]["quando"], self.INICIO + 1800)

    def test_pausa_longa_nao_vira_tempo_de_tarefa(self):
        self.versao({1}, 600)
        self.versao({1, 2}, 600 + 91 * 60)
        self.versao({1, 2, 3}, 600 + 91 * 60 + 120)
        _, t = self.tarefas()
        self.assertIsNone(t["T2"]["segundos"])
        self.assertEqual(t["T3"]["segundos"], 120)

    def test_exatamente_no_limite_de_pausa_ainda_conta(self):
        self.versao({1}, 600)
        self.versao({1, 2}, 600 + 90 * 60)
        self.assertEqual(self.tarefas()[1]["T2"]["segundos"], 90 * 60)

    def test_tarefas_no_mesmo_commit_dividem_o_intervalo(self):
        self.versao({1}, 600)
        self.versao({1, 2, 3}, 1800)
        _, t = self.tarefas()
        self.assertEqual((t["T2"]["segundos"], t["T3"]["segundos"]), (600, 600))

    def test_commit_que_nao_conclui_nada_nao_mexe_na_medida(self):
        self.versao({1}, 600)
        escrever(self.raiz, ".specs/features/a/notas.md", "x")
        _git(self.raiz, "add", "-A")
        _git(self.raiz, "commit", "-q", "-m", "docs(a): nota", quando=self.INICIO + 900)
        self.versao({1, 2}, 1200)
        self.assertEqual(self.tarefas()[1]["T2"]["segundos"], 600)

    def test_ritmo_e_fator_de_calibracao(self):
        self.versao({1}, 600)
        self.versao({1, 2}, 1500)
        self.versao({1, 2, 3}, 1800)
        rel, _ = self.tarefas()
        ritmo = rel["detalhe"]["ritmo"]
        self.assertAlmostEqual(ritmo["por_hora"], 6.0)  # 2 tarefas em 20 min
        self.assertAlmostEqual(ritmo["fator"], 1 / 6)  # 20 min reais para 2h estimadas
        self.assertEqual(ritmo["amostra"], 2)

    def test_linhas_do_status_completo(self):
        self.versao({1}, 600)
        self.versao({1, 2}, 1500)
        self.versao({1, 2, 3}, 1800)
        rel, _ = self.tarefas(agora=self.INICIO + 1800 + 120)
        linhas = pr.formatar(rel).splitlines()
        self.assertIn("Phase atual (Phase 2: Fase 2): Faltam 2 de 2 tarefas: 0% concluído", linhas)
        self.assertIn("Tarefa atual: T4 — Tarefa 4 (estimada 1h)", linhas)
        self.assertIn("Última tarefa: T3 há 2 min (5 min; estimada 1h)", linhas)
        self.assertIn("Ritmo: 6,0 tarefas/h · faltam ~2h de trabalho humano estimado · previsão ~20 min no ritmo atual",
                      linhas)

    def test_v2_da_tarefa_traz_tempo_estimado_e_andamento(self):
        self.versao({1}, 600)
        self.versao({1, 2}, 1500)
        rel, _ = self.tarefas()
        self.assertEqual(pr.linha_tarefa(rel, "T2"),
                         "T2 concluída: 15 min (estimada 1h) · Phase 1: 2 de 3 tarefas · Feature: 2 de 5 tarefas (40%)")
        self.assertEqual(pr.linha_tarefa(rel), pr.linha_tarefa(rel, "T2"))  # sem ID: a última concluída
        self.assertTrue(pr.linha_tarefa(rel, "T1").startswith("T1 concluída: tempo não medido (estimada 1h)"))
        self.assertEqual(pr.linha_tarefa(rel, "T4"), "T4 ainda não concluída")
        self.assertIsNone(pr.linha_tarefa(rel, "T99"))

    def test_v2_do_lote_soma_o_tempo_medido(self):
        self.versao({1}, 600)
        self.versao({1, 2}, 1500)
        self.versao({1, 2, 3}, 1800)
        rel, _ = self.tarefas()
        linha = pr.linha_lote(rel)
        self.assertEqual(linha, "Lote 1 de 1 em andamento: 3 de 5 tarefas, 20 min até agora (estimado 5h); "
                                "tempo medido em 2 de 3 · Feature: 3 de 5 tarefas (60%)")
        self.assertEqual(pr.linha_lote(rel, 1), linha)
        self.assertIsNone(pr.linha_lote(rel, 2))

    def test_v2_do_lote_concluido(self):
        self.versao({1}, 600)
        self.versao({1, 2}, 1500)
        self.versao({1, 2, 3, 4, 5}, 2100)
        rel, _ = self.tarefas()
        self.assertTrue(pr.linha_lote(rel).startswith("Lote 1 de 1 concluído: 5 tarefas em "))
        self.assertIn("(estimado 5h)", pr.linha_lote(rel))
        self.assertTrue(pr.linha_lote(rel).endswith("Feature: 5 de 5 tarefas (100%)"))

    def test_v2_do_lote_sem_estimativa_diz_isso(self):
        self.versao({1, 2}, 600, estimativa=None)
        rel, _ = self.tarefas()
        self.assertIn("(sem estimativa)", pr.linha_lote(rel))

    def test_sem_git_o_resto_continua_funcionando(self):
        with tempfile.TemporaryDirectory() as sem_git:
            escrever(sem_git, ".specs/features/a/tasks.md", tasks_fases([(1, [True], "1h"), (2, [False], "1h")]))
            rel = pr.relatorio(sem_git)
            texto = pr.formatar(rel)
        self.assertIn("Tarefa atual: T2", texto)
        self.assertNotIn("Última tarefa", texto)
        self.assertIn("faltam ~1h de trabalho humano estimado", texto)
        self.assertNotIn("previsão", texto)

    def test_limita_o_numero_de_commits_lidos(self):
        for n in range(1, 4):
            self.versao(set(range(1, n + 1)), n * 300)
        eventos = pr.conclusoes(self.tasks, limite=2)
        self.assertEqual([ids for _, ids in eventos], [["T2"], ["T3"]])


class TestMain(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.raiz = Path(self.tmp.name)
        self.addCleanup(self.tmp.cleanup)
        escrever(self.raiz, ".specs/features/a/tasks.md", tasks_md(tarefa(1, [True]), tarefa(2, [False])))

    def rodar(self, *args):
        saida = io.StringIO()
        with contextlib.redirect_stdout(saida):
            codigo = pr.main(["--raiz", str(self.raiz), *args])
        return codigo, saida.getvalue()

    def test_saida_em_texto(self):
        codigo, saida = self.rodar()
        self.assertEqual(codigo, 0)
        self.assertIn("Feature atual (.specs/features/a): Falta 1 de 2 tarefas: 50% concluído", saida)

    def test_saida_json(self):
        codigo, saida = self.rodar("--json")
        self.assertEqual(codigo, 0)
        dados = json.loads(saida)
        self.assertEqual(dados["projeto"], {"total": 2, "feitas": 1})

    def test_v2_da_tarefa_por_argumento(self):
        codigo, saida = self.rodar("--tarefa", "T1")
        self.assertEqual(codigo, 0)
        self.assertEqual(saida.strip(), "T1 concluída: tempo não medido · Feature: 1 de 2 tarefas (50%)")

    def test_v2_do_lote_por_argumento(self):
        codigo, saida = self.rodar("--lote")
        self.assertEqual(codigo, 0)
        self.assertTrue(saida.startswith("Lote 1 de 1 em andamento: 1 de 2 tarefas"))

    def test_v2_em_json_traz_so_a_linha(self):
        codigo, saida = self.rodar("--tarefa", "T1", "--json")
        self.assertEqual(codigo, 0)
        self.assertEqual(list(json.loads(saida)), ["linha"])

    def test_tarefa_inexistente_sai_com_1(self):
        saida = io.StringIO()
        with contextlib.redirect_stdout(saida), contextlib.redirect_stderr(saida):
            self.assertEqual(pr.main(["--raiz", str(self.raiz), "--tarefa", "T9"]), 1)
            self.assertEqual(pr.main(["--raiz", str(self.raiz), "--lote", "7"]), 1)
        self.assertIn("não encontrada", saida.getvalue())

    def test_lote_que_nao_e_numero_sai_com_2(self):
        saida = io.StringIO()
        with contextlib.redirect_stdout(saida), contextlib.redirect_stderr(saida):
            self.assertEqual(pr.main(["--raiz", str(self.raiz), "--lote", "abc"]), 2)

    def test_saida_em_utf8_mesmo_quando_o_padrao_do_sistema_nao_e(self):
        """Em pipe no Windows o Python usa cp1252; o chamador lê UTF-8 e o 'í' viraria '�'."""
        import os
        import subprocess
        import sys
        env = {k: v for k, v in os.environ.items() if k not in ("PYTHONUTF8", "PYTHONIOENCODING")}
        env["PYTHONIOENCODING"] = "cp1252"
        r = subprocess.run([sys.executable, str(pr_caminho), "--raiz", str(self.raiz)],
                           capture_output=True, env=env)
        self.assertEqual(r.returncode, 0)
        self.assertIn("concluído", r.stdout.decode("utf-8"))

    def test_raiz_inexistente_recusa(self):
        saida = io.StringIO()
        with contextlib.redirect_stdout(saida), contextlib.redirect_stderr(saida):
            codigo = pr.main(["--raiz", str(self.raiz / "nao-existe")])
        self.assertEqual(codigo, 2)


if __name__ == "__main__":
    unittest.main()
