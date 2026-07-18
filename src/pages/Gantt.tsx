import { useMemo, useState } from "react";
import { useData } from "@/store/useData";
import { competenciasDoSistema } from "@/lib/calc";
import { competenciaOf, labelCompetencia, todayISO } from "@/lib/dates";
import type { TarefaStatus } from "@/types";

const COR_STATUS: Record<TarefaStatus, string> = {
  "Não Iniciada": "var(--tx3)",
  "Em Andamento": "var(--accent)",
  Pausada: "var(--orange)",
  Concluída: "var(--green)",
};

export function Gantt() {
  const { snap } = useData();
  const today = todayISO();
  const [fProjeto, setFProjeto] = useState("");

  const meses = useMemo(() => competenciasDoSistema(snap, today), [snap, today]);
  const idxDe = useMemo(() => {
    const m = new Map(meses.map((c, i) => [c, i]));
    return (comp: string) => m.get(comp);
  }, [meses]);
  const total = meses.length;

  const nomeProjeto = (id: string) => snap.projetos.find((p) => p.id === id)?.nome ?? id;

  const tarefas = snap.tarefas
    .filter((t) => t.ativa && t.dtIni && (fProjeto ? t.projetoId === fProjeto : true))
    .sort((a, b) => (a.dtIni ?? "").localeCompare(b.dtIni ?? ""));

  return (
    <>
      <div className="page-title">Gantt</div>
      <div className="page-sub">Linha do tempo das tarefas por competência</div>

      <div className="filter-bar">
        <select value={fProjeto} onChange={(e) => setFProjeto(e.target.value)}>
          <option value="">Projeto: todos</option>
          {snap.projetos.map((p) => (
            <option key={p.id} value={p.id}>{p.id} — {p.nome || p.cliente}</option>
          ))}
        </select>
      </div>

      <div className="tbl-wrap">
        <div className="gantt">
          <div className="gantt-grid">
            <div className="gantt-head">
              <div className="gantt-label" style={{ fontWeight: 700, color: "var(--tx3)", fontSize: 10, textTransform: "uppercase" }}>
                Tarefa
              </div>
              <div className="gantt-months">
                {meses.map((m) => (
                  <div key={m} className="gantt-month">{labelCompetencia(m)}</div>
                ))}
              </div>
            </div>

            {tarefas.map((t) => {
              const iIni = idxDe(competenciaOf(t.dtIni!)) ?? 0;
              const iFim = t.dtFim ? idxDe(competenciaOf(t.dtFim)) ?? iIni : iIni;
              const start = Math.max(0, Math.min(iIni, total - 1));
              const end = Math.max(start, Math.min(iFim, total - 1));
              const left = (start / total) * 100;
              const width = ((end - start + 1) / total) * 100;
              const cor = COR_STATUS[t.status];
              return (
                <div className="gantt-row" key={t.id}>
                  <div className="gantt-label" title={`${t.nome} — ${nomeProjeto(t.projetoId)}`}>
                    {t.nome}
                  </div>
                  <div className="gantt-track">
                    <div
                      className="gantt-bar"
                      style={{ left: `${left}%`, width: `${width}%`, background: cor }}
                      title={`${labelCompetencia(meses[start])} → ${labelCompetencia(meses[end])}`}
                    >
                      {t.hPrev > 0 ? `${t.hPrev}h` : ""}
                    </div>
                  </div>
                </div>
              );
            })}
            {tarefas.length === 0 && (
              <div className="empty-state">Nenhuma tarefa com datas para exibir.</div>
            )}
          </div>
        </div>
      </div>

      <div className="filter-bar" style={{ gap: 16 }}>
        {(Object.keys(COR_STATUS) as TarefaStatus[]).map((s) => (
          <span key={s} className="semaforo">
            <span className="sem-dot" style={{ background: COR_STATUS[s] }} /> {s}
          </span>
        ))}
      </div>
    </>
  );
}
