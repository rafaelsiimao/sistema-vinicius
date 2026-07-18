import { useMemo, useState } from "react";
import { useData } from "@/store/useData";
import { MultiSelect } from "@/ui/MultiSelect";
import {
  competenciasDoSistema,
  linhaDRE,
  type LinhaDRE,
} from "@/lib/calc";
import { fmtBRL } from "@/lib/money";
import { currentCompetencia, labelCompetencia, todayISO } from "@/lib/dates";

const fmtPct = (v: number) => `${(v * 100).toFixed(1)}%`;

function ValCell({ v, bold, neg, muted }: { v: number; bold?: boolean; neg?: boolean; muted?: boolean }) {
  const cor = neg
    ? v < 0 ? "var(--red)" : v > 0 ? "var(--green)" : "var(--tx3)"
    : undefined;
  return (
    <td
      className="td-val"
      style={{
        fontWeight: bold ? 700 : 400,
        color: muted ? "var(--tx3)" : cor,
        whiteSpace: "nowrap",
      }}
    >
      {fmtBRL(v)}
    </td>
  );
}

interface DRELinhaConfig {
  key: keyof LinhaDRE | "receitaLiqLabel" | "margemPct";
  label: string;
  indent?: boolean;
  bold?: boolean;
  sep?: boolean;     // linha de separação antes
  neg?: boolean;     // verde se positivo, vermelho se negativo
  muted?: boolean;   // cor fraca (deduções)
  pct?: boolean;     // exibir como percentual (só total e por mês)
}

