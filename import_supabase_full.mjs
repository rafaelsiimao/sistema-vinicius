import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';

const SUPABASE_URL = 'https://foujodkyckjryjickhbq.supabase.co';
const ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZvdWpvZGt5Y2tqcnlqaWNraGJxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQyNjkwNTMsImV4cCI6MjA5OTg0NTA1M30._plVJRRuQQUVg2nOmH7VEXFcFiRCfqtzjKqZDeJgqqw';

const camelToSnake = s => s.replace(/[A-Z]/g, m => '_' + m.toLowerCase());
function toSnake(obj) {
  const out = {};
  for (const [k, v] of Object.entries(obj)) out[camelToSnake(k)] = v;
  return out;
}

const supabase = createClient(SUPABASE_URL, ANON_KEY);

const { data: authData, error: authErr } = await supabase.auth.signInWithPassword({
  email: 'luciana@jobz.com.br',
  password: 'Jobz2026',
});
if (authErr) { console.error('Auth failed:', authErr.message); process.exit(1); }
console.log('Authenticated as:', authData.user.email);

const data = JSON.parse(readFileSync('C:\\Users\\User\\Downloads\\jobz_backup_final.json', 'utf8'));

async function del(table) {
  const { error } = await supabase.from(table).delete().neq('id', '__none__');
  if (error) { console.error(`Delete ${table} error:`, error.message); process.exit(1); }
  console.log(`  Deleted ${table}`);
}

async function ins(table, rows) {
  if (!rows || rows.length === 0) { console.log(`  ${table}: 0 rows, skipped`); return; }
  const snakeRows = rows.map(toSnake);
  const { error } = await supabase.from(table).insert(snakeRows);
  if (error) { console.error(`Insert ${table} error:`, error.message); process.exit(1); }
  console.log(`  Inserted ${snakeRows.length} rows into ${table}`);
}

// Delete in reverse FK order
console.log('\nDeleting tables...');
await del('comentarios');
await del('custos');
await del('pagamentos');
await del('lancamentos');
await del('parcelas');
await del('tarefas');
await del('projetos');
await del('consultores');
await del('categorias_custo');

// Insert in forward FK order
console.log('\nInserting data...');
await ins('consultores', data.equipe);
await ins('projetos', data.projetos);
await ins('categorias_custo', data.categoriasCusto);
await ins('parcelas', data.parcelas);
await ins('tarefas', data.tarefas);
await ins('lancamentos', data.lancamentos);
await ins('pagamentos', data.pagamentos);
await ins('custos', data.custos);
await ins('comentarios', data.comentarios);

console.log('\nAll done!');
