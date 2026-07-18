import { useMemo, useState } from "react";
import { useData } from "@/store/useData";
import { MultiSelect } from "@/ui/MultiSelect";
import {
  competenciasDoSistema,
  linhaDRE,
  custoVigenteNoMes,
  alvosRateio,
  type LinhaDRE,
} from "@/lib/calc";
import { fmtBRL } from "@/lib/money";
import { labelCompetencia, todayISO } from "@/lib/dates";
import { Kpi } from "@/ui/primitives";

const fmtPct = (v: number) => `${(v * 100).toFixed(1)}%`;
const fmtH = (h: number) => `${h.toFixed(1)}h`;

interface DRELinhaConfig {
  key: keyof LinhaDRE | "margemPct";
  label: string;
  indent?: boolean;
  bold?: boolean;
  sep?: boolean;
  neg?: boolean;
  muted?: boolean;
  isReceita?: boolean;
  red?: boolean;
  expandable?: boolean;
}

const DRE_LINHAS: DRELinhaConfig[] = [
  { key: "receita",        label: "Receita Bruta",              bold: true, isReceita: true },
  { key: "impostos",       label: "(-) Impostos",               indent: true, muted: true },
  { key: "comissao",       label: "(-) Comissão",               indent: true, muted: true },
  { key: "receitaLiq",     label: "= Receita Líquida",          bold: true, sep: true, neg: true },
  { key: "lucroReservado", label: "(-) Lucro desejado",         indent: true, muted: true },
  { key: "adm",            label: "(-) ADM",                    indent: true, muted: true },
  { key: "marketing",      label: "(-) Marketing",              indent: true, muted: true },
  { key: "custoHoras",     label: "(-) Custo de Horas",         indent: true, muted: true, expandable: true },
  { key: "custoBase",      label: "(-) Custos Fixos Rateados",  indent: true, muted: true, expandable: true },
  { key: "totalDespesas",  label: "= Total Despesas",           bold: true, sep: true, red: true },
  { key: "resultado",      label: "= Resultado",                bold: true, sep: true, neg: true },
];

