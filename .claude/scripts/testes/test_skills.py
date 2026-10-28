"""Checagem estrutural das skills de .claude/skills.

Não é script: protege a forma das peças enquanto os fluxos crescem (frontmatter,
tamanho, links para references/ e menu do /fluxo apontando para skill existente).
"""

import json
import re
import unittest
from pathlib import Path

CLAUDE = Path(__file__).resolve().parents[2]
SKILLS = CLAUDE / "skills"
LIMITE_LINHAS = 150

LINK = re.compile(r"\]\(([^)\s]+)\)")


def skills_de_pacote():
    """Pastas instaladas por pacote: não são nossas, não seguem o limite de linhas."""
    fontes = json.loads((CLAUDE / "fontes.json").read_text(encoding="utf-8"))["fontes"]
    return {
        Path(f["usado_em"]).name
        for f in fontes
        if f.get("tipo") == "pacote" and f.get("usado_em", "").startswith(".claude/skills/")
    }


def frontmatter(texto):
    partes = texto.split("---", 2)
    if not texto.startswith("---") or len(partes) < 3:
        return {}
    campos = {}
    for linha in partes[1].splitlines():
        if ":" in linha and not linha.startswith(" "):
            chave, valor = linha.split(":", 1)
            campos[chave.strip()] = valor.strip()
    return campos


def links_locais(arquivo):
    for alvo in LINK.findall(arquivo.read_text(encoding="utf-8")):
        if alvo.startswith(("http://", "https://", "#", "mailto:")):
            continue
        yield alvo.split("#", 1)[0]


