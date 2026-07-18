import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useData } from "@/store/useData";
import { Kpi, ProgressBar, Semaforo, StatusBadge } from "@/ui/primitives";
import {
  calcProjeto,
  pctConcluido,
  pctTempo,
  resumoPorCompetencia,
  saldoConsultor,
  totalAReceberCents,
  totalContratadoCents,
  totalRecebidoCents,
  totalVencidoCents,
} from "@/lib/calc";
import { fmtBRL } from "@/lib/money";
import { currentCompetencia, fmtDate, labelCompetencia, todayISO } from "@/lib/dates";
import type { Kind } from "@/types";

const fmtH = (h: number) => h.toFixed(1);

export function Painel() {
  const { isAdmin } = useData();
  return isAdmin ? <PainelExecutivo /> : <MeuPainel />;
}

function PainelExecutivo() {
  const { snap, rateOf } = useData();
  const today = todayISO();
  const comp = currentCompetencia();

  const [fKind, setFKind] = useState<Kind | "">("");
  const [fStatus, setFStatus] = useState("");
  const [busca, setBusca] = useState("");

  const projs = snap.projetos.filter((p) => p.kind === "projeto");
  const treins = snap.projetos.filter((p) => p.kind === "treinamento");
  const ativos = (arr: typeof projs) => arr.filter((p) => p.status.includes("Andamento")).length;

  const horasTrab = snap.lancamentos.reduce((s, l) => s + l.horas, 0);
  const horasPagas = snap.pagamentos.reduce((s, p) => s + p.horas, 0);
  const aPagarCents = snap.equipe.reduce((s, c) => {
    const sc = saldoConsultor(c.id, snap.lancamentos, snap.pagamentos, rateOf);
    return s + Math.max(0, sc.vSaldoCents);
  }, 0);

  const statusList = useMemo(
    () => [...new Set(snap.projetos.map((p) => p.status))].sort(),
    [snap.projetos],
  );

  const filtrados = snap.projetos.filter((p) => {
    if (p.status === "Cancelado") return false;
    if (fKind && p.kind !== fKind) return false;
    if (fStatus && p.status !== fStatus) return false;
    if (busca) {
      const b = busca.toLowerCase();
      if (!`${p.id} ${p.nome} ${p.cliente}`.toLowerCase().includes(b)) return false;
    }
    return true;
  });

  // Tarefas com horas lançadas e pagamento pendente
  const tarefasPendentes = useMemo(() => {
    // Calcula saldo de horas por consultor/mês
    const saldoPorConsultorMes = new Map<string, number>();
    const hTrabMap = new Map<string, number>();
    const hPagaMap = new Map<string, number>();
    for (const l of snap.lancamentos) {
      const k = `${l.consultorId}||${l.competencia}`;
      hTrabMap.set(k, (hTrabMap.get(k) ?? 0) + l.horas);
    }
    for (const pg of snap.pagamentos) {
      const k = `${pg.consultorId}||${pg.competencia}`;
      hPagaMap.set(k, (hPagaMap.get(k) ?? 0) + pg.horas);
    }
    for (const [k, hT] of hTrabMap) {
      const hP = hPagaMap.get(k) ?? 0;
      saldoPorConsultorMes.set(k, hT - hP);
    }
    // Lançamentos onde o mês está em aberto
    return snap.lancamentos
      .filter((l) => {
        const k = `${l.consultorId}||${l.competencia}`;
        return (saldoPorConsultorMes.get(k) ?? 0) > 0.001;
      })
      .map((l) => ({
        l,
        tarefa: snap.tarefas.find((t) => t.id === l.tarefaId),
        projeto: snap.projetos.find((p) => p.id === l.projetoId),
        consultor: snap.equipe.find((c) => c.id === l.consultorId),
      }))
      .filter((x) => x.projeto?.status !== "Cancelado");
  }, [snap]);

  const [fPendConsultor, setFPendConsultor] = useState("");
  const [fPendProjeto, setFPendProjeto] = useState("");

  return (
    <>
      <div className="page-title">Painel Executivo</div>
      <div className="page-sub">
        {new Date().toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
      </div>

      <div className="kpi-row">
        <Kpi label="Projetos ativos" value={ativos(projs)} sub={`${projs.length} total`} tone="accent" />
        <Kpi label="Treinamentos ativos" value={ativos(treins)} sub={`${treins.length} total`} tone="green" />
        <Kpi label="Contratado" value={fmtBRL(totalContratadoCents(snap.projetos))} tone="accent" />
        <Kpi label="Recebido" value={fmtBRL(totalRecebidoCents(snap.parcelas))} tone="green" />
        <Kpi label="A receber" value={fmtBRL(totalAReceberCents(snap.parcelas))} tone="amber" />
        <Kpi label="Vencido" value={fmtBRL(totalVencidoCents(snap.parcelas, today))} tone="red" />
      </div>

      <div className="kpi-row">
        <Kpi label="Horas trabalhadas" value={fmtH(horasTrab)} tone="accent" />
        <Kpi label="Horas pagas" value={fmtH(horasPagas)} tone="green" />
        <Kpi label="A pagar (consultores)" value={fmtBRL(aPagarCents)} tone="red" />
      </div>

      <div className="tbl-wrap">
        <div className="tbl-title">
          Resumo por projeto
          <span style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <select value={fKind} onChange={(e) => setFKind(e.target.value as Kind | "")}>
              <option value="">Tipo: todos</option>
              <option value="projeto">Projetos</option>
              <option value="treinamento">Treinamentos</option>
            </select>
            <select value={fStatus} onChange={(e) => setFStatus(e.target.value)}>
              <option value="">Status: todos</option>
              {statusList.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
            <input placeholder="Buscar…" value={busca} onChange={(e) => setBusca(e.target.value)} style={{ width: 150 }} />
          </span>
        </div>
        <div className="scroll-x">
          <table>
            <thead>
              <tr>
                <th className="l">ID</th>
                <th className="l">Projeto</th>
                <th>Cliente</th>
                <th>Valor</th>
                <th>% Concluído</th>
                <th>% Tempo</th>
                <th>H. Trab</th>
                <th>Gasto</th>
                <th>% Gasto</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {filtrados.map((p) => {
                const c = calcProjeto(p, snap.lancamentos, snap.pagamentos, rateOf);
                const pc = pctConcluido(p.id, snap.tarefas);
                const pt = pctTempo(p, snap.tarefas, today);
                const pcCor = pc >= pt ? "var(--green)" : "var(--amber)";
                return (
                  <tr key={p.id}>
                    <td className="td-id">
                      <span className="pill">{p.kind === "treinamento" ? "T" : "P"}</span> {p.id}
                    </td>
                    <td className="td-name">{p.nome}</td>
                    <td style={{ fontSize: 11 }}>{p.cliente}</td>
                    <td className="td-val">{fmtBRL(c.valorCents)}</td>
                    <td>
                      <div style={{ fontSize: 11, color: pcCor, fontFamily: "Roboto Mono, monospace" }}>
                        {Math.round(pc * 100)}%
                      </div>
                      <ProgressBar value={pc} color={pcCor} />
                    </td>
                    <td>
                      <div style={{ fontSize: 11, color: "var(--tx2)", fontFamily: "Roboto Mono, monospace" }}>
                        {Math.round(pt * 100)}%
                      </div>
                      <ProgressBar value={pt} />
                    </td>
                    <td className="td-val">{fmtH(c.hTrab)}</td>
                    <td className="td-val">{fmtBRL(c.custoHTrabCents)}</td>
                    <td>
                      <Semaforo pctGasto={c.pctGasto} />
                    </td>
                    <td>
                      <StatusBadge status={p.status} />
                    </td>
                  </tr>
                );
              })}
              {filtrados.length === 0 && (
                <tr>
                  <td colSpan={10} className="empty-state">
                    Nenhum projeto encontrado com os filtros.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="tbl-wrap">
        <div className="tbl-title">Horas por consultor</div>
        <div className="scroll-x">
          <table>
            <thead>
              <tr>
                <th className="l">Consultor</th>
                <th>H. Trab (mês)</th>
                <th>H. Pagas (total)</th>
                <th>Saldo (h)</th>
                <th>Valor a pagar</th>
              </tr>
            </thead>
            <tbody>
              {snap.equipe.map((e) => {
                const s = saldoConsultor(e.id, snap.lancamentos, snap.pagamentos, rateOf);
                const hMes = snap.lancamentos
                  .filter((l) => l.consultorId === e.id && l.competencia === comp)
                  .reduce((a, l) => a + l.horas, 0);
                if (s.hTrab === 0 && hMes === 0) return null;
                return (
                  <tr key={e.id}>
                    <td className="l td-name">{e.nome}</td>
                    <td className="td-val">{fmtH(hMes)}</td>
                    <td className="td-val" style={{ color: "var(--green)" }}>
                      {fmtH(s.hPagas)}
                    </td>
                    <td className="td-val" style={{ color: s.hSaldo > 0.001 ? "var(--amber)" : "var(--tx3)" }}>
                      {fmtH(s.hSaldo)}
                    </td>
                    <td className="td-val" style={{ color: s.hSaldo > 0.001 ? "var(--amber)" : "var(--tx3)" }}>
                      {fmtBRL(s.vSaldoCents)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Tarefas pendentes de pagamento */}
      {(() => {
        const pendFiltrados = tarefasPendentes.filter((x) => {
          if (fPendConsultor && x.l.consultorId !== fPendConsultor) return false;
          if (fPendProjeto && x.l.projetoId !== fPendProjeto) return false;
          return true;
        });
        return (
          <div className="tbl-wrap">
            <div className="tbl-title">
              Tarefas realizadas — pendentes de pagamento
              <span style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <select value={fPendConsultor} onChange={(e) => setFPendConsultor(e.target.value)} style={{ width: "auto" }}>
                  <option value="">Todos consultores</option>
                  {snap.equipe.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
                </select>
                <select value={fPendProjeto} onChange={(e) => setFPendProjeto(e.target.value)} style={{ width: "auto" }}>
                  <option value="">Todos projetos</option>
                  {snap.projetos.filter((p) => p.status !== "Cancelado").map((p) => (
                    <option key={p.id} value={p.id}>{p.id} — {p.nome || p.cliente}</option>
                  ))}
                </select>
              </span>
            </div>
            <div className="scroll-x">
              <table>
                <thead>
                  <tr>
                    <th className="l">Consultor</th>
                    <th className="l">Projeto</th>
                    <th className="l">Tarefa</th>
                    <th>Competência</th>
                    <th>Horas</th>
                    <th>Situação</th>
                  </tr>
                </thead>
                <tbody>
                  {pendFiltrados.slice(0, 50).map((x) => (
                    <tr key={x.l.id}>
                      <td className="l td-name">{x.consultor?.nome ?? x.l.consultorId}</td>
                      <td className="l" style={{ fontSize: 11 }}>{x.projeto?.nome ?? x.l.projetoId}</td>
                      <td className="l" style={{ fontSize: 11, whiteSpace: "normal", maxWidth: 260 }}>
                        {x.tarefa?.nome ?? "—"}
                      </td>
                      <td>{labelCompetencia(x.l.competencia)}</td>
                      <td className="td-val">{fmtH(x.l.horas)}</td>
                      <td><span className="badge b-amber">A pagar</span></td>
                    </tr>
                  ))}
                  {pendFiltrados.length === 0 && (
                    <tr><td colSpan={6} className="empty-state">Nenhuma tarefa pendente de pagamento.</td></tr>
                  )}
                  {pendFiltrados.length > 50 && (
                    <tr><td colSpan={6} className="hint" style={{ textAlign: "center" }}>
                      Mostrando 50 de {pendFiltrados.length}. Use os filtros acima para refinar.
                    </td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        );
      })()}
    </>
  );
}

// ══════════════════════════════════════════════════════════════
// Painel do CONSULTOR — só o que é dele
// ══════════════════════════════════════════════════════════════
function MeuPainel() {
  const { snap, currentUser, rateOf } = useData();
  if (!currentUser) return null;

  const minhas = snap.tarefas.filter((t) => t.respId === currentUser.id && t.ativa);
  const abertas = minhas.filter((t) => t.status !== "Concluída");
  const saldo = saldoConsultor(currentUser.id, snap.lancamentos, snap.pagamentos, rateOf);
  const meses = resumoPorCompetencia(currentUser.id, snap.lancamentos, snap.pagamentos, rateOf);
  const nomeProjeto = (id: string) => snap.projetos.find((p) => p.id === id)?.nome ?? id;

  return (
    <>
      <div className="page-title">Olá, {currentUser.nome.split(" ")[0]}</div>
      <div className="page-sub">
        {new Date().toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
      </div>

      <div className="kpi-row">
        <Kpi label="Minhas tarefas abertas" value={abertas.length} sub={`${minhas.length} no total`} tone="accent" />
        <Kpi label="A receber" value={fmtBRL(saldo.vSaldoCents)} sub={`${fmtH(saldo.hSaldo)}h`} tone="amber" />
        <Kpi label="Já recebido" value={fmtBRL(saldo.vPagasCents)} sub={`${fmtH(saldo.hPagas)}h`} tone="green" />
      </div>

      <div className="tbl-wrap">
        <div className="tbl-title">
          Minhas tarefas abertas
          <Link className="btn btn-sm" to="/tarefas">ver todas</Link>
        </div>
        <div className="scroll-x">
          <table>
            <thead>
              <tr>
                <th className="l">Tarefa</th>
                <th className="l">Projeto</th>
                <th>Prazo</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {abertas.map((t) => (
                <tr key={t.id}>
                  <td className="l td-name" style={{ whiteSpace: "normal" }}>{t.nome}</td>
                  <td className="l" style={{ fontSize: 11 }}>{nomeProjeto(t.projetoId)}</td>
                  <td className="muted" style={{ fontSize: 11 }}>{fmtDate(t.dtFim)}</td>
                  <td><StatusBadge status={t.status} /></td>
                </tr>
              ))}
              {abertas.length === 0 && (
                <tr><td colSpan={4} className="empty-state">Nenhuma tarefa aberta. 🎉</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="tbl-wrap">
        <div className="tbl-title">
          A receber por mês
          <Link className="btn btn-sm" to="/pagamentos">detalhes</Link>
        </div>
        <div className="scroll-x">
          <table>
            <thead>
              <tr>
                <th className="l">Mês</th>
                <th>Horas trab.</th>
                <th>A receber (h)</th>
                <th>Valor a receber</th>
              </tr>
            </thead>
            <tbody>
              {meses.filter((m) => m.horasSaldo > 0.001).map((m) => (
                <tr key={m.competencia}>
                  <td className="l td-name">{labelCompetencia(m.competencia)}</td>
                  <td className="td-val">{fmtH(m.horasTrab)}</td>
                  <td className="td-val" style={{ color: "var(--amber)", fontWeight: 700 }}>{fmtH(m.horasSaldo)}</td>
                  <td className="td-val" style={{ color: "var(--amber)" }}>{fmtBRL(m.valorSaldoCents)}</td>
                </tr>
              ))}
              {meses.filter((m) => m.horasSaldo > 0.001).length === 0 && (
                <tr><td colSpan={4} className="empty-state">Nada a receber no momento.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
