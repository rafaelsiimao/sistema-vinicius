import { useMemo, useState } from "react";
import { useData } from "@/store/useData";
import { todayISO } from "@/lib/dates";
import type { Tarefa } from "@/types";

const DIAS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
const pad = (n: number) => String(n).padStart(2, "0");

export function Calendario() {
  const { snap } = useData();
  const today = todayISO();
  const hoje = new Date();
  const [ano, setAno] = useState(hoje.getFullYear());
  const [mes, setMes] = useState(hoje.getMonth()); // 0-11
  const [fProjeto, setFProjeto] = useState("");

  const nomeProjeto = (id: string) => snap.projetos.find((p) => p.id === id)?.nome ?? id;

  const tarefas = useMemo(
    () => snap.tarefas.filter((t) => t.ativa && (fProjeto ? t.projetoId === fProjeto : true)),
    [snap.tarefas, fProjeto],
  );

  // eventos por dia ISO
  const eventos = useMemo(() => {
    const m = new Map<string, { t: Tarefa; tipo: "ini" | "fim" }[]>();
    const push = (iso: string | null, t: Tarefa, tipo: "ini" | "fim") => {
      if (!iso) return;
      const arr = m.get(iso) ?? [];
      arr.push({ t, tipo });
      m.set(iso, arr);
    };
    for (const t of tarefas) {
      push(t.dtIni, t, "ini");
      push(t.dtFim, t, "fim");
    }
    return m;
  }, [tarefas]);

  const primeiroDiaSemana = new Date(ano, mes, 1).getDay();
  const diasNoMes = new Date(ano, mes + 1, 0).getDate();
  const titulo = new Date(ano, mes, 1).toLocaleDateString("pt-BR", { month: "long", year: "numeric" });

  const celulas: (number | null)[] = [
    ...Array.from({ length: primeiroDiaSemana }, () => null),
    ...Array.from({ length: diasNoMes }, (_, i) => i + 1),
  ];

  function navegar(delta: number) {
    const d = new Date(ano, mes + delta, 1);
    setAno(d.getFullYear());
    setMes(d.getMonth());
  }

  return (
    <>
      <div className="page-title">Calendário</div>
      <div className="page-sub">Inícios e prazos das tarefas</div>

      <div className="filter-bar" style={{ justifyContent: "space-between" }}>
        <div className="cal-nav" style={{ margin: 0 }}>
          <button className="btn btn-sm" onClick={() => navegar(-1)}>← anterior</button>
          <div className="cal-title" style={{ textTransform: "capitalize" }}>{titulo}</div>
          <button className="btn btn-sm" onClick={() => navegar(1)}>próximo →</button>
          <button className="btn btn-sm" onClick={() => { setAno(hoje.getFullYear()); setMes(hoje.getMonth()); }}>hoje</button>
        </div>
        <select value={fProjeto} onChange={(e) => setFProjeto(e.target.value)}>
          <option value="">Projeto: todos</option>
          {snap.projetos.map((p) => (
            <option key={p.id} value={p.id}>{p.id} — {p.nome || p.cliente}</option>
          ))}
        </select>
      </div>

      <div className="cal-grid">
        {DIAS.map((d) => (
          <div key={d} className="cal-head">{d}</div>
        ))}
        {celulas.map((dia, i) => {
          if (dia === null) return <div key={`e${i}`} className="cal-day empty" />;
          const iso = `${ano}-${pad(mes + 1)}-${pad(dia)}`;
          const evs = eventos.get(iso) ?? [];
          return (
            <div key={iso} className={`cal-day ${iso === today ? "today" : ""}`}>
              <div className="cal-day-num">{dia}</div>
              {evs.slice(0, 4).map(({ t, tipo }, j) => (
                <div
                  key={j}
                  className={`cal-event ${tipo}`}
                  title={`${tipo === "ini" ? "Início" : "Prazo"}: ${t.nome} — ${nomeProjeto(t.projetoId)}`}
                >
                  {tipo === "ini" ? "▶ " : "■ "}{t.nome}
                </div>
              ))}
              {evs.length > 4 && <div className="hint">+{evs.length - 4}</div>}
            </div>
          );
        })}
      </div>

      <div className="filter-bar" style={{ gap: 16, marginTop: 12 }}>
        <span className="semaforo"><span className="sem-dot" style={{ background: "var(--accent2)" }} /> ▶ Início</span>
        <span className="semaforo"><span className="sem-dot" style={{ background: "var(--amber)" }} /> ■ Prazo</span>
      </div>
    </>
  );
}
