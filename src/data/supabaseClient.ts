import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { CONFIG } from "@/config";

const url = CONFIG.supabaseUrl;
const key = CONFIG.supabaseAnonKey;

/**
 * Cliente Supabase — null se a config (config.js) não estiver preenchida.
 * Blindado: só cria com uma URL http(s) válida (evita quebrar quando o config.js
 * ainda tem os placeholders "COLE_AQUI...").
 */
function makeClient(): SupabaseClient | null {
  if (!/^https?:\/\/.+/i.test(url) || !key || key.startsWith("COLE_")) return null;
  try {
    return createClient(url, key);
  } catch {
    return null;
  }
}

export const supabase: SupabaseClient | null = makeClient();

export function requireSupabase(): SupabaseClient {
  if (!supabase) {
    throw new Error(
      "Supabase não configurado. Defina VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY no .env.",
    );
  }
  return supabase;
}
