// ═══════════════════════════════════════════════════════════════
// MOTOR FINANCEIRO — funções PURAS (sem estado, sem DOM).
// Portado do protótipo, com as correções da auditoria:
//  #8  custo/hora por consultor (nunca R$100 fixo)
//  #9  pagamento alocado por projeto (não rateio global)
//  #11 % gasto marca estouro quando não há margem
//  #6  "recebido" só conta parcela com status "recebida"
// ═══════════════════════════════════════════════════════════════

import type {
  Consultor,
  Custo,
  Lancamento,
  Pagamento,
  Parcela,
  Projeto,
  Snapshot,
  Tarefa,
} from "@/types";
import { addMonths, competenciaOf, competenciasBetween } from "./dates";
import { splitCents } from "./money";

// ── custo/hora ────────────────────────────────────────────────
/** Cria uma função que devolve o custo/hora (centavos) de um consultor. 0 se desconhecido. */
export function makeRateOf(equipe: Consultor[]): (consultorId: string) => number {
  const map = new Map(equipe.map((c) => [c.id, c.custoHoraCents]));
  return (consultorId: string) => map.get(consultorId) ?? 0;
}

/** Lançamentos cujo consultor não existe mais na equipe (para alertar o usuário). */
export function lancamentosOrfaos(snap: Snapshot): Lancamento[] {
  const ids = new Set(snap.equipe.map((c) => c.id));
  return snap.lancamentos.filter((l) => !ids.has(l.consultorId));
}

// ── cascata do projeto ────────────────────────────────────────
export interface ProjetoCalc {
  valorCents: number;
  custoAdmCents: number;
  custoComCents: number;
  lucroCents: number;
  /** Disponível para horas técnicas (o "orçamento" de execução). */
  dispHTCents: number;
  hTrab: number;
  custoHTrabCents: number;
  hPagas: number;
  valPagoCents: number;
  /** Fração gasta do disponível. Infinity = gastou sem ter margem. */
  pctGasto: number;
}

export function calcProjeto(
  p: Projeto,
  lancamentos: Lancamento[],
  pagamentos: Pagamento[],
  rateOf: (consultorId: string) => number,
): ProjetoCalc {
  const valorCents = p.valorCents || 0;
  const custoAdmCents = Math.round(valorCents * (p.pctAdm || 0));
  const custoComCents = Math.round(valorCents * (p.pctCom || 0));
  const lucroCents = Math.round(valorCents * (p.pctLucro || 0));
  const dispHTCents = valorCents - custoAdmCents - custoComCents - lucroCents;

  const lancs = lancamentos.filter((l) => l.projetoId === p.id);
  const hTrab = sum(lancs, (l) => l.horas);
  const custoHTrabCents = lancs.reduce(
    (s, l) => s + Math.round(l.horas * rateOf(l.consultorId)),
    0,
  );

  const pags = pagamentos.filter((pg) => pg.projetoId === p.id);
  const hPagas = sum(pags, (pg) => pg.horas);
  const valPagoCents = sum(pags, (pg) => pg.valorCents);

  // #11: se não há disponível e ainda assim se gastou, é estouro (Infinity),
  // nunca "verde 0%".
  const pctGasto =
    dispHTCents > 0
      ? custoHTrabCents / dispHTCents
      : custoHTrabCents > 0
        ? Infinity
        : 0;

  return {
    valorCents,
    custoAdmCents,
    custoComCents,
    lucroCents,
    dispHTCents,
    hTrab,
    custoHTrabCents,
    hPagas,
    valPagoCents,
    pctGasto,
  };
}

export type SemaforoNivel = "ok" | "atencao" | "limite" | "estourou";

export interface SemaforoInfo {
  nivel: SemaforoNivel;
  texto: string;
}

/** Semáforo do disponível: verde <70, amarelo 70–90, laranja 90–100, vermelho >100. */
export function semaforo(pctGasto: number): SemaforoInfo {
  const p = pctGasto * 100;
  if (p < 70) return { nivel: "ok", texto: "OK" };
  if (p < 90) return { nivel: "atencao", texto: "Atenção" };
  if (p <= 100) return { nivel: "limite", texto: "Limite" };
  return { nivel: "estourou", texto: "Estourou" };
}