const DRE_LINHAS: DRELinhaConfig[] = [
  { key: "receita",    label: "Receita Bruta",         bold: true },
  { key: "impostos",   label: "(-) Impostos",           indent: true, muted: true },
  { key: "comissao",   label: "(-) Comissão",           indent: true, muted: true },
  { key: "receitaLiq", label: "= Receita Líquida",      bold: true, sep: true, neg: true },
  { key: "custoHoras", label: "(-) Custo de Horas",     indent: true, muted: true },
  { key: "custoBase",  label: "(-) Custos Fixos Rateados", indent: true, muted: true },
  { key: "adm",        label: "(-) ADM",                indent: true, muted: true },
  { key: "marketing",  label: "(-) Marketing",          indent: true, muted: true },
  { key: "resultado",  label: "= Resultado",            bold: true, sep: true, neg: true },
];

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
      comp: "Total",
      receita: acc.receita + l.receita,
      impostos: acc.impostos + l.impostos,
      comissao: acc.comissao + l.comissao,
      receitaLiq: acc.receitaLiq + l.receitaLiq,
      custoHoras: acc.custoHoras + l.custoHoras,
      custoBase: acc.custoBase + l.custoBase,
      adm: acc.adm + l.adm,
      marketing: acc.marketing + l.marketing,
      resultado: acc.resultado + l.resultado,
    }),
    { comp: "Total", receita: 0, impostos: 0, comissao: 0, receitaLiq: 0, custoHoras: 0, custoBase: 0, adm: 0, marketing: 0, resultado: 0 },
  );

  // Seletor de mês para drill-down
  const [compSel, setCompSel] = useState(currentCompetencia());

  const getValue = (linha: LinhaDRE, key: keyof LinhaDRE): number =>
    typeof linha[key] === "number" ? (linha[key] as number) : 0;

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

      {/* DRE horizontal — meses nas colunas */}
      <div className="tbl-wrap">
        <div className="tbl-title">DRE — meses na horizontal</div>
        <div className="scroll-x">
          <table style={{ minWidth: comMov.length * 110 + 220 }}>
            <thead>
              <tr>
                <th className="l" style={{ minWidth: 200, position: "sticky", left: 0, background: "var(--panel)", zIndex: 2 }}>
                  Indicador
                </th>
                <th style={{ background: "var(--accent2)", color: "#fff", fontWeight: 700, minWidth: 110 }}>
                  TOTAL
                </th>
                {comMov.map((l) => (
                  <th
                    key={l.comp}
                    style={{ minWidth: 110, cursor: "pointer", color: l.comp === compSel ? "var(--accent2)" : undefined }}
                    onClick={() => setCompSel(l.comp)}
                    title="Clique para ver detalhe por projeto"
                  >
                    {labelCompetencia(l.comp)}
                  </th>
                ))}
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
                      background: cfg.bold ? "var(--panel2)" : "var(--panel)",
                      zIndex: 1,
                      fontWeight: cfg.bold ? 700 : 400,
                      color: cfg.muted ? "var(--tx3)" : "var(--tx1)",
                      paddingLeft: cfg.indent ? 24 : undefined,
                      fontSize: cfg.bold ? 13 : 12,
                    }}
                  >
                    {cfg.label}
                  </td>
                  {/* coluna TOTAL */}
                  <ValCell
                    v={getValue(total, cfg.key as keyof LinhaDRE)}
                    bold={cfg.bold}
                    neg={cfg.neg}
                    muted={cfg.muted}
                  />
                  {/* colunas por mês */}
                  {comMov.map((l) => (
                    <ValCell
                      key={l.comp}
                      v={getValue(l, cfg.key as keyof LinhaDRE)}
                      bold={cfg.bold}
                      neg={cfg.neg}
                      muted={cfg.muted}
                    />
                  ))}
                </tr>
              ))}
              {/* linha de margem (%) */}
              <tr style={{ borderTop: "1px solid var(--border)" }}>
                <td
                  className="l"
                  style={{
                    position: "sticky", left: 0, background: "var(--panel)", zIndex: 1,
                    color: "var(--tx3)", fontSize: 12,
                  }}
                >
                  Margem %
                </td>
                <td className="td-val muted" style={{ fontSize: 11 }}>
                  {total.receita > 0 ? fmtPct(total.resultado / total.receita) : "—"}
                </td>
                {comMov.map((l) => (
                  <td key={l.comp} className="td-val muted" style={{ fontSize: 11 }}>
                    {l.receita > 0 ? fmtPct(l.resultado / l.receita) : "—"}
                  </td>
                ))}
              </tr>
              {comMov.length === 0 && (
                <tr>
                  <td colSpan={2} className="empty-state">
                    Sem lançamentos, parcelas ou custos ainda.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <div className="hint" style={{ padding: "0 16px 12px" }}>
          Clique no mês para ver detalhe por projeto abaixo.
        </div>
      </div>

      {/* detalhe por projeto na competência selecionada */}
      <div className="tbl-wrap">
        <div className="tbl-title">
          Detalhe por projeto —{" "}
          <select value={compSel} onChange={(e) => setCompSel(e.target.value)} style={{ width: "auto" }}>
            {meses.map((m) => (
              <option key={m} value={m}>{labelCompetencia(m)}</option>
            ))}
          </select>
        </div>
        <div className="scroll-x">
          <table>
            <thead>
              <tr>
                <th className="l">Projeto</th>
                <th>Receita</th>
                <th>Impostos</th>
                <th>Comissão</th>
                <th>Rec. Líquida</th>
                <th>Custo Horas</th>
                <th>Fixos Rateados</th>
                <th>ADM</th>
                <th>Marketing</th>
                <th>Resultado</th>
              </tr>
            </thead>
            <tbody>
              {(() => {
                const rows = projetosFiltrados
                  .map((p) => ({ p, l: linhaDRE(compSel, [p], snap.parcelas, snap.lancamentos, snap.custos, snap.projetos, rateOf) }))
                  .filter(({ l }) => l.receita || l.custoHoras || l.custoBase)
                  .sort((a, b) => b.l.resultado - a.l.resultado);
                if (!rows.length) {
                  return (
                    <tr>
                      <td colSpan={10} className="empty-state">Nada em {labelCompetencia(compSel)}.</td>
                    </tr>
                  );
                }
                return rows.map(({ p, l }) => (
                  <tr key={p.id}>
                    <td className="l td-name">{p.id} — {p.nome || p.cliente}</td>
                    <td className="td-val">{fmtBRL(l.receita)}</td>
                    <td className="td-val muted">{fmtBRL(l.impostos)}</td>
                    <td className="td-val muted">{fmtBRL(l.comissao)}</td>
                    <td className="td-val" style={{ fontWeight: 700 }}>{fmtBRL(l.receitaLiq)}</td>
                    <td className="td-val" style={{ color: "var(--amber)" }}>{fmtBRL(l.custoHoras)}</td>
                    <td className="td-val" style={{ color: "var(--red)" }}>{fmtBRL(l.custoBase)}</td>
                    <td className="td-val muted">{fmtBRL(l.adm)}</td>
                    <td className="td-val muted">{fmtBRL(l.marketing)}</td>
                    <td className="td-val" style={{ fontWeight: 700, color: l.resultado >= 0 ? "var(--green)" : "var(--red)" }}>
                      {fmtBRL(l.resultado)}
                    </td>
                  </tr>
                ));
              })()}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