class TestSkills(unittest.TestCase):
    def setUp(self):
        self.pacotes = skills_de_pacote()
        self.pastas = sorted(p for p in SKILLS.iterdir() if p.is_dir())

    def test_toda_pasta_tem_skill_md_com_nome_e_descricao(self):
        for pasta in self.pastas:
            with self.subTest(skill=pasta.name):
                arquivo = pasta / "SKILL.md"
                self.assertTrue(arquivo.exists(), "falta SKILL.md")
                campos = frontmatter(arquivo.read_text(encoding="utf-8"))
                self.assertEqual(campos.get("name"), pasta.name)
                self.assertTrue(campos.get("description"), "description vazia")

    def test_skills_nossas_ate_150_linhas(self):
        for pasta in self.pastas:
            if pasta.name in self.pacotes:
                continue
            with self.subTest(skill=pasta.name):
                linhas = len((pasta / "SKILL.md").read_text(encoding="utf-8").splitlines())
                self.assertLessEqual(linhas, LIMITE_LINHAS)

    def test_links_locais_existem(self):
        for pasta in self.pastas:
            if pasta.name in self.pacotes:
                continue
            for arquivo in [pasta / "SKILL.md", *sorted((pasta / "references").glob("*.md"))]:
                for alvo in links_locais(arquivo):
                    with self.subTest(arquivo=str(arquivo.relative_to(SKILLS)), link=alvo):
                        self.assertTrue((arquivo.parent / alvo).exists(), "link quebrado")

    def test_fluxos_que_criam_telas_oferecem_mockup(self):
        """Feature, legado e uso próprio oferecem a mockup-visual quando há tela; o reconhecimento registra a decisão."""
        for nome in ("feature", "legado", "uso-proprio"):
            with self.subTest(skill=nome):
                texto = (SKILLS / nome / "SKILL.md").read_text(encoding="utf-8")
                self.assertIn("mockup-visual", texto)
                self.assertNotIn("só se o usuário pedir", texto)
        reconhecimento = (SKILLS / "reconhecimento" / "SKILL.md").read_text(encoding="utf-8")
        self.assertIn("**Mockup**", reconhecimento)
        mockup = SKILLS / "mockup-visual"
        self.assertIn("Modo módulo", (mockup / "SKILL.md").read_text(encoding="utf-8"))
        self.assertTrue((mockup / "references" / "modulo.md").exists())

    def test_fase_nao_depende_da_memoria_da_conversa(self):
        """Trocar de sessão nos marcos exige que toda aprovação fique gravada em arquivo."""
        for pasta in self.pastas:
            if pasta.name in self.pacotes:
                continue
            for arquivo in [pasta / "SKILL.md", *sorted((pasta / "references").glob("*.md"))]:
                with self.subTest(arquivo=str(arquivo.relative_to(SKILLS))):
                    self.assertNotIn("aprovação nesta sessão", arquivo.read_text(encoding="utf-8"))
        self.assertIn("**Plano aprovado em**", (SKILLS / "reconhecimento" / "SKILL.md").read_text(encoding="utf-8"))

    def test_marcos_de_troca_de_sessao(self):
        claude_md = (CLAUDE / "CLAUDE.md").read_text(encoding="utf-8")
        self.assertIn("## Marcos de troca de sessão", claude_md)
        self.assertTrue((SKILLS / "fluxo" / "references" / "marcos.md").exists())
        menu = (SKILLS / "fluxo" / "SKILL.md").read_text(encoding="utf-8")
        self.assertIn("## Retomada", menu)
        self.assertIn("references/marcos.md", menu)

    def test_progresso_no_resumo_de_fase_e_na_retomada(self):
        """O status de tarefas aparece no fim de cada fase e ao retomar a sessão."""
        claude_md = (CLAUDE / "CLAUDE.md").read_text(encoding="utf-8")
        self.assertIn("python .claude/scripts/progresso.py", claude_md)
        marcos = (SKILLS / "fluxo" / "references" / "marcos.md").read_text(encoding="utf-8")
        self.assertIn("**Progresso**", marcos)
        self.assertIn("progresso.py", (SKILLS / "fluxo" / "SKILL.md").read_text(encoding="utf-8"))
        skill = (SKILLS / "progresso" / "SKILL.md").read_text(encoding="utf-8")
        self.assertIn("python .claude/scripts/progresso.py", skill)
        self.assertTrue((CLAUDE / "scripts" / "progresso.py").exists())

    def test_roteiro_acima_da_feature(self):
        """A quebra do produto em features é uma fase própria e o vocabulário é único."""
        def ler(*partes):
            return SKILLS.joinpath(*partes).read_text(encoding="utf-8")

        self.assertIn("6b", ler("projeto-novo", "references", "fases.md"))
        self.assertIn("skill `roteiro`", ler("projeto-novo", "SKILL.md"))
        self.assertIn("3b", ler("uso-proprio", "references", "fases.md"))
        self.assertIn("skill `roteiro`", ler("uso-proprio", "SKILL.md"))
        for fluxo in ("feature", "legado"):
            with self.subTest(fluxo=fluxo):
                self.assertIn("skill `roteiro`", ler(fluxo, "SKILL.md"))
        claude_md = (CLAUDE / "CLAUDE.md").read_text(encoding="utf-8")
        self.assertIn("## Vocabulário", claude_md)
        self.assertIn("**Roteiro**", claude_md)
        self.assertIn("roteiro", (CLAUDE / "rules" / "artefatos.md").read_text(encoding="utf-8"))
        self.assertTrue((SKILLS / "roteiro" / "references" / "criterios.md").exists())
        self.assertTrue((SKILLS / "roteiro" / "references" / "modelo.md").exists())

    def test_tarefa_pequena_e_sem_limite_de_quantidade(self):
        """O limite é o tamanho da tarefa (até 2 horas de trabalho humano), nunca a quantidade."""
        claude_md = (CLAUDE / "CLAUDE.md").read_text(encoding="utf-8")
        self.assertIn("## Tarefas", claude_md)
        self.assertIn("**Estimativa**", claude_md)
        self.assertIn("2 horas", claude_md)
        for arquivo in (CLAUDE / "CLAUDE.md", SKILLS / "roteiro" / "SKILL.md",
                        SKILLS / "roteiro" / "references" / "criterios.md",
                        SKILLS / "roteiro" / "references" / "modelo.md",
                        SKILLS / "feature" / "SKILL.md", SKILLS / "legado" / "SKILL.md"):
            with self.subTest(arquivo=arquivo.name):
                texto = arquivo.read_text(encoding="utf-8")
                self.assertIsNone(re.search(r"(?<!\d)80 tarefas", texto), "sobrou o limite de 80 tarefas")
                self.assertNotIn("LIMITE_TAREFAS", texto)
        for nome in ("feature", "legado", "projeto-novo", "uso-proprio"):
            with self.subTest(skill=nome):
                self.assertIn("Estimativa", (SKILLS / nome / "SKILL.md").read_text(encoding="utf-8"))

    def test_execucao_por_lote_com_v2_por_tarefa(self):
        """Sempre por subagente, um lote por vez; o trabalhador relata o V2 de cada tarefa; a revisão segue o risco."""
        claude_md = (CLAUDE / "CLAUDE.md").read_text(encoding="utf-8")
        for trecho in ("## Execução", "Sempre por subagente, um lote por vez", "Não há execução inline",
                       "progresso.py --tarefa", "progresso.py --lote", "`**Risco**: alto|baixo`", "**14h**",
                       "substitui o passo 6.4", "uma linha V2 por tarefa"):
            with self.subTest(trecho=trecho):
                self.assertIn(trecho, claude_md)
        self.assertNotIn("**Subagentes**", claude_md)  # não há mais oferta nem escolha de subagentes
        for nome in ("implementador", "implementador-dominio"):
            with self.subTest(agente=nome):
                texto = (CLAUDE / "agents" / f"{nome}.md").read_text(encoding="utf-8")
                self.assertIn("Lote (fases", texto)
                self.assertIn("progresso.py --tarefa", texto)  # o trabalhador relata o V2 depois de cada tarefa
                self.assertIn("revisão por risco", texto.lower())
                self.assertNotIn("Tarefa <ID> concluída", texto)
        progresso = (SKILLS / "progresso" / "SKILL.md").read_text(encoding="utf-8")
        for trecho in ("--tarefa", "--lote", "Feature atual", "Phase atual"):
            with self.subTest(progresso=trecho):
                self.assertIn(trecho, progresso)
        marcos = (SKILLS / "fluxo" / "references" / "marcos.md").read_text(encoding="utf-8")
        self.assertIn("Feature atual", marcos)
        self.assertIn("commit-msg", (CLAUDE / "scripts" / "instalar.py").read_text(encoding="utf-8"))

    def test_trava_de_modelo(self):
        """A sessão compara o próprio modelo com o da fase e pergunta antes de trabalhar."""
        claude_md = (CLAUDE / "CLAUDE.md").read_text(encoding="utf-8")
        self.assertIn("**Trava de modelo**", claude_md)
        self.assertIn("antes de qualquer trabalho da fase", claude_md)
        self.assertIn("trava de modelo", (SKILLS / "fluxo" / "SKILL.md").read_text(encoding="utf-8"))
        self.assertIn("trava de modelo", (SKILLS / "fluxo" / "references" / "marcos.md").read_text(encoding="utf-8"))

    def test_fluxo_pronto_aponta_para_skill_existente(self):
        menu = (SKILLS / "fluxo" / "SKILL.md").read_text(encoding="utf-8")
        prontos = [linha for linha in menu.splitlines() if linha.startswith("|") and "**Pronto**" in linha]
        self.assertTrue(prontos, "nenhum fluxo pronto no menu")
        for linha in prontos:
            with self.subTest(linha=linha[:40]):
                nomes = re.findall(r"skill `([a-z0-9-]+)`", linha)
                self.assertTrue(nomes, "fluxo pronto sem skill indicada")
                for nome in nomes:
                    self.assertTrue((SKILLS / nome / "SKILL.md").exists(), f"skill {nome} não existe")


if __name__ == "__main__":
    unittest.main()
