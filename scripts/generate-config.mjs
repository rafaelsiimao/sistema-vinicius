import { writeFileSync } from "node:fs";

const rawDataSource = process.env.JOBZ_DATA_SOURCE;
const supabaseUrl =
  process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || "";
const supabaseAnonKey =
  process.env.SUPABASE_ANON_KEY ||
  process.env.SUPABASE_PUBLISHABLE_KEY ||
  process.env.VITE_SUPABASE_ANON_KEY ||
  process.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
  "";

const dataSource =
  rawDataSource === "local" || rawDataSource === "supabase"
    ? rawDataSource
    : supabaseUrl && supabaseAnonKey
      ? "supabase"
      : "local";

const config = {
  dataSource,
  supabaseUrl: supabaseUrl || "COLE_AQUI_A_PROJECT_URL",
  supabaseAnonKey: supabaseAnonKey || "COLE_AQUI_A_ANON_PUBLIC_KEY",
};

const body = `/* Generated at deploy time by scripts/generate-config.mjs.
   Configure Vercel environment variables:
   - JOBZ_DATA_SOURCE=supabase
   - SUPABASE_URL
   - SUPABASE_ANON_KEY
*/
window.__JOBZ_CONFIG__ = ${JSON.stringify(config, null, 2)};
`;

writeFileSync(new URL("../dist/config.js", import.meta.url), body, "utf8");
console.log(`Generated dist/config.js with dataSource="${dataSource}".`);

if (dataSource === "supabase" && (!supabaseUrl || !supabaseAnonKey)) {
  console.warn("Supabase mode is enabled, but SUPABASE_URL or SUPABASE_ANON_KEY is missing.");
}
