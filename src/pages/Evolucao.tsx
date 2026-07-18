import { useMemo, useState } from "react";
import { useData } from "@/store/useData";
import { Kpi } from "@/ui/primitives";
import {
  competenciasDoSistema,
  custoBaseMesCents,
  custoHorasMesCents,
  receitaMesCents,
} from "@/lib/calc";
import { fmtBRL } from "@/lib/money";
import { currentCompetencia, labelCompetencia, todayISO } from "@/lib/dates";

interface LinhaMes {
  comp: string;
  receita: number;
  custoHoras: number;
  custoBase: number;
  resultado: number;
}

const fmtPct = (v: number) => `${(v * 100).toFixed(0)}%`;

export function Evolucao() {
  const { snap, rateOf } = useData();
  const today = todayISO();
  const [compSel, setCompSel] = useState(currentCompetencia());

  const meses = useMemo(() => competenciasDoSistema(snap, today), [snap, today]);
  const projetos = snap.projetos.filter((p) => p.status !== "Cancelado");

  // Consolidado mês a mês.
  const linhas: LinhaMes[] = useMemo(
    () =>
      meses.map((comp) => {
        const receita = projetos.reduce((s, p) => s + receitaMesCents(p.id, comp, snap.parcelas), 0);
        const custoHoras = projetos.reduce((s, p) => s + custoHorasMesCents(p.id, comp, snap.lancamentos, rateOf), 0);
        const custoBase = projetos.reduce((s, p) => s + custoBaseMesCents(p.id, comp, snap.custos, snap.projetos), 0);
        return { comp, receita, custoHoras, custoBase, resultado: receita - custoHoras - custoBase };
      }),
    [meses, projetos, snap.parcelas, snap.lancamentos, snap.custos, snap.projetos, rateOf],
  );

  // Só meses com algum movimento, para a tabela e o gráfico não ficarem vazios.
  const comMovimento = linhas.filter((l) => l.receita || l.custoHoras || l.custoBase);

  const totReceita = comMovimento.reduce((s, l) => s + l.receita, 0);
  const totCustoHoras = comMovimento.reduce((s, l) => s + l.custoHoras, 0);
  const totCustoBase = comMovimento.reduce((s, l) => s + l.custoBase, 0);
  const totResultado = totReceita - totCustoHoras - totCustoBase;

  // Detalhe por projeto na competência selecionada.
  const detalhe = projetos
    .map((p) => {
      const receita = receitaMesCents(p.id, compSel, snap.parcelas);
      const custoHoras = custoHorasMesCents(p.id, compSel, snap.lancamentos, rateOf);
      const custoBase = custoBaseMesCents(p.id, compSel, snap.custos, snap.projetos);
      return { p, receita, custoHoras, custoBase, resultado: receita - custoHoras - custoBase };
    })
    .filter((x) => x.receita || x.custoHoras || x.custoBase)
    .sort((a, b) => b.resultado - a.resultado);

  const maxAbs = Math.max(1, ...comMovimento.map((l) => Math.abs(l.resultado)));

  return (
    <>
      <div className="page-title">Evolução Mensal</div>
      <div className="page-sub">Receita, custos e resultado mês a mês</div>

      <div className="kpi-row">
        <Kpi label="Receita (horizonte)" value={fmtBRL(totReceita)} tone="accent" />
        <Kpi label="Custo de horas" value={fmtBRL(totCustoHoras)} tone="amber" />
        <Kpi label="Custos rateados" value={fmtBRL(totCustoBase)} tone="red" />
        <Kpi
          label="Resultado"
          value={fmtBRL(totResultado)}
          tone={totResultado >= 0 ? "green" : "red"}
          sub={totReceita > 0 ? `margem ${fmtPct(totResultado / totReceita)}` : undefined}
        />
      </div>

      {/* mini-gráfico de resultado por mês */}
      <div className="tbl-wrap">
        <div className="tbl-title">Resultado por mês</div>
        <div style={{ padding: 16, overflowX: "auto" }}>
          <div style={{ display: "flex", gap: 8, alignItems: "flex-end", minHeight: 150 }}>
            {comMovimento.map((l) => {
              const h = Math.round((Math.abs(l.resultado) / maxAbs) * 120);
              const pos = l.resultado >= 0;
              return (
                <div key={l.comp} style={{ display: "flex", flexDirection: "column", alignItems: "center", minWidth: 42 }} title={`${labelCompetencia(l.comp)}: ${fmtBRL(l.resultado)}`}>
                  <div style={{ fontSize: 9, color: pos ? "var(--green)" : "var(--red)", fontFamily: "Roboto Mono, monospace", marginBottom: 3 }}>
                    {Math.round(l.resultado / 100)}
                  </div>
                  <div
                    style={{
                      width: 26,
                      height: Math.max(3, h),
                      background: pos ? "var(--green)" : "var(--red)",
                      borderRadius: 3,
                      opacity: 0.85,
                    }}
                  />
                  <div style={{ fontSize: 9, color: "var(--tx3)", marginTop: 4, fontFamily: "Roboto Mono, monospace" }}>
                    {labelCompetencia(l.comp)}
                  </div>
                </div>
              );
            })}
            {comMovimento.length === 0 && <div className="muted">Sem movimento financeiro ainda.</div>}
          </div>
          <div className="hint" style={{ marginTop: 8 }}>Valores em R$ (centenas) — verde = lucro, vermelho = prejuízo no mês.</div>
        </div>
      </div>

      {/* tabela consolidada */}
      <div className="tbl-wrap">
        <div className="tbl-title">Consolidado mensal</div>
        <div className="scroll-x">
          <table>
            <thead>
              <tr>
                <th className="l">Mês</th>
                <th>Receita</th>
                <th>Custo horas</th>
                <th>Custos rateados</th>
                <th>Resultado</th>
                <th>Margem</th>
              </tr>
            </thead>
            <tbody>
              {comMovimento.map((l) => (
                <tr key={l.comp} style={{ cursor: "pointer" }} onClick={() => setCompSel(l.comp)}>
                  <td className="l td-name">{labelCompetencia(l.comp)}</td>
                  <td className="td-val">{fmtBRL(l.receita)}</td>
                  <td className="td-val" style={{ color: "var(--amber)" }}>{fmtBRL(l.custoHoras)}</td>
                  <td className="td-val" style={{ color: "var(--red)" }}>{fmtBRL(l.custoBase)}</td>
                  <td className="td-val" style={{ color: l.resultado >= 0 ? "var(--green)" : "var(--red)", fontWeight: 700 }}>{fmtBRL(l.resultado)}</td>
                  <td className="td-val muted">{l.receita > 0 ? fmtPct(l.resultado / l.receita) : "—"}</td>
                </tr>
              ))}
              {comMovimento.length === 0 && (
                <tr><td colSpan={6} className="empty-state">Sem lançamentos, parcelas ou custos ainda.</td></tr>
              )}
            </tbody>
            {comMovimento.length > 0 && (
              <tfoot>
                <tr style={{ borderTop: "2px solid var(--border)" }}>
                  <td className="l" style={{ fontWeight: 700 }}>Total</td>
                  <td className="td-val" style={{ fontWeight: 700 }}>{fmtBRL(totReceita)}</td>
                  <td className="td-val" style={{ fontWeight: 700, color: "var(--amber)" }}>{fmtBRL(totCustoHoras)}</td>
                  <td className="td-val" style={{ fontWeight: 700, color: "var(--red)" }}>{fmtBRL(totCustoBase)}</td>
                  <td className="td-val" style={{ fontWeight: 700, color: totResultado >= 0 ? "var(--green)" : "var(--red)" }}>{fmtBRL(totResultado)}</td>
                  <td className="td-val muted">{totReceita > 0 ? fmtPct(totResultado / totReceita) : "—"}</td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
        <div className="hint" style={{ padding: "0 16px 12px" }}>Clique num mês para ver o detalhe por projeto abaixo.</div>
      </div>

      {/* detalhe por projeto na competência selecionada */}
      <div className="tbl-wrap">
        <div className="tbl-title">
          Detalhe por projeto
          <select value={compSel} onChange={(e) => setCompSel(e.target.value)} style={{ width: "auto" }}>
            {meses.map((m) => (<option key={m} value={m}>{labelCompetencia(m)}</option>))}
          </select>
        </div>
        <div className="scroll-x">
          <table>
            <thead>
              <tr>
                <th className="l">Projeto</th>
                <th>Receita</th>
                <th>Custo horas</th>
                <th>Custos rateados</th>
                <th>Resultado</th>
              </tr>
            </thead>
            <tbody>
              {detalhe.map(({ p, receita, custoHoras, custoBase, resultado }) => (
                <tr key={p.id}>
                  <td className="l td-name">{p.id} — {p.nome}</td>
                  <td className="td-val">{fmtBRL(receita)}</td>
                  <td className="td-val" style={{ color: "var(--amber)" }}>{fmtBRL(custoHoras)}</td>
                  <td className="td-val" style={{ color: "var(--red)" }}>{fmtBRL(custoBase)}</td>
                  <td className="td-val" style={{ color: resultado >= 0 ? "var(--green)" : "var(--red)", fontWeight: 700 }}>{fmtBRL(resultado)}</td>
                </tr>
              ))}
              {detalhe.length === 0 && (
                <tr><td colSpan={5} className="empty-state">Nada em {labelCompetencia(compSel)}.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
