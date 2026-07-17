// ─────────────────────────────────────────────────────────────
// Carga inicial dos dados no Supabase (bootstrap).
// Lê um backup no SCHEMA NOVO (baixado pelo app em modo local) e insere no banco
// usando a SERVICE ROLE KEY (ignora RLS). Uso único, roda na sua máquina.
//
// Uso:
//   1) defina no .env (ou no ambiente):
//        SUPABASE_URL=...            (Project Settings → API → Project URL)
//        SUPABASE_SERVICE_ROLE_KEY=... (Project Settings → API → service_role — SECRETA)
//        JOBZ_ADMIN_EMAIL=...        (opcional: e-mail do primeiro admin)
//        JOBZ_ADMIN_PASSWORD=...     (opcional: cria/confirma usuario Auth)
//        JOBZ_ADMIN_NAME=...         (opcional: nome se precisar criar consultor)
//   2) node scripts/import-to-supabase.mjs caminho/para/backup.json
//
// A service_role NUNCA vai para o app publicado — é só para esta carga.
// ─────────────────────────────────────────────────────────────
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
const file = process.argv[2];
const adminEmail = (process.env.JOBZ_ADMIN_EMAIL ?? "").trim().toLowerCase();
const adminPassword = (process.env.JOBZ_ADMIN_PASSWORD ?? "").trim();
const adminName = (process.env.JOBZ_ADMIN_NAME ?? "").trim();

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

async function ensureAuthAdminUser() {
  if (!adminEmail || !adminPassword) return;

  const { error } = await sb.auth.admin.createUser({
    email: adminEmail,
    password: adminPassword,
    email_confirm: true,
    user_metadata: { role: "admin" },
  });

  if (!error) {
    console.log(`✓ auth admin: ${adminEmail}`);
    return;
  }

  const msg = String(error.message ?? "");
  if (/already|registered|exists/i.test(msg)) {
    console.log(`• auth admin: ${adminEmail} já existe`);
    return;
  }

  console.error(`✗ auth admin: ${msg}`);
  process.exit(1);
}

function promoteAdminRow(row) {
  if (!adminEmail) return row;
  const email = String(row.email ?? "").trim().toLowerCase();
  return email === adminEmail ? { ...row, papel: "admin" } : row;
}

async function ensureConsultorAdmin() {
  if (!adminEmail) return;

  const { data, error } = await sb
    .from("consultores")
    .select("id,email,papel")
    .ilike("email", adminEmail)
    .limit(1);

  if (error) {
    console.error(`✗ consultor admin: ${error.message}`);
    process.exit(1);
  }

  if (data?.length) {
    const row = data[0];
    if (row.papel !== "admin") {
      const { error: updateError } = await sb
        .from("consultores")
        .update({ papel: "admin" })
        .eq("id", row.id);
      if (updateError) {
        console.error(`✗ consultor admin: ${updateError.message}`);
        process.exit(1);
      }
    }
    console.log(`✓ consultor admin: ${adminEmail}`);
    return;
  }

  const fallbackId = `admin-${adminEmail.replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")}`;
  const fallbackName = adminName || adminEmail.split("@")[0] || "Admin";
  const { error: insertError } = await sb.from("consultores").upsert({
    id: fallbackId,
    nome: fallbackName,
    email: adminEmail,
    funcao: "Administrador",
    custo_hora_cents: 0,
    ativo: true,
    papel: "admin",
  });

  if (insertError) {
    console.error(`✗ consultor admin: ${insertError.message}`);
    process.exit(1);
  }
  console.log(`✓ consultor admin criado: ${adminEmail}`);
}

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

await ensureAuthAdminUser();

for (const [col, table] of ORDER) {
  const rows = (snap[col] ?? [])
    .map((row) => (table === "consultores" ? promoteAdminRow(row) : row))
    .map(toSnake);
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
await ensureConsultorAdmin();
console.log("\nCarga concluída.");
