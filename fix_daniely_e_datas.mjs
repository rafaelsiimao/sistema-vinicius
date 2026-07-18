import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://foujodkyckjryjickhbq.supabase.co';
const ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZvdWpvZGt5Y2tqcnlqaWNraGJxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQyNjkwNTMsImV4cCI6MjA5OTg0NTA1M30._plVJRRuQQUVg2nOmH7VEXFcFiRCfqtzjKqZDeJgqqw';
const supabase = createClient(SUPABASE_URL, ANON_KEY);

const { error: authErr } = await supabase.auth.signInWithPassword({ email: 'luciana@jobz.com.br', password: 'Jobz2026' });
if (authErr) { console.error('Auth failed:', authErr.message); process.exit(1); }
console.log('Autenticado como Luciana');

// ── 1. Pagamentos da Daniely para quitar Jun/26 e Jul/26 ──────────────────────
// Busca lançamentos da Daniely por competência para calcular horas
const { data: lancsDani } = await supabase
  .from('lancamentos')
  .select('id, horas, competencia')
  .eq('consultor_id', 'c-daniely');

const porComp = {};
for (const l of lancsDani) {
  porComp[l.competencia] = (porComp[l.competencia] || 0) + l.horas;
}
console.log('Horas da Daniely por comp:', porComp);

// Busca pagamentos existentes
const { data: pagsDani } = await supabase
  .from('pagamentos')
  .select('competencia, horas')
  .eq('consultor_id', 'c-daniely');

const pagosComp = {};
for (const p of pagsDani) {
  pagosComp[p.competencia] = (pagosComp[p.competencia] || 0) + p.horas;
}
console.log('Horas já pagas da Daniely:', pagosComp);

// Calcula saldo por competência e cria pagamentos para quitar tudo
const novos = [];
for (const [comp, totalH] of Object.entries(porComp)) {
  const pagas = pagosComp[comp] || 0;
  const saldo = totalH - pagas;
  if (saldo > 0.01) {
    novos.push({
      id: `pag-dani-${comp}-quitado`,
      consultor_id: 'c-daniely',
      projeto_id: null,
      horas: saldo,
      valor_cents: Math.round(saldo * 10000), // R$100/h
      data: '2026-07-18',
      competencia: comp,
      obs: 'Quitação pendente',
    });
  }
}

if (novos.length === 0) {
  console.log('Daniely já não tem pendências!');
} else {
  console.log('Criando pagamentos:', novos.map(p => `${p.competencia}: ${p.horas}h R$${p.valor_cents/100}`));
  const { error } = await supabase.from('pagamentos').upsert(novos, { onConflict: 'id' });
  if (error) { console.error('Erro ao inserir pagamentos:', error.message); process.exit(1); }
  console.log(`✓ Criados ${novos.length} pagamento(s) para Daniely`);
}

// ── 2. Corrigir data dos lançamentos Jul/26 com data em junho ─────────────────
const { data: lancsJul } = await supabase
  .from('lancamentos')
  .select('id, data, competencia')
  .eq('competencia', '2026-07')
  .lt('data', '2026-07-01');

console.log(`\nLançamentos Jul/26 com data em junho: ${lancsJul.length}`);

if (lancsJul.length > 0) {
  for (const l of lancsJul) {
    // Troca mês de 06 para 07 mantendo dia
    const novaData = l.data.replace(/^2026-06/, '2026-07');
    const { error } = await supabase.from('lancamentos').update({ data: novaData }).eq('id', l.id);
    if (error) console.error(`Erro em ${l.id}:`, error.message);
  }
  console.log(`✓ Datas corrigidas de junho para julho nos ${lancsJul.length} lançamentos`);
}

console.log('\nConcluído!');
