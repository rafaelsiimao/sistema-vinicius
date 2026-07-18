import { useState } from "react";
import { useData } from "@/store/useData";
import type { TarefaStatus } from "@/types";

const COLUNAS: { status: TarefaStatus; cor: string }[] = [
  { status: "Não Iniciada", cor: "var(--tx3)" },
  { status: "Em Andamento", cor: "var(--accent)" },
  { status: "Pausada", cor: "var(--orange)" },
  { status: "Concluída", cor: "var(--green)" },
];

export function Kanban() {
  const { snap, save, toast } = useData();
  const [fProjeto, setFProjeto] = useState("");
  const [dragId, setDragId] = useState<string | null>(null);
  const [overCol, setOverCol] = useState<TarefaStatus | null>(null);

  const nomeProjeto = (id: string) => snap.projetos.find((p) => p.id === id)?.nome ?? id;
  const nomeConsultor = (id: string | null) => (id ? snap.equipe.find((c) => c.id === id)?.nome ?? id : "—");

  const tarefas = snap.tarefas.filter(
    (t) => t.ativa && (fProjeto ? t.projetoId === fProjeto : true),
  );

  function soltar(status: TarefaStatus, id: string) {
    setOverCol(null);
    setDragId(null);
    const t = snap.tarefas.find((x) => x.id === id);
    if (t && t.status !== status) {
      void save("tarefas", { ...t, status });
      toast(`"${t.nome.slice(0, 30)}" → ${status}`);
    }
  }

  return (
    <>
      <div className="page-title">Kanban</div>
      <div className="page-sub">Arraste as tarefas entre as colunas para mudar o status</div>

      <div className="filter-bar">
        <select value={fProjeto} onChange={(e) => setFProjeto(e.target.value)}>
          <option value="">Projeto: todos</option>
          {snap.projetos.map((p) => (
            <option key={p.id} value={p.id}>{p.id} — {p.nome || p.cliente}</option>
          ))}
        </select>
      </div>

      <div className="kanban">
        {COLUNAS.map(({ status, cor }) => {
          const cards = tarefas.filter((t) => t.status === status);
          return (
            <div
              key={status}
              className={`kb-col ${overCol === status ? "drag-over" : ""}`}
              onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = "move"; setOverCol(status); }}
              onDragLeave={() => setOverCol((c) => (c === status ? null : c))}
              onDrop={(e) => { e.preventDefault(); soltar(status, e.dataTransfer.getData("text/plain") || dragId || ""); }}
            >
              <div className="kb-col-head" style={{ background: "var(--card)", borderLeft: `3px solid ${cor}` }}>
                <span>{status}</span>
                <span className="pill">{cards.length}</span>
              </div>
              {cards.map((t) => (
                <div
                  key={t.id}
                  className={`kb-card ${dragId === t.id ? "dragging" : ""}`}
                  style={{ borderLeftColor: cor }}
                  draggable
                  onDragStart={(e) => { e.dataTransfer.setData("text/plain", t.id); e.dataTransfer.effectAllowed = "move"; setDragId(t.id); }}
                  onDragEnd={() => { setDragId(null); setOverCol(null); }}
                >
                  <div className="kb-card-title">{t.nome}</div>
                  <div className="kb-card-meta">
                    <span>{nomeProjeto(t.projetoId)}</span>
                    <span>{nomeConsultor(t.respId)}</span>
                  </div>
                </div>
              ))}
              {cards.length === 0 && (
                <div style={{ fontSize: 11, color: "var(--tx3)", textAlign: "center", padding: 16 }}>—</div>
              )}
            </div>
          );
        })}
      </div>
    </>
  );
}
