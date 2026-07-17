-- JOBZ · Healthcheck Supabase
--
-- Rode no SQL Editor para conferir se as tabelas, RLS e policies existem.

select
  schemaname,
  tablename,
  rowsecurity
from pg_tables
where schemaname = 'public'
  and tablename in (
    'consultores',
    'projetos',
    'parcelas',
    'tarefas',
    'lancamentos',
    'pagamentos',
    'custos',
    'comentarios',
    'categorias_custo'
  )
order by tablename;

select
  schemaname,
  tablename,
  policyname,
  roles,
  cmd
from pg_policies
where schemaname = 'public'
order by tablename, policyname;

select 'consultores' as tabela, count(*) as linhas from consultores
union all select 'projetos', count(*) from projetos
union all select 'tarefas', count(*) from tarefas
union all select 'lancamentos', count(*) from lancamentos
union all select 'pagamentos', count(*) from pagamentos
union all select 'custos', count(*) from custos;