// ── saldo por consultor ───────────────────────────────────────
export interface SaldoConsultor {
  hTrab: number;
  hPagas: number;
  hSaldo: number;
  vTrabCents: number;
  vPagasCents: number;
  vSaldoCents: number;
}

export function saldoConsultor(
  consultorId: string,
  lancamentos: Lancamento[],
  pagamentos: Pagamento[],
  rateOf: (consultorId: string) => number,
): SaldoConsultor {
  const ch = rateOf(consultorId);
  const hTrab = sum(
    lancamentos.filter((l) => l.consultorId === consultorId),
    (l) => l.horas,
  );
  const hPagas = sum(
    pagamentos.filter((p) => p.consultorId === consultorId),
    (p) => p.horas,
  );
  return {
    hTrab,
    hPagas,
    hSaldo: hTrab - hPagas,
    vTrabCents: Math.round(hTrab * ch),
    vPagasCents: Math.round(hPagas * ch),
    vSaldoCents: Math.round((hTrab - hPagas) * ch),
  };
}

/**
 * Saldo de horas de um consultor em um projeto específico.
 * #9: alocação real por projeto (lançamentos − pagamentos daquele projeto).
 */
export function saldoConsultorProjeto(
  consultorId: string,
  projetoId: string,
  lancamentos: Lancamento[],
  pagamentos: Pagamento[],
): number {
  const trab = sum(
    lancamentos.filter(
      (l) => l.consultorId === consultorId && l.projetoId === projetoId,
    ),
    (l) => l.horas,
  );
  const pago = sum(
    pagamentos.filter(
      (p) => p.consultorId === consultorId && p.projetoId === projetoId,
    ),
    (p) => p.horas,
  );
  return trab - pago;
}

// ── pago × a pagar por competência (mês trabalhado) ───────────
export interface ResumoMes {
  competencia: string;
  horasTrab: number;
  horasPagas: number;
  horasSaldo: number;
  valorPagoCents: number;
  valorSaldoCents: number;
}

/**
 * Para um consultor, quebra horas trabalhadas × pagas por competência (mês do
 * trabalho). Base da visão "pago / a pagar por mês".
 */
export function resumoPorCompetencia(
  consultorId: string,
  lancamentos: Lancamento[],
  pagamentos: Pagamento[],
  rateOf: (consultorId: string) => number,
): ResumoMes[] {
  const ch = rateOf(consultorId);
  const trab = new Map<string, number>();
  for (const l of lancamentos) {
    if (l.consultorId !== consultorId) continue;
    trab.set(l.competencia, (trab.get(l.competencia) ?? 0) + l.horas);
  }
  const pagas = new Map<string, number>();
  for (const p of pagamentos) {
    if (p.consultorId !== consultorId) continue;
    pagas.set(p.competencia, (pagas.get(p.competencia) ?? 0) + p.horas);
  }
  const comps = [...new Set([...trab.keys(), ...pagas.keys()])].filter(Boolean).sort();
  return comps.map((competencia) => {
    const horasTrab = trab.get(competencia) ?? 0;
    const horasPagas = pagas.get(competencia) ?? 0;
    const horasSaldo = horasTrab - horasPagas;
    return {
      competencia,
      horasTrab,
      horasPagas,
      horasSaldo,
      valorPagoCents: Math.round(horasPagas * ch),
      valorSaldoCents: Math.round(horasSaldo * ch),
    };
  });
}

export interface LinhaPagavel {
  competencia: string;
  projetoId: string;
  horasTrab: number;
  horasPagas: number;
  horasSaldo: number;
}

/**
 * Linhas (competência × projeto) com saldo a pagar > 0 para um consultor.
 * Usadas para registrar pagamento alocado ao mês e ao projeto certos.
 */
