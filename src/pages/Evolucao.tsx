import { useMemo, useState } from "react";
import { useData } from "@/store/useData";
import { MultiSelect } from "@/ui/MultiSelect";
import {
  competenciasDoSistema,
  linhaDRE,
  type LinhaDRE,
} from "@/lib/calc";
import { fmtBRL } from "@/lib/money";
import { labelCompetencia, todayISO } from "@/lib/dates";

const fmtPct = (v: number) => `${(v * 100).toFixed(1)}%`;

interface DRELinhaConfig {
  key: keyof LinhaDRE | "margemPct";
  label: string;
  indent?: boolean;
  bold?: boolean;
  sep?: boolean;
  neg?: boolean;
  muted?: boolean;
  isReceita?: boolean; // usa coloração verde/amarelo
}

const DRE_LINHAS: DRELinhaConfig[] = [
  { key: "receita",        label: "Receita Bruta",              bold: true, isReceita: true },
  { key: "impostos",       label: "(-) Impostos",               indent: true, muted: true },
  { key: "comissao",       label: "(-) Comissão",               indent: true, muted: true },
  { key: "receitaLiq",     label: "= Receita Líquida",          bold: true, sep: true, neg: true },
  { key: "lucroReservado", label: "(-) Lucro desejado",         indent: true, muted: true },
  { key: "adm",            label: "(-) ADM",                    indent: true, muted: true },
  { key: "marketing",      label: "(-) Marketing",              indent: true, muted: true },
  { key: "custoHoras",     label: "(-) Custo de Horas",         indent: true, muted: true },
  { key: "custoBase",      label: "(-) Custos Fixos Rateados",  indent: true, muted: true },
  { key: "totalDespesas",  label: "= Total Despesas",           bold: true, sep: true },
  { key: "resultado",      label: "= Resultado",                bold: true, sep: true, neg: true },
];

function ValCell({
  v,
  bold,
  neg,
  muted,
  isReceita,
  receitaRecebida,
}: {
  v: number;
  bold?: boolean;
  neg?: boolean;
  muted?: boolean;
  isReceita?: boolean;
  receitaRecebida?: number;
}) {
  let color: string | undefined;
  if (isReceita && v > 0) {
    color = receitaRecebida !== undefined && receitaRecebida >= v
      ? "var(--green)"
      : "var(--amber)";
  } else if (neg) {
    color = v < 0 ? "var(--red)" : v > 0 ? "var(--green)" : "var(--tx3)";
  } else if (muted) {
    color = "var(--tx3)";
  }
  return (
    <td className="td-val" style={{ fontWeight: bold ? 700 : 400, color, whiteSpace: "nowrap" }}>
      {v === 0 ? <span style={{ color: "var(--tx3)", opacity: 0.4 }}>—</span> : fmtBRL(v)}
    </td>
  );
}

