// ─────────────────────────────────────────────────────────────
// Configuração de ambiente.
// Prioridade: arquivo público config.js (window.__JOBZ_CONFIG__) — editável no
// servidor SEM recompilar — e, como reserva, as variáveis VITE_* do build.
// ─────────────────────────────────────────────────────────────
interface JobzRuntimeConfig {
  dataSource?: "local" | "supabase";
  supabaseUrl?: string;
  supabaseAnonKey?: string;
}

const rt: JobzRuntimeConfig =
  (typeof window !== "undefined" && (window as unknown as { __JOBZ_CONFIG__?: JobzRuntimeConfig }).__JOBZ_CONFIG__) || {};

function pick(a: string | undefined, b: string | undefined): string {
  return (a && a.trim()) || (b && b.trim()) || "";
}

export const CONFIG = {
  dataSource: (rt.dataSource ?? import.meta.env.VITE_DATA_SOURCE) === "supabase" ? "supabase" : "local",
  supabaseUrl: pick(rt.supabaseUrl, import.meta.env.VITE_SUPABASE_URL),
  supabaseAnonKey: pick(rt.supabaseAnonKey, import.meta.env.VITE_SUPABASE_ANON_KEY),
} as const;