export function linhasPagaveis(
  consultorId: string,
  lancamentos: Lancamento[],
  pagamentos: Pagamento[],
): LinhaPagavel[] {
  const key = (comp: string, proj: string) => `${comp}||${proj}`;
  const trab = new Map<string, number>();
  for (const l of lancamentos) {
    if (l.consultorId !== consultorId) continue;
    const k = key(l.competencia, l.projetoId);
    trab.set(k, (trab.get(k) ?? 0) + l.horas);
  }
  const pagas = new Map<string, number>();
  for (const p of pagamentos) {
    if (p.consultorId !== consultorId || !p.projetoId) continue;
    const k = key(p.competencia, p.projetoId);
    pagas.set(k, (pagas.get(k) ?? 0) + p.horas);
  }
  const rows: LinhaPagavel[] = [];
  for (const k of new Set([...trab.keys(), ...pagas.keys()])) {
    const [competencia, projetoId] = k.split("||");
    const horasTrab = trab.get(k) ?? 0;
    const horasPagas = pagas.get(k) ?? 0;
    const horasSaldo = horasTrab - horasPagas;
    if (horasSaldo > 0.001) rows.push({ competencia, projetoId, horasTrab, horasPagas, horasSaldo });
  }
  return rows.sort((a, b) => a.competencia.localeCompare(b.competencia) || a.projetoId.localeCompare(b.projetoId));
}

// ── faturamento / parcelas ────────────────────────────────────
export interface ParcelaPreview {
  numero: number;
  vencimento: string; // ISO
  valorCents: number;
  entrada: boolean;
}

/**
 * Gera as parcelas de um contrato.
 * #7: usa addMonths seguro (não pula meses).  Centavos batem exatos (splitCents).
 */
export function calcularParcelas(
  valorCents: number,
  nParcelas: number,
  temEntrada: boolean,
  valorEntradaCents: number,
  dtParc1: string | null,
): ParcelaPreview[] {
  if (!dtParc1 || nParcelas < 1) return [];
  const parcelas: ParcelaPreview[] = [];
  let restante = valorCents;
  let nRestante = nParcelas;
  let idx = 0;

  if (temEntrada && valorEntradaCents > 0) {
    parcelas.push({
      numero: 1,
      vencimento: dtParc1,
      valorCents: valorEntradaCents,
      entrada: true,
    });
    restante = valorCents - valorEntradaCents;
    nRestante = nParcelas - 1;
    idx = 1;
  }

  if (nRestante > 0) {
    const valores = splitCents(restante, nRestante);
    for (let i = 0; i < nRestante; i++) {
      parcelas.push({
        numero: idx + i + 1,
        vencimento: addMonths(dtParc1, idx + i),
        valorCents: valores[i],
        entrada: false,
      });
    }
  }
  return parcelas;
}

/** Uma parcela está vencida? DERIVADO (nunca armazenado). #6 */
export function parcelaVencida(p: Parcela, todayISO: string): boolean {
  return p.status === "a_receber" && p.vencimento < todayISO;
}

// ── evolução mensal: receita e custo de horas por competência ──
/** Faturamento de um projeto numa competência (parcelas por vencimento, exclui canceladas). */
export function receitaMesCents(projetoId: string, comp: string, parcelas: Parcela[]): number {
  return parcelas
    .filter((p) => p.projetoId === projetoId && p.status !== "cancelada" && competenciaOf(p.vencimento) === comp)
    .reduce((s, p) => s + p.valorCents, 0);
}

/** Receita JÁ RECEBIDA de um projeto numa competência (status "recebida"). */
export function receitaRecebidaMesCents(projetoId: string, comp: string, parcelas: Parcela[]): number {
  return parcelas
    .filter((p) => p.projetoId === projetoId && p.status === "recebida" && competenciaOf(p.vencimento) === comp)
    .reduce((s, p) => s + p.valorCents, 0);
}

/** Custo de horas (mão de obra) de um projeto numa competência. */
export function custoHorasMesCents(
  projetoId: string,
  comp: string,
  lancamentos: Lancamento[],
  rateOf: (consultorId: string) => number,
): number {
  return lancamentos
    .filter((l) => l.projetoId === projetoId && l.competencia === comp)
    .reduce((s, l) => s + Math.round(l.horas * rateOf(l.consultorId)), 0);
}

/**
 * Custo proporcional (impostos, comissão, adm, marketing…) de um projeto numa competência.
 * O percentual é aplicado sobre a receita reconhecida no mês.
 */
export function custoPctMesCents(
  pct: number,
  projetoId: string,
  comp: string,
  parcelas: Parcela[],
): number {
  if (!pct) return 0;
  return Math.round(receitaMesCents(projetoId, comp, parcelas) * pct);
}

