// ═══════════════════════════════════════════════════════════════
// DATAS — utilitários seguros.
// Corrige a fragilidade #7 (setMonth pulava meses no dia 29/30/31) e a #15
// (horizonte de meses "chumbado" em 2026–2027).
// ═══════════════════════════════════════════════════════════════

const MES_NOMES = [
  "Jan", "Fev", "Mar", "Abr", "Mai", "Jun",
  "Jul", "Ago", "Set", "Out", "Nov", "Dez",
];

/** Data de hoje em ISO "YYYY-MM-DD" (sem hora, fuso local). */
export function todayISO(): string {
  const d = new Date();
  return isoDate(d);
}

/** Competência atual "YYYY-MM". */
export function currentCompetencia(): string {
  return todayISO().slice(0, 7);
}

/** Formata um Date como "YYYY-MM-DD" no fuso local (não usa toISOString, que é UTC). */
export function isoDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** Interpreta uma data ISO como meio-dia local, evitando saltos de fuso. */
export function parseISO(iso: string): Date {
  return new Date(`${iso}T12:00:00`);
}

/**
 * Soma `n` meses a uma data ISO, PRESERVANDO o dia sempre que possível.
 * Ex.: addMonths("2026-01-31", 1) → "2026-02-28" (e não "2026-03-03").
 */
export function addMonths(iso: string, n: number): string {
  const d = parseISO(iso);
  const day = d.getDate();
  d.setDate(1);
  d.setMonth(d.getMonth() + n);
  const daysInTarget = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
  d.setDate(Math.min(day, daysInTarget));
  return isoDate(d);
}

/** Soma `n` meses a uma competência "YYYY-MM". */
export function addMonthsCompetencia(comp: string, n: number): string {
  const [y, m] = comp.split("-").map(Number);
  const total = y * 12 + (m - 1) + n;
  const ny = Math.floor(total / 12);
  const nm = (total % 12) + 1;
  return `${ny}-${String(nm).padStart(2, "0")}`;
}

/** Rótulo curto de competência: "2026-07" → "Jul/26". */
export function labelCompetencia(comp: string): string {
  const [y, m] = comp.split("-").map(Number);
  return `${MES_NOMES[m - 1]}/${String(y).slice(2)}`;
}

/** Rótulo de data ISO para exibição pt-BR: "2026-07-16" → "16/07/2026". */
export function fmtDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  const [y, m, d] = iso.slice(0, 10).split("-");
  return `${d}/${m}/${y}`;
}

/**
 * Gera a lista de competências ("YYYY-MM") entre dois extremos, inclusive.
 * A régua de meses do sistema é DERIVADA dos dados, não fixa.
 */
export function competenciasBetween(min: string, max: string): string[] {
  const out: string[] = [];
  let cur = min;
  let guard = 0;
  while (cur <= max && guard < 600) {
    out.push(cur);
    cur = addMonthsCompetencia(cur, 1);
    guard++;
  }
  return out;
}

/** Extrai a competência ("YYYY-MM") de uma data ISO. */
export function competenciaOf(iso: string): string {
  return iso.slice(0, 7);
}
