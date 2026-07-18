import type { ReactNode } from "react";
import { semaforo, type SemaforoNivel } from "@/lib/calc";

// ── KPI card ──────────────────────────────────────────────────
export function Kpi({
  label,
  value,
  sub,
  tone = "accent",
}: {
  label: string;
  value: ReactNode;
  sub?: ReactNode;
  tone?: "accent" | "green" | "amber" | "red" | "purple";
}) {
  return (
    <div className={`kpi kpi-${tone}`}>
      <div className="kpi-label">{label}</div>
      <div className="kpi-val">{value}</div>
      {sub != null && <div className="kpi-sub">{sub}</div>}
    </div>
  );
}

// ── Badge de status (cor derivada do texto) ───────────────────
export function StatusBadge({ status }: { status: string | null | undefined }) {
  if (!status) return <span className="badge b-gray">—</span>;
  const s = status.toLowerCase();
  let cls = "b-gray";
  if (s.includes("andamento")) cls = "b-blue";
  else if (s.includes("conclu") || s.includes("receb") || s.includes("quit")) cls = "b-green";
  else if (s.includes("atras") || s.includes("estour")) cls = "b-red";
  else if (s.includes("pausa")) cls = "b-orange";
  else if (s.includes("planej") || s.includes("inici") || s.includes("parcial")) cls = "b-amber";
  else if (s.includes("cancel")) cls = "b-gray";
  return <span className={`badge ${cls}`}>{status}</span>;
}

// ── Semáforo de orçamento ─────────────────────────────────────
const SEM_COLOR: Record<SemaforoNivel, string> = {
  ok: "var(--green)",
  atencao: "var(--amber)",
  limite: "var(--orange)",
  estourou: "var(--red)",
};

export function Semaforo({ pctGasto }: { pctGasto: number }) {
  const info = semaforo(pctGasto);
  const cor = SEM_COLOR[info.nivel];
  const pctText = pctGasto === Infinity ? "∞" : `${Math.round(pctGasto * 100)}%`;
  return (
    <span className="semaforo" title={`${pctText} do disponível — ${info.texto}`}>
      <span className="sem-dot" style={{ background: cor }} />
      <span style={{ color: cor }}>
        {pctText} · {info.texto}
      </span>
    </span>
  );
}

// ── Barra de progresso ────────────────────────────────────────
export function ProgressBar({ value, color }: { value: number; color?: string }) {
  const pct = Math.max(0, Math.min(1, value)) * 100;
  return (
    <div className="prog">
      <div className="prog-fill" style={{ width: `${pct}%`, background: color ?? "var(--accent)" }} />
    </div>
  );
}
