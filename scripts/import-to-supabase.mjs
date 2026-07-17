// ─────────────────────────────────────────────────────────────
// Carga inicial dos dados no Supabase (bootstrap).
// Lê um backup no SCHEMA NOVO (baixado pelo app em modo local) e insere no banco
// usando a SERVICE ROLE KEY (ignora RLS). Uso único, roda na sua máquina.
//
// Uso:
//   1) defina no .env (ou no ambiente):
//        SUPABASE_URL=...            (Project Settings → API → Project URL)
//        SUPABASE_SERVICE_ROLE_KEY=... (Project Settings → API → service_role — SECRETA)
//   2) node scripts/import-to-supabase.mjs caminho/para/backup.json
//
// A service_role NUNCA vai para o app publicado — é só para esta carga.
// ─────────────────────────────────────────────────────────────
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
const file = process.argv[2];

if (!url || !key) {
  console.error("Defina SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY no ambiente/.env.");
  process.exit(1);
}
if (!file) {
  console.error("Uso: node scripts/import-to-supabase.mjs <backup.json>");
  process.exit(1);
}

const snap = JSON.parse(readFileSync(file, "utf8"));
const sb = createClient(url, key, { auth: { persistSession: false } });

// coleção (app) → tabela (banco), em ordem de dependência (pais antes de filhos).
const ORDER = [
  ["equipe", "consultores"],
  ["categoriasCusto", "categorias_custo"],
  ["projetos", "projetos"],
  ["tarefas", "tarefas"],
  ["parcelas", "parcelas"],
  ["lancamentos", "lancamentos"],
  ["pagamentos", "pagamentos"],
  ["custos", "custos"],
  ["comentarios", "comentarios"],
];

const camelToSnake = (s) => s.replace(/[A-Z]/g, (m) => "_" + m.toLowerCase());
const toSnake = (obj) =>
  Object.fromEntries(Object.entries(obj).map(([k, v]) => [camelToSnake(k), v]));

function chunk(arr, n) {
  const out = [];
  for (let i = 0; i < arr.length; i += n) out.push(arr.slice(i, i + n));
  return out;
}

for (const [col, table] of ORDER) {
  const rows = (snap[col] ?? []).map(toSnake);
  if (!rows.length) {
    console.log(`• ${table}: 0`);
    continue;
  }
  let ok = 0;
  for (const part of chunk(rows, 500)) {
    const { error } = await sb.from(table).upsert(part);
    if (error) {
      console.error(`✗ ${table}: ${error.message}`);
      process.exit(1);
    }
    ok += part.length;
  }
  console.log(`✓ ${table}: ${ok}`);
}
console.log("\nCarga concluída.");