/** Linha DRE completa de uma lista de projetos numa competência. */
export interface LinhaDRE {
  comp: string;
  receita: number;
  receitaRecebida: number;
  impostos: number;
  comissao: number;
  receitaLiq: number;
  lucroReservado: number;
  adm: number;
  marketing: number;
  custoHoras: number;
  custoBase: number;
  totalDespesas: number;
  resultado: number;
}

export function linhaDRE(
  comp: string,
  projetos: Projeto[],
  parcelas: Parcela[],
  lancamentos: Lancamento[],
  custos: Custo[],
  todosProjetos: Projeto[],
  rateOf: (consultorId: string) => number,
): LinhaDRE {
  const receita = projetos.reduce((s, p) => s + receitaMesCents(p.id, comp, parcelas), 0);
  const receitaRecebida = projetos.reduce((s, p) => s + receitaRecebidaMesCents(p.id, comp, parcelas), 0);
  const impostos = projetos.reduce((s, p) => s + custoPctMesCents(p.pctImpostos ?? 0, p.id, comp, parcelas), 0);
  const comissao = projetos.reduce((s, p) => s + custoPctMesCents(p.pctCom ?? 0, p.id, comp, parcelas), 0);
  const adm = projetos.reduce((s, p) => s + custoPctMesCents(p.pctAdm ?? 0, p.id, comp, parcelas), 0);
  const marketing = projetos.reduce((s, p) => s + custoPctMesCents(p.pctMarketing ?? 0, p.id, comp, parcelas), 0);
  const lucroReservado = projetos.reduce((s, p) => s + custoPctMesCents(p.pctLucro ?? 0, p.id, comp, parcelas), 0);
  const receitaLiq = receita - impostos - comissao;
  const custoHoras = projetos.reduce((s, p) => s + custoHorasMesCents(p.id, comp, lancamentos, rateOf), 0);
  const custoBase = projetos.reduce((s, p) => s + custoBaseMesCents(p.id, comp, custos, todosProjetos), 0);
  const totalDespesas = impostos + comissao + lucroReservado + adm + marketing + custoHoras + custoBase;
  const resultado = receita - totalDespesas;
  return { comp, receita, receitaRecebida, impostos, comissao, receitaLiq, lucroReservado, adm, marketing, custoHoras, custoBase, totalDespesas, resultado };
}

// ── totais de receita (para o Painel) ─────────────────────────
export function totalContratadoCents(projetos: Projeto[]): number {
  return sum(
    projetos.filter((p) => p.status !== "Cancelado"),
    (p) => p.valorCents,
  );
}

/** #6: só conta o que foi EFETIVAMENTE recebido (status "recebida"). */
export function totalRecebidoCents(parcelas: Parcela[]): number {
  return sum(
    parcelas.filter((p) => p.status === "recebida"),
    (p) => p.valorCents,
  );
}

export function totalAReceberCents(parcelas: Parcela[]): number {
  return sum(
    parcelas.filter((p) => p.status === "a_receber"),
    (p) => p.valorCents,
  );
}

export function totalVencidoCents(parcelas: Parcela[], todayISO: string): number {
  return sum(
    parcelas.filter((p) => parcelaVencida(p, todayISO)),
    (p) => p.valorCents,
  );
}

// ── custos e rateio ───────────────────────────────────────────
export function projetoAtivoNoMes(p: Projeto, comp: string): boolean {
  if (p.status === "Cancelado") return false;
  const ini = p.dtIni ? competenciaOf(p.dtIni) : null;
  const fim = p.dtFim ? competenciaOf(p.dtFim) : null;
  if (ini && comp < ini) return false;
  if (fim && comp > fim) return false;
  return true;
}

export function custoVigenteNoMes(c: Custo, comp: string): boolean {
  if (!c.competencia) return false;
  if (c.frequencia === "recorrente") {
    if (comp < c.competencia) return false;
    if (c.competenciaFim && comp > c.competenciaFim) return false;
    return true;
  }
  return c.competencia === comp;
}

interface AlvoRateio {
  projetoId: string;
  peso: number;
}

