import { describe, expect, it } from "vitest";
import {
  calcProjeto,
  calcularParcelas,
  custoBaseMesCents,
  custoVigenteNoMes,
  makeRateOf,
  parcelaVencida,
  saldoConsultorProjeto,
  semaforo,
  totalRecebidoCents,
} from "./calc";
import { addMonths } from "./dates";
import { splitCents } from "./money";
import type { Consultor, Custo, Lancamento, Pagamento, Parcela, Projeto } from "@/types";

const equipe: Consultor[] = [
  { id: "c1", nome: "Ana", funcao: "Consultor", email: "ana@x.com", custoHoraCents: 12000, ativo: true, papel: "consultor" },
  { id: "c2", nome: "Bruno", funcao: "Consultor", email: "bruno@x.com", custoHoraCents: 8000, ativo: true, papel: "consultor" },
];
const rateOf = makeRateOf(equipe);

const proj = (over: Partial<Projeto> = {}): Projeto => ({
  id: "P001",
  kind: "projeto",
  nome: "Teste",
  cliente: "Cliente",
  tipo: "",
  gerenteId: null,
  valorCents: 10_000_00,
  pctAdm: 0.2,
  pctCom: 0.02,
  pctLucro: 0.1,
  status: "Em Andamento",
  dtIni: null,
  dtFim: null,
  ...over,
});

describe("calcProjeto — cascata", () => {
  it("calcula ADM, comissão, lucro e disponível", () => {
    const c = calcProjeto(proj(), [], [], rateOf);
    expect(c.custoAdmCents).toBe(2_000_00);
    expect(c.custoComCents).toBe(200_00);
    expect(c.lucroCents).toBe(1_000_00);
    expect(c.dispHTCents).toBe(6_800_00);
  });

  it("#8 usa o custo/hora POR consultor (não R$100 fixo)", () => {
    const lancs: Lancamento[] = [
      { id: "l1", projetoId: "P001", tarefaId: null, consultorId: "c1", competencia: "2026-07", horas: 10, data: "2026-07-01", obs: "" },
      { id: "l2", projetoId: "P001", tarefaId: null, consultorId: "c2", competencia: "2026-07", horas: 10, data: "2026-07-01", obs: "" },
    ];
    const c = calcProjeto(proj(), lancs, [], rateOf);
    // 10*120 + 10*80 = 2000,00 — jamais 10*100 + 10*100
    expect(c.custoHTrabCents).toBe(2_000_00);
    expect(c.hTrab).toBe(20);
  });

  it("#11 marca estouro quando não há disponível e ainda assim gastou", () => {
    const semMargem = proj({ pctAdm: 0.5, pctCom: 0.3, pctLucro: 0.2 }); // disp = 0
    const lancs: Lancamento[] = [
      { id: "l1", projetoId: "P001", tarefaId: null, consultorId: "c1", competencia: "2026-07", horas: 1, data: "2026-07-01", obs: "" },
    ];
    const c = calcProjeto(semMargem, lancs, [], rateOf);
    expect(c.dispHTCents).toBe(0);
    expect(c.pctGasto).toBe(Infinity);
    expect(semaforo(c.pctGasto).nivel).toBe("estourou");
  });
});

describe("semaforo", () => {
  it("classifica as faixas", () => {
    expect(semaforo(0.5).nivel).toBe("ok");
    expect(semaforo(0.8).nivel).toBe("atencao");
    expect(semaforo(0.95).nivel).toBe("limite");
    expect(semaforo(1.2).nivel).toBe("estourou");
  });
});

describe("calcularParcelas", () => {
  it("#7 não pula meses (dia 31)", () => {
    // 3 parcelas a partir de 31/01 → 31/01, 28/02, 31/03
    const ps = calcularParcelas(9_000_00, 3, false, 0, "2026-01-31");
    expect(ps.map((p) => p.vencimento)).toEqual([
      "2026-01-31",
      "2026-02-28",
      "2026-03-31",
    ]);
  });

  it("soma das parcelas bate exatamente com o total (sem sobra de centavo)", () => {
    const ps = calcularParcelas(10_000_00, 3, false, 0, "2026-01-10");
    const soma = ps.reduce((s, p) => s + p.valorCents, 0);
    expect(soma).toBe(10_000_00);
  });

  it("respeita entrada + parcelas", () => {
    const ps = calcularParcelas(10_000_00, 3, true, 4_000_00, "2026-01-10");
    expect(ps[0]).toMatchObject({ entrada: true, valorCents: 4_000_00 });
    expect(ps.reduce((s, p) => s + p.valorCents, 0)).toBe(10_000_00);
  });
});

describe("addMonths seguro", () => {
  it("preserva o dia quando possível e ajusta no fim do mês", () => {
    expect(addMonths("2026-01-31", 1)).toBe("2026-02-28");
    expect(addMonths("2026-01-15", 1)).toBe("2026-02-15");
    expect(addMonths("2026-12-31", 2)).toBe("2027-02-28");
  });
});

