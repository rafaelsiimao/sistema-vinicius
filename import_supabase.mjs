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

// Import lancamentos
const lancRows = (data.lancamentos || []).map(toSnake);
console.log(`\nLancamentos to import: ${lancRows.length}`);
const { error: delLancErr } = await supabase.from('lancamentos').delete().neq('id', '__none__');
if (delLancErr) { console.error('Del lancamentos error:', delLancErr.message); process.exit(1); }
const { error: insLancErr } = await supabase.from('lancamentos').insert(lancRows);
if (insLancErr) { console.error('Ins lancamentos error:', insLancErr.message); process.exit(1); }
console.log(`Inserted ${lancRows.length} lancamentos OK`);

// Import pagamentos
const pagRows = (data.pagamentos || []).map(toSnake);
console.log(`\nPagamentos to import: ${pagRows.length}`);
const { error: delPagErr } = await supabase.from('pagamentos').delete().neq('id', '__none__');
if (delPagErr) { console.error('Del pagamentos error:', delPagErr.message); process.exit(1); }
const { error: insPagErr } = await supabase.from('pagamentos').insert(pagRows);
if (insPagErr) { console.error('Ins pagamentos error:', insPagErr.message); process.exit(1); }
console.log(`Inserted ${pagRows.length} pagamentos OK`);

console.log('\nAll done!');