export function alvosRateio(c: Custo, comp: string, projetos: Projeto[]): AlvoRateio[] {
  if (c.rateio === "projeto") {
    return c.projetoId ? [{ projetoId: c.projetoId, peso: 1 }] : [];
  }
  if (c.rateio === "personalizado") {
    return c.rateioCustom
      .filter((r) => r.pct > 0)
      .map((r) => ({ projetoId: r.projetoId, peso: r.pct / 100 }));
  }
  const alvos = projetos.filter((p) => {
    if (!projetoAtivoNoMes(p, comp)) return false;
    if (c.rateio === "ativos") return p.kind === "projeto";
    return true; // ativos_todos
  });
  if (!alvos.length) return [];
  const peso = 1 / alvos.length;
  return alvos.map((p) => ({ projetoId: p.id, peso }));
}

/** Custo (centavos) que recai sobre um projeto em uma competência. */
export function custoBaseMesCents(
  projetoId: string,
  comp: string,
  custos: Custo[],
  projetos: Projeto[],
): number {
  return custos
    .filter((c) => custoVigenteNoMes(c, comp))
    .reduce((s, c) => {
      const alvos = alvosRateio(c, comp, projetos);
      const meu = alvos.find((a) => a.projetoId === projetoId);
      return s + (meu ? Math.round(c.valorCents * meu.peso) : 0);
    }, 0);
}

// ── progresso de tarefas ──────────────────────────────────────
export function pctConcluido(projetoId: string, tarefas: Tarefa[]): number {
  const ts = tarefas.filter((t) => t.projetoId === projetoId && t.ativa);
  if (!ts.length) return 0;
  const conc = ts.filter((t) => t.status === "Concluída").length;
  return conc / ts.length;
}

function datasProjeto(
  p: Projeto,
  tarefas: Tarefa[],
): { ini: string | null; fim: string | null } {
  if (p.dtIni && p.dtFim) return { ini: p.dtIni, fim: p.dtFim };
  const ts = tarefas.filter((t) => t.projetoId === p.id && t.dtIni);
  if (!ts.length) return { ini: p.dtIni, fim: p.dtFim };
  const datas = ts.map((t) => t.dtIni!).sort();
  return {
    ini: p.dtIni ?? datas[0],
    fim: p.dtFim ?? datas[datas.length - 1],
  };
}

/** Fração do tempo decorrido do projeto (0..1). */
export function pctTempo(p: Projeto, tarefas: Tarefa[], todayISO: string): number {
  const { ini, fim } = datasProjeto(p, tarefas);
  if (!ini || !fim) return 0;
  if (todayISO <= ini) return 0;
  if (todayISO >= fim) return 1;
  const t0 = new Date(ini).getTime();
  const t1 = new Date(fim).getTime();
  const now = new Date(todayISO).getTime();
  if (t1 <= t0) return 1;
  return (now - t0) / (t1 - t0);
}

// ── régua de meses derivada dos dados (#15) ───────────────────
/** Deriva o intervalo de competências relevante a partir de TODAS as datas do sistema. */
export function competenciasDoSistema(snap: Snapshot, todayISO: string): string[] {
  const comps: string[] = [competenciaOf(todayISO)];
  for (const p of snap.projetos) {
    if (p.dtIni) comps.push(competenciaOf(p.dtIni));
    if (p.dtFim) comps.push(competenciaOf(p.dtFim));
  }
  for (const par of snap.parcelas) comps.push(competenciaOf(par.vencimento));
  for (const l of snap.lancamentos) comps.push(l.competencia);
  for (const c of snap.custos) {
    comps.push(c.competencia);
    if (c.competenciaFim) comps.push(c.competenciaFim);
  }
  const valid = comps.filter((c) => /^\d{4}-\d{2}$/.test(c));
  if (!valid.length) return [competenciaOf(todayISO)];
  const min = valid.reduce((a, b) => (a < b ? a : b));
  const max = valid.reduce((a, b) => (a > b ? a : b));
  return competenciasBetween(min, max);
}

// ── util ──────────────────────────────────────────────────────
function sum<T>(arr: T[], fn: (item: T) => number): number {
  return arr.reduce((s, item) => s + (fn(item) || 0), 0);
}