export function Evolucao() {
  const { snap, rateOf } = useData();
  const today = todayISO();
  const [fProjetos, setFProjetos] = useState<string[]>([]);

  const meses = useMemo(() => competenciasDoSistema(snap, today), [snap, today]);

  const projetosAtivos = snap.projetos.filter((p) => p.status !== "Cancelado");
  const projetosOpts = projetosAtivos.map((p) => ({
    value: p.id,
    label: `${p.id} — ${p.nome || p.cliente}`,
  }));

  const projetosFiltrados = fProjetos.length
    ? projetosAtivos.filter((p) => fProjetos.includes(p.id))
    : projetosAtivos;

  const linhas: LinhaDRE[] = useMemo(
    () =>
      meses.map((comp) =>
        linhaDRE(comp, projetosFiltrados, snap.parcelas, snap.lancamentos, snap.custos, snap.projetos, rateOf),
      ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [meses, fProjetos, snap.parcelas, snap.lancamentos, snap.custos, snap.projetos, rateOf],
  );

  const comMov = linhas.filter(
    (l) => l.receita || l.custoHoras || l.custoBase || l.impostos || l.comissao || l.adm || l.marketing,
  );

  const total = comMov.reduce<LinhaDRE>(
    (acc, l) => ({
      comp: "TOTAL",
      receita:         acc.receita         + l.receita,
      receitaRecebida: acc.receitaRecebida + l.receitaRecebida,
      impostos:        acc.impostos        + l.impostos,
      comissao:        acc.comissao        + l.comissao,
      receitaLiq:      acc.receitaLiq      + l.receitaLiq,
      lucroReservado:  acc.lucroReservado  + l.lucroReservado,
      adm:             acc.adm             + l.adm,
      marketing:       acc.marketing       + l.marketing,
      custoHoras:      acc.custoHoras      + l.custoHoras,
      custoBase:       acc.custoBase       + l.custoBase,
      totalDespesas:   acc.totalDespesas   + l.totalDespesas,
      resultado:       acc.resultado       + l.resultado,
    }),
    { comp: "TOTAL", receita: 0, receitaRecebida: 0, impostos: 0, comissao: 0, receitaLiq: 0, lucroReservado: 0, adm: 0, marketing: 0, custoHoras: 0, custoBase: 0, totalDespesas: 0, resultado: 0 },
  );

  const getValue = (linha: LinhaDRE, key: keyof LinhaDRE): number =>
    typeof linha[key] === "number" ? (linha[key] as number) : 0;

  const nCols = comMov.length + 2; // label + meses + TOTAL

  return (
    <>
      <div className="page-title">Evolução Mensal</div>
      <div className="page-sub">DRE — receita, deduções e resultado por mês</div>

      <div className="filter-bar">
        <MultiSelect
          label="Projeto"
          options={projetosOpts}
          selected={fProjetos}
          onChange={setFProjetos}
          placeholder="Todos os projetos"
        />
      </div>

      <div className="tbl-wrap">
        <div className="tbl-title">DRE — meses na horizontal</div>
        <div className="scroll-x">
          <table style={{ minWidth: comMov.length * 110 + 330 }}>
            <thead>
              <tr>
                <th className="l" style={{ minWidth: 220, position: "sticky", left: 0, background: "var(--bg2)", zIndex: 2 }}>
                  Indicador
                </th>
                {comMov.map((l) => (
                  <th key={l.comp} style={{ minWidth: 110 }}>
                    {labelCompetencia(l.comp)}
                  </th>
                ))}
                {/* TOTAL fica no final */}
                <th style={{ background: "var(--accent2)", color: "#fff", fontWeight: 700, minWidth: 120 }}>
                  TOTAL
                </th>
              </tr>
            </thead>
            <tbody>
              {DRE_LINHAS.map((cfg) => (
                <tr
                  key={cfg.key}
                  style={{
                    borderTop: cfg.sep ? "2px solid var(--border)" : undefined,
                    background: cfg.bold ? "rgba(255,255,255,0.03)" : undefined,
                  }}
                >
                  <td
                    className="l"
                    style={{
                      position: "sticky",
                      left: 0,
                      background: cfg.bold ? "var(--card2)" : "var(--card)",
                      zIndex: 1,
                      fontWeight: cfg.bold ? 700 : 400,
                      color: cfg.muted ? "var(--tx3)" : "var(--tx)",
                      paddingLeft: cfg.indent ? 24 : undefined,
                      fontSize: cfg.bold ? 13 : 12,
                    }}
                  >
                    {cfg.label}
                  </td>
                  {/* colunas por mês — TOTAL ao final */}
                  {comMov.map((l) => (
                    <ValCell
                      key={l.comp}
                      v={getValue(l, cfg.key as keyof LinhaDRE)}
                      bold={cfg.bold}
                      neg={cfg.neg}
                      muted={cfg.muted}
                      isReceita={cfg.isReceita}
                      receitaRecebida={cfg.isReceita ? l.receitaRecebida : undefined}
                    />
                  ))}
                  {/* coluna TOTAL */}
                  <ValCell
                    v={getValue(total, cfg.key as keyof LinhaDRE)}
                    bold={cfg.bold}
                    neg={cfg.neg}
                    muted={cfg.muted}
                    isReceita={cfg.isReceita}
                    receitaRecebida={cfg.isReceita ? total.receitaRecebida : undefined}
                  />
                </tr>
              ))}
              {/* linha margem % */}
              <tr style={{ borderTop: "1px solid var(--border)" }}>
                <td
                  className="l"
                  style={{ position: "sticky", left: 0, background: "var(--card)", zIndex: 1, color: "var(--tx3)", fontSize: 12 }}
                >
                  Margem %
                </td>
                {comMov.map((l) => (
                  <td key={l.comp} className="td-val" style={{ fontSize: 11, color: "var(--tx3)" }}>
                    {l.receita > 0 ? fmtPct(l.resultado / l.receita) : "—"}
                  </td>
                ))}
                <td className="td-val" style={{ fontSize: 11, color: "var(--tx3)" }}>
                  {total.receita > 0 ? fmtPct(total.resultado / total.receita) : "—"}
                </td>
              </tr>
              {comMov.length === 0 && (
                <tr>
                  <td colSpan={nCols} className="empty-state">
                    Sem lançamentos, parcelas ou custos ainda.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <div style={{ padding: "6px 16px 10px", fontSize: 11, color: "var(--tx3)" }}>
          Receita Bruta: <span style={{ color: "var(--green)" }}>■ verde = recebida</span> &nbsp;
          <span style={{ color: "var(--amber)" }}>■ amarelo = a receber</span>
        </div>
      </div>
    </>
  );
}