function ValCell({
  v, bold, neg, muted, isReceita, red, receitaRecebida,
}: {
  v: number; bold?: boolean; neg?: boolean; muted?: boolean;
  isReceita?: boolean; red?: boolean; receitaRecebida?: number;
}) {
  let color: string | undefined;
  if (red) {
    color = "var(--red)";
  } else if (isReceita && v > 0) {
    color = receitaRecebida !== undefined && receitaRecebida >= v
      ? "var(--green)" : "var(--amber)";
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

function SubValCell({ v }: { v: number }) {
  return (
    <td className="td-val" style={{ fontSize: 11, color: "var(--tx3)", whiteSpace: "nowrap" }}>
      {v === 0 ? <span style={{ opacity: 0.3 }}>—</span> : fmtBRL(v)}
    </td>
  );
}

export function Evolucao() {
  const { snap, rateOf } = useData();
  const today = todayISO();
  const [fProjetos, setFProjetos] = useState<string[]>([]);
  const [expandidos, setExpandidos] = useState<Set<string>>(new Set());

  function toggleExpand(key: string) {
    setExpandidos(prev => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  }

  const meses = useMemo(() => competenciasDoSistema(snap, today), [snap, today]);
  const projetosAtivos = snap.projetos.filter((p) => p.status !== "Cancelado");
  const projetosOpts = projetosAtivos.map((p) => ({ value: p.id, label: `${p.id} — ${p.nome || p.cliente}` }));
  const projetosFiltrados = fProjetos.length ? projetosAtivos.filter((p) => fProjetos.includes(p.id)) : projetosAtivos;

  const linhas: LinhaDRE[] = useMemo(
    () => meses.map((comp) => linhaDRE(comp, projetosFiltrados, snap.parcelas, snap.lancamentos, snap.custos, snap.projetos, rateOf)),
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

  // ── detalhe Custos Fixos Rateados por competência ──────────────────────────
  const custosDetail = useMemo(() => {
    // Mapa: comp → [{descricao, total}]
    const map = new Map<string, Array<{ descricao: string; total: number }>>();
    for (const l of comMov) {
      const items = snap.custos
        .filter((c) => custoVigenteNoMes(c, l.comp))
        .map((c) => {
          const alvos = alvosRateio(c, l.comp, snap.projetos);
          const total = projetosFiltrados.reduce((s, p) => {
            const alvo = alvos.find((a) => a.projetoId === p.id);
            return s + (alvo ? Math.round(c.valorCents * alvo.peso) : 0);
          }, 0);
          return { descricao: c.descricao, total };
        })
        .filter((c) => c.total > 0);
      map.set(l.comp, items);
    }
    return map;
  }, [comMov, snap.custos, snap.projetos, projetosFiltrados]);

  // Totais de custos fixos por descricao (coluna TOTAL)
  const custosTotal = useMemo(() => {
    const m = new Map<string, number>();
    for (const items of custosDetail.values()) {
      for (const item of items) {
        m.set(item.descricao, (m.get(item.descricao) || 0) + item.total);
      }
    }
    return m;
  }, [custosDetail]);

  const custosNomes = useMemo(() => [...custosTotal.keys()], [custosTotal]);

  // ── detalhe Custo de Horas por consultor ───────────────────────────────────
  const tarefaProjetoMap = useMemo(() => new Map(snap.tarefas.map((t) => [t.id, t.projetoId])), [snap.tarefas]);
  const projetoIdSet = useMemo(() => new Set(projetosFiltrados.map((p) => p.id)), [projetosFiltrados]);

  const horasDetail = useMemo(() => {
    const map = new Map<string, Array<{ nome: string; horas: number; total: number }>>();
    for (const l of comMov) {
      const items = snap.equipe.map((c) => {
        const horas = snap.lancamentos
          .filter((lanc) =>
            lanc.consultorId === c.id &&
            lanc.competencia === l.comp &&
            projetoIdSet.has(tarefaProjetoMap.get(lanc.tarefaId ?? "") ?? ""),
          )
          .reduce((s, lanc) => s + lanc.horas, 0);
        const total = Math.round(horas * rateOf(c.id));
        return { nome: c.nome, horas, total };
      }).filter((c) => c.total > 0);
      map.set(l.comp, items);
    }
    return map;
  }, [comMov, snap.equipe, snap.lancamentos, tarefaProjetoMap, projetoIdSet, rateOf]);

  const horasTotal = useMemo(() => {
    const m = new Map<string, { horas: number; total: number }>();
    for (const items of horasDetail.values()) {
      for (const item of items) {
        const prev = m.get(item.nome) || { horas: 0, total: 0 };
        m.set(item.nome, { horas: prev.horas + item.horas, total: prev.total + item.total });
      }
    }
    return m;
  }, [horasDetail]);

  const horasNomes = useMemo(() => [...horasTotal.keys()], [horasTotal]);

  const nCols = comMov.length + 2;

  const stickyLabel = (bold: boolean, indent?: boolean, muted?: boolean, extraStyle?: React.CSSProperties) => ({
    position: "sticky" as const,
    left: 0,
    background: bold ? "var(--card2)" : "var(--card)",
    zIndex: 1,
    fontWeight: bold ? 700 : 400,
    color: muted ? "var(--tx3)" : "var(--tx)",
    paddingLeft: indent ? 24 : undefined,
    fontSize: bold ? 13 : 12,
    ...extraStyle,
  });

  return (
    <>
      <div className="page-title">Evolução Mensal</div>
      <div className="page-sub">DRE — receita, deduções e resultado por mês</div>

      {/* Cards resumo */}
      <div className="kpi-row" style={{ marginBottom: 16 }}>
        <Kpi label="Total Receita Bruta"    value={fmtBRL(total.receita)}       />
        <Kpi label="Total Custo de Horas"   value={fmtBRL(total.custoHoras)}    />
        <Kpi label="Total Custos Rateados"  value={fmtBRL(total.custoBase)}     />
        <Kpi label="Total Despesas"         value={fmtBRL(total.totalDespesas)} />
        <Kpi label="Resultado Acumulado"    value={fmtBRL(total.resultado)}     />
      </div>

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
                <th className="l" style={{ minWidth: 240, position: "sticky", left: 0, background: "var(--bg2)", zIndex: 2 }}>
                  Indicador
                </th>
                {comMov.map((l) => (
                  <th key={l.comp} style={{ minWidth: 110 }}>{labelCompetencia(l.comp)}</th>
                ))}
                <th style={{ background: "var(--accent2)", color: "#fff", fontWeight: 700, minWidth: 120 }}>TOTAL</th>
              </tr>
            </thead>
            <tbody>
              {DRE_LINHAS.map((cfg) => {
                const isExpanded = expandidos.has(cfg.key as string);
                const canExpand = cfg.expandable;

                return (
                  <>
                    {/* Linha principal */}
                    <tr
                      key={cfg.key}
                      style={{
                        borderTop: cfg.sep ? "2px solid var(--border)" : undefined,
                        background: cfg.bold ? "rgba(255,255,255,0.03)" : undefined,
                        cursor: canExpand ? "pointer" : undefined,
                      }}
                      onClick={canExpand ? () => toggleExpand(cfg.key as string) : undefined}
                    >
                      <td
                        className="l"
                        style={stickyLabel(!!cfg.bold, cfg.indent, cfg.muted, {
                          color: cfg.red ? "var(--red)" : cfg.muted ? "var(--tx3)" : "var(--tx)",
                        })}
                      >
                        {canExpand && (
                          <span style={{ marginRight: 6, display: "inline-block", fontSize: 10, transition: "transform .15s", transform: isExpanded ? "rotate(90deg)" : "none" }}>
                            ▶
                          </span>
                        )}
                        {cfg.label}
                      </td>
                      {comMov.map((l) => (
                        <ValCell
                          key={l.comp}
                          v={getValue(l, cfg.key as keyof LinhaDRE)}
                          bold={cfg.bold}
                          neg={cfg.neg}
                          muted={cfg.muted}
                          red={cfg.red}
                          isReceita={cfg.isReceita}
                          receitaRecebida={cfg.isReceita ? l.receitaRecebida : undefined}
                        />
                      ))}
                      <ValCell
                        v={getValue(total, cfg.key as keyof LinhaDRE)}
                        bold={cfg.bold}
                        neg={cfg.neg}
                        muted={cfg.muted}
                        red={cfg.red}
                        isReceita={cfg.isReceita}
                        receitaRecebida={cfg.isReceita ? total.receitaRecebida : undefined}
                      />
                    </tr>

                    {/* Sub-linhas de detalhe — Custos Fixos Rateados */}
                    {canExpand && isExpanded && cfg.key === "custoBase" && custosNomes.map((nome) => (
                      <tr key={`custoBase-${nome}`} style={{ background: "rgba(255,255,255,0.01)" }}>
                        <td className="l" style={{ ...stickyLabel(false, true, true), paddingLeft: 40, fontSize: 11, background: "var(--card)" }}>
                          {nome}
                        </td>
                        {comMov.map((l) => {
                          const v = custosDetail.get(l.comp)?.find((i) => i.descricao === nome)?.total ?? 0;
                          return <SubValCell key={l.comp} v={v} />;
                        })}
                        <SubValCell v={custosTotal.get(nome) ?? 0} />
                      </tr>
                    ))}

                    {/* Sub-linhas de detalhe — Custo de Horas por consultor */}
                    {canExpand && isExpanded && cfg.key === "custoHoras" && horasNomes.map((nome) => (
                      <tr key={`custoHoras-${nome}`} style={{ background: "rgba(255,255,255,0.01)" }}>
                        <td className="l" style={{ ...stickyLabel(false, true, true), paddingLeft: 40, fontSize: 11, background: "var(--card)" }}>
                          {nome}
                          <span style={{ marginLeft: 6, fontSize: 10, opacity: 0.6 }}>
                            ({fmtH(horasTotal.get(nome)?.horas ?? 0)})
                          </span>
                        </td>
                        {comMov.map((l) => {
                          const item = horasDetail.get(l.comp)?.find((i) => i.nome === nome);
                          return <SubValCell key={l.comp} v={item?.total ?? 0} />;
                        })}
                        <SubValCell v={horasTotal.get(nome)?.total ?? 0} />
                      </tr>
                    ))}
                  </>
                );
              })}

              {/* Linha margem % */}
              <tr style={{ borderTop: "1px solid var(--border)" }}>
                <td className="l" style={{ position: "sticky", left: 0, background: "var(--card)", zIndex: 1, color: "var(--tx3)", fontSize: 12 }}>
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