describe("splitCents", () => {
  it("distribui o resto na última parte", () => {
    expect(splitCents(1000, 3)).toEqual([333, 333, 334]);
  });
});

describe("recebimento (#6)", () => {
  const parc = (over: Partial<Parcela>): Parcela => ({
    id: "x",
    projetoId: "P001",
    numero: 1,
    vencimento: "2026-01-01",
    valorCents: 1_000_00,
    status: "a_receber",
    recebidoEm: null,
    entrada: false,
    ...over,
  });

  it("parcela vencida é derivada, não recebida", () => {
    const p = parc({ vencimento: "2026-01-01", status: "a_receber" });
    expect(parcelaVencida(p, "2026-07-16")).toBe(true);
    expect(totalRecebidoCents([p])).toBe(0); // vencer NÃO é receber
  });

  it("só conta como recebido quando status = recebida", () => {
    const p = parc({ status: "recebida", recebidoEm: "2026-02-01" });
    expect(totalRecebidoCents([p])).toBe(1_000_00);
  });
});

describe("saldo por projeto (#9)", () => {
  it("aloca pagamento ao projeto correto", () => {
    const lancs: Lancamento[] = [
      { id: "l1", projetoId: "P001", tarefaId: null, consultorId: "c1", competencia: "2026-07", horas: 10, data: "2026-07-01", obs: "" },
      { id: "l2", projetoId: "P002", tarefaId: null, consultorId: "c1", competencia: "2026-07", horas: 5, data: "2026-07-01", obs: "" },
    ];
    const pags: Pagamento[] = [
      { id: "pg1", consultorId: "c1", projetoId: "P001", horas: 4, valorCents: 4 * 12000, data: "2026-07-10", competencia: "2026-07", obs: "" },
    ];
    expect(saldoConsultorProjeto("c1", "P001", lancs, pags)).toBe(6);
    expect(saldoConsultorProjeto("c1", "P002", lancs, pags)).toBe(5);
  });
});

describe("rateio de custos", () => {
  const p = (id: string, kind: "projeto" | "treinamento"): Projeto => ({
    id, kind, nome: id, cliente: "", tipo: "", gerenteId: null,
    valorCents: 0, pctAdm: 0, pctCom: 0, pctLucro: 0, status: "Em Andamento",
    dtIni: "2026-01-01", dtFim: "2026-12-31",
  });
  const projetos = [p("P1", "projeto"), p("P2", "projeto"), p("T1", "treinamento")];

  const custo = (over: Partial<Custo>): Custo => ({
    id: "x", categoria: "Geral", descricao: "", valorCents: 0, competencia: "2026-07",
    competenciaFim: null, frequencia: "unica", rateio: "ativos_todos", projetoId: null,
    rateioCustom: [], ...over,
  });

  it("'ativos' rateia só entre projetos; 'ativos_todos' inclui treinamentos", () => {
    const custos = [
      custo({ id: "a", valorCents: 60000, rateio: "ativos_todos" }), // 600 / 3 = 200 cada
      custo({ id: "b", valorCents: 150000, rateio: "ativos" }), //     1500 / 2 = 750 cada projeto
    ];
    expect(custoBaseMesCents("P1", "2026-07", custos, projetos)).toBe(95000); // 200 + 750
    expect(custoBaseMesCents("T1", "2026-07", custos, projetos)).toBe(20000); // só o "ativos_todos"
    const total = ["P1", "P2", "T1"].reduce((s, id) => s + custoBaseMesCents(id, "2026-07", custos, projetos), 0);
    expect(total).toBe(60000 + 150000); // apropriado = vigente
  });

  it("rateio personalizado respeita os percentuais", () => {
    const custos = [custo({ valorCents: 100000, rateio: "personalizado", rateioCustom: [{ projetoId: "P1", pct: 70 }, { projetoId: "P2", pct: 30 }] })];
    expect(custoBaseMesCents("P1", "2026-07", custos, projetos)).toBe(70000);
    expect(custoBaseMesCents("P2", "2026-07", custos, projetos)).toBe(30000);
  });

  it("custo recorrente vale dentro da janela e única só na competência", () => {
    const rec = custo({ frequencia: "recorrente", competencia: "2026-05", competenciaFim: "2026-08" });
    expect(custoVigenteNoMes(rec, "2026-04")).toBe(false);
    expect(custoVigenteNoMes(rec, "2026-07")).toBe(true);
    expect(custoVigenteNoMes(rec, "2026-09")).toBe(false);
    const uni = custo({ frequencia: "unica", competencia: "2026-07" });
    expect(custoVigenteNoMes(uni, "2026-07")).toBe(true);
    expect(custoVigenteNoMes(uni, "2026-08")).toBe(false);
  });
});
